# User Journey: Inventory Audit / Reconciliation

> Covers system reconciliation (cache vs. Flow sum) and physical count audits
> Referenced by [[InMan User Journeys]] #24

---

## Overview

Inventory Audit has two modes:

1. **System Reconciliation** — detects and corrects drift between the cached `quantity` on [[InventoryItem]] and the actual sum of [[Flow]]s. This is a data integrity check. Can run automatically on a schedule or be triggered manually.

2. **Physical Count** — staff physically counts what's on the shelves and enters actual quantities. The system compares against expected values and generates adjustment [[Flow]]s for any discrepancies. Scopeable by Space, Category, or full inventory.

Both modes produce **adjustment Flows** (`flow_type` = `adjustment`) with [[FlowAdjustmentDetail]] child rows, preserving a full audit trail of what was wrong and how it was corrected.

---

## Entry Points

| Entry Point | Mode |
|-------------|------|
| **Admin page** (`/admin/audit`) — "Run Reconciliation" | System reconciliation |
| **Admin page** — "Start Physical Count" | Physical count |
| **Scheduled job** — configurable cadence | System reconciliation (background) |
| **Dashboard alert** — "Reconciliation found 3 discrepancies" | Links to review screen |

---

## Mode 1 — System Reconciliation

### What It Does

For every [[InventoryItem]] in the [[Crew]], the system:
1. Reads the cached `quantity` from the InventoryItem
2. Calculates the expected quantity by summing all [[Flow]]s for that item (purchases in, waste/consumption/prep_usage out, transfers lateral, adjustments +/-)
3. Compares the two values
4. If they differ → flags as a discrepancy

### Trigger Options

**Scheduled (background):**
Configurable in [[Crew]] `settings`:
```json
{
  "reconciliation": {
    "enabled": true,
    "cadence": "daily"
  }
}
```
Options: `daily`, `weekly`, `monthly`, `disabled`. Runs as a Supabase cron job. Discrepancies are flagged for admin review — never auto-corrected.

**Manual:**
Admin navigates to the audit page and clicks "Run Reconciliation Now." Same process, immediate results.

### Review Screen

Shows all items where cached quantity ≠ Flow sum:

| Item | Cached Qty | Flow Sum | Drift | Last Flow | Action |
|------|-----------|----------|-------|-----------|--------|
| Cholula Hot Sauce | 3 count | 2 count | +1 (overcounted) | Waste, 2 days ago | [Correct] [Investigate] [Dismiss] |
| Olive Oil | 10 oz | 12 oz | -2 (undercounted) | Purchase, yesterday | [Correct] [Investigate] [Dismiss] |
| Sugar | 4 lbs | 4 lbs | — | Transfer, today | ✅ Matches |

Only discrepancies are shown by default. "Show all" toggle reveals matched items too.

### Per-Discrepancy Actions

**Correct** — creates an adjustment [[Flow]]:
- `flow_type` = `adjustment`
- `quantity` = delta (Flow sum - cached quantity)
- [[FlowAdjustmentDetail]]: `adjustment_type` = `cache_correction`, `expected_quantity` = cached, `actual_quantity` = Flow sum
- Cached `quantity` on InventoryItem updated to match Flow sum
- Optional reason field: "Cache drift from concurrent operations"

**Investigate** — expands to show the full Flow history for that item. Helps the admin understand *why* the drift happened (maybe a Flow was created without updating the cache, or a failed edge function left things inconsistent).

**Dismiss** — acknowledge the discrepancy without correcting. Reappears on next reconciliation if still present.

### Bulk Correct

"Correct all discrepancies" — creates adjustment Flows for every flagged item in one atomic operation via edge function.

---

## Mode 2 — Physical Count

### Step 1 — Define Scope

The admin chooses what to count:

| Scope | What's Included | Best For |
|-------|----------------|----------|
| **Full inventory** | All InventoryItems in the Crew | End-of-month full audit |
| **By Space** | All items at a selected Space (with "include children" toggle) | Counting one cabinet, one fridge, one bar section |
| **By Category** | All items in a selected Category | Counting all liquor, all produce |

### Step 2 — Count

The system generates a count sheet — a list of all InventoryItems in scope, showing the Product name and location but **hiding the expected quantity** (to avoid bias):

| Item | Location | Your Count |
|------|----------|-----------|
| Cholula Hot Sauce, 5 oz | Pantry > Shelf 2 | [___] |
| Olive Oil, 16 oz | Back > Above > Cabinet 1 | [___] |
| Sugar, 4 lb (Domino) | Pantry > Shelf 1 | [___] |
| Jasmine Rice, 2 lb | Pantry > Shelf 1 | [___] |

**Behavior:**
- Staff walks through the physical space and enters actual counts
- Items can be counted in any order
- "Not found" button for items that should be at a location but aren't visible (flags as quantity = 0)
- "Found extra item" button for items on the shelf that aren't in the system at this location (could be displaced or untracked)
- Progress indicator: "12 of 28 items counted"
- Counts auto-save as entered (no data loss if the app closes)

**Optional: Hide expected quantity** — a toggle (default on) that hides the system's expected quantity during counting. This prevents confirmation bias. Once all items are counted, the comparison screen reveals expected vs. actual.

### Step 3 — Review Discrepancies

After counting, the system compares actual counts against expected quantities:

| Item | Location | Expected | Counted | Difference | Action |
|------|----------|----------|---------|-----------|--------|
| Cholula Hot Sauce | Pantry > Shelf 2 | 3 | 2 | -1 | [Adjust] [Recount] [Dismiss] |
| Olive Oil | Cabinet 1 | 1 | 1 | — | ✅ Matches |
| Sugar | Pantry > Shelf 1 | 4 lbs | 5 lbs | +1 | [Adjust] [Recount] [Dismiss] |
| Jasmine Rice | Pantry > Shelf 1 | 2 | 0 | -2 | [Adjust] [Recount] [Dismiss] |

Only discrepancies shown by default. "Show all" reveals matches.

### Per-Discrepancy Actions

**Adjust** — creates an adjustment [[Flow]]:
- `flow_type` = `adjustment`
- `quantity` = delta (counted - expected)
- [[FlowAdjustmentDetail]]: `adjustment_type` = `physical_count`, `expected_quantity` = system value, `actual_quantity` = counted value, `audit_session_id` = this count session
- Optional reason: "Found behind other items", "Suspected spillage not logged", "Miscounted last time"
- Cached `quantity` updated to the counted value

**Recount** — clears the count for this item, puts it back in the count queue.

**Dismiss** — acknowledge without adjusting. Useful if the admin believes the system is correct and the count was wrong.

### Step 4 — Complete Audit

Summary:

| Metric | Value |
|--------|-------|
| Scope | Pantry (all children) |
| Items counted | 28 |
| Matches | 24 (86%) |
| Adjusted | 3 |
| Dismissed | 1 |
| Total adjustment value | -$8.50 (net shrinkage) |

User taps "Complete audit." All adjustment Flows share the same `audit_session_id` for grouped reporting.

---

## Audit History

Previous audit results are stored and viewable:

| Date | Type | Scope | Discrepancies | Net Adjustment |
|------|------|-------|---------------|---------------|
| Apr 1, 2026 | Physical count | Full inventory | 5 of 42 (12%) | -$12.30 |
| Mar 25, 2026 | System reconciliation | Full | 2 of 42 (5%) | +$1.50 |
| Mar 15, 2026 | Physical count | Bar area | 1 of 18 (6%) | -$4.20 |

Tapping a row shows the full discrepancy detail from that audit.

---

## Data Model Changes

**`flow_type` enum gains `adjustment`:**

The existing enum (`purchase | waste | consumption | transfer | prep_usage`) is extended to include `adjustment`. Adjustment flows follow the same Approach 4 pattern with a [[FlowAdjustmentDetail]] child table.

| flow_type | Direction | Child Table |
|-----------|----------|-------------|
| `purchase` | in | [[FlowPurchaseDetail]] |
| `waste` | out | [[WasteEvent]] |
| `consumption` | out | — |
| `transfer` | lateral | [[FlowTransferDetail]] |
| `prep_usage` | out | [[FlowPrepUsageDetail]] |
| `adjustment` | in or out (depends on delta sign) | [[FlowAdjustmentDetail]] |

---

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[InventoryItem]] | Read | Listing items for reconciliation or count sheet |
| [[InventoryItem]] | Update (cached quantity) | Correction or physical count adjustment |
| [[Flow]] | Read (aggregate sum) | System reconciliation — calculating expected quantity from Flow history |
| [[Flow]] | Insert (adjustment) | One per corrected discrepancy |
| [[FlowAdjustmentDetail]] | Insert | One per adjustment Flow |
| [[Space]] | Read | Scope selection for physical count, location display |
| [[Category]] | Read | Scope selection for physical count |
| [[Product]] | Read | Item display on count sheet |
| [[Crew]] | Read (`settings`) | Reconciliation cadence configuration |

---

## See Also

- [[Flow]] — adjustment is a new flow_type, canonical ledger is the source of truth
- [[FlowAdjustmentDetail]] — child table for adjustment-specific fields
- [[InventoryItem]] — cached quantity is what's being validated and corrected
- [[Journey - Crew Management]] — reconciliation cadence configured in Crew settings
- [[Journey - Checking Stock]] — where quantity discrepancies might first be noticed
