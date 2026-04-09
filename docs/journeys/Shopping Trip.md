# User Journey: Shopping Trip

> Covers the at-the-store experience — checking items off, capturing costs at checkout, and resolving restock targets
> Referenced by [[InMan User Journeys]] #18

---

## Overview

The Shopping Trip is the at-the-store workflow. The experience is split into two phases: **in-store** (lightweight — just check items off as you find them) and **checkout** (heavier — capture costs, resolve restock targets, confirm the trip). All purchase [[Flow]]s are created **batched at checkout**, not per item.

After the trip, the list can seed an [[Journey - Intake Session]] for putting items away.

---

## Entry Points

| Entry Point | Context |
|-------------|---------|
| **Shopping page** — select an active list → "Start shopping" | Opens the list in shopping mode |
| **Mobile notification** — "Time to shop? [List name] is ready" | Opens the list in shopping mode (future) |

---

## Phase 1 — In-Store (Check Off Items)

The list is displayed in a mobile-optimized, one-handed-friendly layout. Each item is a tappable row.

### Item Row (unchecked)

```
☐ Cholula Hot Sauce, 5 oz    ×2
   Low stock · Pantry > Shelf 2
```

Shows: Product name, quantity needed, source context (low stock / recipe / manual), and the current location if it's a restock item.

### Checking Off

Tap the row or checkbox to mark as found:

```
☑ Cholula Hot Sauce, 5 oz    ×2    ✓ Found
```

Checked items move to the bottom of the list (or a "Found" section) so unchecked items stay prominent at the top.

### In-Store Actions

| Action | What It Does |
|--------|-------------|
| **Check off** | Mark item as found |
| **Uncheck** | Changed your mind — item moves back to unchecked |
| **Not available** | Mark item as unavailable at the store. Stays on the list but flagged. |
| **Change quantity** | Adjust quantity on the fly (they only had 1 instead of 2, or you're grabbing 3 instead of 2) |
| **Add unlisted item** | Quick-add something not on the list (impulse buy). Opens a simplified search → Product selection. |

### Collaborative Shopping

Multiple [[CrewMember]]s can shop the same list simultaneously (e.g., splitting up at Costco). Each check-off is attributed: "Checked by [name]." Last-write-wins for MVP — real-time sync is a future enhancement.

### Progress Indicator

"8 of 12 items found" — visible at the top. When all items are checked (or marked unavailable), prompt: "All items handled! Ready to check out?"

---

## Phase 2 — Checkout

Triggered by "Check out" button (available anytime, not just when all items are found). This is where costs are captured and restock targets are resolved.

### Checkout Table

Shows all checked-off items (found items only — unavailable items are excluded):

| Item | Qty | Unit Cost | Total | Restock Target |
|------|-----|-----------|-------|---------------|
| Cholula Hot Sauce, 5 oz | 2 | $____ | — | Pantry > Shelf 2 (existing) |
| Sugar, 4 lb (Domino) | 1 | $____ | — | [Choose target] |
| Lime Juice, 16 oz | 1 | $____ | — | [New item] |
| Sparkling Water (unlisted) | 3 | $____ | — | [Choose target] |

### Per-Item Fields at Checkout

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| Quantity | Yes | Pre-filled from check-off quantity | Adjustable |
| Unit cost | No | — | Prompted: "How much?" Per-unit cost. Skippable. |
| Restock target | Yes | Pre-selected for low_stock items (from [[ShoppingListItemLowStockSource]]) | See resolution below |

### Restock Target Resolution

For each checked-off item, the user specifies where the purchased quantity goes:

**Low stock source items:** The triggering [[InventoryItem]] from the child table is pre-selected. User can override.

**Manual / recipe / batch source items:** System shows existing [[InventoryItem]]s for this [[Product]] within the [[Crew]], plus a "Create new" option:

| Option | What Happens |
|--------|-------------|
| **Restock [existing item at location]** | Purchase Flow adds quantity to the existing InventoryItem |
| **Create new** | New InventoryItem created. User picks a location at checkout or defers to Intake Session. |

**ProductGroup items:** If the list item references a [[ProductGroup]] (generic "Sugar"), the user must first specify which [[Product]] they actually bought, then resolve to an InventoryItem or create new.

### Cost Capture

The cost field is visible for every item, prompted but skippable:

- If entered: `unit_cost` stored on the [[FlowPurchaseDetail]], `last_unit_cost` updated on the target [[InventoryItem]]
- If skipped: no cost data for this purchase. Existing `last_unit_cost` on the InventoryItem is unchanged.
- **Running total** at the bottom: "Trip total: $47.23 (9 of 12 items costed)"

### Confirm Checkout

Summary before committing:

| Metric | Value |
|--------|-------|
| Items purchased | 10 |
| Items unavailable | 2 |
| Unlisted items added | 1 |
| Trip total | $47.23 (9 costed) |
| New inventory items | 1 |
| Restocked items | 9 |

User taps "Confirm checkout."

### On Confirm (atomic via edge function)

For each checked-off item:

**Restocking an existing InventoryItem:**
- Purchase [[Flow]] created (`flow_type` = purchase, quantity, unit, performed_by)
- [[FlowPurchaseDetail]] created (`unit_cost` if provided, `source` = list name or store name)
- [[InventoryItem]] cached quantity updated (incremented)
- `last_unit_cost` updated if cost provided

**Creating a new InventoryItem:**
- [[InventoryItem]] created (`product_id`, `crew_id`, `quantity`, `unit`, `current_space_id` if set or Premises if deferred)
- Purchase [[Flow]] + [[FlowPurchaseDetail]] created
- Cached quantity set

**For all items:**
- [[ShoppingListItem]] `is_checked` = true, `checked_by`, `checked_at`, `unit_cost` set

**List status:**
- If all items are now checked or marked unavailable: prompt "Mark list as complete?"
- User can complete or keep active

---

## After Checkout

### Transition to Intake Session

After checkout, a prompt appears:

> "Ready to put things away? Start an intake session to shelve your items."
> [Start intake] [Skip for now]

"Start intake" → [[Journey - Intake Session]] seeded from this shopping list. Items that were restocked at checkout are pre-populated with their new quantities. Items that need shelving (new items created at Premises level) are highlighted.

"Skip for now" → items are in inventory at their assigned locations (or Premises if deferred). User can shelve later.

### Unavailable Items

Items marked "Not available" during the in-store phase:

- Remain on the list as unchecked
- If the list is marked complete, unavailable items can optionally be moved to a new list: "2 items were unavailable. Add them to a new list?"
- Or moved back to the Suggested Items list for next time

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[ShoppingList]] | Read | Loading the list for shopping mode |
| [[ShoppingList]] | Update | Status changes (active → completed) |
| [[ShoppingListItem]] | Read | Displaying items |
| [[ShoppingListItem]] | Update | Check-off, quantity changes, cost capture, unavailable marking |
| [[ShoppingListItem]] | Insert | Unlisted items added in-store |
| ShoppingListItem child tables | Read | Pre-selecting restock targets from source |
| [[Product]] | Read | Item display, restock target resolution |
| [[ProductGroup]] | Read | Resolving generic items to specific Products |
| [[InventoryItem]] | Read | Existing items for restock target selection |
| [[InventoryItem]] | Insert | New items from checkout |
| [[InventoryItem]] | Update | Restock quantity + last_unit_cost |
| [[Flow]] | Insert (purchase) | One per checked-off item at checkout |
| [[FlowPurchaseDetail]] | Insert | Cost and source per purchase Flow |
| [[Space]] | Read | Location display and assignment |

---

## See Also

- [[Journey - Building a Shopping List]] — where lists are created and populated
- [[Journey - Auto-Generated Shopping List]] — where auto-generated items come from
- [[Journey - Intake Session]] — post-shopping shelving, seeded from the completed list
- [[Journey - Adding Inventory]] — unlisted items use the same product search
- [[ShoppingListItem]] — `source_type` + child tables for restock target pre-selection
- [[FlowPurchaseDetail]] — cost capture at checkout
