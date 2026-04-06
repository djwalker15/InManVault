# User

> Part of [[Feature 1 - Multi-Organization Tenancy]]

A local reference to an authenticated individual managed by **Clerk**. Clerk handles email, display name, avatar, password, social login, MFA, and session management. This table exists only to anchor foreign keys and store app-specific data that Clerk doesn't manage.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `user_id` | text PK | Clerk's string-based user ID (e.g., `user_2abc123...`). Matches the `sub` claim in the JWT. |
| `created_at` | timestamp | When this user first appeared in InMan |

> **What lives in Clerk (not stored here):** email, display_name, avatar_url, password, MFA settings, social login providers, session tokens.

## Auth Integration

InMan uses **Clerk** as a third-party authentication provider with **Supabase**. Clerk issues JWTs containing the user's ID as the `sub` claim. Supabase verifies these tokens and makes the ID available via `auth.jwt()->>'sub'` in RLS policies. Since Clerk uses string-based IDs (not UUIDs), `auth.uid()` cannot be used — all RLS policies must reference `auth.jwt()->>'sub'` instead.

## Relationships

- Has many [[CrewMember]] records (one per [[Crew]] they belong to)
- Referenced as `performed_by` (text FK) on [[Flow]], [[BatchEvent]]
- Referenced as `created_by` (text FK) on [[Recipe]], [[RecipeVersion]], [[ShoppingList]], [[ShoppingListItem]], [[Crew]], [[Product]], [[SpaceTemplate]], [[KioskSession]]
- Referenced as `checked_by` (text FK) on [[ShoppingListItem]]
- Referenced as `prepped_by` (text FK) on [[WastePrepFailureDetail]]

> **Note:** [[WasteEvent]] no longer directly references User. The `logged_by` attribution is derived by joining WasteEvent → [[Flow]] → `performed_by`.

## See Also

- [[User Attribution]] — every state-changing action captures `performed_by`
- [[KioskSession]] — lightweight identification via PIN or name select
