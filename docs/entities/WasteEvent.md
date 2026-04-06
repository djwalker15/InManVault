# WasteEvent

> Part of [[Feature 6 - Waste Tracking]]

A specialized record linked to a waste [[Flow]]. Captures the reason, cost, and context-dependent details about why inventory was lost.

**This is a slim table.** Quantity, item, crew, unit cost, and user attribution are all derived by joining to the parent [[Flow]] via `flow_id`. Only waste-specific fields live here.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `waste_event_id` | PK | |
| `flow_id` | FK → [[Flow]] | Join to get crew_id, inventory_item_id, quantity, unit_cost, performed_by, performed_at |
| `waste_reason` | enum | expired \| spoiled \| damaged \| prep_failure \| spilled \| other |
| `total_cost` | numeric | Calculated — includes derived/recipe cost for batch-produced items. This is genuinely new data not on the Flow. |
| `notes` | text | |
| `photo_url` | text | |

> **Fields intentionally NOT on this table** (derive from Flow): crew_id, inventory_item_id, quantity_wasted, unit_cost, logged_by, logged_at. This eliminates data drift between WasteEvent and its Flow.

## Key Decisions

- Each waste reason has its own detail table with context-specific fields
- Photos and notes are captured on every waste event
- `total_cost` includes derived cost for recipe-produced items (e.g., a wasted bottle of housemade simple syrup costs the sum of its [[Recipe]] inputs)
- Pattern detection (e.g., "items in Crisper expire 2x more often") is a future enhancement built on this logging foundation
- **Immutable record** — WasteEvents are never modified or deleted after creation

## Detail Tables

Each WasteEvent has exactly one detail record, determined by `waste_reason`:

| Reason | Detail Table |
|--------|-------------|
| expired | [[WasteExpiredDetail]] |
| spoiled | [[WasteSpoilageDetail]] |
| damaged | [[WasteDamageDetail]] |
| prep_failure | [[WastePrepFailureDetail]] |
| spilled | [[WasteSpillDetail]] |
| other | [[WasteOtherDetail]] |

## Relationships

- Links to a waste [[Flow]] (the single source for quantity, item, crew, user, cost)
- Has exactly one detail record (see table above)

## See Also

- [[Cost Data Flow]] — waste costing includes derived cost for batch-produced items
