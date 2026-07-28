# Local seed profiles

SQL fixtures you can layer onto a **local** dev database via
[`scripts/dev-stack.sh`](../../scripts/dev-stack.sh). Use these to spin up the data a feature
or test needs without hand-onboarding through the UI.

## How seeding fits together

Three layers populate a local database, in order:

1. **Migrations** (`supabase/migrations/*.sql`) load the schema **and the global catalog** —
   the 20 categories (`…_categories_global_set.sql`) and the starter products
   (`…_products_starter_catalog.sql`, `crew_id IS NULL`). This always runs, even on `--seed none`.
2. **Baseline seed** (`supabase/seed.sql`) — the idempotent "Demo Kitchen" crew. Supabase runs it
   automatically on `supabase db reset` and on remote branch creation. **Don't repurpose this file**
   for local-only experiments; it ships to every non-prod environment.
3. **Profiles in this directory** (`supabase/seeds/<name>.sql`) — **local only**. They are applied by
   `scripts/dev-stack.sh` (via `docker exec … psql` into the local DB container), *after* the reset.
   They never run on remote branches.

Select profiles with `--seed`:

```sh
scripts/dev-stack.sh --reset --seed demo,bulk --seed-items 200   # Demo Kitchen + 200 bulk items
scripts/dev-stack.sh --reset --seed none                         # catalog only, no crew/inventory
scripts/dev-stack.sh --reset --seed demo,myfixture               # Demo Kitchen + your profile
```

`demo` and `none` are special base tokens (handled by `db reset` / `db reset --no-seed`); every other
token maps to `supabase/seeds/<token>.sql`.

## Authoring a new profile

Drop a `supabase/seeds/<name>.sql` file and follow the conventions the baseline already uses:

- **Reference the global catalog by `(name, brand)`**, not by hard-coded IDs:
  ```sql
  select product_id, default_category_id into v_pid, v_cat
    from public.products
   where crew_id is null and name = 'Coarse Kosher Salt' and brand = 'Good & Gather'
     and deleted_at is null
   limit 1;
  ```
- **Idempotency.** Give every row a **fixed UUID with a prefix unique to this profile** (the baseline
  uses `d0d0…`; `bulk.sql` uses `b01c…` — pick your own so profiles never collide) and end every
  insert with `ON CONFLICT (<pk>) DO NOTHING`. Re-running a profile must never duplicate or
  double-count.
- **Never write `quantity` directly.** `inventory_items.quantity` is a cache. Insert a `purchase`
  `flow` (+ a `flow_purchase_details` row) and let `flow_quantity_cache_trigger` set the quantity —
  see how `seed.sql` and `bulk.sql` do it.
- **Self-contained.** If your profile needs a crew/space, ensure it idempotently at the top (so it
  also works under `--seed none`). Reuse the demo crew (`d0d0d0d0-0000-4000-8000-000000000001`) when
  it makes sense.
- **Honor `--seed-items`** for volume-scalable profiles: read the count from the GUC the script sets.
  ```sql
  \if :{?n}
  \else
    \set n 50
  \endif
  select set_config('app.seed_n', :'n', false);
  -- ... then inside PL/pgSQL:  v_n int := current_setting('app.seed_n')::int;
  ```

`bulk.sql` is the reference implementation — copy its structure for new volume fixtures.

## Shipped profiles

| Profile | What it adds | Honors `--seed-items`? |
|---|---|---|
| `bulk` | N random catalog-backed inventory items + purchase flows in a "Bulk Storage" space of the Demo Kitchen crew | Yes (default 50) |
