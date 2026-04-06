# InMan — User Journeys

> **Generated:** March 31, 2026
> **Purpose:** Map every user journey across the system — serves as the index for the `journeys/` folder
> **Status:** 8 of 26 journeys documented (+ 1 absorbed)

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
| 4 | [[Journey - Adding Inventory]] | ✅ Documented | Search/create [[Product]], set quantity + location, barcode scan, bulk import. Four methods: manual search/create, bulk import, barcode scan, quick add. Two-step flow (product resolution → inventory details). Stay-in-flow for multiple items. |
| 5 | [[Journey - Moving Items]] | ✅ Documented | Five scenarios: single item move (immediate Flow), put-back routine (batch displaced items), set home locations (batch unsorted), bulk reassign with preview (Space to Space), reorganize (space-centric or item-centric free-form redistribution). |
| 6 | [[Journey - Checking Stock]] | ✅ Documented | Browse by [[Space]], browse by [[Category]], search, view item detail with inline expansion, inline actions (restock, move, waste, add to list), alerts summary (low stock, expired, displaced). |
| 7 | [[Journey - Intake Session]] | ✅ Documented | Session-based workflow for receiving multiple items (replaces "Restocking"). Two modes: batch table (list-seeded with discrepancy tracking) and sequential (from-scratch). Covers personal post-shopping intake and commercial delivery receiving. Also covers journey #19 (Post-Shopping Intake). |

---

## Cooking & Prep

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 9 | [[Journey - Creating a Recipe]] | ⬜ Not yet | Add ingredients ([[Product]]s + sub-[[Recipe]]s), write [[RecipeStep]]s, set yield, link `output_product_id`, save. First [[RecipeVersion]] created. |
| 10 | [[Journey - Editing a Recipe]] | ⬜ Not yet | Modify an existing [[Recipe]], new [[RecipeVersion]] created automatically, view version history, compare versions. |
| 11 | [[Journey - Cooking a Meal]] | ⬜ Not yet | Consume-intent [[BatchEvent]]. Pick [[Recipe]], scale it, check ingredient availability (with [[UnitDefinition]] conversion), execute, deduct ingredients via prep_usage [[Flow]]s, log cost. Nothing enters inventory. |
| 12 | [[Journey - Prepping for Storage]] | ⬜ Not yet | Store/split-intent [[BatchEvent]]. Pick [[Recipe]], scale, execute, create output [[InventoryItem]]s with derived cost from `output_product_id`, assign to [[Space]]. |

---

## Waste

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 8 | [[Journey - Expiry Management]] | ⬜ Not yet | Review approaching/expired [[InventoryItem]]s, decide to use or waste, update dates. Connects to [[Journey - Logging Waste]]. |
| 13 | [[Journey - Logging Waste]] | ✅ Documented | Five entry points (Checking Stock, alerts, dedicated action, kiosk, batch failure). Flexible ordering (item-first or reason-first). Six reason-specific detail forms. Smart quantity defaults. Photo optional. Confirmation step before deducting. Stay-in-flow. Atomic edge function. |
| 14 | [[Journey - Reviewing Waste History]] | ⬜ Not yet | Filter by time/reason/[[Space]]/[[Category]], view trends, identify problem areas. All data derived from [[WasteEvent]] → [[Flow]] joins. |
| 15 | [[Journey - Handling Expired Items]] | ⬜ Not yet | System alerts expiry on [[InventoryItem]] → user decides: use it (consumption [[Flow]]), waste it ([[Journey - Logging Waste]]), or extend the date. |

---

## Shopping

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 16 | [[Journey - Building a Shopping List]] | ⬜ Not yet | Create named [[ShoppingList]], manually add [[ShoppingListItem]]s, set quantities. `source_type` = manual. |
| 17 | [[Journey - Auto-Generated Shopping List]] | ⬜ Not yet | Low stock alerts populate `source_inventory_item_id`, [[Recipe]] needs populate `source_recipe_id`, planned [[BatchEvent]]s populate `source_batch_id`. Source tracking enables prioritization. |
| 18 | [[Journey - Shopping Trip]] | ⬜ Not yet | At the store with the list. Check off items, prompted to choose which [[InventoryItem]] to restock or create new, capture `unit_cost`. Each checkout creates a purchase [[Flow]] atomically via edge function. Collaborative — multiple [[CrewMember]]s can check off simultaneously. |
| 19 | [[Journey - Post-Shopping Intake]] | ✅ Covered by #7 | Absorbed into [[Journey - Intake Session]] — a shopping-list-seeded intake session IS the post-shopping intake flow. |

---

## Kiosk

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 20 | [[Journey - Kiosk Enrollment]] | 🟡 Partial | Covered in [[Journey - Onboarding]] Path C. Admin authenticates, configures [[KioskSession]], generates token. Full detail on token architecture in [[KioskSession]] entity doc. |
| 21 | [[Journey - Kiosk Daily Use]] | ⬜ Not yet | Staff identifies via name + PIN (two-step). Performs allowed actions: log waste, check inventory, view shopping list, log batch. All actions go through edge functions with `performed_by` attribution. |
| 22 | [[Journey - Kiosk Administration]] | ⬜ Not yet | Deactivate a kiosk (`is_active` = false), change allowed actions, re-enroll a device after storage wipe, view kiosk activity log. |

---

## Admin & Reporting

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 23 | [[Journey - Cost Reporting]] | ⬜ Not yet | View spending by [[Category]]/time/[[Space]], meal costs from consume [[BatchEvent]]s, waste costs from [[WasteEvent]]s, [[Recipe]] costs from recursive ingredient costing. Full pipeline documented in [[Cost Data Flow]]. |
| 24 | [[Journey - Inventory Audit]] | ⬜ Not yet | Compare cached `quantity` on [[InventoryItem]] against [[Flow]] ledger sums. Investigate discrepancies. Run reconciliation function to correct drift. |
| 25 | [[Journey - Space Reorganization]] | ⬜ Not yet | Restructure [[Space]] hierarchy after renovation. Move items in bulk (transfer [[Flow]]s for each), update `home_space_id` assignments, soft delete removed spaces. |
| 26 | [[Journey - Data Export]] | ⬜ Not yet | Export inventory, [[Flow]]s, [[WasteEvent]]s, [[Recipe]]s for external analysis or backup. Format options, filtering, date ranges. |

---

## Journey Dependencies

Some journeys are prerequisites for or feed into others:

```
Onboarding (1) → Space Setup (2) → Adding Inventory (4)
                                  → Creating a Recipe (9)
                                  → Kiosk Enrollment (20)

Adding Inventory (4) → Checking Stock (6) → Moving Items (5)
                     → Intake Session (7)

Checking Stock (6) → Auto-Generated Shopping List (17)
                   → Expiry Management (8) → Logging Waste (13)

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
| [[Flow]] | 4, 5, 7, 8, 11, 12, 13, 15, 18, 21, 23, 24 |
| [[InventoryItem]] | 4, 5, 6, 7, 8, 11, 12, 13, 15, 17, 18, 21, 24 |
| [[Space]] | 2, 4, 5, 6, 7, 13, 21, 25 |
| [[Product]] | 4, 6, 7, 9, 16, 17, 18 |
| [[Recipe]] | 9, 10, 11, 12, 17 |
| [[ShoppingList]] / [[ShoppingListItem]] | 7, 16, 17, 18 |
| [[WasteEvent]] | 13, 14, 15, 21, 23 |
| [[BatchEvent]] | 11, 12, 17, 21, 23 |
| [[IntakeSession]] / [[IntakeSessionItem]] | 7 |
| [[CrewMember]] | 1, 3, 20, 21, 22 |
| [[KioskSession]] | 20, 21, 22 |
