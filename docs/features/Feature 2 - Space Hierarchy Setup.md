# Feature 2 — Space Hierarchy Setup

## Entities

- [[Space]] — self-referencing hierarchy node
- [[SpaceTemplate]] — pre-built blueprints

## Summary

Self-referencing hierarchy with 7 unit types: `premises → area → zone → section → sub_section → container → shelf`. Key distinction: `sub_section` is fixed infrastructure (cabinets, drawers), `container` is portable/removable storage (organizers, cambros, bins). Multiple root Premises per [[Crew]]. [[SpaceTemplate]]s provide pre-built blueprints for quick setup.

## Key Decisions

- 7 unit types with structural vs. portable split
- Shelves can be children of either `sub_section` or `container`
- Not every level required in a given path
- Short names only — full paths derived at runtime
- Multiple root Premises per [[Crew]]
- `crew_id` on [[Space]] for multi-tenant ownership

## Referenced By

- [[InventoryItem]] — `home_space_id` and `current_space_id`
- [[Flow]] — `from_space_id` and `to_space_id` for transfers
- [[WasteEvent]] detail tables — storage context at time of waste
- [[BatchEvent]] — `output_space_id`
- [[KioskSession]] — `premises_id`
