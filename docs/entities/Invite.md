# Invite

> Part of [[Feature 1 - Multi-Organization Tenancy]]

An invitation for someone to join a [[Crew]]. Created by an Admin, sent via email with a unique invite code. The invite link routes to `/invite/:code`.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `invite_id` | PK | |
| `crew_id` | FK → [[Crew]] | Which Crew the invitee will join |
| `invited_by` | text FK → [[User]] | Clerk user ID of the Admin who sent the invite |
| `email` | text | Email address the invite was sent to |
| `role` | enum | Admin \| Member \| Viewer — the role the invitee will receive |
| `code` | text | Unique invite code (used in the URL `/invite/:code`) |
| `status` | enum | pending \| accepted \| expired \| revoked |
| `accepted_by` | text FK → [[User]] | Nullable — Clerk user ID of the user who accepted |
| `created_at` | timestamp | |
| `accepted_at` | timestamp | Nullable |
| `expires_at` | timestamp | Nullable — optional expiry for time-limited invites |

## Lifecycle

1. Admin creates invite → `status` = pending, `code` generated, email sent
2. Recipient clicks `/invite/:code` → signs up or signs in → accepts → `status` = accepted, `accepted_by` and `accepted_at` set, [[CrewMember]] record created
3. If not accepted before `expires_at` → `status` = expired
4. Admin can revoke → `status` = revoked

## Key Decisions

- Invite codes are unique, unguessable strings (UUID or similar)
- An invite is tied to an email but the accepting user's email (from Clerk) must match
- Accepting an invite creates a [[CrewMember]] with the role specified in the invite
- Expired or revoked invites show a friendly error page, not a broken link

## Relationships

- Belongs to [[Crew]]
- Created by [[User]] (invited_by)
- Accepted by [[User]] (accepted_by, nullable)
- Acceptance creates a [[CrewMember]] record
