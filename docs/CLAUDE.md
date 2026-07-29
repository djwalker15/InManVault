# CLAUDE.md — InMan Project Context

> **Last updated:** June 19, 2026 — content covers through Phase 8 (CI/CD + product site) and the inventory add-methods. See **Superseded Guidance** below for reversed decisions.
> **Repositories:** djwalker15/InMan (app), djwalker15/InManVault (Obsidian vault)
> **Owner:** Davontae Walker (djwalker@tenacioustech.net)

---

## What Is InMan?

InMan is an inventory management application for tracking what you have, where it's stored, how much is left, and what needs restocking. It scales from a single person in an apartment to a family household to a commercial environment like a bar.

The project has a complete conceptual data model (46 entities across 12 features), 26 documented user journeys (+1 designed: #27 Opening a Package, pending implementation), and 20 architecture decisions — ready for implementation.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4
- **UI Components:** Custom design-system primitives under `app/src/components/ds/`, migrated from `inman-design-system/`
- **Routing:** React Router v7
- **Testing:** Vitest 4, Playwright 1.59
- **Backend/DB:** Supabase (PostgreSQL with RLS, Edge Functions, Realtime subscriptions), Supabase JS v2
- **Auth:** Clerk v5 (third-party auth provider integrated with Supabase, Clerk React components for auth UI)

---

## Auth: Clerk + Supabase

Clerk handles all authentication: login, signup, password reset, social auth, MFA, session management, user profiles. InMan does NOT store email, display_name, or avatar — those live in Clerk.

### Key Integration Details
- Clerk is configured as a Supabase third-party auth provider
- Clerk issues JWTs with the user's ID as the `sub` claim
- Supabase verifies Clerk JWTs and makes the user ID available via `auth.jwt()->>'sub'`
- **All `user_id` columns are `text` type** (Clerk uses string IDs like `user_2abc123...`, not UUIDs)
- `auth.uid()` CANNOT be used — always use `auth.jwt()->>'sub'` in RLS policies
- The `users` table in Supabase is a slim local reference: just `user_id text PK` and `created_at`

### RLS Policy Pattern
```sql
-- Example: crew members can only access their own crew's data
create policy "Crew members can view flows"
on flows for select to authenticated
using (
  crew_id in (
    select crew_id from crew_members
    where user_id = (select auth.jwt()->>'sub')
  )
);
```

---

## Critical Architecture Decisions

### Quantity: Cache Model

`quantity` on InventoryItem is a **cached value**, not the source of truth. The **Flow ledger is canonical**. Every operation that changes quantity MUST create a Flow — no direct quantity updates allowed.

- `quantity` is updated on every Flow for fast reads
- A reconciliation function recalculates `quantity` by summing all flows per item and correcting drift
- If cached quantity and flow sum disagree, the flow sum wins

### Soft Deletes

All mutable entities use soft deletes via `deleted_at` (timestamp, nullable). Nothing is truly deleted — this preserves the full audit trail for historical analysis (waste trends, cost reporting, level history).

**Soft-deleted entities:** Product, ProductComponent, Category, Recipe, RecipeVersion, Space, SpaceTemplate, InventoryItem, ShoppingList, KioskSession, CrewMember

**Never deleted (immutable records):** Flow, all Flow child tables (FlowPurchaseDetail, FlowTransferDetail, FlowPrepUsageDetail, FlowAdjustmentDetail, FlowPackageBreakDetail), WasteEvent, all waste detail tables, BatchEvent, BatchInput, BatchOutput, PackageBreakEvent, RecipeStep, RecipeIngredient, all RecipeIngredient child tables, IntakeSession, IntakeSessionItem, UnitDefinition

Active queries always filter `WHERE deleted_at IS NULL`. RLS policies include the same filter.

### Atomic Operations via Edge Functions

Multi-step operations that must fully succeed or fully roll back are implemented as **Supabase edge functions** (TypeScript) wrapping database transactions:

- **Batch completion (store intent)** — create output InventoryItems, purchase Flows for outputs, create BatchOutputs, update BatchEvent status. Ingredient deductions happen progressively during cooking (not at completion).
- **Shopping list checkout** — resolve restock targets, create purchase Flows, update InventoryItem quantities, mark items checked. Batched at checkout, not per-item.
- **Waste logging** — create waste Flow + FlowPurchaseDetail (if applicable), update cached quantity, create WasteEvent + reason-specific detail record
- **Intake session completion** — create purchase Flows for each received item, create/update InventoryItems, update IntakeSession totals and status
- **Bulk space reassignment** — move all items from one space to another, create transfer Flows for each, optionally update home locations
- **Put-back routine** — batch transfer Flows for all displaced items being returned to home
- **Inventory audit corrections** — create adjustment Flows for all flagged discrepancies in one transaction
- **Open package (`open_package`)** — break a sealed package into children: create PackageBreakEvent, one `package_break` out-Flow on the pack, N `package_yield` in-Flows on resolved children (merge-into-existing or create-new), a FlowPackageBreakDetail per leg, and child `last_unit_cost` from the allocated cost — asserting cost conservation
- **Kiosk action routing** — edge functions validate kiosk token, verify allowed actions, execute operations via service role key, set `performed_by` from identified crew member

### Unit Conversion: Within-Category

A `unit_definitions` reference table provides conversion factors within unit categories (weight, volume, count). Cross-category conversion is blocked.

| unit | unit_category | base_unit | to_base_factor |
|------|--------------|-----------|---------------|
| g | weight | g | 1 |
| kg | weight | g | 1000 |
| oz | weight | g | 28.3495 |
| lbs | weight | g | 453.592 |
| ml | volume | fl_oz | 0.033814 |
| L | volume | fl_oz | 33.814 |
| tsp | volume | fl_oz | 0.166667 |
| tbsp | volume | fl_oz | 0.5 |
| cup | volume | fl_oz | 8 |
| fl_oz | volume | fl_oz | 1 |
| count | count | count | 1 |
| pkg | count | count | 1 |

The app layer converts all within-category comparisons to base units before deducting or comparing. If a recipe ingredient and inventory item use different categories, the system shows an error.

### Recipe Circular Reference Guard

Two layers of protection against Recipe A → Recipe B → Recipe A chains:
- **App layer** — checks before saving, provides friendly error message
- **DB trigger** — fires on `recipe_ingredient_recipe_refs` INSERT/UPDATE, walks the chain via recursive CTE to detect cycles, raises exception if found

### User Account Deletion — soft-delete with 30-day restore, immutable-ledger attribution retained

User-account deletion is a **soft-delete with a 30-day restore window**, orchestrated by `request_account_deletion(p_transfer_to_user_id text default null)` and reversible by `restore_account()` within the window. After 30 days, `process_due_user_deletions()` (pg_cron daily, 03:00 UTC) reports the row as past-cool-down; the row itself **stays as a tombstone**.

**Crew-branching contract:** for each crew the deleting user owns —
- transferee passed → ownership moves to that user (must be a current Admin of the crew); caller's `crew_members` row is soft-deleted.
- otherwise + other members exist → `crews.is_ownerless = true`, `became_ownerless_at = now()` (downstream handoff is the separate Ownerless-crew flow).
- otherwise + no other members → crew is soft-deleted alongside the user.

For crews the user is just a member of, only their `crew_members` row is soft-deleted.

**Immutable ledger tables retain attribution.** `flows.performed_by`, `batch_events.performed_by`, `waste_prep_failure_details.prepped_by`, and every other immutable-row FK to `users(user_id)` keep pointing to the user's original Clerk `sub` — no anonymization, no tombstoning, no cascading. Audit trails, cost rollups, and waste-by-user analytics remain intact.

**Why tombstone instead of hard-DELETE:**
- The `users` table is a slim local ref (`user_id` + `created_at` + the two soft-delete timestamps). It carries no PII; that lives in Clerk and is purged via the outbound `users.deleteUser()` admin-API call on commit.
- 12+ immutable ledger tables FK to `users(user_id)`. Hard-DELETE would force either dropping those constraints (loses referential integrity) or anonymizing the rows (contradicts the resolved decision above).
- Clerk does not reuse `sub` values, so "fresh tenant on re-signup after 30 days" works naturally — the new Clerk identity won't collide with the old tombstone regardless of whether the row still exists.

If literal row-level DELETE is ever required (GDPR variant, EU residency requirement, etc.), the follow-up is a migration that drops the FK constraints on the immutable ledger tables and extends `process_due_user_deletions()` to perform the DELETE. Track separately.

---

## Data Model Overview

The conceptual data model covers 11 features across 43 entities. All 26 user journeys are documented. Full documentation lives in the Obsidian vault (`inman-vault/`, 83 files). Here's the summary:

### Entity Map

**Tenancy & Auth:**
- `users` — slim local ref to Clerk user (`user_id text PK`, `created_at`)
- `crews` — tenant boundary (name, settings, created_by). Has `owner_id` (text FK → User) — the Crew Owner with elevated privileges (delete crew, transfer ownership, remove Admins). Crew deletion has a 48-hour waiting period via `deletion_requested_at`.
- `crew_members` — join table (crew_id, user_id, role, permission_overrides, kiosk_pin). **`kiosk_pin` is nullable** — deferred to first kiosk setup to keep sign-up friction low; format (4–8 digits) is validated when present.
- `invites` — invitation to join a Crew (crew_id, invited_by, email, role, code, status, expires_at). Consumed on acceptance → creates a `crew_members` record.

**Spaces (physical hierarchy):**
- `spaces` — self-referencing via `parent_id`, 7 unit types, `crew_id` owner
- `space_templates` — pre-built hierarchy blueprints (nullable `crew_id`)

**Catalog:**
- `products` — specific purchasable product (name, brand, barcode, image, size). Has `product_group_id` (FK → ProductGroup, nullable) linking to a generic group. Has `source` field tracking origin. Has `is_package boolean` (app-maintained: true iff active `product_components` rows exist). Nullable `crew_id`.
- `product_components` — bill-of-materials line for a **package** product (`package_product_id`, `component_product_id`, `quantity`, `unit`, `sort_order`). Catalog-layer composition template, like a recipe's ingredient list. Mutable + soft-deletable; RLS derived by joining to the package product (no own `crew_id`).
- `product_groups` — generic product concept (e.g., "Sugar", "Olive Oil") that groups specific Products. Recipes can reference these for generic ingredients. Nullable `crew_id` (pre-seeded, admin-curated, crew-created). At batch time, user chooses which specific InventoryItem to deduct from (FIFO suggestion).
- `product_submissions` — review queue for promoting crew-private products to master catalog. InMan admin team reviews. Supports merge with existing master catalog duplicates.
- `categories` — categorization. Nullable `crew_id` (null = system default, set = crew-custom)
- `inventory_items` — crew-specific instance of a product at a location. `quantity` is a **cached value** derived from the Flow ledger.

**Reference Data:**
- `unit_definitions` — unit conversion reference table (unit, unit_category, base_unit, to_base_factor). System-seeded, not crew-editable.

**Transactions:**
- `flows` — unified transaction ledger. `flow_type` enum discriminates; type-specific fields live in child tables. **No nullable FKs on the base table.** Base Flow is a clean universal record: crew_id, inventory_item_id, quantity, unit, performed_by, performed_at, notes.
- `flow_purchase_details` — child of Flow when `flow_type` = purchase. Fields: unit_cost, source (vendor).
- `flow_transfer_details` — child of Flow when `flow_type` = transfer. Fields: from_space_id, to_space_id.
- `flow_prep_usage_details` — child of Flow when `flow_type` = prep_usage. Fields: batch_id.
- `flow_adjustment_details` — child of Flow when `flow_type` = adjustment. Fields: adjustment_type (cache_correction/physical_count), expected_quantity, actual_quantity, audit_session_id, reason.
- Waste flows use the existing `waste_events` table as their child.
- Consumption flows have no child row — no extra fields needed.
- `package_break_events` — immutable header for opening a package (inverse of a store-intent batch). Fields: `package_inventory_item_id`, `package_product_id`, `quantity_opened`, `performed_by`. Mirrors `batch_events`.
- `flow_package_break_details` — child of Flow for **both** `package_break` and `package_yield` legs (the exception to one-table-per-flow_type). Fields: `break_event_id`, `role` (package | component), `component_product_id`, `allocated_unit_cost`. Links every leg to its `package_break_events` header.
- `intake_sessions` — session-based batch receiving. Source types: `shopping_list` (seeded from completed list), `manual` (from scratch), `purchase_order` (future). Tracks who received, when, total cost, item count. Completion is atomic via edge function.
- `intake_session_items` — line items within an intake session. Tracks expected vs. received quantity, unit cost, shelving location (deferrable). Discrepancy statuses: received, short, extra, skipped.

**Waste:**
- `waste_events` — linked to a waste flow. **Slim table** — only waste-specific fields (waste_reason, total_cost, notes, photo_url). Quantity, item, crew, cost, and user are derived by joining to the parent Flow.
- `waste_expired_details` — context for expired waste
- `waste_spoilage_details` — context for spoiled waste
- `waste_damage_details` — context for damaged waste
- `waste_prep_failure_details` — context for prep failures
- `waste_spill_details` — context for spills
- `waste_other_details` — catch-all

**Recipes & Batching:**
- `recipes` — formula definition, nullable `crew_id` for sharing. Has `output_product_id` (FK → Product, nullable) — set after creation, not during. Defines what Product the recipe produces when batched with store intent.
- `recipe_versions` — versioned snapshots (ingredients + steps + yield frozen per version). Only created on substance changes (ingredients, steps, yield). Metadata edits (name, description, times) update Recipe in place. Has `change_summary` (auto-generated) and `change_notes` (user-provided). Revert creates a forward copy — version history only moves forward.
- `recipe_ingredients` — ingredient line. `ingredient_type` enum discriminates; references live in child tables. **No nullable FKs on the parent.**
- `recipe_ingredient_product_refs` — child: specific Product reference
- `recipe_ingredient_group_refs` — child: generic ProductGroup reference
- `recipe_ingredient_recipe_refs` — child: sub-Recipe reference (circular ref guard via DB trigger)
- `recipe_ingredient_free_texts` — child: unlinked free-text name (blocks batching)
- `recipe_steps` — instruction steps
- `batch_events` — execution of a recipe (store/consume/split intent, scale_factor, actual vs expected yield)
- `batch_inputs` — ingredients consumed during batch
- `batch_outputs` — outputs produced (nullable inventory_item_id for consumed output)

**Shopping:**
- `shopping_lists` — named, collaborative lists per crew
- `shopping_list_items` — line item. `source_type` enum discriminates; source references live in child tables. **No nullable FKs on the parent.**
- `shopping_list_item_low_stock_sources` — child: inventory_item_id (triggered by low stock alert)
- `shopping_list_item_recipe_sources` — child: recipe_id (needed for a recipe)
- `shopping_list_item_batch_sources` — child: batch_id (needed for a planned batch)
- `manual` source has no child row — just `source_type = 'manual'`

**Kiosk:**
- `kiosk_sessions` — device-level session with token-based auth (Path B). Token hash stored in DB, raw token stored on device. Two-step identification: name select → PIN confirm (not configurable — always both). Independent of Clerk sessions.

---

## Space Hierarchy — 7 Unit Types

| Level | unit_type | Role | Examples |
|-------|-----------|------|----------|
| 1 | `premises` | Physical property | My House, Lake House |
| 2 | `area` | Room / functional space | Kitchen, Garage, Bar |
| 3 | `zone` | Named region | Back, Center, Side, Pantry, Fridge |
| 4 | `section` | Positional subdivision | Above, Below, Top, Front |
| 5 | `sub_section` | **Fixed infrastructure** | Cabinet 1, Drawer 2, Freezer Drawer |
| 6 | `container` | **Portable/removable storage** | Spice rack, Drawer organizer, Cambro |
| 7 | `shelf` | Shelf (under sub_section or container) | Shelf 1, Shelf 3 |

**Critical distinction:** `sub_section` = bolted to the wall (structural). `container` = can be picked up and moved (portable). This split matters for Kiosk Mode, Waste Tracking, and commercial use cases.

**Rules:**
- Not every level required in a given path
- Shelves can be children of either sub_section or container
- Full paths are NEVER stored — always derived at runtime by walking parent_id chain
- Multiple root premises per crew allowed
- `crew_id` on every space for multi-tenant ownership

---

## Inventory Item — Three States

Items have two space references:
- `home_space_id` (nullable) — where the item is assigned to live
- `current_space_id` (required, defaults to active premises) — where it actually is

| State | Condition | Meaning |
|-------|-----------|---------|
| Unsorted | `home_space_id` is null | No designated home yet |
| In place | `home_space_id` = `current_space_id` | Where it belongs |
| Displaced | Both set, they don't match | Not in its home location |

---

## Flow Ledger — Single Source of Truth

All inventory changes are recorded as flow events. **No `direction` column** — derived from `flow_type`:

| flow_type | Derived direction | Effect |
|-----------|------------------|--------|
| `purchase` | in | Increases cached quantity, updates last_unit_cost |
| `waste` | out | Decreases cached quantity, links to waste_event |
| `consumption` | out | Decreases cached quantity |
| `transfer` | lateral | Updates current_space_id (from_space → to_space), no quantity change |
| `prep_usage` | out | Decreases cached quantity (ingredient consumed in batch) |
| `adjustment` | in or out | Corrects cached quantity (from system reconciliation or physical count) |
| `package_break` | out | Decreases sealed-pack quantity on a package item (a pack is opened) |
| `package_yield` | in | Increases a child item's quantity (contents released from an opened pack) |

`package_break` and `package_yield` are the legs of a `package_break_events` header and share one child table, `flow_package_break_details` (discriminated by `role`). See "Inventory Item Composition" below. Every flow is user-stamped (`performed_by text FK → users`).

**Quantity on InventoryItem is a cache.** If it drifts from the flow sum, the flow sum wins. System reconciliation runs on a configurable schedule (daily/weekly/monthly) to detect drift. Physical count audits allow staff to verify quantities against what's on the shelf. Both produce adjustment Flows (FlowAdjustmentDetail) to correct discrepancies with a full audit trail.

---

## Cost Data Pipeline

1. **Purchase** → `unit_cost` on Flow, `last_unit_cost` on InventoryItem (cached)
2. **Recipe costing** → recursive sum of ingredient costs through sub-recipes
3. **Batch costing** → BatchEvent `total_cost` = sum of BatchInput costs
4. **Derived item costing** → stored BatchOutput's InventoryItem gets cost from batch
5. **Waste costing** → WasteEvent `total_cost` includes derived cost for batch-produced items
6. **Meal costing** → consume BatchEvents track `total_cost` even with no stored output
7. **Shopping list** → `unit_cost` captured at checkout on ShoppingListItem
8. **Package break** → a package's `last_unit_cost` × packs opened is **split** across its children (category-aware default, override at open time, conservation enforced) onto each child's `last_unit_cost`; from there it re-enters the pipeline (waste, recipe) like any other item cost

---

## Nullable crew_id Pattern

Five entities use nullable `crew_id` for global vs crew-scoped records:
- `products`: null = master catalog, set = crew-private custom product
- `product_groups`: null = global group (pre-seeded/admin-curated), set = crew-created
- `categories`: null = system default, set = crew-custom
- `recipes`: null = shared recipe, set = crew-private
- `space_templates`: null = system-provided, set = crew-created

When querying, union global records (crew_id IS NULL) with current crew's records.

---

## Batch Intents

| Intent | Ingredients | Output | Cost Tracked? | Requires output_product_id? |
|--------|-------------|--------|--------------|---------------------------|
| `store` | Deducted | Creates/restocks InventoryItems | Yes — on items | **Yes** |
| `consume` | Deducted | Nothing enters inventory (eaten) | Yes — on BatchEvent | No |
| `split` | Deducted | Some stored, some consumed | Yes — both | **Yes** (for stored portion) |

If `batch_intent` is store or split and the Recipe's `output_product_id` is null, the app layer blocks the batch — you can't store output without defining what the output product is.

---

## Waste Detail Tables

WasteEvent is a **slim table** — it carries only waste-specific fields. Quantity, item, crew, cost, and user attribution are derived by joining to the parent Flow via `flow_id`.

Each WasteEvent has exactly one detail record based on `waste_reason`:

| Reason | Detail Table | Key Context |
|--------|-------------|-------------|
| expired | waste_expired_details | expiry_date, days_past, space, was_opened |
| spoiled | waste_spoilage_details | space, container_type, days_since_opened, storage_conditions |
| damaged | waste_damage_details | how_damaged, space, packaging_issue |
| prep_failure | waste_prep_failure_details | recipe_id, batch_id, what_went_wrong, prepped_by |
| spilled | waste_spill_details | space, how_spilled, during_activity |
| other | waste_other_details | freeform description |

---

## Shopping List Checkout Flow

Shopping Trip has two phases: in-store (lightweight check-off) and checkout (where data operations happen, batched):

1. **In-store:** Staff check off items as they find them. Collaborative — multiple members can shop simultaneously. Items can be marked unavailable. Unlisted items can be added on the fly.
2. **Checkout:** For each checked-off item:
   - System shows existing InventoryItems for that Product (with locations), plus "Create new"
   - If `source_type` = low_stock, pre-select the source InventoryItem (from child table) as default
   - User confirms restock target → purchase Flow + FlowPurchaseDetail created
   - `unit_cost` captured per item (prompted but skippable)
   - All purchase Flows created atomically via edge function
3. **After checkout:** Prompt to start an Intake Session for shelving

---

## Timestamps

All mutable entities have both `created_at` and `updated_at`. The `updated_at` field is auto-maintained by a Supabase trigger:

```sql
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
```

Immutable entities (Flow, all Flow child tables, WasteEvent, waste details, BatchInput, BatchOutput, PackageBreakEvent, RecipeIngredient, RecipeIngredient child tables, RecipeStep, IntakeSession, IntakeSessionItem) have `created_at` only — they are never modified after creation.

---

## Key Design Principles

1. **Flow ledger is canonical.** `quantity` on InventoryItem is a cache. All inventory changes go through Flows. No direct quantity updates.

2. **Soft deletes everywhere.** Mutable entities use `deleted_at` — nothing truly disappears. Historical records (Flows, WasteEvents, BatchEvents) are immutable and never deleted.

3. **Atomic multi-step operations.** Batch completion, waste logging, shopping checkout, intake session completion, bulk reassignment, inventory audit corrections, and kiosk action routing use Supabase edge functions wrapping database transactions.

4. **Structural vs. portable distinction matters.** `sub_section` = fixed infrastructure, `container` = portable storage. Affects Kiosk Mode, Waste Tracking, and commercial use cases.

5. **"Location" is an item property, not an organizational entity.** Organizational nodes are "Spaces." "Location" refers to where an item is stored (home_space_id, current_space_id).

6. **Unified ledger over distributed tracking.** A single Flow table as the source of truth for all inventory transactions, rather than feature-specific tracking tables.

7. **Product ≠ Inventory Item.** Product is "what is this thing" (universal). InventoryItem is "how much do we have and where" (crew-specific). Same product can have multiple inventory records per crew.

8. **Cost flows through everything.** From purchase → recipe → batch → derived item → waste. A wasted bottle of housemade syrup costs the sum of its recipe inputs.

9. **Unit conversion within categories only.** Weight ↔ weight and volume ↔ volume via base unit conversion. Cross-category (weight ↔ volume) is blocked without per-product density data.

10. **Enum + child tables (Approach 4) for all polymorphic references.** Consistent pattern: parent has an enum discriminator, each type gets its own child table with real FK constraints. No nullable FK columns on parent entities. Applied to RecipeIngredient, ShoppingListItem, Flow, and WasteEvent.

11. **ProductGroup ≠ Category.** Categories are broad ("Baking", "Condiments"). ProductGroups are specific ingredient types ("Sugar", "Olive Oil"). Recipes reference ProductGroups for generic ingredients, resolved to specific InventoryItems at batch time.

12. **Recipe versioning is substance-only.** Metadata edits (name, description, times) update in place. Ingredient/step/yield changes create a new RecipeVersion. Revert creates a forward copy — version history only moves forward.

13. **Kiosk auth is independent.** Token-based (Path B), independent of Clerk sessions. Two-step identification (name + PIN) for every action. All operations via edge functions with service role key.

10. **Circular reference protection at two levels.** App layer provides friendly UX, DB trigger provides safety net for recipe ingredient cycles.

11. **Kiosk uses token-based auth (Path B).** Independent of Clerk sessions. Token hash stored in DB, raw token on device. Edge functions validate token and handle all kiosk data operations via service role key. Survives admin logout, session expiry, browser restart.

12. **Invite system for Crew membership.** Admins create invites with unique codes, roles, and optional expiry. Invite link (`/invite/:code`) routes new or existing users through acceptance flow. Consumed invite creates a CrewMember record.

13. **Master catalog population (5 layers).** Pre-seeded from Open Food Facts (day one), barcode lookup API (ongoing, automatic), crew-created products (ongoing, organic), manual curation by InMan admin team, and promotion from crew-private via ProductSubmission review. InMan admin team is the only approver. Merge capability prevents duplicates.

14. **Intake Sessions for batch receiving.** Structured session-based workflow for restocking multiple items. Seeded from shopping lists (batch table with discrepancy tracking) or from scratch (sequential). Session is a persisted record for accountability. Completion is atomic via edge function. Replaces the separate "Restocking" and "Post-Shopping Intake" journeys.

15. **Crew Owner distinct from Admin.** `owner_id` on Crew. Owner has all Admin privileges plus: delete crew, transfer ownership, remove Admins. Only Admins can be promoted to Owner. Owner cannot leave without transferring ownership first.

16. **Crew deletion with 48-hour waiting period.** Owner requests deletion → all members notified → crew remains functional during countdown → Owner can cancel → after 48 hours, scheduled job soft-deletes crew and cascades to all child entities. Immutable records (Flows, WasteEvents) remain but become inaccessible via RLS.

17. **ProductGroup for generic recipe ingredients.** Separate entity from Product. Recipes can reference a ProductGroup ("Sugar") instead of a specific Product ("Domino Sugar 4lb"). At batch time, user is prompted to choose which specific InventoryItem to deduct from, with FIFO suggestion. ProductGroups populated via pre-seeding, admin curation, and crew creation (nullable `crew_id` pattern).

18. **Enum + child tables (Approach 4) for ALL polymorphic references.** Consistent pattern across the entire model. Parent has an enum discriminator, each type gets its own child table with real FK constraints and type-specific fields. No nullable FK columns on parent entities. Applied to:
    - RecipeIngredient (`ingredient_type`): 4 child tables — ProductRef, GroupRef, RecipeRef, FreeText
    - ShoppingListItem (`source_type`): 3 child tables — LowStockSource, RecipeSource, BatchSource. Manual has no child row.
    - Flow (`flow_type`): 4 child tables — PurchaseDetail, TransferDetail, PrepUsageDetail, AdjustmentDetail. WasteEvent is the existing waste child. Consumption has no child row. `package_break` + `package_yield` **share** one child (FlowPackageBreakDetail, discriminated by `role`) — the one deliberate two-types-one-table case, because both are legs of the same break event.
    - WasteEvent (`waste_reason`): 6 child tables (already used this pattern before the decision was formalized)

19. **Adjustment Flow type for inventory audits.** `flow_type` = `adjustment` with FlowAdjustmentDetail child table. Two adjustment types: `cache_correction` (system reconciliation found drift) and `physical_count` (staff counted and found a discrepancy). Preserves full audit trail of what was wrong and how it was fixed.

20. **Inventory item composition (packages).** A Product can be a **package** whose contents are tracked individually (variety pack, multipack of identical units, ad-hoc crew bundle). Composition is a catalog-layer BOM (`product_components` on the Product, like a recipe's ingredient list) + an `is_package` flag. A sealed pack is its own InventoryItem counted in packs; it **breaks on open** (not at purchase) — the inverse of a store-intent BatchEvent: one `package_break` out-Flow on the pack + N `package_yield` in-Flows on children, grouped under a `package_break_events` header, written atomically by `open_package`. Both legs use the shared `flow_package_break_details` child. Children resolve **merge-into-existing-or-create-new** (within-category unit convert; cross-category falls back to create-new). Package cost is **split across children with conservation enforced** (category-aware default, override at open time). No clean undo in v1 — the break event + flows are immutable, so the UI requires a confirm/preview step. See `Feature 12 - Inventory Item Composition` and `Journey - Opening a Package`.

---

## MVP Scope

The MVP delivers the core inventory loop: auth, Crews, Spaces, Products, InventoryItems, and Flows. Six journeys: Onboarding (Path A), Space Setup, Adding Inventory (manual), Checking Stock, Moving Items (single + put-back), Crew Management (invite + roles).

**13 tables:** users, crews, crew_members, invites, spaces, categories, product_groups, products, inventory_items, unit_definitions, flows, flow_purchase_details, flow_transfer_details.

**Post-MVP phases:** v1.1 Waste → v1.2 Recipes & Batching → v1.3 Shopping → v1.4 Kiosk → v1.5 Admin & Reporting.

Full implementation plan: `inman-vault/InMan Implementation Plan.md`

---

## Implementation Sequence

**Hybrid approach:** Foundation DB first (all 13 MVP tables with RLS, triggers, seed data), then vertical journey-by-journey frontend development.

### Phase 0 — Project Scaffolding ✅ done
Repo (`djwalker15/InMan`), Vite + React 19 + TypeScript, Tailwind CSS 4, Clerk + Supabase wiring, root `CLAUDE.md`, `app/` scaffolding all in place.

### Phase 1 — Foundation DB (13 steps) — in progress
Auth slice (`users`, `crews`, `crew_members`), invites slice, spaces slice, and inventory slice (`categories`, `products`, `inventory_items`, `unit_definitions`, `flows`, `flow_purchase_details`, `flow_transfer_details`) are landed under `supabase/migrations/`. The 20 documented system categories are fully seeded, and a starter master catalog of 227 hand-categorized products derived from the curator's kitchen CSV is in place — enough to drive the Adding Inventory journey end-to-end. The Open Food Facts pipeline for ~50–100 `product_groups` and a 500–1000-product expansion is still ahead. `product_groups` itself is deferred to v1.2 Recipes (no inventory journey depends on it).

Each step: SQL migration, RLS policies (`auth.jwt()->>'sub'`), `updated_at` trigger, soft delete (`deleted_at`), indexes.

### Phase 2 — Vertical Journeys (6 journeys) — in progress
2.1 Onboarding (Path A) → 2.2 Space Setup → 2.3 Adding Inventory → 2.4 Checking Stock → 2.5 Moving Items → 2.6 Crew Management

Adding Inventory (product resolution, atomic `record_purchase` RPC, restock sub-flow, list shell) is the active slice. Each journey: TypeScript types → Supabase queries → React components under `app/src/components/` → route registration.

---

## Edge Function Inventory

### Database RPC Functions (MVP)
- `add_inventory_item` — insert InventoryItem + Flow + FlowPurchaseDetail
- `restock_inventory_item` — insert Flow + FlowPurchaseDetail + update cached quantity
- `move_inventory_item` — update current_space_id + insert Flow + FlowTransferDetail
- `put_back_items` — batch: update current_space_id + insert Flows for each checked item
- `create_crew_with_owner` — insert Crew + CrewMember
- `accept_invite` — update Invite + insert CrewMember
- `bulk_import_inventory` — atomic-per-row import (spreadsheet **and** receipt scan); `p_source` tags Flow provenance (`bulk_import` / `receipt_scan`); creates Product + InventoryItem + Flow + FlowPurchaseDetail (with `unit_cost`) per row
- `search_products_fuzzy` — trigram-ranked catalog candidates over the `products.name` GIN index; used by `parse-receipt` for line resolution and reusable by the product picker

### Edge Functions (MVP)
- `send_invite` — insert Invite + send email (external API)
- `sync_clerk_user` — Clerk webhook handler → insert/update User row
- `submit-feedback` — insert Feedback row + auto-file a task into the ClickUp InMan Inbox (token server-side only; row kept even if ClickUp sync fails). See [[Feature 13 - In-App Feedback]].
- `parse-receipt` — receipt/invoice scan ([[Journey - Adding Inventory]] Method 5). Claude vision extracts line items, then resolves each to a [[Product]] via [[ProductAlias]] lookup → `search_products_fuzzy` → Claude disambiguation. Returns resolved rows; the client gates ambiguous/new lines behind an explicit pick/create, then commits via `bulk_import_inventory`. `ANTHROPIC_API_KEY` lives only here.

### Post-MVP Edge Functions (identified)
- `log_waste` (v1.1), `complete_batch` (v1.2), `checkout_shopping_trip` (v1.3), `complete_intake_session` (v1.3), `kiosk_action_router` (v1.4), `run_reconciliation` (v1.5)
- `open_package` — atomic plpgsql RPC (same shape as `record_purchase` / checkout): PackageBreakEvent + `package_break` out-Flow + N resolved `package_yield` in-Flows + per-leg FlowPackageBreakDetail + child `last_unit_cost`, asserting cost conservation

---

## Route Map (MVP — 10 routes)

**Public:** `/`, `/sign-up`, `/sign-in`, `/invite/:code`
**No Crew:** `/onboarding`
**Main app:** `/dashboard`, `/inventory`, `/spaces`, `/spaces/setup`, `/crews`, `/crew/settings`

---

## Seed Data Strategy

| Data | Rows | Method |
|------|------|--------|
| `unit_definitions` | 12 | SQL migration — hardcoded |
| `categories` (global) | 20 | SQL migration — hardcoded |
| `product_groups` (global) | 50-100 | Pre-launch pipeline — Open Food Facts taxonomy |
| `products` (master catalog) | 500-1000 | Pre-launch pipeline — Open Food Facts filtered import, linked to groups |
| `space_templates` | 0 | Post-launch — built iteratively |

**Open Food Facts pipeline:** Download bulk CSV → filter US products with valid UPC/brand → extract ProductGroups from mid-level taxonomy → map to 20 categories → link Products to groups → manual review → output SQL seed files.

---

## User Journeys — All 26 Complete

Full index with statuses, dependencies, and entity frequency: `inman-vault/InMan User Journeys.md`

### Onboarding & Setup (3 journeys)
- **Onboarding** — Three entry points: root URL (landing page), invite link, kiosk enrollment. Path A: sign up → create Crew → space setup → add items → invite members → dashboard. Path B: invite link → accept → dashboard. Path C: admin enrolls kiosk device with token. Kiosk PIN is collected the first time a member touches kiosk setup or use, not at sign-up or invite acceptance.
- **Space Setup** — Five phases: visual explainer → create Premises → guided first branch (smart defaults, live tree, wider/deeper prompts) → tree editor handoff → template option (merge or replace).
- **Crew Management** — Eight admin actions: invite, change roles, permission overrides, remove members, transfer ownership (Owner-only), leave crew, edit settings, delete crew (48h waiting period). Owner distinct from Admin. Crew switcher + dedicated settings page.

### Day-to-Day Inventory (4 journeys)
- **Adding Inventory** — Four methods: manual search/create (two-step: product resolution → inventory details), bulk import (spreadsheet upload with column mapping), barcode scan (continuous mode), quick add (minimal fields). Search shows master catalog + existing inventory (restock or add another). Stay-in-flow.
- **Moving Items** — Five scenarios: single move (immediate Flow), put-back routine (batch displaced items), set home locations (batch unsorted), bulk reassign with preview (Space to Space, optionally updates home), reorganize (space-centric or item-centric).
- **Checking Stock** — Search-first with real-time filtering. Browse by Space or Category. Three filters (category, space, stock status). Inline expansion with detail + recent activity. Seven inline actions (restock, move, set home, put back, log waste, add to list, edit). Alerts summary with dashboard widget.
- **Intake Session** — Session-based batch receiving (replaces Restocking + Post-Shopping Intake). Two modes: batch table (list-seeded, discrepancy tracking) and sequential (from-scratch). Deferred shelving. Atomic completion via edge function. Persisted IntakeSession + IntakeSessionItem entities.

### Waste (4 journeys, 1 absorbed)
- **Expiry Management** — Dedicated page with three tabs: Triage (use/waste/extend/dismiss with tiered thresholds), FIFO Planning (use-this-first ordering across same-Product items), Missing Dates (batch-set expiry). Tiered thresholds configurable per Crew in settings JSON.
- **Logging Waste** — Five entry points. Flexible ordering (item-first or reason-first). Six reason-specific detail forms. Smart quantity defaults. Photo optional. Confirmation step before deducting. Stay-in-flow. Batch failure entry point for multi-item waste.
- **Reviewing Waste History** — Waste analytics dashboard: summary cards (cost, count, top reason/product/location), four charts (over time, by reason, by category, by space), detailed event log with inline expansion showing reason-specific details + photos. Six filter dimensions. CSV/Excel export.
- **Handling Expired Items** — Absorbed into Expiry Management Tab 1 (Triage).

### Cooking & Prep (4 journeys)
- **Creating a Recipe** — Hybrid layout (all sections visible). Four ingredient search groups (ProductGroups, Products, Recipes, Create/Unlinked). Live cost estimate with missing data indicators. Free-text ingredients block batching. output_product_id set after creation. First save creates RecipeVersion v1.
- **Editing a Recipe** — Same form. Metadata edits (name, description, times) update in place. Substance changes (ingredients, steps, yield) create new RecipeVersion with auto-generated change summary + optional user note. Version history with side-by-side comparison. Revert creates a forward copy.
- **Cooking a Meal** — Consume-intent BatchEvent. Interactive: select recipe, scale (preset + custom + target yield), resolve ProductGroup ingredients to specific InventoryItems, deduct as you go (progressive prep_usage Flows), mid-batch failure handling (log as waste / keep deductions / undo).
- **Prepping for Storage** — Store-intent BatchEvent. Shares Steps 1-3 with Cooking a Meal. Output step: single or split into multiple portions, each with required location. Cost derived from ingredients → flows to output InventoryItem's `last_unit_cost`. Requires `output_product_id` on Recipe.

### Shopping (4 journeys, 1 absorbed)
- **Building a Shopping List** — Multiple named lists per Crew. Collaborative with attribution. Manual adding at Product, InventoryItem, or ProductGroup level. Duplicate detection with merge/separate prompt. List lifecycle: active → completed → archived.
- **Auto-Generated Shopping List** — Three triggers: low stock (auto-add), recipe needs (deficit calculation with confirm), planned batch (deficit with confirm). Configurable per Crew. Dedicated "Suggested Items" staging list. Items reviewed and moved to real shopping lists.
- **Shopping Trip** — Two phases: in-store (lightweight check-off, collaborative, unavailable marking, unlisted item adding) and checkout (cost capture, restock target resolution with low_stock pre-selection, ProductGroup → Product resolution, batched purchase Flows). Transitions to Intake Session.
- **Post-Shopping Intake** — Absorbed into Intake Session (a shopping-list-seeded intake session IS the post-shopping intake).

### Kiosk (3 journeys)
- **Kiosk Enrollment** — Full lifecycle: admin auth on target device, Crew/Premises selection, allowed actions config (9 actions across 4 categories + presets), token generation (hash in DB, raw on device). Multi-device management, re-enrollment after wipe, boot sequence.
- **Kiosk Daily Use** — Two-step identification (name + PIN) with inactivity timeout. Nine possible actions as simplified, touch-optimized, Premises-scoped versions of full-app journeys. All actions via edge functions with token validation and `performed_by` attribution.
- **Kiosk Administration** — Device management page: edit config (name, premises, allowed actions), deactivate/reactivate, delete, re-enroll. Per-device activity log. Cross-device activity view.

### Admin & Reporting (4 journeys)
- **Cost Reporting** — Unified dashboard: summary cards (spending, waste cost, waste %, batch avg, inventory valuation), six charts (over time, by category, waste % by category, recipe comparison, by vendor, valuation by Space), transaction log. Recipe cost sub-view with ingredient breakdown and cost-over-time. Eight filter dimensions.
- **Inventory Audit** — Two modes: system reconciliation (cached qty vs Flow sum, scheduled + manual, flag-and-review) and physical count (scoped by Space/Category/full, blind counting, discrepancy review). Both produce adjustment Flows with FlowAdjustmentDetail. Audit history.
- **Space Reorganization** — Six hierarchy operations: rename, move subtree, merge (combine items + soft-delete source), delete (orphan handling), split (divide into two), reclassify (change unit_type). Simple ops inline, complex ops in dedicated mode with preview panel.
- **Data Export** — Centralized page: eight data sets (inventory, transactions, waste, recipes, shopping lists, batches, cost report, spaces), three formats (CSV, Excel, PDF with charts), configurable filters per data set, preview before export.

---

## Superseded Guidance

Decisions that have been reversed since the original draft. Where any older note (entity,
feature, or journey) still describes the pre-reversal behavior, **this section wins.** Each
entry gives the original decision, what replaced it, and the evidence.

1. **Volume base unit: `ml` → `fl_oz`.** Volume conversions originally normalized to
   milliliters. Switched to fluid ounces so the base matches the US-centric catalog. The
   `unit_definitions` table above already reflects `fl_oz` as the volume base.
   *(`4b3abae refactor(db): switch volume base unit from ml to fl_oz`.)*

2. **`kiosk_pin` collected at sign-up → deferred to first kiosk use.** The onboarding flow
   originally collected a kiosk PIN up front. Not every crew member uses a kiosk, so this was
   pure drop-off. `crew_members.kiosk_pin` is now **nullable**, the field was removed from the
   onboarding form, and the PIN is prompted inline the first time a member touches kiosk
   setup/use. General rule: don't collect feature-specific data at sign-up/invite — defer to
   first use of that feature. *(`docs: defer kiosk_pin to first kiosk setup instead of sign-up`;
   `refactor(onboarding): … drop PIN`.)*

3. **Spaces soft-delete via direct client `UPDATE` → `SECURITY DEFINER` RPC.** Soft-deleting a
   Space with a client-side `UPDATE spaces SET deleted_at = now()` tripped the RLS
   SELECT-on-new-row trap (the `deleted_at IS NULL` SELECT policy rejected the just-deleted
   row, surfacing a misleading "new row violates RLS" error). Structural Space mutations now
   route through `cascade_soft_delete_spaces` and the other Phase 6 RPCs. Default to the RPC
   pattern for `crew_members`/`spaces` mutations. *(`c0ba1b7 fix(spaces): inline tree delete
   via cascade_soft_delete_spaces RPC`; `d6eb37e`.)*

4. **User-account deletion: hard-`DELETE` considered → soft-delete tombstone with 30-day
   restore.** Hard deletion was rejected because 12+ immutable ledger tables FK to
   `users(user_id)` and would force either dropping constraints or anonymizing rows. Resolved:
   soft-delete with a 30-day restore window (`request_account_deletion` / `restore_account`),
   the `users` row stays as a PII-free tombstone, and ledger attribution
   (`flows.performed_by`, etc.) is retained unchanged. See "User Account Deletion" above for
   the full contract. *(`27a0c9d`/`ec3470c`/`256d11f` account slices.)*

5. **"Restocking" + "Post-Shopping Intake" journeys → absorbed into Intake Session.** The two
   separate restocking journeys were merged into a single session-based Intake Session
   (a shopping-list-seeded intake session *is* the post-shopping intake).

6. **"Handling Expired Items" journey → absorbed into Expiry Management.** Folded into the
   Triage tab (Tab 1) of the Expiry Management journey.

> **Not yet reversed but flagged:** development currently runs against the **prod** Supabase
> project rather than a local stack, which has already caused migration-history drift (the
> prod `schema_migrations` table was rewritten on 2026-06-12 to match git). Standing up a
> local stack is tracked in ClickUp (`86e1yr2r3`). See
> `docs/Retrospective - MVP Build-out 2026-06.md` for the full account.

---

## Reference Documents

- `inman-vault/` — Complete Obsidian vault with 84 markdown files: 43 entities, 11 features, 24 user journeys, 3 cross-cutting concerns, 3 index documents. Hosted at github.com/djwalker15/InManVault.
- `inman-vault/InMan Implementation Plan.md` — MVP scope, implementation sequence, edge function inventory, route map, seed data strategy
- `InMan_ERD.mermaid` — Full entity relationship diagram with all 43 entities and relationships
- FigJam diagrams — Onboarding flow (Paths A+B, Path C) and ERD cluster diagrams in Figma