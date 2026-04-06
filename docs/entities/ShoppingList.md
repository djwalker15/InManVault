# ShoppingList

> Part of [[Feature 10 - Shopping List]]

A named, collaborative shopping list owned by a [[Crew]]. Items can be added manually or auto-generated from low stock alerts, [[Recipe]] needs, or planned [[BatchEvent]]s.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `list_id` | PK | |
| `crew_id` | FK → [[Crew]] | |
| `name` | text | e.g., "H-E-B Run", "Costco Trip", "Bar Restock" |
| `status` | enum | active \| completed \| archived |
| `created_by` | text FK → [[User]] | Clerk user ID |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-maintained by trigger |
| `deleted_at` | timestamp | Nullable — soft delete |

## Key Decisions

- Multiple named lists per [[Crew]] (different stores, different purposes)
- Collaborative — multiple [[CrewMember]]s can add and check off items (Supabase Realtime)
- Checking off an item triggers the checkout flow (see [[ShoppingListItem]])
- **Soft delete:** Uses `deleted_at`.

## Relationships

- Belongs to [[Crew]]
- Has many [[ShoppingListItem]]s
