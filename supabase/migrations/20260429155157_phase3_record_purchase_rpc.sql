-- ============================================================
-- Phase 3 (cont.) — record_purchase RPC
-- Atomic add-an-item: inserts inventory_items + flows(purchase) +
-- flow_purchase_details in one transaction so the cache triggers
-- (quantity, last_unit_cost) settle on a consistent row.
-- ============================================================

create or replace function public.record_purchase(
  p_product_id        uuid,
  p_quantity          numeric,
  p_unit              text,
  p_current_space_id  uuid,
  p_home_space_id     uuid    default null,
  p_category_id       uuid    default null,
  p_min_stock         numeric default null,
  p_expiry_date       date    default null,
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
  v_item_id uuid;
  v_flow_id uuid;
begin
  -- AuthN
  v_user_id := public.current_user_id();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve the caller's most-recent active crew membership.
  select cm.crew_id
    into v_crew_id
  from public.crew_members cm
  where cm.user_id    = v_user_id
    and cm.deleted_at is null
  order by cm.created_at desc
  limit 1;

  if v_crew_id is null then
    raise exception 'No active Crew membership';
  end if;

  -- Validate inputs.
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0';
  end if;
  if not exists (select 1 from public.unit_definitions where unit = p_unit) then
    raise exception 'unit % is not defined', p_unit;
  end if;

  -- Product must be in the master catalog or owned by this crew.
  if not exists (
    select 1
    from public.products p
    where p.product_id  = p_product_id
      and p.deleted_at  is null
      and (p.crew_id is null or p.crew_id = v_crew_id)
  ) then
    raise exception 'Product not accessible';
  end if;

  -- Current space must belong to this crew.
  if not exists (
    select 1
    from public.spaces s
    where s.space_id    = p_current_space_id
      and s.crew_id     = v_crew_id
      and s.deleted_at  is null
  ) then
    raise exception 'Current space not in this Crew';
  end if;

  -- Home space, if set, must also belong to this crew.
  if p_home_space_id is not null and not exists (
    select 1
    from public.spaces s
    where s.space_id    = p_home_space_id
      and s.crew_id     = v_crew_id
      and s.deleted_at  is null
  ) then
    raise exception 'Home space not in this Crew';
  end if;

  -- Category, if set, must be system-global or owned by this crew.
  if p_category_id is not null and not exists (
    select 1
    from public.categories c
    where c.category_id = p_category_id
      and c.deleted_at  is null
      and (c.crew_id is null or c.crew_id = v_crew_id)
  ) then
    raise exception 'Category not accessible';
  end if;

  -- Insert inventory_items with quantity = 0; the flow trigger will
  -- bump the cache to the purchased quantity. Same for last_unit_cost
  -- (set by the purchase-detail trigger).
  insert into public.inventory_items (
    crew_id, product_id, current_space_id, home_space_id,
    quantity, unit, category_id, min_stock, expiry_date, notes, created_by
  )
  values (
    v_crew_id, p_product_id, p_current_space_id, p_home_space_id,
    0, p_unit, p_category_id, p_min_stock, p_expiry_date, p_notes, v_user_id
  )
  returning inventory_item_id into v_item_id;

  -- Purchase flow — trigger increments inventory_items.quantity.
  insert into public.flows (
    crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
  )
  values (
    v_crew_id, v_item_id, 'purchase', p_quantity, p_unit, v_user_id, p_notes
  )
  returning flow_id into v_flow_id;

  -- Purchase detail — trigger caches last_unit_cost when supplied.
  insert into public.flow_purchase_details (flow_id, unit_cost, source)
  values (v_flow_id, p_unit_cost, p_source);

  return v_item_id;
end;
$$;

revoke execute on function public.record_purchase(
  uuid, numeric, text, uuid, uuid, uuid, numeric, date, numeric, text, text
) from public;
grant  execute on function public.record_purchase(
  uuid, numeric, text, uuid, uuid, uuid, numeric, date, numeric, text, text
) to authenticated;
