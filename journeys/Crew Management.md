# User Journey: Crew Management

> Covers ongoing administration of a Crew — members, roles, permissions, settings, and ownership
> Referenced by [[InMan User Journeys]] #3

---

## Overview

Crew Management is the ongoing administration layer for a [[Crew]] after initial creation. It covers eight actions: inviting members, changing roles, setting permission overrides, removing members, transferring ownership, leaving a crew, editing crew settings, and deleting a crew.

The UI lives in a dedicated **Crew Settings page** (`/crew/settings`), accessible by Admins and the Owner. Members and Viewers can see their own membership but not manage others. A **Crew Switcher** in the nav allows quick switching between Crews for multi-membership users.

---

## UI Structure

### Crew Switcher (Nav)

Persistent dropdown in the app navigation showing all [[Crew]]s the current user belongs to:
- Current crew highlighted
- One-tap to switch — all app data reloads for the selected crew
- "Create a new Crew" option at the bottom
- "Manage Crews" link → Crew List page

### Crew List Page (`/crews`)

Full management page showing all Crews the user belongs to:

| Crew Name | Your Role | Members | Actions |
|-----------|-----------|---------|---------|
| Walker Home | Owner | 3 | Settings, Leave |
| Haywire Bar | Member | 8 | Leave |

- **Settings** — visible for Owner and Admins → navigates to Crew Settings
- **Leave** — visible for everyone except the Owner (Owner must transfer ownership first)
- **Create a new Crew** button

### Crew Settings Page (`/crew/settings`)

Tabs or sections:

| Section | Who Can Access |
|---------|---------------|
| General | Owner, Admins |
| Members | Owner, Admins (read-only for Members/Viewers showing the member list) |
| Permissions | Owner, Admins |
| Danger Zone | Owner only |

---

## Action 1 — Invite New Members

> Already modeled via [[Invite]] entity. See [[Journey - Onboarding]] Path B for the acceptance flow.

**Where:** Crew Settings → Members tab → "Invite" button

**Flow:**
1. Enter email address
2. Select role: Admin | Member | Viewer
3. Optionally set an expiry (default: 7 days)
4. Send invite

**On send:**
- [[Invite]] created (crew_id, invited_by, email, role, code, status = pending, expires_at)
- Email sent with invite link (`/invite/:code`)

**Pending invites** are visible in the Members tab with status, sent date, and actions: Resend, Revoke.

**Data touched:**
- [[Invite]] (insert)

---

## Action 2 — Change a Member's Role

**Who can do it:**
- **Owner** — can change anyone's role (including Admins)
- **Admins** — can change Members and Viewers, but NOT other Admins

**Where:** Crew Settings → Members tab → role dropdown on a member row

**Flow:**
1. Select new role from dropdown (Admin | Member | Viewer)
2. Confirm

**On confirm:**
- [[CrewMember]] `role` updated
- If promoting to Admin: confirmation dialog — "This person will be able to manage inventory, spaces, recipes, and other members."
- If demoting an Admin (Owner only): confirmation dialog — "This person will lose admin privileges."

**Guard rails:**
- Cannot change the Owner's role (ownership transfer is a separate action)
- Last Admin protection: if demoting the only remaining Admin (besides Owner), warn — "This will leave you as the only person who can manage this crew."

**Data touched:**
- [[CrewMember]] (update `role`)

---

## Action 3 — Set Per-Feature Permission Overrides

**Who can do it:** Owner, Admins

**Where:** Crew Settings → Permissions tab, or per-member in the Members tab → "Customize permissions" expand

**Flow:**

For a selected member, show a grid of features with the role-default permission and an override toggle:

| Feature | Role Default (Member) | Override |
|---------|----------------------|----------|
| View inventory | ✅ Allowed | — |
| Edit inventory | ✅ Allowed | — |
| Manage spaces | ✅ Allowed | 🔒 Deny |
| Create recipes | ✅ Allowed | — |
| Edit recipes | ✅ Allowed | — |
| Log waste | ✅ Allowed | — |
| Manage shopping lists | ✅ Allowed | — |
| View reports | ❌ Denied | ✅ Allow |

Each row can be left at role default or overridden to Allow/Deny.

**On save:**
- [[CrewMember]] `permission_overrides` JSON updated

**Data touched:**
- [[CrewMember]] (update `permission_overrides`)

---

## Action 4 — Remove a Member

**Who can do it:**
- **Owner** — can remove anyone (including Admins)
- **Admins** — can remove Members and Viewers, but NOT other Admins or the Owner

**Where:** Crew Settings → Members tab → "Remove" action on a member row

**Flow:**
1. Confirmation dialog: "Remove [name] from [Crew name]? They will lose access to all crew data. This action can be undone by re-inviting them."
2. Confirm

**On confirm:**
- [[CrewMember]] soft-deleted (`deleted_at` set) — preserves historical attribution (`performed_by`, `logged_by`, etc.)
- The removed user loses access immediately (RLS policies check active crew membership)
- Their historical actions remain attributed in [[Flow]]s, [[WasteEvent]]s, [[BatchEvent]]s, etc.

**Guard rails:**
- Cannot remove the Owner (must transfer ownership first, then leave)
- Cannot remove yourself (use "Leave Crew" instead)

**Data touched:**
- [[CrewMember]] (soft delete)

---

## Action 5 — Transfer Ownership

**Who can do it:** Owner only

**Where:** Crew Settings → Danger Zone → "Transfer Ownership"

**Flow:**
1. Select the new Owner from a dropdown of current Admins (only Admins can become Owner)
2. Confirmation dialog: "Transfer ownership of [Crew name] to [name]? They will gain full control including the ability to delete this crew. You will remain as an Admin."
3. Type the crew name to confirm (extra friction for this critical action)
4. Confirm

**On confirm:**
- [[Crew]] `owner_id` updated to the new Owner's user_id
- The old Owner's [[CrewMember]] role stays as Admin
- The new Owner is notified (in-app notification or email)

**Guard rails:**
- Only Admins can be selected as the new Owner (Members/Viewers must be promoted first)
- The transfer is immediate — no waiting period

**Data touched:**
- [[Crew]] (update `owner_id`)

---

## Action 6 — Leave a Crew

**Who can do it:** Any member EXCEPT the Owner

**Where:** Crew List page → "Leave" action, or Crew Settings → Members tab → own row → "Leave"

**Flow:**
1. Confirmation dialog: "Leave [Crew name]? You will lose access to all crew data. You can rejoin if invited again."
2. Confirm

**On confirm:**
- [[CrewMember]] soft-deleted (`deleted_at` set)
- User is redirected to the Crew List page (or dashboard of their next crew, or the "create/join a crew" screen if they have no other crews)
- Historical attribution preserved

**Guard rails:**
- **Owner cannot leave.** The Owner must transfer ownership first, then leave. This prevents orphaned crews.
- If the user's only crew: after leaving, they see the Crew Decision screen from [[Journey - Onboarding]] Step 3 ("Start fresh or join a crew?")

**Data touched:**
- [[CrewMember]] (soft delete)

---

## Action 7 — Edit Crew Settings

**Who can do it:** Owner, Admins

**Where:** Crew Settings → General tab

**Editable fields:**

| Setting | Notes |
|---------|-------|
| Crew name | Text — "Walker Home", "Haywire Bar" |
| Crew preferences | JSON settings — configurable defaults like low stock alert threshold (days), expiry alert threshold (days), default currency |

**On save:**
- [[Crew]] updated (name, settings)

**Data touched:**
- [[Crew]] (update)

---

## Action 8 — Delete a Crew

**Who can do it:** Owner only

**Where:** Crew Settings → Danger Zone → "Delete Crew"

This is the most destructive action in the system. It soft-deletes everything: the Crew, all Spaces, all InventoryItems, all Flows, all Recipes, all BatchEvents, all ShoppingLists, all KioskSessions, all CrewMembers.

### Flow

**Step 1 — Initial confirmation:**
"Permanently delete [Crew name]? This will remove all spaces, inventory, recipes, shopping lists, and member access. This cannot be undone after the waiting period."

**Step 2 — Type crew name:**
Text field: "Type '[Crew name]' to confirm" (prevents accidental deletion)

**Step 3 — Deletion requested:**
- [[Crew]] `deletion_requested_at` set to now, `deletion_requested_by` set to Owner's user_id
- **48-hour waiting period begins**
- All crew members are notified (in-app + email): "[Crew name] has been scheduled for deletion by [Owner name]. It will be permanently deleted on [date/time]. Contact the owner to cancel."
- The crew remains fully functional during the waiting period

**Step 4 — During the waiting period (48 hours):**
- A banner appears across the crew's UI: "This crew is scheduled for deletion on [date/time]. [Cancel deletion]"
- The Owner can cancel at any time → `deletion_requested_at` and `deletion_requested_by` set to null, members notified of cancellation

**Step 5 — After 48 hours:**
- A scheduled job (Supabase cron or edge function) processes crews where `deletion_requested_at` + 48 hours < now
- Soft-deletes cascade: [[Crew]] `deleted_at` set, and all child entities get `deleted_at` set:
  - All [[Space]]s
  - All [[InventoryItem]]s
  - All [[CrewMember]]s
  - All [[Recipe]]s, [[RecipeVersion]]s
  - All [[ShoppingList]]s
  - All [[KioskSession]]s
  - All [[Invite]]s (pending ones revoked)
- [[Flow]]s, [[WasteEvent]]s, [[BatchEvent]]s, and other immutable records are NOT soft-deleted — they retain their data for audit purposes but are inaccessible because the crew is deleted (RLS blocks access)
- All members lose access immediately

**Data touched:**
- [[Crew]] (update `deletion_requested_at`, `deletion_requested_by`; eventually soft delete)
- All child entities (eventual cascade soft delete)

---

## Route Structure

| Route | Who Can Access | Purpose |
|-------|---------------|---------|
| `/crews` | Any authenticated user | Crew List — see all crews, switch, leave, create new |
| `/crew/settings` | Owner, Admins | Crew Settings — general, members, permissions, danger zone |
| `/crew/settings` | Members, Viewers | Read-only view of member list and own membership |

---

## Data Model Changes

This journey introduces new fields on [[Crew]]:

| Field | Type | Notes |
|-------|------|-------|
| `owner_id` | text FK → [[User]] | The Crew Owner. Has all Admin privileges plus: delete crew, transfer ownership, remove Admins. |
| `deletion_requested_at` | timestamp | Nullable — set when Owner requests deletion, starts 48-hour countdown |
| `deletion_requested_by` | text FK → [[User]] | Nullable — who requested the deletion |

## Data Model Touchpoints

| Entity | Operation | When |
|--------|-----------|------|
| [[Crew]] | Read | Settings display, crew list |
| [[Crew]] | Update | Edit settings, transfer ownership, request/cancel deletion |
| [[Crew]] | Soft delete | After 48-hour waiting period |
| [[CrewMember]] | Read | Member list, role display |
| [[CrewMember]] | Update | Change role, set permission overrides |
| [[CrewMember]] | Soft delete | Remove member, leave crew, crew deletion cascade |
| [[Invite]] | Insert | Send new invite |
| [[Invite]] | Update | Revoke pending invite |
| [[User]] | Read (via Clerk API) | Display names, avatars in member list |

---

## See Also

- [[Crew]] — entity definition (updated with `owner_id`, `deletion_requested_at`, `deletion_requested_by`)
- [[CrewMember]] — roles, permission overrides, soft delete for historical attribution
- [[Invite]] — invitation lifecycle
- [[Journey - Onboarding]] — crew creation (Step 4), invite acceptance (Path B)
- [[Feature 1 - Multi-Organization Tenancy]] — feature-level overview
