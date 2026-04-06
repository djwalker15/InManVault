# Space

> Part of [[Feature 2 - Space Hierarchy Setup]]

A physical node in the organizational hierarchy. Uses a self-referencing `parent_id` to support arbitrarily deep nesting.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `space_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `name` | text | Short name only (e.g., "Cabinet 1", "Kitchen"). Full paths derived at runtime. |
| `unit_type` | enum | One of 7 types (see hierarchy below) |
| `parent_id` | FK → Space | Nullable — null only for root Premises |
| `notes` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Unit Type Hierarchy (7 levels)

| Level | unit_type | Role | Examples |
|-------|-----------|------|----------|
| 1 | `premises` | Physical property | My House, Lake House |
| 2 | `area` | Room or functional space | Kitchen, Garage, Bar |
| 3 | `zone` | Named region within an area | Back, Center, Side, Pantry, Fridge |
| 4 | `section` | Positional subdivision | Above, Below, Top, Front |
| 5 | `sub_section` | Fixed infrastructure unit | Cabinet 1, Drawer 2, Freezer Drawer |
| 6 | `container` | Portable/removable storage | Spice rack, Drawer organizer, Cambro, Tool tray |
| 7 | `shelf` | Shelf within sub_section or container | Shelf 1, Shelf 3 |

## Key Decisions

- **Structural vs. portable split:** `sub_section` = fixed infrastructure (bolted to the wall), `container` = portable storage (can be picked up and moved). Previously cabinets/drawers were typed as `container`; they are now `sub_section`.
- **Shelves are flexible:** Can be children of either `sub_section` or `container`.
- **Not every level required:** A path can skip levels (e.g., `zone → section → shelf` with no sub_section or container).
- **Multiple root Premises per [[Crew]]:** A crew can manage "My House" and "Lake House" simultaneously.
- **Full paths never stored:** Always derived at runtime via `parent_id` chain using recursive CTE or breadcrumb walk.
- **Soft delete:** Uses `deleted_at`. Historical [[Flow]]s and waste detail tables can still reference deleted spaces for context.

## Relationships

- Belongs to [[Crew]]
- Self-referencing parent/children via `parent_id`
- Referenced by [[InventoryItem]] as `home_space_id` and `current_space_id`
- Referenced by [[Flow]] as `from_space_id` and `to_space_id` (transfers)
- Referenced by [[WasteSpoilageDetail]], [[WasteSpillDetail]], [[WasteDamageDetail]], [[WasteExpiredDetail]] for storage context
- Referenced by [[BatchEvent]] as `output_space_id`
- Referenced by [[KioskSession]] as `premises_id`
