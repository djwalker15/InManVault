-- ============================================================
-- Inventory Audit (first slice) — record_adjustment RPC
-- Atomic physical-count correction for one inventory_item: appends
-- an adjustment flow + flow_adjustment_details. The existing
-- flow_adjustment_apply trigger settles the cached quantity from
-- actual - expected (the quantity cache trigger deliberately
-- ignores adjustment flows).
--
-- flows.quantity is checked >= 0, so the flow row stores the
-- ABSOLUTE delta; direction lives in the detail row
-- (actual_quantity - expected_quantity).
--
-- Also adds flow_adjustment_details.audit_session_id for parity
-- with the FlowAdjustmentDetail entity note. Always null from the
-- single-item inline action; the full Inventory Audit journey will
-- populate it.
-- ============================================================

alter table public.flow_adjustment_details
  add column audit_session_id text null;

create or replace function public.record_adjustment(
  p_inventory_item_id uuid,
  p_actual_quantity   numeric,
  p_reason            text default null,
  p_notes             text default null,
  p_audit_session_id  text default null
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
  v_expected numeric;
  v_delta    numeric;
  v_flow_id  uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Lock the row: v_expected feeds the delta, so a concurrent flow
  -- between read and insert would corrupt the correction.
  select i.crew_id, i.unit, i.quantity
    into v_crew_id, v_unit, v_expected
  from public.inventory_items i
  where i.inventory_item_id = p_inventory_item_id
    and i.deleted_at        is null
  for update;

  if v_crew_id is null then
    raise exception 'Inventory item not found or deleted';
  end if;

  -- Same gate as the flow_adjustment_details_insert policy: the
  -- definer function bypasses RLS, so enforce it explicitly.
  if not public.is_crew_admin_or_owner(v_crew_id) then
    raise exception 'Only crew admins or the owner can adjust counts';
  end if;

  if p_actual_quantity is null or p_actual_quantity < 0 then
    raise exception 'actual quantity must be >= 0';
  end if;

  v_delta := p_actual_quantity - v_expected;
  if v_delta = 0 then
    raise exception 'Count already matches — nothing to adjust';
  end if;

  insert into public.flows (
    crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
  )
  values (
    v_crew_id, p_inventory_item_id, 'adjustment', abs(v_delta), v_unit,
    v_user_id, p_notes
  )
  returning flow_id into v_flow_id;

  -- flow_adjustment_apply trigger updates the cached quantity.
  insert into public.flow_adjustment_details (
    flow_id, adjustment_type, expected_quantity, actual_quantity,
    reason, audit_session_id
  )
  values (
    v_flow_id, 'physical_count', v_expected, p_actual_quantity,
    p_reason, p_audit_session_id
  );

  return v_flow_id;
end;
$$;

revoke execute on function public.record_adjustment(uuid, numeric, text, text, text) from public;
grant  execute on function public.record_adjustment(uuid, numeric, text, text, text) to authenticated;
