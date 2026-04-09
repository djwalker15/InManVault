# User Journey: Building a Shopping List

> Covers manually creating and populating shopping lists
> Referenced by [[InMan User Journeys]] #16

---

## Overview

Shopping lists in InMan are **named, collaborative, and multi-instance** — a [[Crew]] can have multiple active lists simultaneously (e.g., "H-E-B run", "Sysco order", "Weekly groceries"). Any [[CrewMember]] can add items, and every action is attributed.

This journey covers the **manual** side of list building. Auto-generated items from low stock alerts, recipe needs, and planned batches are covered in [[Journey - Auto-Generated Shopping List]].

---

## Entry Points

| Entry Point | Context |
|-------------|---------|
| **Shopping page** (`/shopping`) — "New List" button | Creates a new named list |
| **Shopping page** — select an existing active list | Opens the list for editing |
| **Checking Stock inline action** — "Add to list" on an item | Prompts to pick a list, pre-fills Product |
| **Expiry Management triage** — "Add to list" on an out-of-stock item | Prompts to pick a list, pre-fills Product |
| **Global quick-add** — "Add to shopping list" | Prompts to pick a list, then search for Product |

---

## Creating a New List

**Step 1 — Name the list**

| Field | Required | Notes |
|-------|----------|-------|
| Name | Yes | e.g., "H-E-B run", "Sysco order", "This week's groceries" |
| Notes | No | e.g., "For Saturday service prep" |

**On create:**
- [[ShoppingList]] created (`crew_id`, `name`, `status` = active, `created_by`, `notes`)
- User is taken to the empty list view

---

## Adding Items to a List

### Search and Select

Same search pattern as other journeys. User types in a search field, results appear:

**Group A — Your Inventory (restock targets)**
Existing [[InventoryItem]]s matching the search. Each shows: Product name, brand, current quantity, location, and stock status (low/out). Selecting one adds the item at **InventoryItem level** — the list knows exactly which item to restock at checkout.

**Group B — Product Catalog**
[[Product]]s from the master catalog and crew-private products. Selecting one adds the item at **Product level** — a generic "buy this product" entry without a specific restock target.

**Group C — Product Groups**
[[ProductGroup]]s matching the search. Selecting one adds the item at **ProductGroup level** — "buy some kind of sugar."

**Group D — Create new**
"Can't find it? Add a custom item." — creates a crew-private [[Product]] and adds it.

### Per-Item Fields

After selecting, the user sets:

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Quantity needed | Yes | 1 | How many to buy |
| Unit | Yes | Product's default or `count` | From [[UnitDefinition]] |
| Notes | No | — | e.g., "Get the large bottle if available" |

### On Add

- [[ShoppingListItem]] created (`list_id`, `product_id`, `quantity_needed`, `unit`, `source_type` = manual, `notes`)
- `added_by` tracked (via `created_by` or attribution field) for collaborative visibility
- If the item was selected from Group A (InventoryItem level), the specific restock target is noted for checkout pre-selection
- Success toast: "Added [Product name] to [List name]"

### Duplicate Detection

If the [[Product]] is already on this list, prompt:

> "[Product name] is already on this list (2 count). Merge with existing entry or add a separate line?"
> - **Merge** → increases `quantity_needed` on the existing entry
> - **Separate line** → creates a new [[ShoppingListItem]] (useful when buying the same product in different sizes or for different purposes)

### Stay in Flow

After adding, the search field clears for the next item. A running count shows: "8 items on this list." An "I'm done adding" button returns to the list view.

---

## The List View

Shows all [[ShoppingListItem]]s on the selected list:

| Item | Qty | Added By | Source | Status |
|------|-----|----------|--------|--------|
| Cholula Hot Sauce, 5 oz | 2 | Davontae | Manual | ☐ |
| Sugar (any) | 4 lbs | Davontae | Low stock | ☐ |
| Lime Juice | 8 oz | Marcus | Recipe: Margarita | ☐ |

### Columns

- **Item** — Product name (+ brand/size if specific), or ProductGroup name if generic
- **Qty** — `quantity_needed` + `unit`
- **Added By** — who added it (from Clerk display name)
- **Source** — `source_type` label. Manual entries show "Manual." Auto-generated entries show context: "Low stock", "Recipe: [name]", "Batch: [name]"
- **Status** — unchecked / checked (for use during [[Journey - Shopping Trip]])

### List Actions

| Action | Who | What It Does |
|--------|-----|-------------|
| **Add items** | Any member | Opens the add flow |
| **Edit item** | Any member | Change quantity, unit, notes |
| **Remove item** | Any member | Removes from list (no soft delete — it's a planning entity) |
| **Reorder** | Any member | Drag to reorder (useful for organizing by store aisle) |
| **Mark complete** | Any member | Sets list `status` → completed |
| **Archive** | Admin/Owner | Sets list `status` → archived (hidden from active views) |
| **Duplicate list** | Any member | Creates a new active list with the same items (for recurring shopping patterns) |
| **Start intake** | Any member | Transitions to [[Journey - Intake Session]] with this list as seed |

---

## List Lifecycle

| Status | Meaning | Transitions |
|--------|---------|-------------|
| `active` | In use — items being added, list may be taken to the store | → `completed` (manually or when all items checked), → `archived` |
| `completed` | Shopping done — all items checked or manually marked complete | → `archived`, → `active` (reopen) |
| `archived` | Historical record — hidden from active list views but preserved | → `active` (unarchive) |

**Auto-complete:** When the last unchecked item is checked off (during [[Journey - Shopping Trip]]), prompt: "All items checked! Mark this list as complete?" The user can complete or keep it active (in case they want to add more).

---

## Collaboration

Multiple [[CrewMember]]s can interact with the same list simultaneously:

- Any member can add items, edit quantities, remove items, check items off
- Each action is attributed: "Added by [name]", "Checked by [name]"
- Real-time sync not required for MVP — last-write-wins is acceptable. Real-time collaborative editing is a future enhancement.

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[ShoppingList]] | Insert | Creating a new list |
| [[ShoppingList]] | Update | Changing status (active → completed → archived), editing name/notes |
| [[ShoppingListItem]] | Insert | Adding items |
| [[ShoppingListItem]] | Update | Editing quantity/unit/notes, checking off |
| [[ShoppingListItem]] | Delete | Removing items (hard delete — planning entity, not audited) |
| [[Product]] | Read | Search results, item display |
| [[ProductGroup]] | Read | Search results for generic items |
| [[InventoryItem]] | Read | Search results showing current stock and restock targets |
| [[Category]] | Read | Item categorization in search |

---

## See Also

- [[Journey - Auto-Generated Shopping List]] — low stock, recipe, and batch sources that populate lists automatically
- [[Journey - Shopping Trip]] — at-the-store checkout flow using this list
- [[Journey - Intake Session]] — post-shopping intake seeded from a completed list
- [[Journey - Checking Stock]] — "Add to list" inline action feeds into this journey
- [[ShoppingList]] — entity definition
- [[ShoppingListItem]] — entity with `source_type` enum + child tables
