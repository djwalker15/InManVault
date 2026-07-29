# ProductComponent

> Part of [[Feature 3 - Item Catalog]], [[Feature 12 - Inventory Item Composition]]

A single line in a package [[Product]]'s **bill of materials** — "this package contains N of that product, in this unit." The composition template lives at the **catalog layer** (on the [[Product]]), like a [[Recipe]]'s ingredient list: a manufacturer's variety-pack contents are identical for every [[Crew]], so they're defined once. Ad-hoc crew bundles use a crew-private package [[Product]] with the same table.

A [[Product]] is a **package** when it has at least one active ProductComponent row (surfaced cheaply via the `is_package` flag on [[Product]]).

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `component_id` | PK | |
| `package_product_id` | FK → [[Product]] | The package this line belongs to |
| `component_product_id` | FK → [[Product]] | What's inside (the child product) |
| `quantity` | numeric | **> 0** — how many child units per **single** package |
| `unit` | FK → [[UnitDefinition]] | The child line's unit (e.g., `count`, `g`, `ml`) |
| `sort_order` | int | Display order within the composition |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

**Constraint:** `unique (package_product_id, component_product_id) where deleted_at is null` — a child product appears at most once in an active composition (raise its `quantity` instead of adding a second row).

## Behavior

- **Mutable + soft-deletable.** Catalog editors fix bad compositions; removing a line is a soft delete (`deleted_at`). This is unlike the immutable flow/event tables — the *template* can change, but a past [[PackageBreakEvent]] froze the composition it used at break time.
- **No own `crew_id`.** Visibility/RLS is **derived by joining to the package [[Product]]** — a master-catalog package's components are global; a crew-private package's components are crew-scoped. Follows the spirit of the [[Nullable crew_id Pattern]] without a redundant column.
- **Single-row multipacks ride the same rails.** A case of 24 identical waters is one ProductComponent (`quantity = 24`) — no separate machinery.
- **Quantity is per single package.** At break time the [[PackageBreakEvent]] multiplies by `quantity_opened` to get child quantities produced.
- **v1 points at a specific [[Product]]** (`component_product_id`). A future extension could allow a [[ProductGroup]] reference for generic kits — parallels the [[RecipeIngredient]] product/group split. Out of scope now.

## Validation (authoring)

- `quantity > 0`; `unit` must be a valid [[UnitDefinition]].
- `component_product_id ≠ package_product_id` (a package can't contain itself).
- A child that is itself a package is allowed but **not auto-exploded** on break — opening yields the sealed child package as one item (no recursive break in v1).
- Marking [[Product]] `is_package = true` requires at least one active component row.

## Relationships

- Belongs to a package [[Product]] via `package_product_id`
- References the child [[Product]] via `component_product_id`
- References [[UnitDefinition]] for the line's unit
- Read by [[PackageBreakEvent]] / the `open_package` RPC to compute child yields

## See Also

- [[Feature 12 - Inventory Item Composition]] — the design record (BOM template, break-on-open model, cost rule)
- [[Product]] — `is_package`, has-many components
- [[PackageBreakEvent]] — consumes this template when a sealed pack is opened
- [[Journey - Opening a Package]] — both the authoring (catalog) and break (instance) flows
- [[RecipeIngredient]] — the analogous BOM line for recipes
