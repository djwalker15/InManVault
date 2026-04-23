-- ============================================================
-- Pin search_path on helper functions (security advisor WARN)
-- Add covering index on crews.created_by (performance advisor INFO)
-- ============================================================

alter function public.set_updated_at() set search_path = '';
alter function public.current_user_id() set search_path = '';

create index crews_created_by_idx
  on public.crews (created_by)
  where deleted_at is null;
