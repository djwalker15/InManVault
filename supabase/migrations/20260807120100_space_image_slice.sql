-- ============================================================
-- Space image slice: optional photo per space.
--
-- Photo-only (the deterministic warm-gradient placeholder stays as the
-- fallback — no icon picker). One photo per space in v1. The column
-- holds a crew-media storage path (`<crew_id>/spaces/<space_id>/<uuid>.jpg`),
-- served via signed URLs; see docs/cross-cutting/Media Storage.md.
--
-- Spaces are mutable, so a direct crew-member UPDATE writes the column —
-- the existing spaces RLS policies already cover it.
-- ============================================================

alter table public.spaces
  add column image_path text null;

-- ============================================================
-- End space image slice.
-- ============================================================
