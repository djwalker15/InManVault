-- ============================================================
-- Phase 3 (cont.) — restock_inventory RPC
-- Atomic restock of an EXISTING inventory_item: appends a purchase
-- flow + flow_purchase_details. Quantity-cache and last_unit_cost
-- triggers settle the cached values on the parent row.
-- ============================================================

create or replace function public.restock_inventory(
  p_inventory_item_id uuid,
  p_quantity          numeric,
  p_unit_cost         numeric default null,
  p_notes             text    default null,
  p_source            text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id text;
  v_crew_id uuid;
  v_unit    text;
  v_flow_id uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- The item must exist, be live, and belong to a Crew the caller is in.
  select i.crew_id, i.unit
    into v_crew_id, v_unit
  from public.inventory_items i
  where i.inventory_item_id = p_inventory_item_id
    and i.deleted_at        is null;

  if v_crew_id is null then
    raise exception 'Inventory item not found or deleted';
  end if;

  if not public.is_crew_member(v_crew_id) then
    raise exception 'Not a member of this Crew';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;

  -- Append the purchase flow. Trigger increments the cached quantity.
  insert into public.flows (
    crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
  )
  values (
    v_crew_id, p_inventory_item_id, 'purchase', p_quantity, v_unit, v_user_id, p_notes
  )
  returning flow_id into v_flow_id;

  -- Detail row — trigger caches last_unit_cost when supplied.
  insert into public.flow_purchase_details (flow_id, unit_cost, source)
  values (v_flow_id, p_unit_cost, p_source);

  return v_flow_id;
end;
$$;

revoke execute on function public.restock_inventory(uuid, numeric, numeric, text, text) from public;
grant  execute on function public.restock_inventory(uuid, numeric, numeric, text, text) to authenticated;
