-- ============================================================
-- Removing an Inventory Item — soft_delete_inventory_item RPC
--
-- A client-side `update inventory_items set deleted_at = now()`
-- trips the RLS SELECT-on-new-row trap (the select policy filters
-- deleted_at is null, so the just-deleted row is invisible and the
-- update reports an RLS violation) — same rationale as
-- cascade_soft_delete_spaces. SECURITY DEFINER RPC instead,
-- admin/owner-gated to match the inventory_items delete policy.
--
-- Ledger consistency: if the cached quantity isn't 0, a zero-out
-- adjustment (flow + flow_adjustment_details) is written first, so
-- the flow sum for the item is 0 at deletion and reconciliation
-- never flags the tombstone. Flow history is untouched and stays
-- queryable for reporting.
-- ============================================================

create or replace function public.soft_delete_inventory_item(
  p_inventory_item_id uuid,
  p_reason            text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id text;
  v_crew_id uuid;
  v_unit    text;
  v_qty     numeric;
  v_flow_id uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select i.crew_id, i.unit, i.quantity
    into v_crew_id, v_unit, v_qty
  from public.inventory_items i
  where i.inventory_item_id = p_inventory_item_id
    and i.deleted_at        is null
  for update;

  if v_crew_id is null then
    raise exception 'Inventory item not found or deleted';
  end if;

  if not public.is_crew_admin_or_owner(v_crew_id) then
    raise exception 'Only crew admins or the owner can remove items';
  end if;

  -- Zero out any remaining quantity on the ledger before tombstoning.
  if v_qty <> 0 then
    insert into public.flows (
      crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
    )
    values (
      v_crew_id, p_inventory_item_id, 'adjustment', abs(v_qty), v_unit,
      v_user_id, p_reason
    )
    returning flow_id into v_flow_id;

    insert into public.flow_adjustment_details (
      flow_id, adjustment_type, expected_quantity, actual_quantity, reason
    )
    values (
      v_flow_id, 'physical_count', v_qty, 0,
      coalesce(p_reason, 'Item removed from tracking')
    );
  end if;

  update public.inventory_items
  set deleted_at = now()
  where inventory_item_id = p_inventory_item_id;
end;
$$;

revoke execute on function public.soft_delete_inventory_item(uuid, text) from public;
grant  execute on function public.soft_delete_inventory_item(uuid, text) to authenticated;
