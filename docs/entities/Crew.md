# Crew

> Part of [[Feature 1 - Multi-Organization Tenancy]]

The tenant boundary for the entire system. Everything downstream — [[Space]]s, [[InventoryItem]]s, [[Recipe]]s, [[ShoppingList]]s — belongs to a Crew.

A Crew represents any group using InMan together: a solo person in an apartment, a family household, or a business like a bar. The name was chosen to feel natural at every scale — "my crew of one" through "the Haywire crew."

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `crew_id` | PK | |
| `name` | text | |
| `owner_id` | text FK → [[User]] | **The Crew Owner.** Has all Admin privileges plus: delete crew, transfer ownership, remove Admins. Exactly one owner per Crew. |
| `created_by` | text FK → [[User]] | Clerk user ID — who originally created the crew (may differ from owner if transferred) |
| `settings` | JSON | Configurable preferences (low stock threshold, expiry alert threshold, default currency, etc.) |
| `deletion_requested_at` | timestamp | Nullable — set when Owner requests deletion, starts 48-hour countdown |
| `deletion_requested_by` | text FK → [[User]] | Nullable — Clerk user ID of who requested deletion |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |

## Ownership

The Owner is distinct from Admin. On crew creation, the creator becomes both the Owner and an Admin [[CrewMember]].

| Capability | Viewer | Member | Admin | Owner |
|-----------|--------|--------|-------|-------|
| View data | ✅ | ✅ | ✅ | ✅ |
| Edit data | ❌ | ✅ | ✅ | ✅ |
| Manage members | ❌ | ❌ | ✅ (not other Admins) | ✅ (everyone) |
| Invite members | ❌ | ❌ | ✅ | ✅ |
| Change roles | ❌ | ❌ | ✅ (Members/Viewers only) | ✅ (anyone) |
| Remove Admins | ❌ | ❌ | ❌ | ✅ |
| Transfer ownership | ❌ | ❌ | ❌ | ✅ |
| Delete crew | ❌ | ❌ | ❌ | ✅ |

## Crew Deletion

Deletion has a **48-hour waiting period**:
1. Owner requests deletion → `deletion_requested_at` set, all members notified
2. Crew remains functional during the waiting period with a warning banner
3. Owner can cancel at any time
4. After 48 hours, a scheduled job soft-deletes the Crew and cascades to all child entities
5. Immutable records ([[Flow]], [[WasteEvent]], [[BatchEvent]]) are not deleted but become inaccessible via RLS

## Relationships

- Has many [[CrewMember]]s (join to [[User]])
- Has an Owner ([[User]] via `owner_id`)
- Has many [[Space]]s (one or more root Premises)
- Has many [[InventoryItem]]s
- Has many [[Recipe]]s (crew-private ones)
- Has many [[ShoppingList]]s
- Has many [[Category]] records (crew-custom ones)
- Has many [[KioskSession]]s
- Has many [[Flow]]s
- Has many [[WasteEvent]]s (via Flows)
- Has many [[BatchEvent]]s
- Has many [[IntakeSession]]s
- Has many [[Invite]]s

## See Also

- [[Nullable crew_id Pattern]] — [[Product]], [[Category]], and [[Recipe]] use nullable `crew_id` to distinguish global vs. crew-scoped records
- [[User Attribution]] — all state-changing actions within a Crew are user-stamped
- [[Journey - Crew Management]] — the full crew administration journey
