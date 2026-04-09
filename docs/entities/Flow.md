# Flow

> Part of [[Feature 7 - In-Out Flows]]

The core transaction ledger. Every change to inventory is recorded as a Flow event. Uses the **enum + child table pattern**: the `flow_type` enum declares what kind of transaction this is, and a child table row (if applicable) holds type-specific fields.

This is the **single source of truth** for inventory level history, movement history, and quantity. The `quantity` field on [[InventoryItem]] is a cache derived from Flows.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `flow_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `inventory_item_id` | FK → [[InventoryItem]] | |
| `flow_type` | enum | `purchase` \| `waste` \| `consumption` \| `transfer` \| `prep_usage` \| `adjustment` |
| `quantity` | numeric | |
| `unit` | text | |
| `performed_by` | text FK → [[User]] | Clerk user ID |
| `performed_at` | timestamp | |
| `notes` | text | |

## Child Tables

Zero or one child row per Flow, determined by `flow_type`:

| flow_type | Derived Direction | Child Table | Has Child Row? |
|-----------|------------------|-------------|---------------|
| `purchase` | in | [[FlowPurchaseDetail]] | Yes — `unit_cost`, `source` |
| `waste` | out | [[WasteEvent]] | Yes — waste reason, total_cost, photo, notes, + detail table |
| `consumption` | out | — | No — no extra fields needed |
| `transfer` | lateral | [[FlowTransferDetail]] | Yes — `from_space_id`, `to_space_id` |
| `prep_usage` | out | [[FlowPrepUsageDetail]] | Yes — `batch_id` |
| `adjustment` | in or out | [[FlowAdjustmentDetail]] | Yes — `adjustment_type`, `expected_quantity`, `actual_quantity`, `audit_session_id`, `reason` |

## Key Decisions

- **Flow ledger is canonical.** `quantity` on [[InventoryItem]] is a cache updated on every Flow. A reconciliation function corrects drift. If they disagree, the flow sum wins.
- **No `direction` column.** Direction is derived from `flow_type` (purchase = in, waste/consumption/prep_usage = out, transfer = lateral, adjustment = depends on delta sign).
- **Type-specific fields live in child tables.** The base Flow is a clean, universal transaction record. Purchase details, transfer locations, prep usage batch links, and waste details all live in their respective child tables.
- Every flow is user-stamped (`performed_by`) — including those from [[KioskSession]]
- **Immutable record** — Flows are never modified or deleted after creation

## Relationships

- Belongs to [[Crew]]
- References [[InventoryItem]]
- References [[User]] as `performed_by`
- Has zero or one child row depending on `flow_type`

## See Also

- [[FlowPurchaseDetail]] — purchase-specific fields
- [[FlowTransferDetail]] — transfer-specific fields
- [[FlowPrepUsageDetail]] — prep usage-specific fields
- [[FlowAdjustmentDetail]] — adjustment-specific fields (cache correction, physical count)
- [[WasteEvent]] — waste-specific fields (the existing waste child table)
- [[User Attribution]]
- [[Cost Data Flow]]
