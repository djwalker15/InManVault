-- ============================================================
-- Retiring a crew product — soft_delete_product RPC
--
-- Crew-private products can now be edited and retired from the catalog
-- browser's "My crew's" view (ClickUp 86e2jqrfc, absorbed into 86e1wd90n).
-- A client-side `update products set deleted_at = now()` trips the RLS
-- SELECT-on-new-row trap (products_select filters deleted_at is null), so
-- this is a SECURITY DEFINER RPC — same shape as soft_delete_inventory_item.
--
-- Guard: a product that active inventory items still reference is NOT
-- retired (every product join in the app filters deleted_at is null, so
-- those items would render with a missing product). The caller is told
-- how many items block it; remove or re-point them first.
--
-- Master-catalog rows (crew_id is null) are never retirable from here.
-- The product's crew-media image object is left in place (orphans are
-- accepted in v1 per docs/cross-cutting/Media Storage.md).
-- ============================================================

create or replace function public.soft_delete_product(
  p_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id text;
  v_crew_id uuid;
  v_refs    integer;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select p.crew_id
    into v_crew_id
  from public.products p
  where p.product_id = p_product_id
    and p.deleted_at is null
    and p.crew_id    is not null
  for update;

  if v_crew_id is null then
    raise exception 'Product not found, already retired, or not crew-owned';
  end if;

  if not public.is_crew_admin_or_owner(v_crew_id) then
    raise exception 'Only crew admins or the owner can retire products';
  end if;

  select count(*)::integer
    into v_refs
  from public.inventory_items i
  where i.product_id = p_product_id
    and i.deleted_at is null;

  if v_refs > 0 then
    raise exception '% inventory item% still reference this product — remove or re-point % first',
      v_refs,
      case when v_refs = 1 then '' else 's' end,
      case when v_refs = 1 then 'it' else 'them' end;
  end if;

  update public.products
  set deleted_at = now()
  where product_id = p_product_id;
end;
$$;

revoke execute on function public.soft_delete_product(uuid) from public;
grant  execute on function public.soft_delete_product(uuid) to authenticated;
