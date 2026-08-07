-- ============================================================
-- Feedback screenshots slice: multi-image support.
--
-- House style is a child table, never text[]. Bucket stays the
-- user-scoped `feedback-screenshots` (feedback can be submitted
-- crew-less, so it does NOT move to crew-media). The parent's
-- `screenshot_path` column is kept (populated with the first
-- screenshot) for back-compat; dropping it is a later follow-up.
-- ============================================================

create table public.feedback_screenshots (
  feedback_screenshot_id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback (feedback_id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create index feedback_screenshots_feedback_id_idx
  on public.feedback_screenshots (feedback_id);

alter table public.feedback_screenshots enable row level security;

-- Mirror the parent's predicates via an exists-join (feedback_slice
-- 65-78): submitters see and write only their own rows. SELECT policy
-- first — house convention against the RLS RETURNING trap.
create policy feedback_screenshots_select
on public.feedback_screenshots
for select
to authenticated
using (
  exists (
    select 1 from public.feedback f
    where f.feedback_id = feedback_screenshots.feedback_id
      and f.submitted_by = (select auth.jwt()->>'sub')
  )
);

create policy feedback_screenshots_insert
on public.feedback_screenshots
for insert
to authenticated
with check (
  exists (
    select 1 from public.feedback f
    where f.feedback_id = feedback_screenshots.feedback_id
      and f.submitted_by = (select auth.jwt()->>'sub')
  )
);

-- No UPDATE/DELETE policies — screenshots are write-once alongside the
-- feedback row; the edge function patches nothing here.

grant select, insert on public.feedback_screenshots to authenticated;

-- Backfill the existing single screenshots into the child table.
insert into public.feedback_screenshots (feedback_id, path, created_at)
select feedback_id, screenshot_path, created_at
from public.feedback
where screenshot_path is not null;

comment on column public.feedback.screenshot_path is
  'Deprecated: superseded by feedback_screenshots. Kept populated with the first screenshot for back-compat; drop in a later slice.';

-- ============================================================
-- End feedback screenshots slice.
-- ============================================================
