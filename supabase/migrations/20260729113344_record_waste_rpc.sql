-- ============================================================
-- v1.1 Waste slice — record_waste RPC
-- Atomic waste logging: waste flow (cache trigger decrements) +
-- slim waste_events row + exactly one reason-specific detail row
-- built from the p_details jsonb payload (precedent:
-- bulk_import_inventory's jsonb rows).
--
-- The vault originally planned a `log_waste` edge function; repo
-- precedent (record_purchase / restock / transfer / open_package)
-- is a single-transaction plpgsql RPC — recorded as superseded in
-- Feature 6.
-- ============================================================

create or replace function public.record_waste(
  p_inventory_item_id uuid,
  p_quantity          numeric,
  p_waste_reason      public.waste_reason,
  p_notes             text  default null,
  p_photo_url         text  default null,
  p_details           jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id        text;
  v_crew_id        uuid;
  v_unit           text;
  v_on_hand        numeric;
  v_space_id       uuid;
  v_last_unit_cost numeric;
  v_flow_id        uuid;
  v_event_id       uuid;
  v_total_cost     numeric;
  v_expiry         date;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Lock the row: the on-hand cap must hold when the flow lands.
  select i.crew_id, i.unit, i.quantity, i.current_space_id, i.last_unit_cost
    into v_crew_id, v_unit, v_on_hand, v_space_id, v_last_unit_cost
  from public.inventory_items i
  where i.inventory_item_id = p_inventory_item_id
    and i.deleted_at        is null
  for update;

  if v_crew_id is null then
    raise exception 'Inventory item not found or deleted';
  end if;

  if not public.is_crew_member(v_crew_id) then
    raise exception 'Not a member of this Crew';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  if p_quantity > v_on_hand then
    raise exception 'Cannot waste more than the % % on hand', v_on_hand, v_unit;
  end if;

  -- Waste flow — quantity-cache trigger decrements the cached quantity.
  insert into public.flows (
    crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
  )
  values (
    v_crew_id, p_inventory_item_id, 'waste', p_quantity, v_unit,
    v_user_id, p_notes
  )
  returning flow_id into v_flow_id;

  -- Cost snapshot from the item's last known unit cost. Derived batch
  -- cost for recipe-produced items lands with v1.2.
  v_total_cost := case
    when v_last_unit_cost is null then null
    else round(p_quantity * v_last_unit_cost, 4)
  end;

  insert into public.waste_events (
    flow_id, waste_reason, total_cost, notes, photo_url
  )
  values (v_flow_id, p_waste_reason, v_total_cost, p_notes, p_photo_url)
  returning waste_event_id into v_event_id;

  -- Exactly one reason-specific detail row.
  case p_waste_reason
    when 'expired' then
      v_expiry := (p_details->>'expiry_date')::date;
      if v_expiry is null then
        raise exception 'expired waste requires expiry_date';
      end if;
      insert into public.waste_expired_details (
        waste_event_id, expiry_date, days_past_expiry, space_id, was_opened
      )
      values (
        v_event_id,
        v_expiry,
        greatest(0, current_date - v_expiry),
        coalesce((p_details->>'space_id')::uuid, v_space_id),
        coalesce((p_details->>'was_opened')::boolean, false)
      );
    when 'spoiled' then
      insert into public.waste_spoilage_details (
        waste_event_id, expiry_date, space_id, container_type,
        days_since_opened, storage_conditions
      )
      values (
        v_event_id,
        (p_details->>'expiry_date')::date,
        coalesce((p_details->>'space_id')::uuid, v_space_id),
        nullif(p_details->>'container_type', ''),
        (p_details->>'days_since_opened')::integer,
        nullif(p_details->>'storage_conditions', '')
      );
    when 'damaged' then
      if nullif(p_details->>'how_damaged', '') is null then
        raise exception 'damaged waste requires how_damaged';
      end if;
      insert into public.waste_damage_details (
        waste_event_id, how_damaged, space_id, packaging_issue
      )
      values (
        v_event_id,
        p_details->>'how_damaged',
        coalesce((p_details->>'space_id')::uuid, v_space_id),
        coalesce((p_details->>'packaging_issue')::boolean, false)
      );
    when 'prep_failure' then
      if nullif(p_details->>'what_went_wrong', '') is null then
        raise exception 'prep_failure waste requires what_went_wrong';
      end if;
      insert into public.waste_prep_failure_details (
        waste_event_id, recipe_id, batch_id, what_went_wrong, prepped_by
      )
      values (
        v_event_id,
        (p_details->>'recipe_id')::uuid,
        (p_details->>'batch_id')::uuid,
        p_details->>'what_went_wrong',
        coalesce(nullif(p_details->>'prepped_by', ''), v_user_id)
      );
    when 'spilled' then
      if nullif(p_details->>'how_spilled', '') is null then
        raise exception 'spilled waste requires how_spilled';
      end if;
      insert into public.waste_spill_details (
        waste_event_id, space_id, how_spilled, during_activity
      )
      values (
        v_event_id,
        coalesce((p_details->>'space_id')::uuid, v_space_id),
        p_details->>'how_spilled',
        nullif(p_details->>'during_activity', '')
      );
    when 'other' then
      if nullif(p_details->>'description', '') is null then
        raise exception 'other waste requires a description';
      end if;
      insert into public.waste_other_details (waste_event_id, description)
      values (v_event_id, p_details->>'description');
  end case;

  return v_flow_id;
end;
$$;

revoke execute on function public.record_waste(uuid, numeric, public.waste_reason, text, text, jsonb) from public;
grant  execute on function public.record_waste(uuid, numeric, public.waste_reason, text, text, jsonb) to authenticated;
