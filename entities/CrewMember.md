# CrewMember

> Part of [[Feature 1 - Multi-Organization Tenancy]]

Join table linking [[User]]s to [[Crew]]s. Carries role and permission data.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `crew_member_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `user_id` | text FK → [[User]] | Clerk user ID |
| `role` | enum | Admin \| Member \| Viewer (default permissions) |
| `permission_overrides` | JSON | Per-feature granular overrides |
| `kiosk_pin` | text (hashed) | **Required.** Set during sign-up or invite acceptance. Used for [[KioskSession]] two-step identification (name select → PIN confirm). |
| `joined_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete. Former members still appear in historical attribution. |

## Key Decisions

- Roles provide sensible defaults; per-feature overrides allow fine-grained control (e.g., a Member who can edit inventory but not recipes)
- **`kiosk_pin` is required** — every crew member must set one during onboarding (sign-up for crew creators, invite acceptance for joiners). This ensures kiosk identification is always available without additional setup.
- `user_id` is a text field matching Clerk's string-based user ID, not a UUID or integer
- **Soft delete:** A member who leaves should still appear in historical `performed_by` / `logged_by` attribution

## Relationships

- Belongs to [[Crew]]
- Belongs to [[User]]
- `kiosk_pin` used by [[KioskSession]] for two-step identification (name + PIN)
