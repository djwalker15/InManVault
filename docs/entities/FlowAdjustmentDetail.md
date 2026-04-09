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

- The parent [[Flow]]'s `quantity` is the **delta**: `actual_quantity - expected_quantity`. Positive = inventory was undercounted (adjustment adds). Negative = inventory was overcounted (adjustment subtracts).
- Cached `quantity` on [[InventoryItem]] is updated to match `actual_quantity`
- **Direction is derived:** positive delta = in, negative delta = out (consistent with other flow types)

## Adjustment Types

| Type | Trigger | `expected_quantity` Source | `actual_quantity` Source |
|------|---------|--------------------------|------------------------|
| `cache_correction` | System reconciliation found cached qty ≠ Flow sum | Cached `quantity` on InventoryItem | Sum of all Flows for that item |
| `physical_count` | Staff physically counted and entered a different number | Cached `quantity` on InventoryItem (which should equal Flow sum after any cache correction) | User-entered count |

## See Also

- [[Flow]] — parent entity
- [[Journey - Inventory Audit]] — the full audit workflow
