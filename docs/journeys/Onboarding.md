# User Journey: Onboarding

> Covers the complete first-time experience from landing page to active use

---

## Entry Points

The app has three entry points for unauthenticated users:

### Entry Point 1 — Root URL (`/`)

Unauthenticated visitors see the landing page. Simple explainer with a value prop, 3-4 feature highlights, and two CTAs: "Get Started" (→ sign up) and "Sign In" (→ returning users). The route is structured to grow into a full marketing page later. Authenticated users hitting `/` are redirected to their dashboard.

### Entry Point 2 — Invite Link (`/invite/:code`)

Someone received an [[Invite]] from a [[Crew]] admin. If they already have an account, they sign in and accept. If not, they sign up first, then auto-accept. They skip Crew creation — they're joining an existing [[Crew]].

### Entry Point 3 — Kiosk Enrollment (`/kiosk/enroll`)

An admin navigates here on the target device. They authenticate via Clerk, configure the [[KioskSession]] (Crew, Premises, auth method, allowed actions), and enroll the device. A kiosk token is generated and stored client-side. The admin's Clerk session is no longer needed — the token is independent (Path B architecture).

---

## Path A — New User, Creating a Crew

The full wizard flow for someone starting fresh.

### Step 1 — Landing Page

User reads the value prop, clicks "Get Started."

**Data touched:** none

### Step 2 — Sign Up via Clerk

Email, social auth, passkeys, etc. Clerk handles everything. On success, InMan creates a local user reference.

**Data touched:** `users` (insert — `user_id` text from Clerk, `created_at`)

### Step 3 — Crew Decision

Screen asks: "Are you starting a new space or joining one?"
- **Start fresh** → continue to Step 4
- **I have an invite** → enter invite code → redirects to Path B

**Data touched:** none — routing decision only

### Step 4 — Create Your Crew

Name the Crew (e.g., "Walker Home", "Haywire Bar"). User becomes Admin automatically.

**Set your PIN:** User is prompted to create a 4+ digit PIN. This is required — used for kiosk identification (name select → PIN confirm) across all [[KioskSession]]s in any [[Crew]] they belong to.

**Data touched:**
- [[Crew]] (insert — name, created_by, settings)
- [[CrewMember]] (insert — crew_id, user_id, role = Admin, kiosk_pin = hashed PIN)

### Step 5 — Set Up Your Spaces

> **Detailed journey:** [[Journey - Space Setup]] — covers the full first-time space setup experience in depth (Explainer → Premises → Guided First Branch → Tree Editor → Templates)

The space setup experience walks users through five phases:

1. **Explainer screen** — visual guide showing all 7 levels with a kitchen example. Dismissable, accessible later via "?" icon.
2. **Create Premises** — name their place (explicit first step). Live tree appears and shows the first node.
3. **Guided first branch** — system walks them through one complete path (premises → area → zone → section → sub_section → container → shelf), with smart type defaults, tooltips, and prompts to go wider or deeper. Tree grows in real-time.
4. **Tree editor handoff** — guided mode ends, full tree editor opens. User can add nodes anywhere, use smart defaults, edit/delete freely.
5. **Template option** — available at any time. Browse and preview templates. If spaces already exist, user chooses "Replace or merge?"

**Data touched:**
- [[SpaceTemplate]] (read — if using template)
- [[Space]] (insert — one root Premises minimum, many rows from guided flow or template)

### Step 6 — Add Your First Items

> **Detailed journey:** [[Journey - Adding Inventory]] — covers all four methods (manual search/create, bulk import, barcode scan, quick add) and the two-step product resolution → inventory details flow

Three options during onboarding:

**Add manually** → uses the two-step flow from [[Journey - Adding Inventory]] Method 1. Search master [[Product]] catalog → set inventory details. Stays in flow for multiple items.

**Scan barcodes** → uses Method 3 from [[Journey - Adding Inventory]]. Camera-based scanning, auto-resolve to [[Product]]s, continuous scan mode.

**Skip for now** → "You can add items anytime from the Inventory page."

**Data touched:**
- [[Product]] (read master catalog; possibly insert crew-private custom product)
- [[InventoryItem]] (insert — product_id, crew_id, current_space_id, quantity, unit)
- [[Flow]] (insert — purchase flow for each item added with initial quantity)

### Step 7 — Invite Your Crew (Optional)

"Want to invite others?" Enter email addresses, assign roles (Member or Admin). Invites sent via email.

**Data touched:**
- [[Invite]] (insert — crew_id, invited_by, email, role, code, status = pending)

### Step 8 — Wizard Complete → Dashboard

User lands on the dashboard. Onboarding checklist appears with progress indicator.

---

## Path B — Joining via Invite

### Step 1 — Invite Link

User clicks `/invite/:code`. System validates the [[Invite]] (exists, status = pending, not expired).

### Step 2 — Sign In or Sign Up

If they have an account → sign in via Clerk. If not → sign up via Clerk. `users` row created if new.

**Data touched:** `users` (insert if new)

### Step 3 — Accept Invite

System shows the [[Crew]] name and who invited them. User confirms.

**Set your PIN:** User is prompted to create a 4+ digit PIN (same as Path A). Required for kiosk identification.

**Data touched:**
- [[Invite]] (update — status = accepted, accepted_by, accepted_at)
- [[CrewMember]] (insert — crew_id, user_id, role from invite, kiosk_pin = hashed PIN)

### Step 4 — Dashboard

They land in the Crew's app. No wizard — the Crew is already set up. Checklist shows personal items only.

---

## Path C — Kiosk Enrollment

### Step 1 — Navigate to `/kiosk/enroll`

Admin opens this URL on the target device (bar tablet, kitchen iPad).

### Step 2 — Admin Authenticates via Clerk

Standard sign-in. Must be an Admin of at least one [[Crew]].

### Step 3 — Kiosk Configuration

Admin selects:
- Which [[Crew]] this kiosk belongs to
- Which Premises ([[Space]] with unit_type = premises) it's bound to
- Device name (e.g., "Bar Tablet", "Kitchen iPad")
- Allowed actions: checkboxes from defined action vocabulary

> **Identification is always two-step** (name select → PIN confirm) and is not configurable per kiosk.

### Step 4 — Confirm and Enroll

System creates [[KioskSession]], generates a unique token, hashes it, stores the hash in the DB and the raw token in the device's local storage.

**Data touched:**
- [[KioskSession]] (insert — crew_id, premises_id, device_name, allowed_actions, token_hash, is_active = true, created_by)

### Step 5 — Kiosk Mode Activates

Admin's Clerk session is no longer relevant. On all subsequent app loads:
1. Boot sequence checks local storage for kiosk token
2. Validates against server (is_active = true, token hash matches)
3. If valid → render kiosk UI with two-step identification: select your name → enter your PIN
4. If invalid/missing → fall through to normal Clerk login

**Ongoing:** All kiosk actions go through Supabase edge functions using the kiosk token. `performed_by` is set from the name + PIN identification, not from a Clerk JWT.

---

## Onboarding Checklist

The checklist appears on the dashboard after onboarding and persists until dismissed or completed. All items are **derived from existing data** — no separate checklist table needed.

### For Crew creators (Path A):

| Checklist Item | Derived From |
|---------------|-------------|
| ✅ Account created | `users` row exists |
| ✅ Crew created | `crew_members` record exists with role = Admin |
| Spaces set up | `spaces` count > 1 (more than just root Premises) |
| First items added | `inventory_items` count > 0 for this Crew |
| Invite crew members | `crew_members` count > 1 OR `invites` with status = pending |
| Set up categories | Crew-custom `categories` count > 0 |
| Configure low stock thresholds | `inventory_items` with `min_stock` not null count > 0 |
| Create your first recipe | `recipes` count > 0 for this Crew |
| Set up a kiosk | `kiosk_sessions` count > 0 for this Crew |

### For invited members (Path B):

| Checklist Item | Derived From |
|---------------|-------------|
| ✅ Account created | `users` row exists |
| ✅ Joined [Crew name] | `crew_members` record exists |
| ✅ PIN set | Set during invite acceptance |
| Browse your spaces | Dismissible — no data condition |
| Browse inventory | Dismissible — no data condition |

---

## Route Structure

| Route | Auth State | What Renders |
|-------|-----------|-------------|
| `/` | Unauthenticated | Landing page (simple explainer + CTAs) |
| `/` | Authenticated | Redirect to `/dashboard` |
| `/sign-up` | Unauthenticated | Clerk sign-up flow |
| `/sign-in` | Unauthenticated | Clerk sign-in flow |
| `/onboarding` | Authenticated, no Crew | Wizard (Steps 3-7) |
| `/invite/:code` | Any | Validate invite → sign in/up → accept |
| `/kiosk/enroll` | Authenticated (Admin) | Kiosk configuration |
| `/dashboard` | Authenticated, has Crew | Main app with checklist |
| `/kiosk` | Kiosk token present | Kiosk mode UI |

---

## Entities Involved

- [[User]] — created on sign-up
- [[Crew]] — created in wizard or pre-existing (invite path)
- [[CrewMember]] — created on Crew creation or invite acceptance
- [[Invite]] — created when admin invites someone, consumed on acceptance
- [[Space]] — created during space setup
- [[SpaceTemplate]] — read during template selection
- [[Product]] — read from master catalog, possibly created (custom)
- [[InventoryItem]] — created when adding first items
- [[Flow]] — created for initial inventory (purchase flows)
- [[KioskSession]] — created during kiosk enrollment
- [[Category]] — read during item creation (system defaults)
