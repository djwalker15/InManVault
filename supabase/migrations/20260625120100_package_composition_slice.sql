-- ============================================================
-- Feature 12 — Inventory Item Composition (Packages): schema slice
--
-- A Product can be a *package* whose contents are tracked individually
-- (variety pack, multipack of identical units, ad-hoc crew bundle).
-- Composition is a catalog-layer BOM (product_components on the Product,
-- like a recipe's ingredient list) + a cheap is_package flag. A sealed
-- pack is its own inventory_item counted in packs; it BREAKS ON OPEN —
-- the inverse of a store-intent batch: one package_break out-flow on the
-- pack + N package_yield in-flows on children, grouped under a
-- package_break_events header, written atomically by open_package().
--
-- This migration:
--   * products.is_package flag
--   * product_components   (mutable, soft-deletable BOM template)
--   * package_break_events (immutable header — mirrors batch_events)
--   * flow_package_break_details (immutable child of both new flow types)
--   * two new arms on flow_quantity_cache_trigger()
--   * RLS + immutability triggers throughout
--
-- The open_package RPC lives in the sibling RPC migration.
-- Enum values (package_break / package_yield / package_break_role) were
-- committed in 20260625120000_package_composition_enums.sql.
-- ============================================================

-- ------------------------------------------------------------
-- products.is_package — app-maintained convenience flag.
-- True iff the product has at least one active product_components row;
-- a cheap filter for catalog search / UI without a join. Maintenance is
-- the authoring layer's job (out of scope for the break-first slice);
-- the open_package RPC reads the components directly, not this flag.
-- ------------------------------------------------------------
alter table public.products
  add column is_package boolean not null default false;

-- ------------------------------------------------------------
-- product_components: catalog-layer bill of materials for a package.
-- Mutable + soft-deletable (catalog editors fix bad compositions). No
-- own crew_id — visibility derives by joining to the package Product
-- (master-catalog package → global; crew-private package → crew-scoped).
-- ------------------------------------------------------------
create table public.product_components (
  component_id          uuid        primary key default gen_random_uuid(),
  package_product_id    uuid        not null references public.products(product_id),
  component_product_id  uuid        not null references public.products(product_id),
  quantity              numeric     not null check (quantity > 0),  -- per single package
  unit                  text        not null references public.unit_definitions(unit),
  sort_order            int         not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz null,
  constraint product_components_no_self check (package_product_id <> component_product_id)
);

-- A child product appears at most once in an active composition
-- (raise its quantity instead of adding a second row).
create unique index product_components_unique_active
  on public.product_components (package_product_id, component_product_id)
  where deleted_at is null;

create index product_components_package_idx
  on public.product_components (package_product_id)
  where deleted_at is null;

create trigger product_components_set_updated_at
before update on public.product_components
for each row execute function public.set_updated_at();

alter table public.product_components enable row level security;

-- SELECT first (avoids the INSERT … RETURNING RLS trap). Visible when
-- the package Product is visible: global package or a crew the caller
-- belongs to.
create policy product_components_select
on public.product_components
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.products p
    where p.product_id = product_components.package_product_id
      and p.deleted_at is null
      and (p.crew_id is null or public.is_crew_member(p.crew_id))
  )
);

-- Authoring (insert / soft-delete-via-update) only on a crew-owned
-- package Product. Global-package components are seeded by service role,
-- mirroring how products_insert requires a non-null crew_id.
create policy product_components_insert
on public.product_components
for insert
to authenticated
with check (
  exists (
    select 1
    from public.products p
    where p.product_id = product_components.package_product_id
      and p.deleted_at is null
      and p.crew_id is not null
      and public.is_crew_member(p.crew_id)
  )
);

create policy product_components_update
on public.product_components
for update
to authenticated
using (
  exists (
    select 1
    from public.products p
    where p.product_id = product_components.package_product_id
      and p.deleted_at is null
      and p.crew_id is not null
      and public.is_crew_member(p.crew_id)
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.product_id = product_components.package_product_id
      and p.deleted_at is null
      and p.crew_id is not null
      and public.is_crew_member(p.crew_id)
  )
);

-- ------------------------------------------------------------
-- package_break_events: immutable header for opening a package.
-- Mirrors batch_events; groups the one-out + N-in legs of a single
-- break so history renders as one entry. created_at only — never
-- modified or deleted after creation.
-- ------------------------------------------------------------
create table public.package_break_events (
  break_event_id             uuid        primary key default gen_random_uuid(),
  crew_id                    uuid        not null references public.crews(crew_id),
  package_inventory_item_id  uuid        not null references public.inventory_items(inventory_item_id),
  package_product_id         uuid        not null references public.products(product_id),
  quantity_opened            numeric     not null check (quantity_opened > 0),
  performed_by               text        not null references public.users(user_id),
  performed_at               timestamptz not null default now(),
  created_at                 timestamptz not null default now()
);

create index package_break_events_crew_idx
  on public.package_break_events (crew_id);
create index package_break_events_item_idx
  on public.package_break_events (package_inventory_item_id);

alter table public.package_break_events enable row level security;

create policy package_break_events_select
on public.package_break_events
for select
to authenticated
using (public.is_crew_member(crew_id));

create policy package_break_events_insert
on public.package_break_events
for insert
to authenticated
with check (public.is_crew_member(crew_id));

-- Immutable: reject UPDATE / DELETE (same pattern as flows).
create or replace function public.package_break_events_immutable_trigger()
returns trigger
language plpgsql
as $$
begin
  raise exception 'package_break_events is immutable — % is not allowed', tg_op;
end;
$$;

create trigger package_break_events_no_update
before update on public.package_break_events
for each row execute function public.package_break_events_immutable_trigger();

create trigger package_break_events_no_delete
before delete on public.package_break_events
for each row execute function public.package_break_events_immutable_trigger();

-- ------------------------------------------------------------
-- flow_package_break_details: immutable child of flows for BOTH
-- package_break and package_yield legs — the one deliberate
-- two-flow-types-one-child case, discriminated by `role`. Links every
-- leg back to its package_break_events header and carries the leg's
-- allocated cost.
-- ------------------------------------------------------------
create table public.flow_package_break_details (
  flow_id              uuid        primary key references public.flows(flow_id),
  break_event_id       uuid        not null references public.package_break_events(break_event_id),
  role                 public.package_break_role not null,
  component_product_id uuid        null     references public.products(product_id),
  allocated_unit_cost  numeric     null     check (allocated_unit_cost is null or allocated_unit_cost >= 0),
  created_at           timestamptz not null default now(),
  -- component legs name a child product; the package leg never does.
  constraint flow_package_break_role_product check (
    (role = 'package'   and component_product_id is null)
    or (role = 'component' and component_product_id is not null)
  )
);

create index flow_package_break_details_event_idx
  on public.flow_package_break_details (break_event_id);

alter table public.flow_package_break_details enable row level security;

create policy flow_package_break_details_select
on public.flow_package_break_details
for select
to authenticated
using (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_package_break_details.flow_id
      and public.is_crew_member(f.crew_id)
  )
);

create policy flow_package_break_details_insert
on public.flow_package_break_details
for insert
to authenticated
with check (
  exists (
    select 1
    from public.flows f
    where f.flow_id = flow_package_break_details.flow_id
      and f.flow_type in ('package_break', 'package_yield')
      and public.is_crew_member(f.crew_id)
  )
);

-- Immutable child: reject UPDATE / DELETE.
create or replace function public.flow_package_break_details_immutable_trigger()
returns trigger
language plpgsql
as $$
begin
  raise exception 'flow_package_break_details is immutable — % is not allowed', tg_op;
end;
$$;

create trigger flow_package_break_details_no_update
before update on public.flow_package_break_details
for each row execute function public.flow_package_break_details_immutable_trigger();

create trigger flow_package_break_details_no_delete
before delete on public.flow_package_break_details
for each row execute function public.flow_package_break_details_immutable_trigger();

-- ------------------------------------------------------------
-- Quantity cache trigger: fold in the two new flow types as signed
-- deltas (package_break = −qty on the pack, package_yield = +qty on the
-- child). create-or-replace keeps the existing trigger binding.
-- ------------------------------------------------------------
create or replace function public.flow_quantity_cache_trigger()
returns trigger
language plpgsql
as $$
declare
  v_delta numeric := 0;
begin
  case new.flow_type
    when 'purchase'      then v_delta :=  new.quantity;
    when 'batch_output'  then v_delta :=  new.quantity;
    when 'waste'         then v_delta := -new.quantity;
    when 'consumption'   then v_delta := -new.quantity;
    when 'prep_usage'    then v_delta := -new.quantity;
    when 'package_break' then v_delta := -new.quantity;
    when 'package_yield' then v_delta :=  new.quantity;
    when 'transfer'      then v_delta :=  0;
    when 'adjustment'    then v_delta :=  0; -- handled by detail trigger
  end case;

  if v_delta <> 0 then
    update public.inventory_items
    set quantity = quantity + v_delta
    where inventory_item_id = new.inventory_item_id;
  end if;

  return new;
end;
$$;
