# InventoryItem

> Part of [[Feature 3 - Item Catalog]], [[Feature 4 - Inventory Level Tracking]], [[Feature 5 - Assignment and Location Tracing]], [[Feature 12 - Inventory Item Composition]]

A [[Crew]]'s specific instance of a [[Product]] at a location. This is the "how much do we have and where is it?" layer. The same [[Product]] can appear as multiple InventoryItems within a [[Crew]] (e.g., Cholula in the pantry AND on the countertop are two separate records).

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `inventory_item_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `product_id` | FK → [[Product]] | |
| `home_space_id` | FK → [[Space]] | Nullable — null means "no designated home yet" |
| `current_space_id` | FK → [[Space]] | **Required** — defaults to active Premises on creation |
| `category_id` | FK → [[Category]] | Nullable — overrides [[Product]]'s default category if set |
| `quantity` | numeric | **Cached value** — derived from [[Flow]] ledger. See note below. |
| `unit` | text | |
| `min_stock` | numeric | Nullable — threshold for low stock alerts |
| `expiry_date` | date | Nullable |
| `last_unit_cost` | numeric | Updated on purchase [[Flow]]s |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Quantity Is a Cache

> **Critical:** `quantity` is NOT the source of truth. The [[Flow]] ledger is canonical. Every operation that changes quantity MUST create a [[Flow]] — no direct quantity updates allowed.
>
> `quantity` is updated on every Flow for fast reads. A reconciliation function periodically recalculates quantity by summing all Flows for each item and correcting any drift. If cached quantity and flow sum disagree, **the flow sum wins**.

## Packages — Sealed Stock vs. Loose Children

When the [[Product]] is a package (`is_package = true`), the InventoryItem holds **sealed packs** — `quantity` counts unopened packages, not their contents. **Opening** a pack is the moment it converts into child items: a [[PackageBreakEvent]] writes one `package_break` out-[[Flow]] on this item and N `package_yield` in-[[Flow]]s on the children. Both levels are ordinary InventoryItems — **no special table** — so the quantity-as-cache invariant holds at both.

- A break is **not** triggered at purchase — you can simultaneously hold *2 sealed packs* and *3 loose Cokes* from a previously-opened pack, and every number is cache-consistent.
- Child resolution at break time **merges into an existing** child item (within-category unit-convert) or **creates a new one** — the same merge-vs-create resolution as batch store-output and shopping checkout.
- "Remaining composition" of an opened pack = the current child item levels. Consuming/wasting a loose child is a normal `consumption`/`waste` Flow on the child — no package awareness. Wasting a *sealed* pack is a normal `waste` Flow on the package item at pack cost — it does **not** spawn children.

See [[Feature 12 - Inventory Item Composition]] and [[Journey - Opening a Package]].

## Three Item States

Derived from the two space fields:

- **Unsorted** — `home_space_id` is null (placed somewhere, but no designated home)
- **In place** — `home_space_id` = `current_space_id`
- **Displaced** — both set, but they don't match

## Alert Types

- **Low stock** — `quantity` < `min_stock`
- **Out of stock** — `quantity` = 0
- **Expiry approaching** — `expiry_date` within configurable threshold
- **Expired** — `expiry_date` has passed

## Key Decisions

- `current_space_id` is always required (an item is always *somewhere*) — defaults to the [[Crew]]'s active Premises on creation
- `home_space_id` is nullable — null means unsorted, not an error
- Can point to any level in the [[Space]] hierarchy, not just leaf nodes
- `category_id` override allows a [[Crew]] to recategorize a [[Product]] for their own context
- `last_unit_cost` updated whenever a purchase [[Flow]] is recorded — applies to the specific item being restocked
- **Soft delete:** Uses `deleted_at`. Historical [[Flow]]s and [[WasteEvent]]s can still reference deleted items.

## Relationships

- Belongs to [[Crew]]
- References [[Product]] for universal product info
- References [[Space]] twice (home and current)
- Optionally overrides [[Category]]
- Has many [[Flow]]s (the transaction history for this item)
- Referenced by [[BatchInput]] when consumed in a batch
- Referenced by [[BatchOutput]] when produced by a batch
- Referenced by [[WasteEvent]] (via Flow) when wasted
- Referenced by [[ShoppingListItem]] as `source_inventory_item_id`
- As a package: referenced by [[PackageBreakEvent]] as `package_inventory_item_id` (the pack being opened); children are created/merged by the break

## See Also

- [[Cost Data Flow]] — `last_unit_cost` is part of the cost pipeline
