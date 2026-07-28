-- =============================================================
-- Seed profile: bulk — N random inventory items for the Demo
-- Kitchen crew, for pagination / perf / list-rendering testing.
--
-- Applied LOCALLY by scripts/dev-stack.sh (--seed …,bulk). Volume
-- is set via --seed-items N → psql var :n → GUC app.seed_n.
--
-- Self-contained: idempotently ensures the demo user / crew / a
-- "Bulk Storage" space, then inserts N items + opening-purchase
-- flows. Item/flow rows use a 'b01c…' UUID prefix derived from the
-- loop index + ON CONFLICT DO NOTHING, so re-running never double-
-- counts. Quantities are set by the flow trigger, never directly.
--
-- See supabase/seeds/README.md for the authoring conventions.
-- =============================================================

-- Honor --seed-items; default to 50 for manual psql runs.
\if :{?n}
\else
  \set n 50
\endif
select set_config('app.seed_n', :'n', false);

-- ── Ensure the demo crew skeleton (mirrors supabase/seed.sql; safe
--    to run even after --seed none, where the demo crew is absent) ──
insert into public.users (user_id) values
  ('user_3FBGwBSpx1mbHnfEve5oHaKQTqE')
on conflict (user_id) do nothing;

insert into public.crews (crew_id, name, owner_id, created_by) values
  ('d0d0d0d0-0000-4000-8000-000000000001', 'Demo Kitchen',
   'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE')
on conflict (crew_id) do nothing;

insert into public.crew_members (crew_member_id, crew_id, user_id, role) values
  ('d0d0d0d0-0000-4000-8000-000000000040', 'd0d0d0d0-0000-4000-8000-000000000001',
   'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', 'admin')
on conflict (crew_member_id) do nothing;

-- Premises root (reuse demo's) + a dedicated Bulk Storage area.
insert into public.spaces (space_id, crew_id, parent_id, unit_type, name, created_by) values
  ('d0d0d0d0-0000-4000-8000-000000000010', 'd0d0d0d0-0000-4000-8000-000000000001',
   null, 'premises', 'Demo Kitchen', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE'),
  ('b01c0000-0000-4000-8000-000000000001', 'd0d0d0d0-0000-4000-8000-000000000001',
   'd0d0d0d0-0000-4000-8000-000000000010', 'area', 'Bulk Storage', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE')
on conflict (space_id) do nothing;

-- ── Generate N items, each tied to a random global-catalog product ──
do $$
declare
  v_crew  uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
  v_space uuid := 'b01c0000-0000-4000-8000-000000000001';
  v_user  text := 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE';
  v_n     int  := current_setting('app.seed_n')::int;
  v_pid   uuid;
  v_cat   uuid;
  v_qty   numeric;
  v_cost  numeric;
  v_item  uuid;
  v_flow  uuid;
  i       int;
begin
  if v_n <= 0 then
    raise notice 'bulk seed: seed-items=% — nothing to insert', v_n;
    return;
  end if;
  if not exists (select 1 from public.products where crew_id is null and deleted_at is null) then
    raise exception 'bulk seed: global product catalog is empty — run migrations first';
  end if;

  for i in 1..v_n loop
    -- Random catalog product (with a category so the item is valid).
    select product_id, default_category_id
      into v_pid, v_cat
      from public.products
     where crew_id is null and deleted_at is null and default_category_id is not null
     order by random()
     limit 1;
    continue when v_pid is null;

    v_item := ('b01c0001-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid;
    v_flow := ('b01c0002-0000-4000-8000-' || lpad(to_hex(i), 12, '0'))::uuid;
    v_qty  := (1 + floor(random() * 24))::numeric;          -- 1..25
    v_cost := round((0.50 + random() * 19.50)::numeric, 2); -- 0.50..20.00

    insert into public.inventory_items
      (inventory_item_id, crew_id, product_id, current_space_id, home_space_id,
       unit, category_id, last_unit_cost, created_by)
    values
      (v_item, v_crew, v_pid, v_space, v_space, 'count', v_cat, v_cost, v_user)
    on conflict (inventory_item_id) do nothing;

    insert into public.flows
      (flow_id, crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes)
    values
      (v_flow, v_crew, v_item, 'purchase', v_qty, 'count', v_user, 'Bulk seed opening stock')
    on conflict (flow_id) do nothing;

    insert into public.flow_purchase_details (flow_id, unit_cost, source)
    values (v_flow, v_cost, 'Bulk seed')
    on conflict (flow_id) do nothing;
  end loop;

  raise notice 'bulk seed: ensured % items in Demo Kitchen / Bulk Storage', v_n;
end $$;
