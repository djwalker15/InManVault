-- ============================================================
-- Phase 1 — invites slice
-- Table: invites
-- Helper: is_crew_admin_or_owner (SECURITY DEFINER)
-- RPCs: lookup_invite, accept_invite (both SECURITY DEFINER)
-- ============================================================

create table public.invites (
  invite_id    uuid        primary key default gen_random_uuid(),
  crew_id      uuid        not null references public.crews(crew_id),
  code         text        unique not null,
  email        text        not null,
  role         text        not null check (role in ('admin', 'member', 'viewer')),
  invited_by   text        not null references public.users(user_id),
  accepted_by  text        null     references public.users(user_id),
  accepted_at  timestamptz null,
  status       text        not null default 'pending'
                           check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz null
);

create index invites_crew_status_idx
  on public.invites (crew_id, status)
  where deleted_at is null;

create trigger invites_set_updated_at
before update on public.invites
for each row execute function public.set_updated_at();

alter table public.invites enable row level security;

-- Helper: is the caller an admin or owner of the given crew?
-- SECURITY DEFINER prevents policy recursion when crew_members is queried
-- from within the invites RLS policy.
create or replace function public.is_crew_admin_or_owner(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_members
    where crew_id   = target_crew_id
      and user_id   = public.current_user_id()
      and role      in ('owner', 'admin')
      and deleted_at is null
  );
$$;

revoke execute on function public.is_crew_admin_or_owner(uuid) from public;
grant  execute on function public.is_crew_admin_or_owner(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS policies — SELECT first (avoids INSERT RETURNING trap)
-- ------------------------------------------------------------

-- Crew admins/owners can read their crew's invites.
-- The invite recipient can also read an invite addressed to them.
create policy invites_select
on public.invites
for select
to authenticated
using (
  public.is_crew_admin_or_owner(crew_id)
  or accepted_by = (select public.current_user_id())
);

-- Only admins/owners can create invites.
create policy invites_insert
on public.invites
for insert
to authenticated
with check (public.is_crew_admin_or_owner(crew_id));

-- Admins/owners can update; accept_invite (SECURITY DEFINER) updates via
-- service-role bypass, so the policy just needs to allow owner/admin edits.
create policy invites_update
on public.invites
for update
to authenticated
using (public.is_crew_admin_or_owner(crew_id))
with check (public.is_crew_admin_or_owner(crew_id));

-- ------------------------------------------------------------
-- RPC: lookup_invite
-- SECURITY DEFINER: pre-acceptance callers cannot read invites via
-- RLS (they're not a member yet), but we need them to preview the
-- crew details before accepting. Returns empty if not found / deleted.
-- ------------------------------------------------------------
create or replace function public.lookup_invite(p_code text)
returns table(
  crew_id    uuid,
  crew_name  text,
  status     text,
  expires_at timestamptz,
  invited_by text,
  role       text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
    select
      i.crew_id,
      c.name  as crew_name,
      i.status,
      i.expires_at,
      i.invited_by,
      i.role
    from public.invites i
    join public.crews c on c.crew_id = i.crew_id
    where i.code       = p_code
      and i.deleted_at is null
    limit 1;
end;
$$;

revoke execute on function public.lookup_invite(text) from public;
grant  execute on function public.lookup_invite(text) to authenticated;

-- ------------------------------------------------------------
-- RPC: accept_invite
-- SECURITY DEFINER: atomically inserts crew_members and stamps
-- the invite as accepted. Raises clear exceptions for bad states.
-- ------------------------------------------------------------
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id text;
  v_invite  record;
begin
  v_user_id := (select auth.jwt()->>'sub');
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select invite_id, crew_id, status, expires_at, role, deleted_at
  into   v_invite
  from   public.invites
  where  code = p_code
  limit  1;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.deleted_at is not null then
    raise exception 'Invite has been deleted';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is % — only pending invites can be accepted', v_invite.status;
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Invite has expired';
  end if;

  insert into public.crew_members (crew_id, user_id, role)
  values (v_invite.crew_id, v_user_id, v_invite.role);

  update public.invites
  set status      = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now()
  where invite_id = v_invite.invite_id;

  return v_invite.crew_id;
end;
$$;

revoke execute on function public.accept_invite(text) from public;
grant  execute on function public.accept_invite(text) to authenticated;
