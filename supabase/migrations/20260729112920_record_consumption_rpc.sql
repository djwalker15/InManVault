-- ============================================================
-- Checking Stock "Use it" action — record_consumption RPC
-- Appends a consumption flow for an inventory item. Consumption
-- flows have no child detail table (docs/entities/Flow.md — no
-- extra fields needed); the quantity-cache trigger decrements the
-- cached quantity.
-- ============================================================

create or replace function public.record_consumption(
  p_inventory_item_id uuid,
  p_quantity          numeric,
  p_notes             text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id  text;
  v_crew_id  uuid;
  v_unit     text;
  v_on_hand  numeric;
  v_flow_id  uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Lock the row: the on-hand check below must hold when the flow
  -- lands, or two concurrent uses could drive the cache negative.
  select i.crew_id, i.unit, i.quantity
    into v_crew_id, v_unit, v_on_hand
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
    raise exception 'Cannot use more than the % % on hand', v_on_hand, v_unit;
  end if;

  -- Append the consumption flow. Trigger decrements the cached quantity.
  insert into public.flows (
    crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
  )
  values (
    v_crew_id, p_inventory_item_id, 'consumption', p_quantity, v_unit,
    v_user_id, p_notes
  )
  returning flow_id into v_flow_id;

  return v_flow_id;
end;
$$;

revoke execute on function public.record_consumption(uuid, numeric, text) from public;
grant  execute on function public.record_consumption(uuid, numeric, text) to authenticated;
