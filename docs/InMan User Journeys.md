# InMan — User Journeys

> **Generated:** March 31, 2026
> **Purpose:** Map every user journey across the system — serves as the index for the `journeys/` folder
> **Status:** ✅ 26 core journeys complete — 24 documented + 2 absorbed (#15 → #8, #19 → #7). +1 designed: #27 Opening a Package (pending implementation, see [[Feature 12 - Inventory Item Composition]]).

---

## Onboarding & Setup

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 1 | [[Journey - Onboarding]] | ✅ Documented | Landing page → sign up → crew creation → space setup → first items → invite members → kiosk enrollment. Three paths: new user (A), invite (B), kiosk enrollment (C). |
| 2 | [[Journey - Space Setup]] | ✅ Documented | Detailed first-time space hierarchy setup. Five phases: Explainer → Premises → Guided First Branch → Tree Editor → Templates. |
| 3 | [[Journey - Crew Management]] | ✅ Documented | Invite members, change roles, set per-feature permission overrides, remove members, transfer ownership, leave crew, edit settings, delete crew (48-hour waiting period). Owner distinct from Admin. Crew switcher + dedicated settings page. |

---

## Day-to-Day Inventory

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 4 | [[Journey - Adding Inventory]] | ✅ Documented | Search/create [[Product]], set quantity + location, barcode scan, bulk import. Five methods: manual search/create, bulk import, barcode scan, quick add, and receipt/invoice scan (Claude vision → [[ProductAlias]]-learning resolution → atomic import with `unit_cost`). Two-step flow (product resolution → inventory details). Stay-in-flow for multiple items. |
| 5 | [[Journey - Moving Items]] | ✅ Documented | Five scenarios: single item move (immediate Flow), put-back routine (batch displaced items), set home locations (batch unsorted), bulk reassign with preview (Space to Space), reorganize (space-centric or item-centric free-form redistribution). |
| 6 | [[Journey - Checking Stock]] | ✅ Documented | Browse by [[Space]], browse by [[Category]], search, view item detail with inline expansion, inline actions (restock, move, waste, add to list), alerts summary (low stock, expired, displaced). |
| 7 | [[Journey - Intake Session]] | ✅ Documented | Session-based workflow for receiving multiple items (replaces "Restocking"). Two modes: batch table (list-seeded with discrepancy tracking) and sequential (from-scratch). Covers personal post-shopping intake and commercial delivery receiving. Also covers journey #19 (Post-Shopping Intake). |
| 27 | [[Journey - Opening a Package]] | 🎯 Designed | Break a sealed package [[InventoryItem]] into its child items — the inverse of a store-intent [[BatchEvent]]. Choose count → preview resolved children (merge-vs-create, unit convert) → review cost split (conservation-enforced) → confirm → atomic `open_package`. Data-model spec: [[Feature 12 - Inventory Item Composition]]. |

---

## Cooking & Prep

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 9 | [[Journey - Creating a Recipe]] | ✅ Documented | Hybrid layout (all sections visible). Four ingredient reference types: [[ProductGroup]] (generic), [[Product]] (specific), sub-[[Recipe]], free-text (unlinked, blocks batching). Live cost estimate with missing data indicators. First save creates [[RecipeVersion]] v1. |
| 10 | [[Journey - Editing a Recipe]] | ✅ Documented | Same hybrid layout as creation. Metadata edits update in place (no version). Ingredient/step/yield changes create new [[RecipeVersion]] with auto-generated change summary + optional user note. Version history with side-by-side comparison. Revert creates a forward copy. |
| 11 | [[Journey - Cooking a Meal]] | ✅ Documented | Consume-intent [[BatchEvent]]. Interactive flow: select recipe, scale (preset + custom multipliers), resolve ProductGroup ingredients to specific InventoryItems, deduct as you go (progressive prep_usage Flows), mid-batch failure handling, completion summary with cost. |
| 12 | [[Journey - Prepping for Storage]] | ✅ Documented | Store/split-intent [[BatchEvent]]. Shares Steps 1-3 with Cooking a Meal. Output step: single or split into portions, each with required location. Cost derived from ingredients, flows to output InventoryItem's `last_unit_cost`. Requires `output_product_id` on Recipe. |

---

## Waste

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 8 | [[Journey - Expiry Management]] | ✅ Documented | Dedicated page with three tabs: Triage (expired/urgent/warning items with use/waste/extend/dismiss actions), FIFO Planning (use-this-first ordering across same-Product items), Missing Dates (batch-set expiry on items without dates). Tiered thresholds configurable per Crew. |
| 13 | [[Journey - Logging Waste]] | ✅ Documented | Five entry points (Checking Stock, alerts, dedicated action, kiosk, batch failure). Flexible ordering (item-first or reason-first). Six reason-specific detail forms. Smart quantity defaults. Photo optional. Confirmation step before deducting. Stay-in-flow. Atomic edge function. |
| 14 | [[Journey - Reviewing Waste History]] | ✅ Documented | Dedicated waste analytics dashboard. Three layers: summary cards (cost, count, top reason/product/location), charts (over time, by reason, by category, by space), detailed event log with inline expansion showing reason-specific details + photos. Six filter dimensions. CSV/Excel export. |
| 15 | [[Journey - Handling Expired Items]] | ✅ Covered by #8 | Absorbed into [[Journey - Expiry Management]] Tab 1 (Triage) — expired/expiring items with use/waste/extend/dismiss actions. |

---

## Shopping

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 16 | [[Journey - Building a Shopping List]] | ✅ Documented | Multiple named lists per Crew. Collaborative with attribution. Manual item adding at Product, InventoryItem, or ProductGroup level. Duplicate detection with merge/separate prompt. List lifecycle: active → completed → archived. |
| 17 | [[Journey - Auto-Generated Shopping List]] | ✅ Documented | Three triggers: low stock (auto-add), recipe needs (deficit calculation with confirm), planned batch (deficit with confirm). Configurable per Crew. Dedicated "Suggested Items" staging list. Items reviewed and moved to real shopping lists. |
| 18 | [[Journey - Shopping Trip]] | ✅ Documented | Two phases: in-store (lightweight check-off, collaborative, unlisted item adding) and checkout (cost capture, restock target resolution, batched purchase Flows). Transitions to [[Journey - Intake Session]] for shelving. |
| 19 | [[Journey - Post-Shopping Intake]] | ✅ Covered by #7 | Absorbed into [[Journey - Intake Session]] — a shopping-list-seeded intake session IS the post-shopping intake flow. |

---

## Kiosk

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 20 | [[Journey - Kiosk Enrollment]] | ✅ Documented | Full enrollment lifecycle: admin auth, Crew/Premises selection, allowed actions config (categories + individual toggles + presets), token generation. Multi-device management, re-enrollment after device wipe, boot sequence, token security model. |
| 21 | [[Journey - Kiosk Daily Use]] | ✅ Documented | Two-step identification (name + PIN) with inactivity timeout. Nine possible actions as simplified, touch-optimized, Premises-scoped versions of full-app journeys. All actions via edge functions with kiosk token validation and `performed_by` attribution. |
| 22 | [[Journey - Kiosk Administration]] | ✅ Documented | Manage enrolled devices: edit config (name, premises, allowed actions), deactivate/reactivate, delete, re-enroll (new token). Activity log per device showing who did what. Cross-device activity view. |

---

## Admin & Reporting

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 23 | [[Journey - Cost Reporting]] | ✅ Documented | Dedicated dashboard: summary cards (spending, waste cost, waste %, batch avg, inventory valuation), charts (spending over time, by category, waste % by category, recipe comparison, by vendor, valuation by Space), transaction log. Recipe cost sub-view with ingredient breakdown and cost-over-time. Eight filter dimensions. |
| 24 | [[Journey - Inventory Audit]] | ✅ Documented | Two modes: system reconciliation (cached qty vs. Flow sum, scheduled + manual) and physical count (scoped by Space/Category/full, blind counting, discrepancy review). Both produce adjustment [[Flow]]s with [[FlowAdjustmentDetail]]. Audit history preserved. |
| 25 | [[Journey - Space Reorganization]] | ✅ Documented | Six operations: rename, move (with subtree), merge (combine items + soft-delete source), delete (orphan handling: move to parent/specific/bulk), split (divide into two), reclassify (change unit_type). Simple ops inline, complex ops in dedicated mode with preview. |
| 26 | [[Journey - Data Export]] | ✅ Documented | Centralized export page. Eight data sets (inventory, transactions, waste, recipes, shopping lists, batches, cost report, spaces). Three formats: CSV, Excel, PDF (with charts). Configurable filters per data set. Preview before export. |

---

## Journey Dependencies

Some journeys are prerequisites for or feed into others:

```
Onboarding (1) → Space Setup (2) → Adding Inventory (4)
                                  → Creating a Recipe (9)
                                  → Kiosk Enrollment (20)

Adding Inventory (4) → Checking Stock (6) → Moving Items (5)
                     → Intake Session (7)
                     → Opening a Package (27)   [also from Checking Stock (6)]

Checking Stock (6) → Auto-Generated Shopping List (17)
                   → Expiry Management (8) → Logging Waste (13)
                   → Opening a Package (27)

Creating a Recipe (9) → Editing a Recipe (10)
                      → Cooking a Meal (11)
                      → Prepping for Storage (12)

Cooking a Meal (11) → Auto-Generated Shopping List (17)
Prepping for Storage (12) → Auto-Generated Shopping List (17)

Building a Shopping List (16) → Shopping Trip (18) → Intake Session (7)
Auto-Generated Shopping List (17) → Shopping Trip (18) → Intake Session (7)

Kiosk Enrollment (20) → Kiosk Daily Use (21)
                      → Kiosk Administration (22)

All journeys with data → Cost Reporting (23)
                       → Inventory Audit (24)
                       → Data Export (26)
```

---

## Entities Most Frequently Touched

| Entity | Journeys That Touch It |
|--------|----------------------|
| [[Flow]] | 4, 5, 7, 8, 11, 12, 13, 15, 18, 21, 23, 24, 27 |
| [[InventoryItem]] | 4, 5, 6, 7, 8, 11, 12, 13, 15, 17, 18, 21, 24, 27 |
| [[Space]] | 2, 4, 5, 6, 7, 13, 21, 25, 27 |
| [[Product]] | 4, 6, 7, 9, 16, 17, 18, 27 |
| [[ProductGroup]] | 9, 11, 12 |
| [[Recipe]] | 9, 10, 11, 12, 17 |
| [[ShoppingList]] / [[ShoppingListItem]] | 7, 16, 17, 18 |
| [[WasteEvent]] | 13, 14, 15, 21, 23 |
| [[BatchEvent]] | 11, 12, 17, 21, 23 |
| [[IntakeSession]] / [[IntakeSessionItem]] | 7 |
| [[CrewMember]] | 1, 3, 20, 21, 22 |
| [[KioskSession]] | 20, 21, 22 |
