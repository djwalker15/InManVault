-- ============================================================
-- Phase 2 (cont.) — apply_space_template RPC
-- Atomically stamps a space_templates.template_data tree under the
-- caller's most-recently-created Premises, in either 'merge' or
-- 'replace' mode. Crew-scoped via auth.jwt()->>'sub'; locked to
-- Owner/Admin roles.
-- ============================================================

create or replace function public.apply_space_template(
  p_template_id uuid,
  p_mode        text default 'merge'
)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id   text;
  v_crew_id   uuid;
  v_premises  uuid;
  v_template  jsonb;
  v_inserted  int := 0;
begin
  if p_mode not in ('merge', 'replace') then
    raise exception 'p_mode must be ''merge'' or ''replace''';
  end if;

  v_user_id := public.current_user_id();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve the caller's most-recent active crew + Owner/Admin gate.
  select cm.crew_id
    into v_crew_id
  from public.crew_members cm
  where cm.user_id   = v_user_id
    and cm.deleted_at is null
    and cm.role      in ('owner', 'admin')
  order by cm.created_at desc
  limit 1;

  if v_crew_id is null then
    raise exception 'No active Crew membership with admin/owner role';
  end if;

  -- Pick the most-recently-created Premises for this crew.
  select s.space_id
    into v_premises
  from public.spaces s
  where s.crew_id    = v_crew_id
    and s.parent_id  is null
    and s.deleted_at is null
  order by s.created_at desc
  limit 1;

  if v_premises is null then
    raise exception 'Create a Premises before applying a template';
  end if;

  -- Pull the template (system-global or owned by the caller's crew).
  select t.template_data
    into v_template
  from public.space_templates t
  where t.template_id = p_template_id
    and t.deleted_at  is null
    and (t.crew_id    is null or t.crew_id = v_crew_id)
  limit 1;

  if v_template is null then
    raise exception 'Template not found';
  end if;

  -- Replace: soft-delete every non-Premises space under the active premises.
  if p_mode = 'replace' then
    update public.spaces
    set deleted_at = now()
    where crew_id    = v_crew_id
      and parent_id is not null
      and deleted_at is null;
  end if;

  -- Walk the tree depth-first, inserting a space row for each node.
  v_inserted := public._stamp_template_tree(
    v_crew_id,
    v_user_id,
    v_premises,
    v_template,
    p_mode
  );

  return v_inserted;
end;
$$;

revoke execute on function public.apply_space_template(uuid, text) from public;
grant  execute on function public.apply_space_template(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- Helper: walks a template node and inserts spaces under p_parent_id.
-- Used recursively. SECURITY DEFINER so RLS doesn't block the inserts
-- when called from within apply_space_template.
-- ------------------------------------------------------------
create or replace function public._stamp_template_tree(
  p_crew_id   uuid,
  p_user_id   text,
  p_parent_id uuid,
  p_node      jsonb,
  p_mode      text
)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_name       text;
  v_unit_type  public.unit_type;
  v_new_id     uuid;
  v_inserted   int := 0;
  v_child      jsonb;
  v_attempt    int;
  v_candidate  text;
  v_exists     boolean;
begin
  v_name      := p_node->>'name';
  v_unit_type := (p_node->>'unit_type')::public.unit_type;

  if v_name is null or length(v_name) = 0 then
    raise exception 'Template node missing name';
  end if;

  -- Merge: handle name conflicts by appending " (N)" until free.
  if p_mode = 'merge' then
    v_attempt   := 1;
    v_candidate := v_name;
    loop
      select exists (
        select 1 from public.spaces
        where parent_id  = p_parent_id
          and name       = v_candidate
          and deleted_at is null
      )
      into v_exists;
      exit when not v_exists;
      v_attempt   := v_attempt + 1;
      v_candidate := v_name || ' (' || v_attempt || ')';
    end loop;
    v_name := v_candidate;
  end if;

  insert into public.spaces (crew_id, parent_id, unit_type, name, created_by)
  values (p_crew_id, p_parent_id, v_unit_type, v_name, p_user_id)
  returning space_id into v_new_id;

  v_inserted := 1;

  -- Recurse into children.
  if jsonb_typeof(p_node->'children') = 'array' then
    for v_child in
      select * from jsonb_array_elements(p_node->'children')
    loop
      v_inserted := v_inserted + public._stamp_template_tree(
        p_crew_id,
        p_user_id,
        v_new_id,
        v_child,
        p_mode
      );
    end loop;
  end if;

  return v_inserted;
end;
$$;

revoke execute on function public._stamp_template_tree(uuid, text, uuid, jsonb, text) from public;
-- The inner helper is SECURITY DEFINER; we keep its execute privileges
-- locked to definer-only (it's only called by apply_space_template).
