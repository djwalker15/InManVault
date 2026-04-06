# User Journey: Intake Session (Restocking)

> Covers the session-based workflow for receiving multiple items at once
> Referenced by [[InMan User Journeys]] #7

---

## Overview

An Intake Session is a structured process for receiving multiple items — unpacking groceries, receiving a delivery, or logging items someone else brought home. Unlike [[Journey - Adding Inventory]] (one-at-a-time, any context) or [[Journey - Shopping Trip]] (at the store), this is a **session-based batch operation** with a beginning, middle, and end.

The session is a persisted [[IntakeSession]] record — it tracks who received, when, what, total cost, and any discrepancies. This matters for commercial use (Haywire delivery accountability) and personal use (spending tracking over time).

---

## Entry Points

| Entry Point | Seed Source | Processing Mode |
|-------------|-------------|-----------------|
| **Completed Shopping List** — "Start intake" button on a [[ShoppingList]] with checked-off items | Pre-populated from [[ShoppingListItem]]s | Batch table |
| **Inventory page or Dashboard** — "New intake session" | Empty — items added one at a time | Sequential |
| **Future: Delivery notification** | Pre-populated from purchase order | Batch table |

---

## Starting a Session

### Step 1 — Create the Session

User confirms:
- **Who's receiving** — defaults to current [[User]], changeable for multi-member / kiosk scenarios
- **Reference note** (optional) — "H-E-B run March 30", "Sysco delivery #4821"
- **Source** — auto-set based on entry point (shopping_list or manual)

**Data touched:**
- [[IntakeSession]] (insert — `crew_id`, `source_type`, `source_shopping_list_id` if applicable, `source_reference`, `received_by`, `status` = in_progress, `started_at`)

---

## Processing Items — Batch Table Mode (list-seeded)

The session opens with a table showing all expected items from the [[ShoppingList]]:

| Product | Expected | Received | Cost | Location | Status |
|---------|----------|----------|------|----------|--------|
| Cholula Hot Sauce, 5 oz | 2 | _ | _ | _ | ⬜ Pending |
| Olive Oil, 16 oz | 1 | _ | _ | _ | ⬜ Pending |
| Jasmine Rice, 2 lb | 1 | _ | _ | _ | ⬜ Pending |

### Per-row fields:
- **Received quantity** — how many actually arrived. Defaults to expected quantity.
- **Unit cost** — optional. Per-unit cost for this purchase.
- **Location** — [[Space]] tree dropdown. Optional (can defer shelving). If the [[InventoryItem]] has a `home_space_id`, system pre-suggests: "Put in its home — Kitchen > Back > Above > Cabinet 1?"
- **Confirm** — marks the row as received.

### Discrepancy Handling (list-seeded only)

| Situation | Status | Behavior |
|-----------|--------|----------|
| Received = Expected | ✅ `received` | Normal restock |
| Received < Expected | ⚠️ `short` | Flagged. User can add a note ("out of stock at store", "damaged"). |
| Received > Expected | 📦 `extra` | Flagged. User confirms the overage. |
| Not received at all | ❌ `skipped` | Item stays at current inventory level. Option to re-add to a [[ShoppingList]]. |

### Adding Unlisted Items

An "Add item" row at the bottom of the table. Search/scan for [[Product]]s not on the original list (impulse buys, substitutions). These become [[IntakeSessionItem]]s with null `expected_quantity` and status = `received`.

---

## Processing Items — Sequential Mode (from scratch)

No pre-populated table. The user processes items one at a time:

1. **Search or scan** — find the [[Product]] in the catalog or existing inventory
2. **Existing item found?**
   - **Restock** — add quantity to an existing [[InventoryItem]]. User prompted to choose which one (same as [[Journey - Adding Inventory]] restock sub-flow).
   - **Add new** — create a new [[InventoryItem]]
3. **Set details** — received quantity, unit cost (optional), location (optional — can defer)
4. **Confirm** — item logged as an [[IntakeSessionItem]]
5. **Repeat** until done

A **running table builds below** the input area showing everything processed so far. Items can be edited or removed before completing the session.

---

## Shelving — During or After

Location assignment is flexible throughout the session:

### During Intake
Each item has an optional [[Space]] dropdown. If the user knows where it goes, they assign it immediately. `current_space_id` will be set on the [[InventoryItem]] at completion.

**Smart suggestion:** If the item has a `home_space_id`, the system suggests: "Put in its home — [home path]?" One-tap to accept.

### Defer to Later
Leave the location blank. On completion, `current_space_id` defaults to the active Premises — the item is *in the house* but not *on the shelf*. These items appear as "needs shelving" in the inventory list (effectively unsorted at the Premises level).

Users can shelve deferred items later from:
- The inventory list (inline "Move" action from [[Journey - Checking Stock]])
- A dedicated "needs shelving" filter (Stock status = items at Premises level with a deeper `home_space_id`)

---

## Completing the Session

### Review Summary

| Metric | Value |
|--------|-------|
| Items received | 14 |
| Items short | 1 (Olive Oil — out of stock at store) |
| Items extra / unlisted | 2 (impulse buys) |
| Items skipped | 0 |
| Total cost | $47.23 (sum of items where cost was entered) |
| Items needing shelving | 5 (location not assigned) |

User can review or edit any item, then taps "Complete session."

### On Completion (atomic via edge function)

For each [[IntakeSessionItem]] with status ≠ `skipped`:

| Scenario | Operations |
|----------|-----------|
| **Restocking existing item** | Purchase [[Flow]] created → cached quantity updated → `last_unit_cost` updated if cost provided |
| **New item** | [[InventoryItem]] created → purchase [[Flow]] created |
| **Location assigned** | `current_space_id` set. Transfer [[Flow]] if item was already at a different space. |
| **Location deferred** | `current_space_id` = active Premises |

Session finalization:
- [[IntakeSession]] status → `completed`, `completed_at` set
- `total_items_received` and `total_cost` calculated and stored
- Skipped items can optionally be re-added to a [[ShoppingList]]

**Data touched:**
- [[IntakeSession]] (update — status, completed_at, totals)
- [[InventoryItem]] (insert or update per item)
- [[Flow]] (insert — one purchase flow per received item, optional transfer flows for location changes)
- [[ShoppingList]] (optional — re-add skipped items)

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[IntakeSession]] | Insert | Session creation |
| [[IntakeSession]] | Update | Session completion |
| [[IntakeSessionItem]] | Insert | Each item processed |
| [[IntakeSessionItem]] | Update | Edit during session, status changes |
| [[Product]] | Read | Search/scan during processing |
| [[InventoryItem]] | Read | Finding existing items to restock |
| [[InventoryItem]] | Insert | New items |
| [[InventoryItem]] | Update | Restock quantity, location, cost |
| [[Flow]] | Insert (purchase) | One per received item on completion |
| [[Flow]] | Insert (transfer) | When location changes on existing items |
| [[Space]] | Read | Location dropdowns, home suggestions |
| [[ShoppingList]] | Read | Seeding list-based sessions |
| [[ShoppingListItem]] | Read | Pre-populating expected items |

---

## See Also

- [[IntakeSession]] — the session entity
- [[IntakeSessionItem]] — line items within the session
- [[Journey - Adding Inventory]] — single-item adding and restock sub-flow
- [[Journey - Shopping Trip]] — at-the-store checkout that can seed an intake session
- [[Journey - Post-Shopping Intake]] — this journey IS the post-shopping intake (they're the same thing)
- [[Journey - Checking Stock]] — deferred shelving items appear here as "needs shelving"
- [[Journey - Moving Items]] — shelving deferred items after intake
