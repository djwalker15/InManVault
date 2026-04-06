# Feature 11 — Kiosk Mode

## Entities

- [[KioskSession]] — device-level session
- `kiosk_pin` field on [[CrewMember]]

## Summary

Device-level auth for shared-use environments (bar, family kitchen). Crew members identify via PIN or name selection instead of full login. Admin-configurable action whitelist per kiosk. All actions still user-stamped for attribution.

## Key Decisions

- Kiosk is scoped to a [[Crew]] and a specific Premises ([[Space]])
- Auth method (PIN vs. name tap) configurable per [[Crew]]
- Allowed actions configurable per kiosk by Admin
- All actions still capture `performed_by` — see [[User Attribution]]

## Dependencies

- [[Feature 1 - Multi-Organization Tenancy]] — [[Crew]] / [[CrewMember]]
- [[Feature 2 - Space Hierarchy Setup]] — kiosk tied to a Premises ([[Space]])
- [[Feature 7 - In-Out Flows]] — kiosk actions generate [[Flow]]s
