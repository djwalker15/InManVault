# InMan — User Journeys

> **Generated:** March 31, 2026
> **Purpose:** Map every user journey across the system — serves as the index for the `journeys/` folder
> **Status:** 3 of 26 journeys documented

---

## Onboarding & Setup

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 1 | [[Journey - Onboarding]] | ✅ Documented | Landing page → sign up → crew creation → space setup → first items → invite members → kiosk enrollment. Three paths: new user (A), invite (B), kiosk enrollment (C). |
| 2 | [[Journey - Space Setup]] | ✅ Documented | Detailed first-time space hierarchy setup. Five phases: Explainer → Premises → Guided First Branch → Tree Editor → Templates. |
| 3 | [[Journey - Crew Management]] | ⬜ Not yet | Invite members, change roles, remove members, transfer admin ownership, leave a crew, manage multiple crews. |

---

## Day-to-Day Inventory

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 4 | [[Journey - Adding Inventory]] | ✅ Documented | Search/create [[Product]], set quantity + location, barcode scan, bulk import. Four methods: manual search/create, bulk import, barcode scan, quick add. Two-step flow (product resolution → inventory details). Stay-in-flow for multiple items. |
| 5 | [[Journey - Moving Items]] | ⬜ Not yet | Relocate an item (update `current_space_id`), put items back in their home, bulk reassign. Transfer [[Flow]]s generated. |
| 6 | [[Journey - Checking Stock]] | ⬜ Not yet | Browse by [[Space]], browse by [[Category]], search, view item detail, check displacement status (unsorted / in place / displaced). |
| 7 | [[Journey - Restocking]] | ⬜ Not yet | Purchase flow from receiving groceries/deliveries to updating quantities and costs. Overlaps with [[Journey - Shopping Trip]] post-checkout. |
| 8 | [[Journey - Expiry Management]] | ⬜ Not yet | Review approaching/expired [[InventoryItem]]s, decide to use or waste, update dates. Connects to [[Journey - Logging Waste]]. |

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
| 13 | [[Journey - Logging Waste]] | ⬜ Not yet | Select [[InventoryItem]], choose waste reason, fill reason-specific detail table, capture photo + notes, submit. Creates waste [[Flow]] + [[WasteEvent]] + detail record atomically via edge function. |
| 14 | [[Journey - Reviewing Waste History]] | ⬜ Not yet | Filter by time/reason/[[Space]]/[[Category]], view trends, identify problem areas. All data derived from [[WasteEvent]] → [[Flow]] joins. |
| 15 | [[Journey - Handling Expired Items]] | ⬜ Not yet | System alerts expiry on [[InventoryItem]] → user decides: use it (consumption [[Flow]]), waste it ([[Journey - Logging Waste]]), or extend the date. |

---

## Shopping

| # | Journey | Status | Description |
|---|---------|--------|-------------|
| 16 | [[Journey - Building a Shopping List]] | ⬜ Not yet | Create named [[ShoppingList]], manually add [[ShoppingListItem]]s, set quantities. `source_type` = manual. |
| 17 | [[Journey - Auto-Generated Shopping List]] | ⬜ Not yet | Low stock alerts populate `source_inventory_item_id`, [[Recipe]] needs populate `source_recipe_id`, planned [[BatchEvent]]s populate `source_batch_id`. Source tracking enables prioritization. |
| 18 | [[Journey - Shopping Trip]] | ⬜ Not yet | At the store with the list. Check off items, prompted to choose which [[InventoryItem]] to restock or create new, capture `unit_cost`. Each checkout creates a purchase [[Flow]] atomically via edge function. Collaborative — multiple [[CrewMember]]s can check off simultaneously. |
| 19 | [[Journey - Post-Shopping Intake]] | ⬜ Not yet | Back home. Put items away, verify `current_space_id` matches reality, handle new items not on the list, set `home_space_id` for unsorted items. |

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

Adding Inventory (4) → Checking Stock (6) → Expiry Management (8) → Logging Waste (13)
                     → Moving Items (5)
                     → Restocking (7)

Creating a Recipe (9) → Editing a Recipe (10)
                      → Cooking a Meal (11)
                      → Prepping for Storage (12)

Checking Stock (6) → Auto-Generated Shopping List (17)
Cooking a Meal (11) → Auto-Generated Shopping List (17)
Prepping for Storage (12) → Auto-Generated Shopping List (17)

Building a Shopping List (16) → Shopping Trip (18) → Post-Shopping Intake (19)
Auto-Generated Shopping List (17) → Shopping Trip (18) → Post-Shopping Intake (19)

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
| [[Flow]] | 4, 5, 7, 8, 11, 12, 13, 15, 18, 19, 21, 23, 24 |
| [[InventoryItem]] | 4, 5, 6, 7, 8, 11, 12, 13, 15, 17, 18, 19, 21, 24 |
| [[Space]] | 2, 4, 5, 6, 13, 19, 21, 25 |
| [[Product]] | 4, 6, 9, 16, 17, 18 |
| [[Recipe]] | 9, 10, 11, 12, 17 |
| [[ShoppingList]] / [[ShoppingListItem]] | 16, 17, 18, 19 |
| [[WasteEvent]] | 13, 14, 15, 21, 23 |
| [[BatchEvent]] | 11, 12, 17, 21, 23 |
| [[CrewMember]] | 1, 3, 20, 21, 22 |
| [[KioskSession]] | 20, 21, 22 |
