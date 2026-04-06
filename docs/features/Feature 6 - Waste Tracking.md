# Feature 6 — Waste Tracking

## Entities

- [[WasteEvent]] — core waste record
- [[WasteExpiredDetail]] — context for expired items
- [[WasteSpoilageDetail]] — context for spoiled items
- [[WasteDamageDetail]] — context for damaged items
- [[WastePrepFailureDetail]] — context for prep failures
- [[WasteSpillDetail]] — context for spills
- [[WasteOtherDetail]] — catch-all context

## Summary

Six waste reasons, each with its own context-specific detail table for structured, queryable diagnostics. Partial waste supported. Cost tracked at time of waste, including derived cost for recipe-produced items. Photos and notes on every event. Pattern detection is a future enhancement.

## Waste Reasons

| Reason | Detail Table | Key Context Captured |
|--------|-------------|---------------------|
| expired | [[WasteExpiredDetail]] | Expiry date, days past, storage location, opened status |
| spoiled | [[WasteSpoilageDetail]] | Storage location, container type, conditions, days since opened |
| damaged | [[WasteDamageDetail]] | How damaged, where, packaging issue |
| prep_failure | [[WastePrepFailureDetail]] | Which [[Recipe]], what went wrong, who was prepping |
| spilled | [[WasteSpillDetail]] | Where spilled, how, during what activity |
| other | [[WasteOtherDetail]] | Freeform description |

## Dependencies

- [[Feature 7 - In-Out Flows]] — waste events are a type of outflow in the [[Flow]] ledger
- [[Feature 3 - Item Catalog]] — links to [[InventoryItem]] and [[Product]]
- [[Feature 8 - Recipes]] / [[Feature 9 - Batching and Prepping]] — prep failure references [[Recipe]]; derived item cost from [[BatchEvent]]
- [[Feature 2 - Space Hierarchy Setup]] — storage [[Space]] at time of waste
