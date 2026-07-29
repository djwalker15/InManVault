# FlowAdjustmentDetail

> Child table of [[Flow]] when `flow_type` = `adjustment`

Adjustment-specific fields for a correction to inventory quantity. Created during system reconciliation (cache drift) or physical count audits.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `flow_id` | FK → [[Flow]] | PK — one-to-one with parent |
| `adjustment_type` | enum | `cache_correction` \| `physical_count` |
| `expected_quantity` | numeric | What the system thought the quantity was before adjustment |
| `actual_quantity` | numeric | The corrected quantity (from Flow sum for cache correction, from physical count for physical count) |
| `audit_session_id` | text | Nullable — groups adjustments from the same audit session for reporting |
| `reason` | text | Nullable — user-provided explanation ("found extra behind other items", "suspected theft") |

## Behavior

- The parent [[Flow]]'s `quantity` stores the **absolute delta**: `abs(actual_quantity - expected_quantity)`. The `flows` table has a `check (quantity >= 0)` constraint, so a signed delta cannot live on the flow row — **direction derives from this detail row** (`actual_quantity - expected_quantity`: positive = undercounted, adjustment adds; negative = overcounted, adjustment subtracts).
- Cached `quantity` on [[InventoryItem]] is updated to match `actual_quantity` by the `flow_adjustment_apply` trigger (fires on detail insert; the generic quantity-cache trigger deliberately ignores `adjustment` flows).
- Written atomically by the `record_adjustment` RPC (single-item physical count, shipped 2026-07; admin/owner-gated, matching this table's INSERT policy). The full [[Journey - Inventory Audit]] audit mode will reuse the same RPC with `audit_session_id` populated.

## Adjustment Types

| Type | Trigger | `expected_quantity` Source | `actual_quantity` Source |
|------|---------|--------------------------|------------------------|
| `cache_correction` | System reconciliation found cached qty ≠ Flow sum | Cached `quantity` on InventoryItem | Sum of all Flows for that item |
| `physical_count` | Staff physically counted and entered a different number | Cached `quantity` on InventoryItem (which should equal Flow sum after any cache correction) | User-entered count |

## See Also

- [[Flow]] — parent entity
- [[Journey - Inventory Audit]] — the full audit workflow
