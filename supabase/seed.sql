-- =============================================================
-- Demo seed — "Demo Kitchen" crew with spaces, inventory, flows.
--
-- Purpose: give non-prod environments (the staging branch, fresh
-- preview branches, local `supabase db reset`) a populated crew so
-- features render without hand-onboarding. NEVER runs on prod —
-- prod deploys use `supabase db push`, which does not run seeds.
--
-- Idempotent: every row uses a fixed UUID + ON CONFLICT DO NOTHING,
-- so re-running (or re-seeding a branch) never duplicates or
-- double-counts inventory.
--
-- Owner is a dedicated Clerk dev-instance demo user
-- (demo+clerk_test@tenacioustech.app). The repo owner's primary
-- account is added as an admin member so the demo crew is visible
-- on a normal staging login too.
-- =============================================================

-- ── Users (mirror of Clerk subjects) ─────────────────────────
insert into public.users (user_id) values
  ('user_3FBGwBSpx1mbHnfEve5oHaKQTqE'),  -- demo+clerk_test@tenacioustech.app
  ('user_39AHDBcE1XHvxTSRBxInjXAkkXg')   -- djwalker@tenacioustech.net (repo owner)
on conflict (user_id) do nothing;

-- ── Crew ─────────────────────────────────────────────────────
insert into public.crews (crew_id, name, owner_id, created_by) values
  ('d0d0d0d0-0000-4000-8000-000000000001', 'Demo Kitchen',
   'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE')
on conflict (crew_id) do nothing;

-- ── Members ──────────────────────────────────────────────────
-- Ownership is tracked on crews.owner_id; crew_members.role is
-- admin / member / viewer. Both members are admins here.
insert into public.crew_members (crew_member_id, crew_id, user_id, role) values
  ('d0d0d0d0-0000-4000-8000-000000000040', 'd0d0d0d0-0000-4000-8000-000000000001',
   'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', 'admin'),
  ('d0d0d0d0-0000-4000-8000-000000000041', 'd0d0d0d0-0000-4000-8000-000000000001',
   'user_39AHDBcE1XHvxTSRBxInjXAkkXg', 'admin')
on conflict (crew_member_id) do nothing;

-- ── Spaces: premises root + three areas ──────────────────────
insert into public.spaces (space_id, crew_id, parent_id, unit_type, name, created_by) values
  ('d0d0d0d0-0000-4000-8000-000000000010', 'd0d0d0d0-0000-4000-8000-000000000001',
   null, 'premises', 'Demo Kitchen', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE'),
  ('d0d0d0d0-0000-4000-8000-000000000011', 'd0d0d0d0-0000-4000-8000-000000000001',
   'd0d0d0d0-0000-4000-8000-000000000010', 'area', 'Pantry', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE'),
  ('d0d0d0d0-0000-4000-8000-000000000012', 'd0d0d0d0-0000-4000-8000-000000000001',
   'd0d0d0d0-0000-4000-8000-000000000010', 'area', 'Refrigerator', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE'),
  ('d0d0d0d0-0000-4000-8000-000000000013', 'd0d0d0d0-0000-4000-8000-000000000001',
   'd0d0d0d0-0000-4000-8000-000000000010', 'area', 'Freezer', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE')
on conflict (space_id) do nothing;

-- ── Inventory items + opening-purchase flows ─────────────────
-- Items start at quantity 0; the purchase flow's AFTER-INSERT
-- trigger (flow_quantity_cache_trigger) sets the cached quantity.
-- Products/categories are referenced by the global catalog.
do $$
declare
  v_crew    uuid := 'd0d0d0d0-0000-4000-8000-000000000001';
  v_user    text := 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE';
  -- name, brand, space_id, qty, unit_cost
  r record;
  v_pid uuid;
  v_cat uuid;
begin
  for r in
    select * from (values
      ('Coarse Kosher Salt',        'Good & Gather', 'd0d0d0d0-0000-4000-8000-000000000011', 2::numeric, 3.99::numeric, 'd0d0d0d0-0000-4000-8000-000000000020', 'd0d0d0d0-0000-4000-8000-000000000030'),
      ('90 Second Jasmine Rice',    'Good & Gather', 'd0d0d0d0-0000-4000-8000-000000000011', 6, 1.89, 'd0d0d0d0-0000-4000-8000-000000000021', 'd0d0d0d0-0000-4000-8000-000000000031'),
      ('Apple Cider Vinegar',       'Good & Gather', 'd0d0d0d0-0000-4000-8000-000000000011', 1, 2.49, 'd0d0d0d0-0000-4000-8000-000000000022', 'd0d0d0d0-0000-4000-8000-000000000032'),
      ('Coarse Black Pepper',       'Good & Gather', 'd0d0d0d0-0000-4000-8000-000000000011', 1, 4.29, 'd0d0d0d0-0000-4000-8000-000000000023', 'd0d0d0d0-0000-4000-8000-000000000033'),
      ('Craisins Dried Cranberries 50% Less Sugar', 'Ocean Spray', 'd0d0d0d0-0000-4000-8000-000000000012', 3, 3.29, 'd0d0d0d0-0000-4000-8000-000000000024', 'd0d0d0d0-0000-4000-8000-000000000034'),
      ('90 Second Whole Grain Brown Rice', 'Good & Gather', 'd0d0d0d0-0000-4000-8000-000000000013', 4, 1.89, 'd0d0d0d0-0000-4000-8000-000000000025', 'd0d0d0d0-0000-4000-8000-000000000035')
    ) as t(name, brand, space_id, qty, unit_cost, item_id, flow_id)
  loop
    select product_id, default_category_id into v_pid, v_cat
      from public.products
     where crew_id is null and name = r.name and brand = r.brand and deleted_at is null
     limit 1;
    if v_pid is null then continue; end if;

    insert into public.inventory_items
      (inventory_item_id, crew_id, product_id, current_space_id, home_space_id,
       unit, category_id, last_unit_cost, created_by)
    values
      (r.item_id::uuid, v_crew, v_pid, r.space_id::uuid, r.space_id::uuid,
       'count', v_cat, r.unit_cost, v_user)
    on conflict (inventory_item_id) do nothing;

    insert into public.flows
      (flow_id, crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes)
    values
      (r.flow_id::uuid, v_crew, r.item_id::uuid, 'purchase', r.qty, 'count', v_user, 'Demo seed opening stock')
    on conflict (flow_id) do nothing;

    insert into public.flow_purchase_details (flow_id, unit_cost, source)
    values (r.flow_id::uuid, r.unit_cost, 'Demo seed')
    on conflict (flow_id) do nothing;
  end loop;
end $$;

-- ── Demo package: a soda variety 12-pack (Feature 12) ────────
-- A crew-private package Product (4 Coke / 4 Sprite / 4 Fanta) plus a
-- sealed inventory item so the Opening-a-Package journey is demoable
-- out of the box. Opening it breaks the pack into its three child sodas.
insert into public.products (product_id, crew_id, name, brand, source, created_by, is_package) values
  ('d0d0d0d0-0000-4000-8000-000000000050', 'd0d0d0d0-0000-4000-8000-000000000001',
   'Soda Variety 12-pack', 'Demo Co', 'crew_created', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', true),
  ('d0d0d0d0-0000-4000-8000-000000000051', 'd0d0d0d0-0000-4000-8000-000000000001',
   'Coke 12oz can', 'Coca-Cola', 'crew_created', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', false),
  ('d0d0d0d0-0000-4000-8000-000000000052', 'd0d0d0d0-0000-4000-8000-000000000001',
   'Sprite 12oz can', 'Coca-Cola', 'crew_created', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', false),
  ('d0d0d0d0-0000-4000-8000-000000000053', 'd0d0d0d0-0000-4000-8000-000000000001',
   'Fanta 12oz can', 'Coca-Cola', 'crew_created', 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', false)
on conflict (product_id) do nothing;

insert into public.product_components
  (component_id, package_product_id, component_product_id, quantity, unit, sort_order) values
  ('d0d0d0d0-0000-4000-8000-000000000060', 'd0d0d0d0-0000-4000-8000-000000000050',
   'd0d0d0d0-0000-4000-8000-000000000051', 4, 'count', 0),
  ('d0d0d0d0-0000-4000-8000-000000000061', 'd0d0d0d0-0000-4000-8000-000000000050',
   'd0d0d0d0-0000-4000-8000-000000000052', 4, 'count', 1),
  ('d0d0d0d0-0000-4000-8000-000000000062', 'd0d0d0d0-0000-4000-8000-000000000050',
   'd0d0d0d0-0000-4000-8000-000000000053', 4, 'count', 2)
on conflict (component_id) do nothing;

-- Sealed stock: 3 packs at $12/pack in the Pantry.
insert into public.inventory_items
  (inventory_item_id, crew_id, product_id, current_space_id, home_space_id,
   unit, last_unit_cost, created_by)
values
  ('d0d0d0d0-0000-4000-8000-000000000055', 'd0d0d0d0-0000-4000-8000-000000000001',
   'd0d0d0d0-0000-4000-8000-000000000050', 'd0d0d0d0-0000-4000-8000-000000000011',
   'd0d0d0d0-0000-4000-8000-000000000011', 'pkg', 12.00, 'user_3FBGwBSpx1mbHnfEve5oHaKQTqE')
on conflict (inventory_item_id) do nothing;

insert into public.flows
  (flow_id, crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes)
values
  ('d0d0d0d0-0000-4000-8000-000000000065', 'd0d0d0d0-0000-4000-8000-000000000001',
   'd0d0d0d0-0000-4000-8000-000000000055', 'purchase', 3, 'pkg',
   'user_3FBGwBSpx1mbHnfEve5oHaKQTqE', 'Demo seed sealed packs')
on conflict (flow_id) do nothing;

insert into public.flow_purchase_details (flow_id, unit_cost, source)
values ('d0d0d0d0-0000-4000-8000-000000000065', 12.00, 'Demo seed')
on conflict (flow_id) do nothing;
