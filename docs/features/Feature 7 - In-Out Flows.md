# Feature 7 — In/Out Flows

## Entities

- [[Flow]] — unified transaction ledger

## Summary

Unified transaction ledger. Five flow types: purchase (in), waste (out), consumption (out), transfer (move), prep_usage (out). Every flow is user-stamped. Powers inventory level history, movement history, waste reporting, and cost tracking. Purchase source/receipt tracking deferred.

## What This Ledger Powers

| Downstream Feature | How Flows Are Used |
|-------------------|-------------------|
| [[Feature 4 - Inventory Level Tracking]] | Filter flows by item over time for level history |
| [[Feature 5 - Assignment and Location Tracing]] | Transfer flows provide movement history |
| [[Feature 6 - Waste Tracking]] | Waste flows link to [[WasteEvent]]s for detailed reporting |
| [[Cost Data Flow]] | Purchase flows establish cost; all flows report cost of goods used |

## Key Decisions

- Every flow is user-stamped (`performed_by`) — including from [[KioskSession]]
- Single ledger for all transaction types — no separate history tables
- Purchase source/receipt tracking deferred — `source` is a simple string for now

## Dependencies

- [[Feature 3 - Item Catalog]] — [[Flow]] references [[InventoryItem]]
- [[Feature 2 - Space Hierarchy Setup]] — transfer flows reference [[Space]]
- [[Feature 1 - Multi-Organization Tenancy]] — [[Flow]] references [[User]]
