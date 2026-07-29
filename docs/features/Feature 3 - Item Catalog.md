# Feature 3 — Item Catalog

## Entities

- [[Product]] — universal product definition (incl. `is_package` flag)
- [[Category]] — categorization (system + crew-custom)
- [[InventoryItem]] — crew-specific instance
- [[ProductComponent]] — a line in a package [[Product]]'s bill of materials (composition template)

## Summary

Two-layer split. [[Product]] is the universal definition (brand, barcode, image, size) — shared across [[Crew]]s via a master catalog. [[InventoryItem]] is a [[Crew]]'s specific instance (quantity, location, min stock, expiry). [[Crew]]s can create custom [[Product]]s and custom [[Category]]s. Same [[Product]] can appear as multiple [[InventoryItem]]s within a [[Crew]].

## Composition Templates (Packages)

A [[Product]] can be a **package** whose contents are tracked individually (a variety 12-pack, a case of 24 waters, an ad-hoc crew bundle). Its bill of materials lives at the **catalog layer** in [[ProductComponent]] rows — defined once and shared by every [[Crew]] for master-catalog packages, exactly like a [[Recipe]]'s ingredient list. `is_package` on [[Product]] is the app-maintained "has active components" flag.

Authoring (mark as package, add/edit component rows: child product + qty + unit, master-catalog seeding) and breaking (open a sealed pack into children) are both covered by [[Journey - Opening a Package]]; the data-model design record is [[Feature 12 - Inventory Item Composition]]. Components are **mutable + soft-deletable** (catalog editors fix bad compositions); a past break froze the composition it used.

## Key Decisions

- Shared master catalog + crew-private custom products ([[Nullable crew_id Pattern]])
- Category override: [[Product]] has default, [[InventoryItem]] can override
- System default categories + crew-custom categories
- Same [[Product]] can have multiple [[InventoryItem]] records per [[Crew]] (one per location)
- **Package composition lives on the catalog [[Product]]**, not per physical box ([[ProductComponent]]); `is_package` is a stored convenience flag

## Dependencies

- [[Feature 1 - Multi-Organization Tenancy]] — `crew_id` on all entities
- [[Feature 2 - Space Hierarchy Setup]] — [[InventoryItem]] references [[Space]]
- [[Feature 12 - Inventory Item Composition]] — composition templates + the break operation build on this feature's catalog layer
