# User Journey: Adding Inventory

> Covers all methods of getting inventory items into the system
> Referenced by [[Journey - Onboarding]] Step 6, [[InMan User Journeys]] #4

---

## Overview

Adding inventory is the most frequently used workflow in InMan. It touches [[Product]], [[InventoryItem]], [[Flow]], [[Space]], [[Category]], and [[UnitDefinition]] on every interaction.

The flow follows a **two-step pattern**: first resolve *what* the item is ([[Product]]), then capture *how much and where* ([[InventoryItem]] + [[Flow]]). After each item is added, the flow **stays open** for the next item — critical for initial inventory setup where dozens of items are added in sequence.

---

## Entry Points

All three entry points feed into the same two-step process. The only difference is whether `current_space_id` is pre-filled.

| Entry Point | Context Pre-filled | UI Form |
|-------------|-------------------|---------|
| **Inventory page** — "Add Item" button | Nothing | Full page or modal |
| **Space page** — "Add Item Here" on a specific [[Space]] node | `current_space_id` = that Space | Full page or modal |
| **Global quick-add** — persistent "+" action in app header/nav | Nothing | Lightweight modal |

---

## Method 1 — Manual Search/Create (Primary)

### Step 1 — Product Resolution: "What is this thing?"

A search field with the prompt: "Search for a product..."

As the user types, results appear in **three groups**:

#### Group A — Master Catalog Matches

[[Product]]s from the shared catalog matching the search query. Each result shows:
- Name, brand, size
- Image thumbnail (if available)
- Default [[Category]]

Selecting one moves to Step 2.

#### Group B — Your Existing Inventory

[[InventoryItem]]s the [[Crew]] already has for matching [[Product]]s. Each result shows:
- Name, brand
- Current quantity
- Location path (e.g., "Kitchen > Back > Above > Cabinet 1")

Two actions per result:
- **Restock this** → skips product selection, jumps to the Restock Sub-Flow (simplified Step 2 with just quantity to add and optional cost)
- **Add another** → creates a new [[InventoryItem]] for the same [[Product]] (e.g., a second bottle in a different location). Proceeds to full Step 2.

> This prevents accidental duplicates and makes restocking a natural part of the add flow.

#### Group C — Create Custom Product

Always visible at the bottom of results: "Can't find it? Create a custom product."

Opens a creation form:

| Field | Required? | Notes |
|-------|-----------|-------|
| Name | Yes | |
| Brand | No | |
| Barcode | No | UPC/EAN |
| Image | No | Upload |
| Size value | No | Numeric |
| Size unit | No | From [[UnitDefinition]] |
| Default category | No | [[Category]] dropdown |

Creates a crew-private [[Product]] (`crew_id` set to current [[Crew]]), then proceeds to Step 2.

If the search returns no catalog matches and no existing inventory, Group C is emphasized: "No matches found. Create a new product?"

### Step 2 — Inventory Details: "How much and where?"

The selected [[Product]] is shown at the top (name, brand, size, image) as confirmation. Below it, the inventory form:

| Field | Required? | Default | Notes |
|-------|-----------|---------|-------|
| Quantity | Yes | 1 | Numeric input |
| Unit | Yes | Product's `size_unit` if available, else `count` | Dropdown from [[UnitDefinition]] |
| Current location | Yes | Pre-filled if entered from [[Space]] page, else active Premises | [[Space]] tree dropdown (indented) |
| Home location | No | null (unsorted) | Same [[Space]] tree dropdown. "Same as current" shortcut button. |
| Category | No | Product's `default_category_id` | [[Category]] dropdown. Override for crew-specific categorization. |
| Unit cost | No | null | "How much did this cost?" — skippable |
| Min stock | No | null | "Alert me when I have fewer than..." |
| Expiry date | No | null | Date picker |
| Notes | No | null | Text field |

### On Submit

**Data created atomically:**
- [[InventoryItem]] — `crew_id`, `product_id`, `current_space_id`, `home_space_id`, `quantity` (cached), `unit`, `category_id` (if overridden), `min_stock`, `expiry_date`, `last_unit_cost` (if provided), `notes`
- [[Flow]] — `flow_type` = purchase, `quantity`, `unit`, `unit_cost` (if provided), `performed_by` from current [[User]]
- Cached `quantity` on [[InventoryItem]] set from the [[Flow]]

**Success confirmation:** Brief toast: "Added [Product name] — [quantity] [unit] in [location path]"

### After Submit — Stay in Flow

- Form resets to Step 1 (search field cleared, ready for next item)
- Subtle counter: "3 items added this session"
- "I'm done" button exits the flow and returns to the originating page
- The entry point context is preserved (if entered from a [[Space]] page, `current_space_id` stays pre-filled for the next item)

### Restock Sub-Flow

When the user selects "Restock this" from Group B in Step 1.

Simplified Step 2 — only shows:

| Field | Required? | Notes |
|-------|-----------|-------|
| Quantity to add | Yes | Additive, not total. "Adding X more" |
| Unit cost | No | "How much did this cost?" |
| Notes | No | |

**On submit:**
- [[Flow]] created (purchase, additive quantity) against the **existing** [[InventoryItem]]
- Cached `quantity` updated (incremented by the added amount)
- `last_unit_cost` updated if cost provided
- No new [[InventoryItem]] created

---

## Method 2 — Bulk Import (Secondary)

For initial inventory setup or migrating from a spreadsheet (like the InMan Kitchen v4 Excel file).

### Step 1 — Upload

"Upload a spreadsheet (.xlsx, .csv) with your inventory data."

Accepted formats: `.xlsx`, `.csv`. Drag-and-drop or file picker.

### Step 2 — Column Mapping

System reads headers from the uploaded file. User maps each column to an InMan field via dropdowns:

| Your Column | Maps To | Status |
|-------------|---------|--------|
| "Item Name" | → Product name *(required)* | ✅ Mapped |
| "Brand" | → Product brand | ✅ Mapped |
| "Qty" | → Quantity *(required)* | ✅ Mapped |
| "Location" | → Current space | ⚠️ Needs review |
| "Category" | → Category | ✅ Mapped |
| "UPC" | → Barcode | ✅ Mapped |
| "Notes" | → Notes | ✅ Mapped |
| — | → Unit *(required)* | ❌ Unmapped (set default) |

Required fields that aren't mapped get flagged. Unmapped required fields can be assigned a default value (e.g., Unit = "count" for all rows).

### Step 3 — Preview & Resolve

System processes the mapped data and shows a preview table. Each row displays a resolution status:

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ Product matched | Found in master catalog by name/barcode | Auto-linked |
| 🆕 New product | No catalog match | Will create crew-private [[Product]] |
| ⚠️ Ambiguous match | Multiple catalog results | User picks the right one |
| ❌ Invalid data | Missing required fields or bad format | Fix or skip |
| ✅ Location matched | Matched to existing [[Space]] | Auto-linked |
| ⚠️ Location unmatched | No Space matches this name | Assign manually or default to Premises |

The user can resolve ambiguities row by row or in bulk ("Assign all unmatched locations to [Premises]").

### Step 4 — Import

User confirms. System processes all rows **atomically via edge function**:
- Creates custom [[Product]]s where needed
- Creates [[InventoryItem]]s for each row
- Creates purchase [[Flow]]s for each item
- Resolves or creates [[Space]]s as configured

Progress indicator: "Importing 227 items... 145/227"

Summary on completion: "Imported 220 items. 7 skipped due to errors." With a downloadable error report for failed rows.

### Entities Involved
- [[Product]] (read catalog, insert custom)
- [[InventoryItem]] (insert)
- [[Flow]] (insert — one purchase flow per item)
- [[Space]] (read for location matching)
- [[Category]] (read for category matching)

---

## Method 3 — Barcode Scan (Tertiary)

### Step 1 — Scan

Camera activates (mobile or tablet). User points at a UPC/EAN barcode. System decodes and searches the master catalog by `barcode` field on [[Product]].

### Resolution

| Result | Behavior |
|--------|----------|
| **Product found** | Auto-selected. Proceeds to Step 2 of Manual flow with Product info pre-filled. |
| **Not found** | "Barcode not in our catalog. Create a custom product?" → opens custom creation form with barcode pre-filled, then Step 2. |
| **Already in inventory** | Same Group B behavior from Manual flow — shows existing [[InventoryItem]]s with Restock / Add Another options. |

### Continuous Scan Mode

After submitting one item, the camera stays active for the next scan. Same stay-in-flow pattern as manual entry. Counter shows items scanned this session.

### Entities Involved
Same as Manual flow — just a different product resolution mechanism.

---

## Method 4 — Quick Add (Lowest Priority)

Minimal-friction entry for when you just need to log something fast. Accessible from the global quick-add or as a mode toggle within the add flow.

### One-Screen Form

| Field | Required? | Default | Notes |
|-------|-----------|---------|-------|
| Product name | Yes | — | Searches catalog as you type. If no match selected, creates custom [[Product]] with just the name. |
| Quantity | Yes | 1 | |
| Unit | Yes | count | |
| Location | No | Active Premises | [[Space]] tree dropdown |

Everything else (brand, size, cost, min_stock, expiry, category, notes) is skipped. Can be filled in later by editing the [[InventoryItem]].

### On Submit
Same data operations as Manual Step 2 — creates [[InventoryItem]] + purchase [[Flow]]. Stays in flow for next item.

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[Product]] | Read (search catalog) | Step 1 — all methods |
| [[Product]] | Insert (crew-private) | Custom product creation |
| [[InventoryItem]] | Read (existing inventory) | Step 1 — Group B display |
| [[InventoryItem]] | Insert | Step 2 — new item |
| [[InventoryItem]] | Update (cached quantity, last_unit_cost) | Restock sub-flow |
| [[Flow]] | Insert (purchase) | Every successful add or restock |
| [[Space]] | Read (tree dropdown) | Step 2 — location selection |
| [[Category]] | Read (dropdown) | Step 2 — category selection/override |
| [[UnitDefinition]] | Read (unit dropdown) | Step 2 — unit selection |

> **Atomic operations:** Individual manual adds can be simple inserts. Bulk import must be wrapped in a Supabase edge function for atomicity. Restock is a lightweight operation (one Flow + InventoryItem update).

---

## See Also

- [[Journey - Onboarding]] — Adding Inventory is Step 6 of the onboarding wizard
- [[Journey - Restocking]] — Restock sub-flow is a simplified version of this journey
- [[Journey - Shopping Trip]] — Shopping checkout also creates purchase [[Flow]]s and resolves [[InventoryItem]] targets
- [[Journey - Post-Shopping Intake]] — Handling new items from a shopping trip
- [[InventoryItem]] — entity definition with full field list
- [[Product]] — entity definition (master catalog vs. crew-private)
- [[Flow]] — the canonical source of truth for quantity
