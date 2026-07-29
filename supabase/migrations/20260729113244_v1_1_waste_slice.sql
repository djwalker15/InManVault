-- ============================================================
-- v1.1 Waste slice — waste_events + six reason-detail tables
--
-- WasteEvent is a SLIM table (docs/entities/WasteEvent.md):
-- quantity, item, crew, unit cost, and user attribution derive by
-- joining to the parent waste flow via flow_id. Only waste-specific
-- fields live here. All tables are immutable ledger records:
-- created_at only, no UPDATE/DELETE (reusing flows_immutable_trigger).
--
-- RLS: SELECT policies first (the RETURNING trap — INSERT … RETURNING
-- fails if SELECT can't see the new row), membership resolved by
-- joining through flows. INSERT additionally asserts the parent flow
-- is a waste flow / the parent event has the matching waste_reason.
--
-- waste_prep_failure_details.recipe_id / batch_id are declared
-- WITHOUT foreign keys: recipes and batch_events land in v1.2 —
-- add the constraints in that slice.
-- ============================================================

create type public.waste_reason as enum (
  'expired',
  'spoiled',
  'damaged',
  'prep_failure',
  'spilled',
  'other'
);

-- ------------------------------------------------------------
-- waste_events
-- ------------------------------------------------------------
create table public.waste_events (
  waste_event_id uuid                primary key default gen_random_uuid(),
  flow_id        uuid                not null unique references public.flows(flow_id),
  waste_reason   public.waste_reason not null,
  total_cost     numeric             null check (total_cost is null or total_cost >= 0),
  notes          text                null,
  photo_url      text                null,
  created_at     timestamptz         not null default now()
);

create index waste_events_reason_idx on public.waste_events (waste_reason);

alter table public.waste_events enable row level security;

create policy waste_events_select
on public.waste_events
for select
to authenticated
using (
  exists (
    select 1
    from public.flows f
    where f.flow_id = waste_events.flow_id
      and public.is_crew_member(f.crew_id)
  )
);

create policy waste_events_insert
on public.waste_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.flows f
    where f.flow_id = waste_events.flow_id
      and f.flow_type = 'waste'
      and public.is_crew_member(f.crew_id)
  )
);

create trigger waste_events_no_update
before update on public.waste_events
for each row execute function public.flows_immutable_trigger();

create trigger waste_events_no_delete
before delete on public.waste_events
for each row execute function public.flows_immutable_trigger();

-- ------------------------------------------------------------
-- Reason detail tables. One row per waste_event, PK = waste_event_id.
-- ------------------------------------------------------------
create table public.waste_expired_details (
  waste_event_id   uuid        primary key references public.waste_events(waste_event_id),
  expiry_date      date        not null,
  days_past_expiry integer     null,
  space_id         uuid        null references public.spaces(space_id),
  was_opened       boolean     not null default false,
  created_at       timestamptz not null default now()
);

create table public.waste_spoilage_details (
  waste_event_id     uuid        primary key references public.waste_events(waste_event_id),
  expiry_date        date        null,
  space_id           uuid        null references public.spaces(space_id),
  container_type     text        null,
  days_since_opened  integer     null,
  storage_conditions text        null,
  created_at         timestamptz not null default now()
);

create table public.waste_damage_details (
  waste_event_id  uuid        primary key references public.waste_events(waste_event_id),
  how_damaged     text        not null,
  space_id        uuid        null references public.spaces(space_id),
  packaging_issue boolean     not null default false,
  created_at      timestamptz not null default now()
);

create table public.waste_prep_failure_details (
  waste_event_id  uuid        primary key references public.waste_events(waste_event_id),
  recipe_id       uuid        null, -- FK deferred to v1.2 (recipes)
  batch_id        uuid        null, -- FK deferred to v1.2 (batch_events)
  what_went_wrong text        not null,
  prepped_by      text        not null references public.users(user_id),
  created_at      timestamptz not null default now()
);

create table public.waste_spill_details (
  waste_event_id  uuid        primary key references public.waste_events(waste_event_id),
  space_id        uuid        null references public.spaces(space_id),
  how_spilled     text        not null,
  during_activity text        null,
  created_at      timestamptz not null default now()
);

create table public.waste_other_details (
  waste_event_id uuid        primary key references public.waste_events(waste_event_id),
  description    text        not null,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Shared RLS + immutability for the six detail tables.
-- SELECT: member via waste_events → flows join.
-- INSERT: same join, plus the parent event must carry the matching
-- waste_reason (one detail table per reason, enforced at the edge).
-- ------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('waste_expired_details',      'expired'),
      ('waste_spoilage_details',     'spoiled'),
      ('waste_damage_details',       'damaged'),
      ('waste_prep_failure_details', 'prep_failure'),
      ('waste_spill_details',        'spilled'),
      ('waste_other_details',        'other')
    ) as v(tbl, reason)
  loop
    execute format('alter table public.%I enable row level security', t.tbl);

    execute format($sql$
      create policy %1$s_select
      on public.%1$I
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.waste_events we
          join public.flows f on f.flow_id = we.flow_id
          where we.waste_event_id = %1$I.waste_event_id
            and public.is_crew_member(f.crew_id)
        )
      )
    $sql$, t.tbl);

    execute format($sql$
      create policy %1$s_insert
      on public.%1$I
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.waste_events we
          join public.flows f on f.flow_id = we.flow_id
          where we.waste_event_id = %1$I.waste_event_id
            and we.waste_reason = %2$L
            and public.is_crew_member(f.crew_id)
        )
      )
    $sql$, t.tbl, t.reason);

    execute format(
      'create trigger %1$s_no_update before update on public.%1$I
       for each row execute function public.flows_immutable_trigger()',
      t.tbl);
    execute format(
      'create trigger %1$s_no_delete before delete on public.%1$I
       for each row execute function public.flows_immutable_trigger()',
      t.tbl);
  end loop;
end;
$$;
