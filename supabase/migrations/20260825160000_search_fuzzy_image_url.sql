-- ============================================================
-- search_products_fuzzy — return image_url
-- ----------------------------------------------------------------
-- Receipt-scan candidate chips were the one product surface left without
-- a thumbnail (media slice T5, 2026-08-07) because this RPC didn't expose
-- products.image_url. Adds it to the return table; matching, ranking and
-- the security model are unchanged from 20260805174600.
-- image_url is dual-mode (external http(s) URL or a crew-media storage
-- path) — callers resolve it through the media lib, never directly.
-- ============================================================

-- Return-type changes require drop + recreate. Dropping the old
-- signature first also avoids PostgREST overload ambiguity.
drop function if exists public.search_products_fuzzy(uuid, text, int);

create function public.search_products_fuzzy(
  p_crew_id uuid,
  p_query   text,
  p_limit   int default 5
)
returns table (
  product_id          uuid,
  crew_id             uuid,
  name                text,
  brand               text,
  variant             text,
  barcode             text,
  size_value          numeric,
  size_unit           text,
  image_url           text,
  default_category_id uuid,
  similarity          real
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.current_user_id() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_crew_member(p_crew_id) then
    raise exception 'Not a member of this Crew';
  end if;

  if p_query is null or length(trim(p_query)) = 0 then
    return;
  end if;

  return query
    select
      p.product_id,
      p.crew_id,
      p.name,
      p.brand,
      p.variant,
      p.barcode,
      p.size_value,
      p.size_unit,
      p.image_url,
      p.default_category_id,
      similarity(p.name || coalesce(' ' || p.variant, ''), p_query) as similarity
    from public.products p
    where p.deleted_at is null
      and (p.crew_id is null or p.crew_id = p_crew_id)
      -- matches products_name_variant_trgm_idx exactly
      and (p.name || coalesce(' ' || p.variant, '')) % p_query
    order by similarity(p.name || coalesce(' ' || p.variant, ''), p_query) desc, p.name asc
    limit greatest(p_limit, 1);
end;
$$;

revoke execute on function public.search_products_fuzzy(uuid, text, int) from public;
grant  execute on function public.search_products_fuzzy(uuid, text, int) to authenticated;
