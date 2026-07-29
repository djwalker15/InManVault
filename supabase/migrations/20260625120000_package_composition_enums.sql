-- ============================================================
-- Feature 12 — Inventory Item Composition (Packages): enum additions
--
-- Split into its own migration because Postgres forbids USING a new
-- enum value in the same transaction that ADDs it. Committing the
-- labels here lets the next migration (tables, cache trigger, the
-- open_package RPC) reference them freely.
--
-- Adds two flow_type legs for a package break:
--   package_break  — out-leg on the sealed pack   (cache delta: -qty)
--   package_yield  — in-leg  on each child item    (cache delta: +qty)
-- and the package_break_role discriminator for the shared child table.
-- ============================================================

alter type public.flow_type add value if not exists 'package_break';
alter type public.flow_type add value if not exists 'package_yield';

create type public.package_break_role as enum ('package', 'component');
