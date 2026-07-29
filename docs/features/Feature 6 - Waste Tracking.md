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

## Implementation Status (2026-07)

**Shipped** (`20260729113244_v1_1_waste_slice.sql` + `20260729113344_record_waste_rpc.sql`): `waste_reason` enum, slim `waste_events`, all six detail tables (immutable, RLS via flow join, INSERT asserts matching reason), and the **`record_waste` RPC** — waste flow + event + one detail row atomically, `total_cost` from `last_unit_cost`, on-hand cap, row-locked. UI: the Checking Stock "Log waste" inline action ([[Journey - Logging Waste]] v1 scope).

Deviations from the original design, recorded here:
- **`log_waste` edge function → `record_waste` plpgsql RPC.** Repo precedent: every inventory mutation is a single-transaction RPC (`record_purchase`, `restock_inventory`, `record_transfer`, `open_package`).
- **`waste_prep_failure_details.recipe_id` / `batch_id` have no FK constraints yet** — `recipes` / `batch_events` land in v1.2; add the FKs in that slice.
- **Photo capture deferred** — no storage bucket wired yet. The RPC accepts `p_photo_url`; the v1 form omits it.
- **Derived batch cost deferred to v1.2** — `total_cost` currently snapshots `quantity × last_unit_cost` (null when cost untracked).

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
