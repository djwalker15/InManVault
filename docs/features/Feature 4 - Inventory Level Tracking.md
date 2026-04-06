# Feature 4 — Inventory Level Tracking

## Entities

No new tables — driven by fields on [[InventoryItem]] (`quantity`, `min_stock`, `expiry_date`) and the [[Flow]] ledger.

## Summary

Three alert types: low stock, out of stock, expiry. Updates progress from manual → smart suggestions (recipe-driven deductions) → barcode automation. Level history over time is derived from [[Flow]] records, not stored as snapshots.

## Alert Types

- **Low stock** — `quantity` < `min_stock` on [[InventoryItem]]
- **Out of stock** — `quantity` = 0
- **Expiry approaching** — `expiry_date` within configurable threshold
- **Expired** — `expiry_date` has passed

## Dependencies

- [[Feature 7 - In-Out Flows]] — [[Flow]] provides the transaction history that powers level tracking over time
- [[Feature 8 - Recipes]] / [[Feature 9 - Batching and Prepping]] — feed "smart suggestion" deductions
