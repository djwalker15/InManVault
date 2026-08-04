-- ============================================================
-- Explicit-crew RPCs — stop guessing the caller's crew.
--
-- record_purchase and apply_space_template resolved the caller's crew
-- as the most-recent active crew_members row. That guess diverges from
-- the frontend's active-crew preference (localStorage) for any
-- multi-crew user whose pinned crew isn't their newest membership:
-- the UI creates rows (e.g. products) under the active crew, then the
-- RPC validates them against the guessed crew and fails with
-- "Product not accessible".
--
-- New rule:
--   * creation RPCs take an explicit p_crew_id, validated with the
--     membership helpers (the bulk_import_inventory pattern);
--   * item-scoped RPCs derive the crew from the target row
--     (the restock_inventory pattern) — open_package below.
-- ============================================================

-- ------------------------------------------------------------
-- record_purchase: signature change (adds required p_crew_id),
-- so drop + recreate + re-grant.
-- ------------------------------------------------------------
drop function if exists public.record_purchase(
  uuid, numeric, text, uuid, uuid, uuid, numeric, date, numeric, text, text
);

create function public.record_purchase(
  p_crew_id           uuid,
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

  -- The client says which crew it is operating in; we only verify
  -- membership (no active-crew guessing).
  if p_crew_id is null or not public.is_crew_member(p_crew_id) then
    raise exception 'Not a member of this Crew';
  end if;
  v_crew_id := p_crew_id;

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
  uuid, uuid, numeric, text, uuid, uuid, uuid, numeric, date, numeric, text, text
) from public;
grant  execute on function public.record_purchase(
  uuid, uuid, numeric, text, uuid, uuid, uuid, numeric, date, numeric, text, text
) to authenticated;

-- ------------------------------------------------------------
-- apply_space_template: signature change (adds required p_crew_id),
-- so drop + recreate + re-grant. Keeps the Owner/Admin gate.
-- The _stamp_template_tree helper is unchanged.
-- ------------------------------------------------------------
drop function if exists public.apply_space_template(uuid, text);

create function public.apply_space_template(
  p_template_id uuid,
  p_crew_id     uuid,
  p_mode        text default 'merge'
)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   text;
  v_crew_id   uuid;
  v_premises  uuid;
  v_template  jsonb;
  v_inserted  int := 0;
begin
  if p_mode not in ('merge', 'replace') then
    raise exception 'p_mode must be ''merge'' or ''replace''';
  end if;

  v_user_id := public.current_user_id();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Explicit crew from the client + Owner/Admin gate.
  if p_crew_id is null or not public.is_crew_admin_or_owner(p_crew_id) then
    raise exception 'No active Crew membership with admin/owner role';
  end if;
  v_crew_id := p_crew_id;

  -- Pick the most-recently-created Premises for this crew.
  select s.space_id
    into v_premises
  from public.spaces s
  where s.crew_id    = v_crew_id
    and s.parent_id  is null
    and s.deleted_at is null
  order by s.created_at desc
  limit 1;

  if v_premises is null then
    raise exception 'Create a Premises before applying a template';
  end if;

  -- Pull the template (system-global or owned by the caller's crew).
  select t.template_data
    into v_template
  from public.space_templates t
  where t.template_id = p_template_id
    and t.deleted_at  is null
    and (t.crew_id    is null or t.crew_id = v_crew_id)
  limit 1;

  if v_template is null then
    raise exception 'Template not found';
  end if;

  -- Replace: soft-delete every non-Premises space under the active premises.
  if p_mode = 'replace' then
    update public.spaces
    set deleted_at = now()
    where crew_id    = v_crew_id
      and parent_id is not null
      and deleted_at is null;
  end if;

  -- Walk the tree depth-first, inserting a space row for each node.
  v_inserted := public._stamp_template_tree(
    v_crew_id,
    v_user_id,
    v_premises,
    v_template,
    p_mode
  );

  return v_inserted;
end;
$$;

revoke execute on function public.apply_space_template(uuid, uuid, text) from public;
grant  execute on function public.apply_space_template(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- open_package: same signature, but the crew is now derived from the
-- package item itself (restock_inventory pattern) instead of guessed
-- from the caller's newest membership. One error message for both
-- not-found and not-a-member so existence doesn't leak across crews.
-- ------------------------------------------------------------
create or replace function public.open_package(
  p_package_item_id  uuid,
  p_quantity_opened  numeric,
  p_target_space_id  uuid  default null,
  p_cost_overrides   jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id        text;
  v_crew_id        uuid;
  v_pkg_product    uuid;
  v_pkg_space      uuid;
  v_pkg_qty        numeric;
  v_pkg_unit       text;
  v_pkg_cost_each  numeric;
  v_pkg_cost       numeric;   -- total cost released = cost_each × packs
  v_target_space   uuid;
  v_event_id       uuid;
  v_break_flow     uuid;
  v_yield_flow     uuid;

  v_num_lines      int;
  v_total_units    numeric;   -- meaningful only when all components are 'count'
  v_all_count      boolean;
  v_unit_default   numeric;   -- per individual count unit (all-count path)
  v_line_default   numeric;   -- per component line (mixed path)
  v_allocated_tot  numeric := 0;

  c                record;
  v_child_qty      numeric;   -- produced, in the component's unit
  v_alloc          numeric;   -- allocated cost per component unit
  v_override       numeric;
  v_existing_id    uuid;
  v_existing_unit  text;
  v_from_cat       text;
  v_to_cat         text;
  v_from_factor    numeric;
  v_to_factor      numeric;
  v_target_item    uuid;
  v_flow_unit      text;
  v_flow_qty       numeric;
  v_stored_cost    numeric;   -- allocated cost expressed in the flow's stored unit
begin
  -- AuthN
  v_user_id := public.current_user_id();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_quantity_opened is null or p_quantity_opened <= 0 then
    raise exception 'quantity_opened must be > 0';
  end if;

  -- Lock the package item to serialize concurrent breaks on the same
  -- pack, and take the crew from the item row itself.
  select ii.crew_id, ii.product_id, ii.current_space_id, ii.quantity, ii.unit, ii.last_unit_cost
    into v_crew_id, v_pkg_product, v_pkg_space, v_pkg_qty, v_pkg_unit, v_pkg_cost_each
  from public.inventory_items ii
  where ii.inventory_item_id = p_package_item_id
    and ii.deleted_at is null
  for update;

  if v_crew_id is null or not public.is_crew_member(v_crew_id) then
    raise exception 'Package item not found in this Crew';
  end if;

  if p_quantity_opened > v_pkg_qty then
    raise exception 'Only % sealed pack(s) available to open', v_pkg_qty;
  end if;

  -- The product must actually be a package (have active composition rows).
  if not exists (
    select 1 from public.product_components pc
    where pc.package_product_id = v_pkg_product
      and pc.deleted_at is null
  ) then
    raise exception 'Product is not a package (no active components)';
  end if;

  -- Resolve the target space for the children; default to the pack's space.
  v_target_space := coalesce(p_target_space_id, v_pkg_space);
  if not exists (
    select 1 from public.spaces s
    where s.space_id   = v_target_space
      and s.crew_id    = v_crew_id
      and s.deleted_at is null
  ) then
    raise exception 'Target space not in this Crew';
  end if;

  -- Cost to distribute and the default-allocation shape.
  v_pkg_cost := coalesce(v_pkg_cost_each, 0) * p_quantity_opened;

  select count(*),
         sum(pc.quantity) * p_quantity_opened,
         bool_and(ud.unit_category = 'count')
    into v_num_lines, v_total_units, v_all_count
  from public.product_components pc
  join public.unit_definitions ud on ud.unit = pc.unit
  where pc.package_product_id = v_pkg_product
    and pc.deleted_at is null;

  v_unit_default := case when coalesce(v_total_units, 0) > 0 then v_pkg_cost / v_total_units else 0 end;
  v_line_default := case when v_num_lines > 0 then v_pkg_cost / v_num_lines else 0 end;

  -- Break event header (must exist before any detail rows FK to it).
  insert into public.package_break_events (
    crew_id, package_inventory_item_id, package_product_id,
    quantity_opened, performed_by
  )
  values (
    v_crew_id, p_package_item_id, v_pkg_product,
    p_quantity_opened, v_user_id
  )
  returning break_event_id into v_event_id;

  -- Package out-leg: cache trigger decrements the sealed quantity.
  insert into public.flows (
    crew_id, inventory_item_id, flow_type, quantity, unit, performed_by
  )
  values (
    v_crew_id, p_package_item_id, 'package_break', p_quantity_opened, v_pkg_unit, v_user_id
  )
  returning flow_id into v_break_flow;

  insert into public.flow_package_break_details (
    flow_id, break_event_id, role, component_product_id, allocated_unit_cost
  )
  values (v_break_flow, v_event_id, 'package', null, v_pkg_cost);

  -- Child in-legs, one per active component.
  for c in
    select pc.component_product_id, pc.quantity, pc.unit
    from public.product_components pc
    where pc.package_product_id = v_pkg_product
      and pc.deleted_at is null
    order by pc.sort_order, pc.created_at
  loop
    v_child_qty := c.quantity * p_quantity_opened;  -- in the component's unit

    -- Allocated cost per component unit: explicit override, else the
    -- category-aware default (per-unit for all-count, per-line otherwise).
    v_override := null;
    if p_cost_overrides is not null
       and p_cost_overrides ? c.component_product_id::text then
      v_override := (p_cost_overrides ->> c.component_product_id::text)::numeric;
    end if;

    if v_override is not null then
      v_alloc := v_override;
    elsif v_all_count then
      v_alloc := v_unit_default;
    else
      v_alloc := case when v_child_qty > 0 then v_line_default / v_child_qty else 0 end;
    end if;

    v_allocated_tot := v_allocated_tot + (v_alloc * v_child_qty);

    -- Resolve target: an existing active item for this product in the
    -- target space → merge (within-category convert); else create-new.
    select ii.inventory_item_id, ii.unit
      into v_existing_id, v_existing_unit
    from public.inventory_items ii
    where ii.crew_id          = v_crew_id
      and ii.product_id       = c.component_product_id
      and ii.current_space_id = v_target_space
      and ii.deleted_at       is null
    order by ii.created_at
    limit 1;

    v_from_cat := null;
    if v_existing_id is not null then
      select uf.unit_category, uf.to_base_factor, ut.unit_category, ut.to_base_factor
        into v_from_cat, v_from_factor, v_to_cat, v_to_factor
      from public.unit_definitions uf, public.unit_definitions ut
      where uf.unit = c.unit and ut.unit = v_existing_unit;
    end if;

    if v_existing_id is not null and v_from_cat = v_to_cat then
      -- Merge: convert the produced qty and per-unit cost into the
      -- existing item's unit (conserves the line total).
      v_target_item := v_existing_id;
      v_flow_unit   := v_existing_unit;
      v_flow_qty    := v_child_qty * v_from_factor / v_to_factor;
      v_stored_cost := v_alloc * v_to_factor / v_from_factor;
    else
      -- Create-new (no existing item, or a cross-category mismatch that
      -- can't be safely converted) in the component's own unit.
      insert into public.inventory_items (
        crew_id, product_id, current_space_id, home_space_id,
        quantity, unit, created_by
      )
      values (
        v_crew_id, c.component_product_id, v_target_space, null,
        0, c.unit, v_user_id
      )
      returning inventory_item_id into v_target_item;

      v_flow_unit   := c.unit;
      v_flow_qty    := v_child_qty;
      v_stored_cost := v_alloc;
    end if;

    -- Yield flow: cache trigger increments the child quantity.
    insert into public.flows (
      crew_id, inventory_item_id, flow_type, quantity, unit, performed_by
    )
    values (
      v_crew_id, v_target_item, 'package_yield', v_flow_qty, v_flow_unit, v_user_id
    )
    returning flow_id into v_yield_flow;

    insert into public.flow_package_break_details (
      flow_id, break_event_id, role, component_product_id, allocated_unit_cost
    )
    values (v_yield_flow, v_event_id, 'component', c.component_product_id, v_stored_cost);

    -- Child cost cache (separate path from the purchase-cost trigger).
    update public.inventory_items
    set last_unit_cost = v_stored_cost
    where inventory_item_id = v_target_item;
  end loop;

  -- Conservation: the sum allocated to children must equal the package
  -- cost released. Tolerance absorbs numeric-division artifacts in the
  -- default split; overrides are reconciled to the cent by the UI.
  if abs(v_allocated_tot - v_pkg_cost) > 0.01 then
    raise exception 'Cost allocation (%) must equal package cost released (%)',
      v_allocated_tot, v_pkg_cost;
  end if;

  return v_event_id;
end;
$$;

revoke execute on function public.open_package(uuid, numeric, uuid, jsonb) from public;
grant  execute on function public.open_package(uuid, numeric, uuid, jsonb) to authenticated;
