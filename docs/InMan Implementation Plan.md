# InMan — Implementation Plan

> **Generated:** April 9, 2026
> **Purpose:** Defines MVP scope, implementation sequence, edge function inventory, route map, and seed data strategy
> **Repository:** djwalker15/InMan

---

## MVP Scope — "Foundation"

The MVP delivers the core inventory management loop: sign up, create a Crew, build Spaces, add items, see what you have, move things around, and have every change tracked in the Flow ledger. No recipes, no shopping lists, no waste detail forms, no kiosk, no reporting.

### Journeys Included

| # | Journey | MVP Scope Notes |
|---|---------|----------------|
| 1 | [[Journey - Onboarding]] | Path A only (new user, create Crew). Path B (invite) included for Crew Management. Path C (kiosk) deferred. Kiosk PIN is **not** collected at sign-up or invite acceptance — deferred to first kiosk use. |
| 2 | [[Journey - Space Setup]] | Full five-phase experience. No SpaceTemplates at launch (deferred). |
| 3 | [[Journey - Crew Management]] | Invite members + change roles only. Owner transfer, deletion, permission overrides deferred. |
| 4 | [[Journey - Adding Inventory]] | Manual search/create only. Bulk import, barcode scan, quick add deferred. |
| 5 | [[Journey - Moving Items]] | Single item move + put-back routine. Bulk reassign and reorganize deferred. |
| 6 | [[Journey - Checking Stock]] | Search, browse by Space/Category, inline expansion + detail, alerts summary (low stock, displaced). Inline actions: move, put back, set home, edit. |

### Post-MVP Roadmap

| Phase | Journeys | Theme |
|-------|----------|-------|
| v1.1 — Waste | 8, 13, 14 | Expiry management, waste logging, waste analytics |
| v1.2 — Recipes & Batching | 9, 10, 11, 12 | Recipe creation/editing, cooking, prepping for storage |
| v1.3 — Shopping | 16, 17, 18, 7 | Shopping lists, auto-generation, shopping trips, intake sessions |
| v1.4 — Kiosk | 20, 21, 22 | Device enrollment, daily use, administration |
| v1.5 — Admin & Reporting | 23, 24, 25, 26 | Cost reporting, inventory audit, space reorganization, data export |

### Entities Included in MVP

**Included (13 tables):**
- `users`, `crews`, `crew_members`, `invites`
- `spaces` (no `space_templates` at launch)
- `categories`, `product_groups`, `products`
- `inventory_items`
- `unit_definitions`
- `flows`, `flow_purchase_details`, `flow_transfer_details`

**Deferred:**
- `product_submissions` — v1.3 (catalog curation)
- `intake_sessions`, `intake_session_items` — v1.3
- `waste_events` + 6 detail tables — v1.1
- `flow_prep_usage_details` — v1.2
- `flow_adjustment_details` — v1.5
- `recipes`, `recipe_versions`, `recipe_ingredients` + 4 child tables, `recipe_steps` — v1.2
- `batch_events`, `batch_inputs`, `batch_outputs` — v1.2
- `shopping_lists`, `shopping_list_items` + 3 child tables — v1.3
- `kiosk_sessions` — v1.4
- `space_templates` — post-launch

---

## Implementation Sequence — Hybrid Approach

Foundation DB first (all MVP tables, RLS, triggers, seed data), then vertical journey-by-journey frontend development.

### Phase 0 — Project Scaffolding ✅ done

- GitHub repo (`djwalker15/InMan`)
- Vite 8 + React 19 + TypeScript
- Tailwind CSS 4 with tokens migrated from `inman-design-system/` into `app/src/index.css`
- Custom DS primitives under `app/src/components/ds/` (no shadcn/ui)
- Clerk v5 + React SDK integration
- Supabase project + Clerk as third-party auth provider
- Supabase client configured with Clerk JWT (`useSupabase()` at `app/src/lib/supabase.ts`)
- `CLAUDE.md` at project root
- Vitest 4 + Playwright 1.59 wired up
- Husky pre-commit (eslint + `vitest --related`) on staged files

### Phase 1 — Foundation DB — in progress

All MVP tables built in dependency order. Auth, invites, spaces, and inventory slices have landed under `supabase/migrations/`; Open Food Facts seed pipeline still ahead. Each step includes: SQL migration, RLS policies (using `auth.jwt()->>'sub'`), `updated_at` trigger (mutable tables), soft delete support (`deleted_at`), and seed data where applicable.

| Step | Tables | Dependencies |
|------|--------|-------------|
| 1.1 | `users` | None |
| 1.2 | `crews` | users (owner_id, created_by) |
| 1.3 | `crew_members` | crews, users |
| 1.4 | `invites` | crews, users |
| 1.5 | `spaces` | crews |
| 1.6 | `categories` | crews (nullable crew_id) + seed 20 global defaults |
| 1.7 | `product_groups` | categories, crews (nullable crew_id) |
| 1.8 | `products` | categories, product_groups, crews (nullable crew_id) |
| 1.9 | `inventory_items` | products, spaces, categories, crews |
| 1.10 | `unit_definitions` | None + seed 15 rows |
| 1.11 | `flows` | inventory_items, crews, users |
| 1.12 | `flow_purchase_details` | flows |
| 1.13 | `flow_transfer_details` | flows, spaces |

After table creation: seed `product_groups` (50-100) and `products` (500-1000) from the Open Food Facts pipeline.

### Phase 2 — Vertical Journeys — in progress

Each journey built end-to-end: TypeScript types, Supabase query functions, React component tree under `app/src/components/`, route registration. Adding Inventory (product resolution, atomic `record_purchase` RPC, restock sub-flow, list shell) is the active slice.

| Order | Journey | Key Components |
|-------|---------|---------------|
| 2.1 | Onboarding (Path A) | Landing page, Clerk sign-up/sign-in, Crew creation form, dashboard shell, routing guards |
| 2.2 | Space Setup | Explainer screen, Premises creation, guided first branch, live tree visualization, tree editor, smart type defaults |
| 2.3 | Adding Inventory (manual) | Product search (catalog + existing inventory + create custom), two-step form, purchase Flow creation, stay-in-flow, restock sub-flow |
| 2.4 | Checking Stock | Inventory list with search, filters (Category/Space/Status), inline expansion, inline actions, alerts summary + dashboard widget |
| 2.5 | Moving Items | Single item move (transfer Flow), put-back routine (batch displaced items), set home locations |
| 2.6 | Crew Management | Invite flow (create + send + accept), member list, change roles, basic settings page, Crew switcher in nav |

---

## Edge Function Inventory

### Database RPC Functions (plpgsql)

Pure data operations — multiple inserts/updates within a single database transaction.

| Function | Operations | Triggered By |
|----------|-----------|-------------|
| `record_purchase` (planned as `add_inventory_item`) | Insert InventoryItem + Flow + FlowPurchaseDetail. Set cached quantity. | Adding Inventory |
| `restock_inventory` (planned as `restock_inventory_item`) | Insert Flow + FlowPurchaseDetail + update InventoryItem cached quantity + last_unit_cost. | Restock sub-flow |
| `record_transfer` (planned as `move_inventory_item`) | Update InventoryItem current_space_id + insert Flow + FlowTransferDetail. | Single item move |
| `put_back_items` | **Not built** — single-item put-back shipped instead (each put-back is an individual transfer via `record_transfer`). | Put-back routine |
| `bulk_import_inventory` | Atomic-per-row import (spreadsheet **and** receipt scan); `p_source` tags Flow provenance; Product + InventoryItem + Flow + FlowPurchaseDetail per row. | Bulk import / receipt scan |
| `record_adjustment` | Adjustment Flow (abs delta) + FlowAdjustmentDetail (`physical_count`); admin/owner-gated, row-locked. | Adjust count inline action |
| `record_consumption` | Consumption Flow (no child detail); member-gated, row-locked, capped at on-hand. | Checking Stock "Use it" action |
| `record_waste` | Waste Flow + slim WasteEvent + one reason-specific detail row (`p_details` jsonb); capped at on-hand. Supersedes the planned `log_waste` edge function. | Logging Waste (v1.1) |
| `soft_delete_inventory_item` | Zero-out adjustment when quantity ≠ 0, then set `deleted_at`; admin/owner-gated SECURITY DEFINER. | Removing an Inventory Item |
| `open_package` | PackageBreakEvent + `package_break` out-Flow + N `package_yield` in-Flows + per-leg FlowPackageBreakDetail + child `last_unit_cost`, asserting cost conservation. | Opening a Package |
| `create_crew_with_owner` | Insert Crew + CrewMember (role = Admin). Set owner_id. | Onboarding Step 4 |
| `accept_invite` | Update Invite (status = accepted) + insert CrewMember. | Onboarding Path B |
| `stamp_space_template` | Read SpaceTemplate → insert all Space rows with correct parent_id chain. | Space Setup (deferred to post-launch with templates) |

### Edge Functions (TypeScript on Deno)

Operations requiring external service calls.

| Function | Operations | Why Edge Function |
|----------|-----------|-------------------|
| `send_invite` | Insert Invite + send email via email service (Resend, SendGrid) | External API call (email) |
| `sync_clerk_user` | Insert/update User row from Clerk webhook payload | Webhook handler |

### Post-MVP Edge Functions (identified, not built yet)

| Function | Phase | Why Edge Function |
|----------|-------|-------------------|
| ~~`log_waste`~~ | v1.1 | **Shipped as the `record_waste` RPC** (see RPC table above); photo capture shipped 2026-08 via the `crew-media` bucket ([[Media Storage]]) |
| `open_package` | shipped 2026-07 | **Shipped as an atomic plpgsql RPC**, not an edge function (see RPC table above) |
| `complete_batch` | v1.2 | Complex logic: output creation, cost derivation |
| `checkout_shopping_trip` | v1.3 | Batch purchase Flows + restock resolution |
| `complete_intake_session` | v1.3 | Batch processing + discrepancy handling |
| `kiosk_action_router` | v1.4 | Token validation + service role key operations |
| `run_reconciliation` | v1.5 | Scheduled cron + bulk comparison + adjustment Flows |

---

## Route Map

### MVP Routes (10)

**Public (unauthenticated):**

| Route | Purpose |
|-------|---------|
| `/` | Landing page. Redirects to `/dashboard` if authenticated. |
| `/sign-up` | Clerk sign-up |
| `/sign-in` | Clerk sign-in |
| `/invite/:code` | Validate invite → sign in/up → accept |

**Authenticated, no Crew:**

| Route | Purpose |
|-------|---------|
| `/onboarding` | Crew Decision → Create Crew |

**Authenticated, has Crew (main app):**

| Route | Purpose |
|-------|---------|
| `/dashboard` | Home. Checklist, alerts widget, quick actions. |
| `/inventory` | Inventory list + search + filters + inline actions. "Add Item" button. |
| `/spaces` | Tree editor. Browse items by Space. |
| `/spaces/setup` | First-time guided flow (onboarding only). |
| `/crews` | Crew list — switch, leave, create. |
| `/crew/settings` | Crew settings: general, members. |

### Post-MVP Routes

| Route | Phase |
|-------|-------|
| `/expiry` | v1.1 |
| `/waste` | v1.1 |
| `/recipes`, `/recipes/:id`, `/recipes/:id/batch` | v1.2 |
| `/shopping`, `/shopping/:id`, `/shopping/:id/checkout` | v1.3 |
| `/kiosk/enroll`, `/kiosk`, `/admin/kiosks` | v1.4 |
| `/reports/costs`, `/admin/audit`, `/admin/export`, `/alerts` | v1.5 |

---

## Seed Data Strategy

### Tier 1 — SQL Migration Seed Data ✅ shipped

Inserted automatically during database migrations.

**`unit_definitions`** — 15 rows ✅:
g, kg, oz, lbs (weight → base: g), ml, L, tsp, tbsp, cup, fl_oz, gal, qt, pt (volume → base: fl_oz), count, pkg (count → base: count)

**`categories`** — 20 global defaults (`crew_id` = null) ✅:
Produce, Dairy & Eggs, Meat & Poultry, Seafood, Bakery & Bread, Grains & Pasta, Canned & Jarred, Condiments & Sauces, Spices & Seasonings, Oils & Vinegars, Baking, Snacks, Beverages, Frozen, Deli & Prepared, Liquor, Beer, Wine, Mixers & Bar Supplies, Cleaning & Supplies

### Tier 1.5 — Kitchen Starter Catalog ✅ shipped

A one-shot ETL pass to give the Adding Inventory journey real catalog data ahead of the full OFF pipeline. 227 products derived from the curator's actual kitchen inventory CSV (`docs/InMan_Kitchen_v5 - Sheet1.csv`), hand-categorized into the 20 globals via `scripts/seed/build-starter-catalog.mjs` and emitted as `supabase/migrations/<TS>_products_starter_catalog.sql`.

**Per-row shape:** `crew_id = null`, `source = 'seeded'`, `created_by = null`, `barcode = null`, `image_url = null`, name + brand from CSV, sizes parsed from the CSV `notes` column where unambiguous (~25% of rows have a parsed size; the rest are size-null).

**Distribution skew:** heavy on Snacks (34), Condiments & Sauces (47), Spices & Seasonings (33), Beverages (26), Grains & Pasta (20), Frozen (17). Zero rows in Liquor / Beer / Wine / Cleaning & Supplies / Bakery & Bread / Seafood — those wait for the OFF pipeline or a follow-up curated import.

**Re-run:** edit the CSV or the category map in the script, then `node scripts/seed/build-starter-catalog.mjs` to regenerate the migration deterministically.

### Tier 2 — Pre-Launch Pipeline (Open Food Facts)

A one-time script that processes the Open Food Facts bulk CSV to extract Products and ProductGroups.

**Pipeline steps:**
1. Download Open Food Facts CSV
2. Filter: US products, valid UPC, English name, brand, food/beverage only
3. Extract ProductGroups from mid-level OFF taxonomy (target 50-100 broad groups)
4. Map ProductGroups and Products to our 20 categories
5. Link every Product to its ProductGroup via `product_group_id`
6. Manual review pass — merge duplicate groups, fix naming, ensure no single-product groups
7. Output SQL seed files for `product_groups` and `products`

**Target output:**
- 50-100 ProductGroups (e.g., Sugar, Olive Oil, Hot Sauce, Rice, Pasta, Vodka, Tequila)
- 500-1000 Products, each linked to a ProductGroup
- All `crew_id` = null (master catalog), `source` = `seeded`

**Post-launch catalog growth:** Barcode lookup API for new scans, crew-created products, manual curation, ProductSubmission promotion pipeline.

### Not Seeded (post-launch)

- `space_templates` — built iteratively post-launch
- `product_submissions` — generated by user actions
- All transaction data (flows, waste, batches, etc.) — created during app use

---

## See Also

- [[InMan Data Model]] — entity definitions and feature mapping
- [[InMan User Journeys]] — all 26 journey specifications
