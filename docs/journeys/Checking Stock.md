# User Journey: Checking Stock

> The primary "read" journey — how users answer everyday questions about their inventory
> Referenced by [[InMan User Journeys]] #6

---

## Overview

Checking stock is the most common interaction with InMan. It answers: "Do I have this?", "Where is it?", "What's running low?", and "What's not where it belongs?" It's also the launching pad for action journeys — from checking stock, users can directly restock, move, waste, or add items to a shopping list via **inline actions**.

---

## Entry Points

| Entry Point | What It Shows | Pre-applied Filters |
|-------------|---------------|-------------------|
| **Inventory page** (`/inventory`) | Full item list with search, filters, inline expansion | None |
| **Spaces page** (`/spaces`) | Items at a selected [[Space]] node | Space filter = selected node |
| **Alerts summary** (dashboard widget or `/alerts`) | Items needing attention, grouped by alert type | Stock status filter |
| **Global search** | Persistent search bar in app header | Search query pre-filled |

---

## The Inventory List

The main view: a list of all [[InventoryItem]]s for the current [[Crew]].

### Collapsed Row (default)

Each item shows a summary row:

| Column | Source |
|--------|--------|
| Product name + brand | [[Product]] (name, brand) |
| Quantity | `quantity` + `unit` (e.g., "3 count", "16 oz") |
| Location | `current_space_id` as short path (e.g., "Back > Above > Cabinet 1") |
| Category | Effective category (override if set, else [[Product]] default) |
| Status badges | 🔴 Out of stock, 🟡 Low stock, 🟠 Expiring soon, 🔴 Expired, 📍 Displaced |

Items with alerts sort to the top by default (configurable).

### Inline Expansion (tap to expand)

Tapping an item row expands it in place, revealing the full detail card without navigating away.

#### Product Info
- Name, brand, size, image (from [[Product]])
- Barcode (if set)
- Category (effective — shows override source if different from [[Product]] default)

#### Inventory Info
- **Quantity:** `quantity` `unit` (with low stock / out of stock indicator if applicable)
- **Current location:** `current_space_id` as full breadcrumb path
- **Home location:** `home_space_id` as full path (or "Unsorted" if null)
- **Displacement status:** In place ✅ / Displaced ⚠️ / Unsorted 📋
- **Last unit cost:** `last_unit_cost` (or "Not tracked" if null)
- **Min stock threshold:** `min_stock` (or "Not set")
- **Expiry date:** `expiry_date` with relative label ("Expires in 3 days", "Expired 2 days ago")
- **Notes**

#### Recent Activity (last 5 Flows)
Mini timeline showing recent [[Flow]]s for this item:
- "Purchased 2 count — Mar 25"
- "Moved from Pantry to Countertop — Mar 22"
- "Used 1 in batch — Mar 20"
- "View full history" link → shows all Flows for this item

#### Inline Actions

| Action | When Shown | What It Does | Links To |
|--------|-----------|-------------|----------|
| **Restock** | Always | Opens restock sub-flow — add quantity + optional cost | [[Journey - Adding Inventory]] restock sub-flow |
| **Move** | Always | Pick new `current_space_id` from [[Space]] tree. Creates transfer [[Flow]]. | [[Journey - Moving Items]] |
| **Set home** | When unsorted (`home_space_id` is null) | Pick a home [[Space]]. Updates `home_space_id`. | — |
| **Put back** | When displaced (home ≠ current) | One-tap: `current_space_id` = `home_space_id`. Creates transfer [[Flow]]. | [[Journey - Moving Items]] |
| **Log waste** | Always | Opens waste logging with item pre-selected | [[Journey - Logging Waste]] |
| **Add to list** | Always | Pick a [[ShoppingList]], set quantity. Creates [[ShoppingListItem]] with `source_type` = manual. | [[Journey - Building a Shopping List]] |
| **Edit** | Always | Edit [[InventoryItem]] fields (quantity, unit, locations, min_stock, expiry, notes, category override) | — |

Actions that create [[Flow]]s show a brief success toast and update the expanded detail card in place.

---

## Search

The primary interaction pattern. Search bar at the top of the inventory page, also available globally in the app header.

### Behavior
- Searches across: [[Product]] name, brand, notes, barcode
- Results filter the list **in real-time** as the user types
- Combined with active filters — e.g., search "olive" with Category = "Condiments" shows only matching condiments
- If no results: "No items match '[query]'. Want to add it?" → links to [[Journey - Adding Inventory]]

---

## Filters

Below the search bar, a filter bar with chips/dropdowns:

| Filter | Type | Options |
|--------|------|---------|
| **Category** | Multi-select dropdown | All [[Category]]s (system defaults + crew-custom) |
| **Space** | Tree dropdown | Select a [[Space]] node. Toggle: "This space only" vs. "This space and all children" |
| **Stock status** | Multi-select chips | Low stock, Out of stock, Expiring soon, Expired, Displaced |

### Behavior
- **Stacking:** All filters combine. Search "salt" + Category "Spices" + Status "Low stock" → only low-stock spice items matching "salt"
- **Clear all:** One-tap reset to unfiltered view
- **Persistence:** Active filters persist during the session but reset on page reload (not stored in DB)

---

## Browse by Space

From the **Spaces page**, selecting any [[Space]] node shows items at that location.

### Behavior
- Shows all [[InventoryItem]]s where `current_space_id` = the selected Space
- Toggle: **"Include items in child spaces"** (e.g., selecting "Back" shows items in Back, Back > Above, Back > Above > Cabinet 1, etc.)
- Each item has the same inline expansion and inline actions as the main inventory list
- **"Add Item Here"** button → [[Journey - Adding Inventory]] with `current_space_id` pre-filled

---

## Browse by Category

A dedicated category browse mode alongside the filter-based approach.

### Category Index
Grid or list showing each [[Category]] with:
- Category name
- Item count (number of [[InventoryItem]]s for this [[Crew]])
- Quick stats: total items, low stock count, expired count

Tapping a category opens the inventory list pre-filtered to that category.

---

## Alerts Summary

A dedicated view showing all items needing attention, grouped by alert type. Available as a **dashboard widget** (compact counts) and a **full page** (`/alerts`).

### Alert Groups

| Group | Condition | Inline Actions |
|-------|-----------|---------------|
| 🔴 **Out of Stock** | `quantity` = 0 | Add to shopping list, Restock, Log waste |
| 🟡 **Low Stock** | `quantity` < `min_stock` and > 0 | Add to shopping list, Restock |
| 🟠 **Expiring Soon** | `expiry_date` within configurable threshold (default 7 days) | Use it (consumption [[Flow]]), Log waste, Extend date |
| 🔴 **Expired** | `expiry_date` has passed | Log waste, Extend date (if still usable) |
| 📍 **Displaced** | `home_space_id` ≠ `current_space_id` (both set) | Put back (one-tap), Move to new home |

Each group shows a count badge. Items within each group have inline actions relevant to that alert type.

### Dashboard Widget
Compact summary card: "3 low stock · 1 expired · 2 displaced"

Tapping any count navigates to the alerts summary pre-filtered to that group.

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[InventoryItem]] | Read (list, search, filter) | All entry points |
| [[Product]] | Read (name, brand, barcode, image, size, default category) | List display, search, detail |
| [[Space]] | Read (location paths, tree dropdown for browse/filter) | List display, filters, browse by space |
| [[Category]] | Read (names, item counts) | Filters, category browse |
| [[Flow]] | Read (recent activity timeline) | Inline expansion detail |
| [[Flow]] | Insert (transfer, consumption) | Inline actions: move, put back, use it |
| [[InventoryItem]] | Update (current_space_id, home_space_id, fields) | Inline actions: move, set home, put back, edit |
| [[ShoppingListItem]] | Insert | Inline action: add to list |

> **No new entities introduced.** This journey is entirely read-heavy with inline actions that link to existing write flows.

---

## See Also

- [[Journey - Adding Inventory]] — restock sub-flow triggered from inline actions
- [[Journey - Moving Items]] — move and put-back actions
- [[Journey - Logging Waste]] — waste action triggered from inline actions or alert groups
- [[Journey - Building a Shopping List]] — add to list action
- [[Journey - Expiry Management]] — expiring/expired alert group actions
