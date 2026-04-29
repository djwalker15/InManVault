-- ============================================================
-- Phase 3 — inventory slice
-- ----------------------------------------------------------------
-- New enums:
--   unit_category, flow_type
-- New tables:
--   unit_definitions (immutable, system-seeded)
--   categories       (mutable, nullable crew_id, soft delete)
--   products         (mutable, nullable crew_id, soft delete)
--   inventory_items  (mutable, crew-scoped, cached quantity)
--   flows            (immutable ledger — base table)
--   flow_purchase_details  (immutable child)
--   flow_transfer_details  (immutable child)
--   flow_adjustment_details(immutable child)
-- New triggers:
--   flow_quantity_cache_trigger — updates inventory_items.quantity on
--     flow insert based on flow_type
--   flow_transfer_apply_trigger — updates inventory_items.current_space_id
--     when a flow_transfer_details row lands
--   flow_immutable_trigger / detail equivalents — reject UPDATE/DELETE
-- Seeds:
--   12 unit_definitions (g/kg/oz/lbs, ml/L/tsp/tbsp/cup/fl_oz, count/pkg)
--   6 system categories  (Pantry, Refrigerated, Frozen, Spices, Beverages, Other)
--
-- Deferred to later phases (intentionally NOT in this migration):
--   product_groups, product_submissions  — Phase 3+ recipes / curation
--   flow_prep_usage_details              — Phase 3+ batching
--   batch_events / batch_inputs / batch_outputs — Phase 3+ batching
--   waste_events + waste detail tables   — Phase 4 waste journey
--   intake_sessions / intake_session_items — Phase 4 intake journey
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- pg_trgm powers the products.name trigram index used for fuzzy search
-- in the Add Inventory product-resolution screen (P3.3).
-- ------------------------------------------------------------
create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.unit_category as enum ('weight', 'volume', 'count');

create type public.flow_type as enum (
  'purchase',
  'waste',
  'consumption',
  'transfer',
  'prep_usage',
  'batch_output',
  'adjustment'
);

create type public.adjustment_kind as enum (
  'cache_correction',
  'physical_count'
);

-- ------------------------------------------------------------
-- unit_definitions: immutable reference table, system-seeded
-- ------------------------------------------------------------
create table public.unit_definitions (
  unit            text  primary key,
  unit_category   public.unit_category not null,
  base_unit       text  not null,
  to_base_factor  numeric not null check (to_base_factor > 0),
  created_at      timestamptz not null default now()
);

alter table public.unit_definitions enable row level security;

-- Anyone authenticated can read; nobody (at the policy level) can write.
-- Seed inserts run as definer/service-role here in the migration.
create policy unit_definitions_select
on public.unit_definitions
for select
to authenticated
using (true);

insert into public.unit_definitions (unit, unit_category, base_unit, to_base_factor) values
  ('g',     'weight', 'g',  1),
  ('kg',    'weight', 'g',  1000),
  ('oz',    'weight', 'g',  28.3495),
  ('lbs',   'weight', 'g',  453.592),
  ('ml',    'volume', 'ml', 1),
  ('L',     'volume', 'ml', 1000),
  ('tsp',   'volume', 'ml', 4.929),
  ('tbsp',  'volume', 'ml', 14.787),
  ('cup',   'volume', 'ml', 236.588),
  ('fl_oz', 'volume', 'ml', 29.574),
  ('count', 'count',  'count', 1),
  ('pkg',   'count',  'count', 1);

-- ------------------------------------------------------------
-- categories: nullable crew_id (NULL = system default)
-- ------------------------------------------------------------
create table public.categories (
  category_id  uuid        primary key default gen_random_uuid(),
  crew_id      uuid        null     references public.crews(crew_id),
  name         text        not null check (length(name) between 1 and 80),
  description  text        null,
  created_by   text        null     references public.users(user_id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz null,
  -- A given crew can only have one category by name; system categories are
  -- partial-unique on the global namespace.
  constraint categories_name_unique unique nulls not distinct (crew_id, name)
);

create index categories_crew_idx
  on public.categories (crew_id)
  where deleted_at is null;

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy categories_select
on public.categories
for select
to authenticated
using (
  deleted_at is null
  and (crew_id is null or public.is_crew_member(crew_id))
);

create policy categories_insert
on public.categories
for insert
to authenticated
with check (
  crew_id is not null
  and public.is_crew_admin_or_owner(crew_id)
);

create policy categories_update
on public.categories
for update
to authenticated
using (
  crew_id is not null
  and public.is_crew_admin_or_owner(crew_id)
)
with check (
  crew_id is not null
  and public.is_crew_admin_or_owner(crew_id)
);

create policy categories_delete
on public.categories
for delete
to authenticated
using (
  crew_id is not null
  and public.is_crew_admin_or_owner(crew_id)
);

-- Seed 6 system categories.
insert into public.categories (crew_id, name, description) values
  (null, 'Pantry',       'Shelf-stable goods.'),
  (null, 'Refrigerated', 'Items stored cold (above freezing).'),
  (null, 'Frozen',       'Items kept below freezing.'),
  (null, 'Spices',       'Seasonings, dried herbs, blends.'),
  (null, 'Beverages',    'Drinks — alcoholic and non-.'),
  (null, 'Other',        'Catch-all when nothing else fits.');

-- ------------------------------------------------------------
-- products: nullable crew_id (NULL = master catalog)
-- ------------------------------------------------------------
create table public.products (
  product_id           uuid        primary key default gen_random_uuid(),
  crew_id              uuid        null     references public.crews(crew_id),
  name                 text        not null check (length(name) between 1 and 200),
  brand                text        null,
  barcode              text        null,
  image_url            text        null,
  size_value           numeric     null,
  size_unit            text        null     references public.unit_definitions(unit),
  default_category_id  uuid        null     references public.categories(category_id),
  source               text        null,
  created_by           text        null     references public.users(user_id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz null,
  constraint products_size_consistency check (
    (size_value is null and size_unit is null)
    or (size_value is not null and size_unit is not null)
  )
);

create index products_crew_idx
  on public.products (crew_id)
  where deleted_at is null;

create index products_barcode_idx
  on public.products (barcode)
  where deleted_at is null and barcode is not null;

create index products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops)
  where deleted_at is null;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy products_select
on public.products
for select
to authenticated
using (
  deleted_at is null
  and (crew_id is null or public.is_crew_member(crew_id))
);

create policy products_insert
on public.products
for insert
to authenticated
with check (
  crew_id is not null
  and public.is_crew_member(crew_id)
);

create policy products_update
on public.products
for update
to authenticated
using (
  crew_id is not null
  and public.is_crew_member(crew_id)
)
with check (
  crew_id is not null
  and public.is_crew_member(crew_id)
);

create policy products_delete
on public.products
for delete
to authenticated
using (
  crew_id is not null
  and public.is_crew_admin_or_owner(crew_id)
);

-- ------------------------------------------------------------
-- inventory_items: crew-scoped, cached quantity
-- ------------------------------------------------------------
create table public.inventory_items (
  inventory_item_id  uuid        primary key default gen_random_uuid(),
  crew_id            uuid        not null references public.crews(crew_id),
  product_id         uuid        not null references public.products(product_id),
  current_space_id   uuid        not null references public.spaces(space_id),
  home_space_id      uuid        null     references public.spaces(space_id),
  -- Cached quantity. Source of truth is the Flow ledger; reconciliation
  -- recomputes this from sum of flows. Direct UPDATEs to this column are
  -- allowed (the trigger is the one updating it on flow insert) but the
  -- application MUST go through Flow inserts for changes.
  quantity           numeric     not null default 0,
  unit               text        not null references public.unit_definitions(unit),
  category_id        uuid        null     references public.categories(category_id),
  min_stock          numeric     null check (min_stock is null or min_stock >= 0),
  expiry_date        date        null,
  last_unit_cost     numeric     null check (last_unit_cost is null or last_unit_cost >= 0),
  notes              text        null,
  created_by         text        null     references public.users(user_id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz null
);

create index inventory_items_crew_idx
  on public.inventory_items (crew_id)
  where deleted_at is null;

create index inventory_items_product_idx
  on public.inventory_items (crew_id, product_id)
  where deleted_at is null;

create index inventory_items_current_space_idx
  on public.inventory_items (current_space_id)
  where deleted_at is null;

create index inventory_items_home_space_idx
  on public.inventory_items (home_space_id)
  where deleted_at is null and home_space_id is not null;

create index inventory_items_low_stock_idx
  on public.inventory_items (crew_id)
  where deleted_at is null and min_stock is not null and quantity < min_stock;

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

create policy inventory_items_select
on public.inventory_items
for select
to authenticated
using (
  deleted_at is null
  and public.is_crew_member(crew_id)
);

-- Any active crew member can mutate inventory; granular per-feature
-- permissions are enforced in app via crew_members.permission_overrides
-- (Phase 5).
create policy inventory_items_insert
on public.inventory_items
for insert
to authenticated
with check (public.is_crew_member(crew_id));

create policy inventory_items_update
on public.inventory_items
for update
to authenticated
using (public.is_crew_member(crew_id))
with check (public.is_crew_member(crew_id));

create policy inventory_items_delete
on public.inventory_items
for delete
to authenticated
using (public.is_crew_admin_or_owner(crew_id));

-- ------------------------------------------------------------
-- flows: immutable transaction ledger (base table)
-- ------------------------------------------------------------
create table public.flows (
  flow_id            uuid        primary key default gen_random_uuid(),
  crew_id            uuid        not null references public.crews(crew_id),
  inventory_item_id  uuid        not null references public.inventory_items(inventory_item_id),
  flow_type          public.flow_type not null,
  quantity           numeric     not null check (quantity >= 0),
  unit               text        not null references public.unit_definitions(unit),
  performed_by       text        not null references public.users(user_id),
  performed_at       timestamptz not null default now(),
  notes              text        null,
  created_at         timestamptz not null default now()
);

create index flows_item_idx
  on public.flows (inventory_item_id, performed_at desc);

create index flows_crew_idx
  on public.flows (crew_id, performed_at desc);

create index flows_type_idx
  on public.flows (flow_type, performed_at desc);

alter table public.flows enable row level security;

create policy flows_select
on public.flows
for select
to authenticated
using (public.is_crew_member(crew_id));

create policy flows_insert
on public.flows
for insert
to authenticated
with check (public.is_crew_member(crew_id));

-- Immutable: deny UPDATE / DELETE entirely. RLS denies-by-default when no
-- matching policy exists for an operation, but a defensive trigger makes
-- the intent explicit.
create or replace function public.flows_immutable_trigger()
returns trigger
language plpgsql
as $$
begin
  raise exception 'flows is an immutable ledger — % is not allowed', tg_op;
end;
$$;

create trigger flows_no_update
before update on public.flows
for each row execute function public.flows_immutable_trigger();

create trigger flows_no_delete
before delete on public.flows
for each row execute function public.flows_immutable_trigger();

-- ------------------------------------------------------------
-- Quantity cache trigger: keeps inventory_items.quantity in sync with
-- the Flow ledger. Fires AFTER INSERT on flows. flow_type maps to a
-- delta sign; transfer is 0 (the space change happens via a separate
-- trigger on flow_transfer_details).
-- Adjustment requires its child detail row to know whether it's
-- additive or subtractive; for now we no-op the adjustment leg here
-- and rely on the detail trigger (added below) to reconcile.
-- ------------------------------------------------------------
create or replace function public.flow_quantity_cache_trigger()
returns trigger
language plpgsql
as $$
declare
  v_delta numeric := 0;
begin
  case new.flow_type
    when 'purchase'    then v_delta :=  new.quantity;
    when 'batch_output' then v_delta :=  new.quantity;
    when 'waste'       then v_delta := -new.quantity;
    when 'consumption' then v_delta := -new.quantity;
    when 'prep_usage'  then v_delta := -new.quantity;
    when 'transfer'    then v_delta :=  0;
    when 'adjustment'  then v_delta :=  0; -- handled by detail trigger
  end case;

  if v_delta <> 0 then
    update public.inventory_items
    set quantity = quantity + v_delta
    where inventory_item_id = new.inventory_item_id;
  end if;

  return new;
end;
$$;

create trigger flow_quantity_cache
after insert on public.flows
for each row execute function public.flow_quantity_cache_trigger();

-- ------------------------------------------------------------
-- flow_purchase_details: child of flows when flow_type = 'purchase'
-- ------------------------------------------------------------
create table public.flow_purchase_details (
  flow_id     uuid        primary key references public.flows(flow_id),
  unit_cost   numeric     null check (unit_cost is null or unit_cost >= 0),
  source      text        null,
  created_at  timestamptz not null default now()
);

alter table public.flow_purchase_details enable row level security;

create policy flow_purchase_details_select
on public.flow_purchase_details
for select
to authenticated
using (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_purchase_details.flow_id
      and public.is_crew_member(f.crew_id)
  )
);

create policy flow_purchase_details_insert
on public.flow_purchase_details
for insert
to authenticated
with check (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_purchase_details.flow_id
      and f.flow_type = 'purchase'
      and public.is_crew_member(f.crew_id)
  )
);

-- Update last_unit_cost on the parent inventory_item when a purchase
-- detail lands (cached for fast waste / cost-flow calculations).
create or replace function public.flow_purchase_apply_cost_trigger()
returns trigger
language plpgsql
as $$
declare
  v_item_id uuid;
begin
  if new.unit_cost is null then
    return new;
  end if;
  select f.inventory_item_id
    into v_item_id
  from public.flows f
  where f.flow_id = new.flow_id;
  if v_item_id is not null then
    update public.inventory_items
    set last_unit_cost = new.unit_cost
    where inventory_item_id = v_item_id;
  end if;
  return new;
end;
$$;

create trigger flow_purchase_apply_cost
after insert on public.flow_purchase_details
for each row execute function public.flow_purchase_apply_cost_trigger();

create trigger flow_purchase_details_no_update
before update on public.flow_purchase_details
for each row execute function public.flows_immutable_trigger();

create trigger flow_purchase_details_no_delete
before delete on public.flow_purchase_details
for each row execute function public.flows_immutable_trigger();

-- ------------------------------------------------------------
-- flow_transfer_details: child of flows when flow_type = 'transfer'
-- ------------------------------------------------------------
create table public.flow_transfer_details (
  flow_id        uuid        primary key references public.flows(flow_id),
  from_space_id  uuid        null     references public.spaces(space_id),
  to_space_id    uuid        not null references public.spaces(space_id),
  created_at     timestamptz not null default now(),
  constraint transfer_distinct_spaces check (
    from_space_id is null or from_space_id <> to_space_id
  )
);

alter table public.flow_transfer_details enable row level security;

create policy flow_transfer_details_select
on public.flow_transfer_details
for select
to authenticated
using (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_transfer_details.flow_id
      and public.is_crew_member(f.crew_id)
  )
);

create policy flow_transfer_details_insert
on public.flow_transfer_details
for insert
to authenticated
with check (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_transfer_details.flow_id
      and f.flow_type = 'transfer'
      and public.is_crew_member(f.crew_id)
  )
);

-- Apply the space change to the parent inventory_item. Atomic with the
-- detail insert (same statement).
create or replace function public.flow_transfer_apply_trigger()
returns trigger
language plpgsql
as $$
declare
  v_item_id uuid;
begin
  select f.inventory_item_id
    into v_item_id
  from public.flows f
  where f.flow_id = new.flow_id;
  if v_item_id is not null then
    update public.inventory_items
    set current_space_id = new.to_space_id
    where inventory_item_id = v_item_id;
  end if;
  return new;
end;
$$;

create trigger flow_transfer_apply
after insert on public.flow_transfer_details
for each row execute function public.flow_transfer_apply_trigger();

create trigger flow_transfer_details_no_update
before update on public.flow_transfer_details
for each row execute function public.flows_immutable_trigger();

create trigger flow_transfer_details_no_delete
before delete on public.flow_transfer_details
for each row execute function public.flows_immutable_trigger();

-- ------------------------------------------------------------
-- flow_adjustment_details: child of flows when flow_type = 'adjustment'
-- ------------------------------------------------------------
create table public.flow_adjustment_details (
  flow_id            uuid        primary key references public.flows(flow_id),
  adjustment_type    public.adjustment_kind not null,
  expected_quantity  numeric     not null,
  actual_quantity    numeric     not null,
  reason             text        null,
  created_at         timestamptz not null default now()
);

alter table public.flow_adjustment_details enable row level security;

create policy flow_adjustment_details_select
on public.flow_adjustment_details
for select
to authenticated
using (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_adjustment_details.flow_id
      and public.is_crew_member(f.crew_id)
  )
);

create policy flow_adjustment_details_insert
on public.flow_adjustment_details
for insert
to authenticated
with check (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_adjustment_details.flow_id
      and f.flow_type = 'adjustment'
      and public.is_crew_admin_or_owner(f.crew_id)
  )
);

-- Apply the adjustment delta on detail insert: actual - expected.
create or replace function public.flow_adjustment_apply_trigger()
returns trigger
language plpgsql
as $$
declare
  v_item_id uuid;
  v_delta   numeric;
begin
  select f.inventory_item_id
    into v_item_id
  from public.flows f
  where f.flow_id = new.flow_id;
  v_delta := new.actual_quantity - new.expected_quantity;
  if v_item_id is not null and v_delta <> 0 then
    update public.inventory_items
    set quantity = quantity + v_delta
    where inventory_item_id = v_item_id;
  end if;
  return new;
end;
$$;

create trigger flow_adjustment_apply
after insert on public.flow_adjustment_details
for each row execute function public.flow_adjustment_apply_trigger();

create trigger flow_adjustment_details_no_update
before update on public.flow_adjustment_details
for each row execute function public.flows_immutable_trigger();

create trigger flow_adjustment_details_no_delete
before delete on public.flow_adjustment_details
for each row execute function public.flows_immutable_trigger();

-- ============================================================
-- End Phase 3 inventory slice.
-- ============================================================
