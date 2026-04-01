# KioskSession

> Part of [[Feature 11 - Kiosk Mode]]

A device-level session that allows [[CrewMember]]s to interact with the system without full authentication. The device stays logged in to the [[Crew]]; individuals identify via **name selection + PIN confirmation** (two-step).

## Auth Architecture (Path B — Kiosk Token)

The kiosk gets its own auth mechanism independent of Clerk. When an admin enrolls a device:
1. System generates a unique token and stores its **hash** in the DB
2. The **raw token** is stored in the device's local storage
3. On each app load, the device sends the token to a Supabase edge function
4. The edge function hashes the received token, matches against `token_hash`, validates `is_active = true`
5. If valid, the edge function handles all data operations using the service role key
6. Individual crew member identification (name select → PIN confirm) sets `performed_by` on all actions

This means the kiosk operates **independently of any Clerk session**. The admin who enrolled it can log out — the kiosk continues running until explicitly deactivated.

## Identification Flow

Kiosk identification is always **two-step** — name AND PIN, not name OR PIN:

1. **Select your name** — list of active [[CrewMember]]s for this [[Crew]]
2. **Enter your PIN** — 4+ digit PIN matched against `kiosk_pin` on [[CrewMember]]
3. If correct → kiosk UI renders with allowed actions, `performed_by` set to that [[User]]
4. If incorrect → error, retry (with brute-force protection)

After a configurable inactivity timeout, the kiosk returns to the "Select your name" screen.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `session_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `premises_id` | FK → [[Space]] | Which Premises this kiosk serves |
| `device_name` | text | e.g., "Bar Tablet", "Kitchen iPad" |
| `allowed_actions` | JSON | Admin-configured whitelist of actions |
| `token_hash` | text | Hashed kiosk token — raw token lives on device only |
| `is_active` | bool | Admin can deactivate to kill the session remotely |
| `created_by` | text FK → [[User]] | Clerk user ID — admin who enrolled the device |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

> **`auth_method` removed.** Identification is always name + PIN (two-step). No longer configurable per kiosk.

## Device-Level vs App-Level Security

InMan's responsibility is to reliably honor the kiosk token — detect it on boot, validate it, and render the kiosk UI. Physical device lockdown (preventing users from leaving the app, clearing storage, or accessing settings) is handled by OS-level features:
- **Android:** Lock Task / Kiosk Mode
- **iOS:** Guided Access

For a home kitchen, OS lockdown isn't necessary. For Haywire, the tablet would use OS-level lockdown alongside InMan's kiosk mode.

## Key Decisions

- **Two-step identification:** Always name select → PIN confirm. Not configurable per kiosk.
- Kiosk is scoped to a [[Crew]] and a specific Premises ([[Space]])
- Allowed actions are configurable per kiosk by Admin
- All actions still capture `performed_by` — resolved from name + PIN identification via edge functions
- Token is independent of Clerk — survives admin logout, session expiry, browser restart
- Token can be invalidated server-side by setting `is_active = false`
- If device storage is cleared, the kiosk stops working until an admin re-enrolls it
- **Soft delete:** Uses `deleted_at`.

## Relationships

- Belongs to [[Crew]]
- Bound to a Premises ([[Space]])
- Created by [[User]] (admin)
- Actions generate [[Flow]]s, [[WasteEvent]]s, etc. via edge functions

## See Also

- [[User Attribution]] — kiosk actions are still user-stamped
- [[CrewMember]] — `kiosk_pin` field (required) for PIN-based identification
- [[Journey - Onboarding]] — kiosk enrollment is Path C of the onboarding flow
