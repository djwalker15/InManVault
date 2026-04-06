# User Attribution

> Cross-cutting concern spanning all features

Every state-changing action in InMan captures `performed_by` (text FK → [[User]]). This ensures accountability and traceability across the entire system.

## Auth Provider

InMan uses **Clerk** for authentication. All `user_id` / `performed_by` / `created_by` / `logged_by` / `checked_by` / `prepped_by` fields are **text** type, storing Clerk's string-based user ID (the `sub` claim from the JWT). User profile data (email, name, avatar) is managed by Clerk and fetched via Clerk's API or frontend components — it is not duplicated in InMan's database.

## Where It Appears

| Entity | Field | Type | Context |
|--------|-------|------|---------|
| [[Flow]] | `performed_by` | text FK | Who made this inventory change |
| [[WasteEvent]] | `logged_by` | text FK | Who logged this waste |
| [[BatchEvent]] | `performed_by` | text FK | Who executed this batch |
| [[WastePrepFailureDetail]] | `prepped_by` | text FK | Who was prepping when it failed |
| [[ShoppingListItem]] | `checked_by` | text FK | Who purchased this item |
| [[Crew]] | `created_by` | text FK | Who created this crew |
| [[Recipe]] | `created_by` | text FK | Who wrote this recipe |
| [[RecipeVersion]] | `created_by` | text FK | Who created this version |
| [[ShoppingList]] | `created_by` | text FK | Who created this list |
| [[KioskSession]] | `created_by` | text FK | Which admin set up this kiosk |
| [[Product]] | `created_by` | text FK | Who added this product |
| [[SpaceTemplate]] | `created_by` | text FK | Who created this template |

## RLS Policy Pattern

Since Clerk uses string-based IDs, Supabase RLS policies reference `auth.jwt()->>'sub'` instead of `auth.uid()`:

```sql
-- Example: users can only access flows belonging to their crews
create policy "Crew members can view flows"
on flows for select to authenticated
using (
  crew_id in (
    select crew_id from crew_members
    where user_id = (select auth.jwt()->>'sub')
  )
);
```

## Kiosk Mode Integration

In [[Feature 11 - Kiosk Mode]], the device stays authenticated to a [[Crew]] via [[KioskSession]]. Individual [[CrewMember]]s identify themselves via PIN or name selection. This lightweight identification still resolves to a [[User]] record, so all `performed_by` fields remain properly attributed even without full Clerk login.

## Features Involved

- All features that create or modify data
- [[Feature 11 - Kiosk Mode]] — lightweight identification for shared devices
- [[Feature 1 - Multi-Organization Tenancy]] — [[CrewMember]] carries `kiosk_pin`
