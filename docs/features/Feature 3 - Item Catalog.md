# Feature 3 — Item Catalog

## Entities

- [[Product]] — universal product definition
- [[Category]] — categorization (system + crew-custom)
- [[InventoryItem]] — crew-specific instance

## Summary

Two-layer split. [[Product]] is the universal definition (brand, barcode, image, size) — shared across [[Crew]]s via a master catalog. [[InventoryItem]] is a [[Crew]]'s specific instance (quantity, location, min stock, expiry). [[Crew]]s can create custom [[Product]]s and custom [[Category]]s. Same [[Product]] can appear as multiple [[InventoryItem]]s within a [[Crew]].

## Key Decisions

- Shared master catalog + crew-private custom products ([[Nullable crew_id Pattern]])
- Category override: [[Product]] has default, [[InventoryItem]] can override
- System default categories + crew-custom categories
- Same [[Product]] can have multiple [[InventoryItem]] records per [[Crew]] (one per location)

## Dependencies

- [[Feature 1 - Multi-Organization Tenancy]] — `crew_id` on all entities
- [[Feature 2 - Space Hierarchy Setup]] — [[InventoryItem]] references [[Space]]
