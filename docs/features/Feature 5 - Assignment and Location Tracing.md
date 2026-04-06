# Feature 5 — Assignment and Location Tracing

## Entities

Fields on [[InventoryItem]]: `home_space_id` and `current_space_id`

## Summary

Items have a designated home and a current location. Three states: unsorted (no home assigned), in place (home = current), displaced (home ≠ current). Movement history derived from transfer [[Flow]]s. Bulk assign/reassign supported.

## Three Item States

| State | Condition | Meaning |
|-------|-----------|---------|
| Unsorted | `home_space_id` is null | Placed somewhere, no designated home |
| In place | `home_space_id` = `current_space_id` | Where it belongs |
| Displaced | Both set, they don't match | Not in its home location |

## Key Decisions

- `current_space_id` is always required — defaults to active Premises on creation
- `home_space_id` is nullable — null means unsorted, not an error
- Movement history derived from transfer [[Flow]]s in the ledger
- Bulk assign/reassign generates [[Flow]] events for each item moved

## Dependencies

- [[Feature 7 - In-Out Flows]] — records movement events
- [[Feature 2 - Space Hierarchy Setup]] — both fields reference [[Space]]
