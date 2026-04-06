# IntakeSessionItem

> Part of [[Feature 4 - Inventory Level Tracking]], [[Feature 7 - In-Out Flows]]

A line item within an [[IntakeSession]]. Represents one product being received — either expected (from a list) or added during intake (unlisted/impulse).

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `intake_item_id` | PK | |
| `intake_session_id` | FK → [[IntakeSession]] | |
| `product_id` | FK → [[Product]] | The product being received |
| `inventory_item_id` | FK → [[InventoryItem]] | Nullable — set when restocking an existing item. Null when creating a new item (resolved on session completion). |
| `expected_quantity` | numeric | Nullable — from shopping list or future PO. Null for unlisted/impulse items. |
| `received_quantity` | numeric | How many actually received |
| `unit` | text | |
| `unit_cost` | numeric | Nullable — per-unit cost for this purchase |
| `space_id` | FK → [[Space]] | Nullable — where the item will be shelved. Null = defer shelving (defaults to Premises). |
| `status` | enum | `pending` \| `received` \| `short` \| `extra` \| `skipped` |
| `notes` | text | Nullable — "out of stock at store", "substituted brand" |

## Status Values

| Status | Condition | Meaning |
|--------|-----------|---------|
| `pending` | Not yet processed | Waiting for user to confirm receipt |
| `received` | `received_quantity` = `expected_quantity` (or no expectation) | Normal receipt |
| `short` | `received_quantity` < `expected_quantity` | Received less than expected — discrepancy flagged |
| `extra` | `received_quantity` > `expected_quantity` | Received more than expected — discrepancy flagged |
| `skipped` | `received_quantity` = 0, user explicitly skipped | Item not received at all |

> **Discrepancy tracking only applies to list-seeded sessions.** From-scratch sessions have no `expected_quantity`, so all items are simply `received`.

## On Session Completion

Each IntakeSessionItem with `status` ≠ `skipped` generates:

- **If `inventory_item_id` is set (restocking):** Purchase [[Flow]] created against the existing [[InventoryItem]]. Cached quantity updated. `last_unit_cost` updated if cost provided.
- **If `inventory_item_id` is null (new item):** New [[InventoryItem]] created, then purchase [[Flow]] created. `current_space_id` set from `space_id` (or defaults to Premises if deferred).
- **If `space_id` is set and differs from item's current space:** `current_space_id` updated. Transfer [[Flow]] created if item was already at a different space.

## Key Decisions

- **Not soft-deleted.** Immutable once session is completed — historical record of what was received.
- **Discrepancy tracking is list-seeded only.** From-scratch items always have null `expected_quantity` and status = `received`.
- **Location assignment is optional.** Users can shelve during intake or defer. Deferred items land at the Premises level and show as "needs shelving."

## Relationships

- Belongs to [[IntakeSession]]
- References [[Product]]
- References [[InventoryItem]] (nullable — resolved during processing or on completion)
- References [[Space]] (nullable — shelving location)
- Generates [[Flow]]s on session completion
