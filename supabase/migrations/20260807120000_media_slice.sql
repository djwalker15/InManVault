-- ============================================================
-- Media slice: the crew-scoped `crew-media` bucket.
--
-- One private bucket for every crew-owned image domain (product photos,
-- waste photos, space pictures, future recipe photos). Paths are
-- crew-first — `<crew_id>/<domain>/[<entity_id>/]<uuid>.jpg` — so a
-- single policy set keys access off the first path segment via
-- `is_crew_member`. Design: docs/cross-cutting/Media Storage.md.
--
-- The user-scoped `feedback-screenshots` bucket (feedback can be
-- submitted crew-less) stays separate; see 20260615000000_feedback_slice.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crew-media',
  'crew-media',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- `is_crew_member` is SECURITY DEFINER and already granted to
-- `authenticated` (20260421000001_auth_slice.sql), so these policies
-- need no extra grants.

create policy crew_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crew-media'
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

create policy crew_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crew-media'
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

-- Delete is needed by the replace/remove flows (replace = upload new +
-- delete old). There is deliberately NO update policy: objects are
-- immutable once uploaded.
create policy crew_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crew-media'
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);

-- ============================================================
-- End media slice.
-- ============================================================
