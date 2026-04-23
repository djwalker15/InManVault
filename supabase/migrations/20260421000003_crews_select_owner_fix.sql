-- ============================================================
-- Fix: SELECT policy on crews required an existing crew_members
-- row, but during onboarding the owner inserts the crew first
-- and only then inserts themselves as a member. Any INSERT ...
-- RETURNING (used by .select() after .insert() in the JS client)
-- triggers the SELECT policy on the returned row, so the whole
-- call surfaced as a misleading "RLS violation" error.
-- Broaden the policy so the crew Owner can always read their crew.
-- ============================================================

-- Restore the intended INSERT WITH CHECK (was temporarily relaxed during debugging).
drop policy if exists crews_insert_as_owner on public.crews;
create policy crews_insert_as_owner
on public.crews
for insert
to authenticated
with check (
  owner_id = (select public.current_user_id())
  and created_by = (select public.current_user_id())
);

-- Broaden SELECT: active members OR the row's owner.
drop policy if exists crews_select_members on public.crews;
create policy crews_select_members_or_owner
on public.crews
for select
to authenticated
using (
  public.is_crew_member(crew_id)
  or owner_id = (select public.current_user_id())
);