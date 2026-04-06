# Flow

> Part of [[Feature 7 - In-Out Flows]]

The core transaction ledger. Every change to inventory — purchases, waste, consumption, transfers, prep usage — is recorded as a Flow event. This is the **single source of truth** for inventory level history, movement history, and quantity. The `quantity` field on [[InventoryItem]] is a cache derived from Flows.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `flow_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `inventory_item_id` | FK → [[InventoryItem]] | |
| `flow_type` | enum | purchase \| waste \| consumption \| transfer \| prep_usage |
| `quantity` | numeric | |
| `unit` | text | |
| `unit_cost` | numeric | Nullable — cost at time of transaction |
| `from_space_id` | FK → [[Space]] | Nullable — for transfers |
| `to_space_id` | FK → [[Space]] | Nullable — for transfers |
| `source` | text | Nullable — store/vendor name for purchases |
| `performed_by` | text FK → [[User]] | Clerk user ID |
| `performed_at` | timestamp | |
| `notes` | text | |

> **No `direction` column.** Direction is derived from `flow_type`: purchase = in, waste/consumption/prep_usage = out, transfer = lateral (no quantity change).

## Flow Types

| flow_type | Derived direction | Effect | Linked entity |
|-----------|------------------|--------|---------------|
| `purchase` | in | Increases cached quantity, updates `last_unit_cost` | Future: Vendor / receipt |
| `waste` | out | Decreases cached quantity | [[WasteEvent]] |
| `consumption` | out | Decreases cached quantity | — |
| `transfer` | lateral | Updates `current_space_id`, no quantity change | Uses `from_space_id` / `to_space_id` |
| `prep_usage` | out | Decreases cached quantity (ingredient consumed) | [[BatchInput]] / [[BatchEvent]] |

## Key Decisions

- **Flow ledger is canonical.** `quantity` on [[InventoryItem]] is a cache updated on every Flow. A reconciliation function recalculates from Flows and corrects drift. If they disagree, the flow sum wins.
- Every flow is user-stamped (`performed_by`) — including those from [[KioskSession]]
- `direction` was intentionally omitted — it's fully derivable from `flow_type` and was ambiguous for transfers
- This single ledger powers:
  - **Inventory level history** ([[Feature 4 - Inventory Level Tracking]]) — filter flows by item over time
  - **Movement history** ([[Feature 5 - Assignment and Location Tracing]]) — filter transfer flows by item
  - **Waste reporting** ([[Feature 6 - Waste Tracking]]) — aggregate waste flows by reason, category, time
  - **Cost tracking** ([[Cost Data Flow]]) — purchase flows establish cost, waste/consumption flows report cost of goods used
- Purchase source/receipt tracking is deferred — `source` is a simple string for now
- **Immutable record** — Flows are never modified or deleted after creation

## Relationships

- Belongs to [[Crew]]
- References [[InventoryItem]]
- References [[Space]] (from/to for transfers)
- References [[User]] as `performed_by`
- Waste flows link to [[WasteEvent]]
- Prep usage flows link to [[BatchInput]]

## See Also

- [[User Attribution]]
- [[Cost Data Flow]]
