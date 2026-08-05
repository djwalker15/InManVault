-- ============================================================
-- Catalog — product variant axis
-- ----------------------------------------------------------------
-- Adds a free-text `variant` descriptor to products: the non-size
-- variation axis (flavor / scent / style) that previously got mangled
-- into `name` inconsistently ("LaCroix Lime" vs "Lime LaCroix").
-- Size stays structured in size_value/size_unit. Each variant remains
-- its own Product row (own barcode, own InventoryItems).
--
-- Also recreates search_products_fuzzy so trigram matching and the
-- returned columns cover name + variant, letting cross-field queries
-- ("coke zero") rank correctly. product_aliases are unaffected: they
-- map raw_text -> product_id, and variant does not change row identity.
-- ============================================================

alter table public.products
  add column variant text null
    check (length(variant) between 1 and 80);

-- Expression index matching the RPC's predicate below. The plain
-- products_name_trgm_idx stays: it still serves the app's name ilike
-- queries.
create index products_name_variant_trgm_idx
  on public.products
  using gin ((name || coalesce(' ' || variant, '')) gin_trgm_ops)
  where deleted_at is null;

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
