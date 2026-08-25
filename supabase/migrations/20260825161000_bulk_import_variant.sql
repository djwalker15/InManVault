-- ============================================================
-- bulk_import_inventory — variant-aware product creation
-- ----------------------------------------------------------------
-- The spreadsheet importer now resolves rows on (name, variant) and can
-- map a Flavor/Variant column (product_variant_slice, 2026-08-05, left
-- bulk import as a follow-up). Rows that create a product carry an
-- optional `product_variant` key; everything else is unchanged from
-- 20260622120200. Same signature, so create-or-replace is enough.
-- ============================================================

create or replace function public.bulk_import_inventory(
  p_crew_id uuid,
  p_rows    jsonb,
  p_source  text default 'bulk_import'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id  text;
  v_elem     jsonb;
  v_idx      bigint;
  v_imported integer := 0;
  v_errors   jsonb   := '[]'::jsonb;
  v_source   text    := coalesce(nullif(p_source, ''), 'bulk_import');

  v_product_id uuid;
  v_name       text;
  v_brand      text;
  v_variant    text;
  v_barcode    text;
  v_quantity   numeric;
  v_unit       text;
  v_space_id   uuid;
  v_category   uuid;
  v_unit_cost  numeric;
  v_notes      text;
  v_item_id    uuid;
  v_flow_id    uuid;
begin
  v_user_id := public.current_user_id();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_crew_member(p_crew_id) then
    raise exception 'Not a member of this Crew';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  for v_elem, v_idx in
    select value, ordinality
    from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      v_product_id := nullif(v_elem->>'product_id', '')::uuid;
      v_name       := nullif(v_elem->>'product_name', '');
      v_brand      := nullif(v_elem->>'product_brand', '');
      v_variant    := nullif(trim(v_elem->>'product_variant'), '');
      v_barcode    := nullif(v_elem->>'product_barcode', '');
      v_quantity   := (v_elem->>'quantity')::numeric;
      v_unit       := v_elem->>'unit';
      v_space_id   := nullif(v_elem->>'current_space_id', '')::uuid;
      v_category   := nullif(v_elem->>'category_id', '')::uuid;
      v_unit_cost  := nullif(v_elem->>'unit_cost', '')::numeric;
      v_notes      := nullif(v_elem->>'notes', '');

      -- Validate the universal requirements first.
      if v_quantity is null or v_quantity <= 0 then
        raise exception 'quantity must be > 0';
      end if;
      if v_unit is null or not exists (
        select 1 from public.unit_definitions where unit = v_unit
      ) then
        raise exception 'unit % is not defined', coalesce(v_unit, '(null)');
      end if;
      if v_space_id is null or not exists (
        select 1 from public.spaces s
        where s.space_id   = v_space_id
          and s.crew_id    = p_crew_id
          and s.deleted_at is null
      ) then
        raise exception 'current space not in this Crew';
      end if;
      if v_category is not null and not exists (
        select 1 from public.categories c
        where c.category_id = v_category
          and c.deleted_at  is null
          and (c.crew_id is null or c.crew_id = p_crew_id)
      ) then
        raise exception 'category not accessible';
      end if;

      -- Resolve or create the product.
      if v_product_id is null then
        if v_name is null then
          raise exception 'product_name is required to create a product';
        end if;
        insert into public.products (
          crew_id, name, brand, variant, barcode, source, created_by
        )
        values (
          p_crew_id, v_name, v_brand, v_variant, v_barcode, 'crew_created', v_user_id
        )
        returning product_id into v_product_id;
      elsif not exists (
        select 1 from public.products p
        where p.product_id = v_product_id
          and p.deleted_at is null
          and (p.crew_id is null or p.crew_id = p_crew_id)
      ) then
        raise exception 'product not accessible';
      end if;

      -- Insert the item (qty 0) + purchase flow + detail; triggers settle
      -- the cached quantity and last_unit_cost.
      insert into public.inventory_items (
        crew_id, product_id, current_space_id, quantity, unit,
        category_id, notes, created_by
      )
      values (
        p_crew_id, v_product_id, v_space_id, 0, v_unit,
        v_category, v_notes, v_user_id
      )
      returning inventory_item_id into v_item_id;

      insert into public.flows (
        crew_id, inventory_item_id, flow_type, quantity, unit, performed_by, notes
      )
      values (
        p_crew_id, v_item_id, 'purchase', v_quantity, v_unit, v_user_id, v_notes
      )
      returning flow_id into v_flow_id;

      insert into public.flow_purchase_details (flow_id, unit_cost, source)
      values (v_flow_id, v_unit_cost, v_source);

      v_imported := v_imported + 1;
    exception
      when others then
        v_errors := v_errors || jsonb_build_object(
          'index', v_idx - 1,
          'message', sqlerrm
        );
    end;
  end loop;

  return jsonb_build_object('imported', v_imported, 'errors', v_errors);
end;
$$;

revoke execute on function public.bulk_import_inventory(uuid, jsonb, text) from public;
grant  execute on function public.bulk_import_inventory(uuid, jsonb, text) to authenticated;
