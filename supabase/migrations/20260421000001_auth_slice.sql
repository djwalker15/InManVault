-- ============================================================
-- Phase 1 — auth slice
-- Tables: users, crews, crew_members
-- Tenant boundary is the Crew. Users are a slim local reference
-- to Clerk (string IDs). RLS keys off auth.jwt()->>'sub'.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

-- Stamps updated_at on every UPDATE for mutable entities.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Wraps auth.jwt()->>'sub' so RLS policies read cleaner and the
-- JWT lookup runs once per statement (wrapped in a stable fn).
create or replace function public.current_user_id()
returns text
language sql
stable
as $$
  select (auth.jwt()->>'sub');
$$;

-- ------------------------------------------------------------
-- users — slim local reference to Clerk-managed user
-- Email, display name, avatar all live in Clerk.
-- ------------------------------------------------------------
create table public.users (
  user_id text primary key,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- A user can read their own row.
create policy users_select_self
on public.users
for select
to authenticated
using (user_id = (select public.current_user_id()));

-- A user can create their own row at first sign-in.
create policy users_insert_self
on public.users
for insert
to authenticated
with check (user_id = (select public.current_user_id()));

-- (No UPDATE / DELETE policies — the row is immutable from the client.)


-- ------------------------------------------------------------
-- crews — tenant boundary
-- owner_id is the Crew Owner with elevated privileges (delete crew,
-- transfer ownership, remove Admins). Distinct from Admin role.
-- ------------------------------------------------------------
create table public.crews (
  crew_id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 64),
  owner_id text not null references public.users(user_id),
  created_by text not null references public.users(user_id),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deletion_requested_at timestamptz
);

create index crews_owner_id_idx
  on public.crews (owner_id)
  where deleted_at is null;

create trigger crews_set_updated_at
before update on public.crews
for each row
execute function public.set_updated_at();

alter table public.crews enable row level security;


-- ------------------------------------------------------------
-- crew_members — join table (User ↔ Crew)
-- kiosk_pin is nullable — set on first kiosk setup, not at sign-up,
-- to keep onboarding friction low. Format is validated when present.
-- ------------------------------------------------------------
create table public.crew_members (
  crew_member_id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(crew_id),
  user_id text not null references public.users(user_id),
  role text not null check (role in ('owner', 'admin', 'member')),
  permission_overrides jsonb not null default '{}'::jsonb,
  kiosk_pin text check (kiosk_pin is null or kiosk_pin ~ '^\d{4,8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- One active membership per (crew, user). Soft-deleted rows are excluded
-- so a user can be re-added after being removed.
create unique index crew_members_active_unique
  on public.crew_members (crew_id, user_id)
  where deleted_at is null;

create index crew_members_user_id_idx
  on public.crew_members (user_id)
  where deleted_at is null;

create trigger crew_members_set_updated_at
before update on public.crew_members
for each row
execute function public.set_updated_at();

alter table public.crew_members enable row level security;


-- ------------------------------------------------------------
-- Membership helpers — SECURITY DEFINER so they bypass RLS when
-- called from within RLS policies. This prevents policy recursion
-- when crew_members policies need to check crew_members.
-- ------------------------------------------------------------
create or replace function public.is_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members
    where crew_id = target_crew_id
      and user_id = public.current_user_id()
      and deleted_at is null
  );
$$;

create or replace function public.is_crew_owner(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crews
    where crew_id = target_crew_id
      and owner_id = public.current_user_id()
      and deleted_at is null
  );
$$;

revoke execute on function public.is_crew_member(uuid) from public;
revoke execute on function public.is_crew_owner(uuid) from public;
grant execute on function public.is_crew_member(uuid) to authenticated;
grant execute on function public.is_crew_owner(uuid) to authenticated;


-- ------------------------------------------------------------
-- crews — policies
-- ------------------------------------------------------------

-- Any authenticated user can create a crew, but only as the owner + creator.
create policy crews_insert_as_owner
on public.crews
for insert
to authenticated
with check (
  owner_id = (select public.current_user_id())
  and created_by = (select public.current_user_id())
);

-- Any active member of the crew can read it.
create policy crews_select_members
on public.crews
for select
to authenticated
using (public.is_crew_member(crew_id));

-- Only the Owner can update crew metadata (including deleted_at /
-- deletion_requested_at for the 48h deletion flow).
create policy crews_update_owner
on public.crews
for update
to authenticated
using (owner_id = (select public.current_user_id()))
with check (owner_id = (select public.current_user_id()));


-- ------------------------------------------------------------
-- crew_members — policies
-- ------------------------------------------------------------

-- Owner bootstrap: the creator of a crew can insert themselves as the
-- first 'owner' member. All other member additions happen via invite
-- acceptance through a service-role edge function (not this policy).
create policy crew_members_insert_owner_bootstrap
on public.crew_members
for insert
to authenticated
with check (
  user_id = (select public.current_user_id())
  and role = 'owner'
  and public.is_crew_owner(crew_id)
);

-- Any active member of a crew can see all members of that crew.
create policy crew_members_select_same_crew
on public.crew_members
for select
to authenticated
using (public.is_crew_member(crew_id));
