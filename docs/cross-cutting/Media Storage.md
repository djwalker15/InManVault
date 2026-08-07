# Media Storage

> Cross-cutting concern spanning multiple features — decided 2026-08-07

The crew-scoped pattern for user-uploaded images: product photos, waste-event photos, space pictures, and future consumers (recipe photos, the AI image resolver). One private bucket, signed URLs, a single frontend media library. This is the "new crew-scoped media-storage pattern" that [[Journey - Space Setup]] flagged as missing.

The user-scoped `feedback-screenshots` bucket (see [[Feature 13 - In-App Feedback]]) stays separate — feedback can be submitted without a crew, so it cannot be crew-scoped.

## Bucket topology

One **private** bucket `crew-media`, created by migration (never via `config.toml` — no `[storage]` section is added). Crew-first path scheme:

```
<crew_id>/products/<product_id>/<uuid>.jpg
<crew_id>/waste/<uuid>.jpg
<crew_id>/spaces/<space_id>/<uuid>.jpg
<crew_id>/recipes/...        (future)
<crew_id>/resolver/...       (future — AI image-resolver scratch input)
```

- **Why one bucket:** the access rule is identical for every domain ("caller is a member of the crew that owns the object"), so per-domain buckets would mean N copies of byte-identical policies and a migration per new consumer. One bucket = one policy set, forever.
- **Why crew-first:** the RLS check is a single array index on the first path segment, mirroring the feedback-screenshots precedent (which keys on user id instead).
- **Why entity-id third segment** (products, spaces): makes replace and future cleanup tractable — list the entity prefix, delete stale objects. Waste omits it because upload happens *before* `record_waste` returns an event id, and [[WasteEvent]]s are immutable anyway.
- Limits: 5 MB per object; `image/jpeg`, `image/png`, `image/webp`.

## Storage RLS

Policies on `storage.objects` for `select`, `insert`, and `delete` — **no `update` policy**: objects are immutable; replace = upload new + delete old.

```sql
create policy crew_media_select on storage.objects for select to authenticated
using (
  bucket_id = 'crew-media'
  and public.is_crew_member(((storage.foldername(name))[1])::uuid)
);
-- crew_media_insert: same predicate as WITH CHECK
-- crew_media_delete: same predicate as USING (needed for the replace flow)
```

`is_crew_member` is SECURITY DEFINER and already granted to `authenticated`, so this composes with no new helpers.

## Dual-mode `image_url` on Product

[[Product]].`image_url` (already in the schema) stores **either**:

- a full external `http(s)://` URL — master-catalog products, written server-side by the barcode-lookup pipeline (never by clients), or
- a bare `crew-media` storage path — crew uploads on crew-private products.

One resolver, `resolveImageSrc()` in `app/src/lib/media.ts`, decides at render: `/^https?:\/\//` → use directly; otherwise treat as a path and mint a signed URL. No second column — two nullable columns invite the "both set, which wins?" state and force every consumer to coalesce.

Naming convention elsewhere: [[WasteEvent]].`photo_url` holds a crew-media **path** despite its name (shipped immutable slice — documented, not renamed). New columns use the honest name, e.g. [[Space]].`image_path`.

**v1 scope:** crews upload images to **crew-private products only** (`crew_id` not null), matching the existing name/brand edit gate. Master-catalog images arrive via the barcode-lookup API (external URLs). Per-crew image overrides for catalog products are an explicit non-goal.

## Signed-URL layer (frontend)

`app/src/lib/media.ts`, designed for the app's hand-rolled fetch style (no react-query):

- **TTL 3600 s**, refreshed when < 5 min remain. Module-level cache `Map<path, { url, expiresAt }>` with in-flight dedupe; failed mints cached negatively for 60 s.
- **Microtask-batched minting:** `useSignedUrl(value)` calls enqueue their path; a `queueMicrotask` flush issues **one** `createSignedUrls(paths, 3600)` call per render pass. A list rendering 30 thumbnails makes one storage round-trip, and no list surface needs any wiring beyond rendering the thumb component.
- External URLs resolve synchronously with no network. `null`/error → `null` (caller shows the letter fallback).
- Crew switching needs no invalidation — paths are crew-prefixed and RLS re-checks at every mint.

## Upload lifecycle

- **Downscale client-side** before upload: canvas, 1500 px longest edge, JPEG q0.8 (`downscaleToBlob()` in `app/src/lib/downscale.ts`, refactored from the receipt-scan helper; the base64 variant remains for `parse-receipt`).
- `uploadCrewImage(supabase, crewId, domain, file, entityId?)` → downscale → upload → return path. Mirrors `uploadFeedbackScreenshot`.
- **Replace:** upload new object → update the row (direct update for mutable entities like [[Product]]/[[Space]]) → best-effort delete of the old object. Delete failure = accepted orphan with a console warning.
- **Remove:** null the column + delete the object.
- **Orphans on soft-delete: accepted for v1.** The entity-id path segment keeps a future cleanup job trivial. Explicit non-goal.

## Consumers

| Consumer | Column | Status |
|----------|--------|--------|
| [[Product]] images | `products.image_url` (dual-mode) | Column shipped; upload UI tracked in ClickUp |
| [[WasteEvent]] photos | `waste_events.photo_url` (path) | Column + `record_waste p_photo_url` shipped; capture UI tracked |
| [[Space]] pictures | `spaces.image_path` (new) | Migration + UI tracked; gradient placeholder retained as fallback |
| [[Recipe]] / [[RecipeStep]] photos | `photo_url` (planned) | v1.2 — reuses this pattern as-is |
| AI image resolver | reads/writes crew-media paths | Future — depends on this pattern |

## Non-goals (v1)

- Icon picker for spaces (photo-only; the deterministic gradient stays as the fallback)
- Orphaned-object garbage collection
- Master-catalog image uploads or per-crew overrides
- Waste-photo display (ships with the future `/waste` history page per [[Journey - Reviewing Waste History]])

## Features Involved

- [[Feature 3 - Item Catalog]] — [[Product]] images
- [[Feature 6 - Waste Tracking]] — [[WasteEvent]] photos
- [[Feature 2 - Space Hierarchy Setup]] — [[Space]] pictures
- [[Feature 8 - Recipes]] — future photo support
- [[Feature 13 - In-App Feedback]] — separate user-scoped bucket (not crew-media)
