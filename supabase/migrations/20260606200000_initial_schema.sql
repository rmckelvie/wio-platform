-- WIO platform v1 schema
-- Single-trainer S&C platform. Programmes authored per-client in the UI.
-- Exercises live in a shared library (FK reference). Prescriptions are per-row.
-- Drip-feed: clients only see assignment_weeks where release_date <= now().

-- =============================================================================
-- ENUMS
-- =============================================================================

create type user_role as enum ('admin', 'client');

create type section_type as enum (
  'prime',
  'plyo',
  'strength',
  'accessories',
  'conditioning',
  'core_conditioning'
);

create type assignment_status as enum ('active', 'completed', 'paused');

create type client_status as enum ('active', 'archived');

-- =============================================================================
-- PROFILES — extends auth.users
-- =============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'client',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  )
$$;

-- =============================================================================
-- CLIENTS_ADMIN — the trainer's roster (single-trainer model, no FK to a trainer)
-- =============================================================================

create table clients_admin (
  client_id uuid primary key references profiles(id) on delete cascade,
  status client_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- EXERCISES — shared library (referenced by FK, not snapshotted)
-- =============================================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  video_url text,
  default_notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_name_idx on exercises (lower(name));
create index exercises_archived_idx on exercises (archived) where archived = false;

-- =============================================================================
-- CLIENT_ASSIGNMENTS — a programme block assigned to a client
-- =============================================================================

create table client_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  weeks int not null check (weeks > 0 and weeks <= 52),
  status assignment_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_assignments_client_idx on client_assignments (client_id);

-- =============================================================================
-- ASSIGNMENT_WEEKS — drip-feed gate lives here
-- =============================================================================

create table assignment_weeks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references client_assignments(id) on delete cascade,
  week_index int not null check (week_index > 0),
  name text,  -- optional, e.g. "Deload"
  release_date date not null,
  unique (assignment_id, week_index)
);

create index assignment_weeks_assignment_idx on assignment_weeks (assignment_id);
create index assignment_weeks_release_idx on assignment_weeks (release_date);

-- =============================================================================
-- ASSIGNED_SESSIONS / SECTIONS / EXERCISES — the actual programme content
-- =============================================================================

create table assigned_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_week_id uuid not null references assignment_weeks(id) on delete cascade,
  session_index int not null check (session_index > 0),
  name text not null,
  unique (assignment_week_id, session_index)
);

create index assigned_sessions_week_idx on assigned_sessions (assignment_week_id);

create table assigned_sections (
  id uuid primary key default gen_random_uuid(),
  assigned_session_id uuid not null references assigned_sessions(id) on delete cascade,
  order_index int not null,
  section_type section_type not null,
  unique (assigned_session_id, order_index)
);

create index assigned_sections_session_idx on assigned_sections (assigned_session_id);

create table assigned_exercises (
  id uuid primary key default gen_random_uuid(),
  assigned_section_id uuid not null references assigned_sections(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  order_index int not null,
  prescribed_sets text,   -- nullable, free-text (e.g. "3", "")
  prescribed_reps text,   -- nullable, free-text (e.g. "5", "6/6", "30s", "max")
  notes text,             -- per-row override
  unique (assigned_section_id, order_index)
);

create index assigned_exercises_section_idx on assigned_exercises (assigned_section_id);
create index assigned_exercises_exercise_idx on assigned_exercises (exercise_id);

-- =============================================================================
-- EXERCISE_LOGS — what the client actually did
-- =============================================================================

create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  assigned_exercise_id uuid not null references assigned_exercises(id) on delete cascade,
  set_number int not null check (set_number > 0),
  weight_kg numeric(6, 2),
  reps_done int,
  rpe numeric(3, 1),  -- 0.0 to 10.0
  notes text,
  logged_at timestamptz not null default now()
);

create index exercise_logs_exercise_idx on exercise_logs (assigned_exercise_id);
create index exercise_logs_logged_at_idx on exercise_logs (logged_at);

-- =============================================================================
-- HELPER: which assignment_week_ids is the current user allowed to see?
-- =============================================================================
-- Admin: all of them.
-- Client: their own AND release_date <= today.

create or replace function public.visible_assignment_week_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select aw.id
  from assignment_weeks aw
  join client_assignments ca on ca.id = aw.assignment_id
  where
    public.is_admin()
    or (
      ca.client_id = auth.uid()
      and aw.release_date <= current_date
    )
$$;

-- =============================================================================
-- updated_at triggers
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_profiles before update on profiles
  for each row execute procedure public.touch_updated_at();

create trigger touch_exercises before update on exercises
  for each row execute procedure public.touch_updated_at();

create trigger touch_client_assignments before update on client_assignments
  for each row execute procedure public.touch_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table profiles enable row level security;
alter table clients_admin enable row level security;
alter table exercises enable row level security;
alter table client_assignments enable row level security;
alter table assignment_weeks enable row level security;
alter table assigned_sessions enable row level security;
alter table assigned_sections enable row level security;
alter table assigned_exercises enable row level security;
alter table exercise_logs enable row level security;

-- PROFILES: user sees own; admin sees all; user can update own display_name
create policy "profiles_self_read" on profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_self_update" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
  -- prevents user from self-promoting to admin

create policy "profiles_admin_update" on profiles
  for update using (public.is_admin());

-- CLIENTS_ADMIN: admin only
create policy "clients_admin_all" on clients_admin
  for all using (public.is_admin()) with check (public.is_admin());

-- EXERCISES: admin can do everything; clients can read non-archived
create policy "exercises_admin_all" on exercises
  for all using (public.is_admin()) with check (public.is_admin());

create policy "exercises_client_read" on exercises
  for select using (not archived);

-- CLIENT_ASSIGNMENTS: client sees own; admin sees all
create policy "client_assignments_read" on client_assignments
  for select using (client_id = auth.uid() or public.is_admin());

create policy "client_assignments_admin_write" on client_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- ASSIGNMENT_WEEKS: client sees own AND released; admin sees all
create policy "assignment_weeks_read" on assignment_weeks
  for select using (
    public.is_admin()
    or exists (
      select 1 from client_assignments ca
      where ca.id = assignment_weeks.assignment_id
        and ca.client_id = auth.uid()
        and assignment_weeks.release_date <= current_date
    )
  );

create policy "assignment_weeks_admin_write" on assignment_weeks
  for all using (public.is_admin()) with check (public.is_admin());

-- ASSIGNED_SESSIONS / SECTIONS / EXERCISES: cascade through visible weeks
create policy "assigned_sessions_read" on assigned_sessions
  for select using (assignment_week_id in (select public.visible_assignment_week_ids()));

create policy "assigned_sessions_admin_write" on assigned_sessions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assigned_sections_read" on assigned_sections
  for select using (
    assigned_session_id in (
      select id from assigned_sessions
      where assignment_week_id in (select public.visible_assignment_week_ids())
    )
  );

create policy "assigned_sections_admin_write" on assigned_sections
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assigned_exercises_read" on assigned_exercises
  for select using (
    assigned_section_id in (
      select sec.id from assigned_sections sec
      join assigned_sessions ses on ses.id = sec.assigned_session_id
      where ses.assignment_week_id in (select public.visible_assignment_week_ids())
    )
  );

create policy "assigned_exercises_admin_write" on assigned_exercises
  for all using (public.is_admin()) with check (public.is_admin());

-- EXERCISE_LOGS: client reads/writes own; admin reads all
create policy "exercise_logs_client_read" on exercise_logs
  for select using (
    public.is_admin()
    or exists (
      select 1
      from assigned_exercises ae
      join assigned_sections sec on sec.id = ae.assigned_section_id
      join assigned_sessions ses on ses.id = sec.assigned_session_id
      join assignment_weeks aw on aw.id = ses.assignment_week_id
      join client_assignments ca on ca.id = aw.assignment_id
      where ae.id = exercise_logs.assigned_exercise_id
        and ca.client_id = auth.uid()
    )
  );

create policy "exercise_logs_client_write" on exercise_logs
  for insert with check (
    exists (
      select 1
      from assigned_exercises ae
      join assigned_sections sec on sec.id = ae.assigned_section_id
      join assigned_sessions ses on ses.id = sec.assigned_session_id
      join assignment_weeks aw on aw.id = ses.assignment_week_id
      join client_assignments ca on ca.id = aw.assignment_id
      where ae.id = exercise_logs.assigned_exercise_id
        and ca.client_id = auth.uid()
        and aw.release_date <= current_date
    )
  );

create policy "exercise_logs_client_update" on exercise_logs
  for update using (
    exists (
      select 1
      from assigned_exercises ae
      join assigned_sections sec on sec.id = ae.assigned_section_id
      join assigned_sessions ses on ses.id = sec.assigned_session_id
      join assignment_weeks aw on aw.id = ses.assignment_week_id
      join client_assignments ca on ca.id = aw.assignment_id
      where ae.id = exercise_logs.assigned_exercise_id
        and ca.client_id = auth.uid()
    )
  );

create policy "exercise_logs_client_delete" on exercise_logs
  for delete using (
    exists (
      select 1
      from assigned_exercises ae
      join assigned_sections sec on sec.id = ae.assigned_section_id
      join assigned_sessions ses on ses.id = sec.assigned_session_id
      join assignment_weeks aw on aw.id = ses.assignment_week_id
      join client_assignments ca on ca.id = aw.assignment_id
      where ae.id = exercise_logs.assigned_exercise_id
        and ca.client_id = auth.uid()
    )
  );

create policy "exercise_logs_admin_all" on exercise_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- BACKFILL — create profile rows for any auth.users created before this migration
-- =============================================================================

insert into public.profiles (id, email, role)
select id, email, 'client'
from auth.users
on conflict (id) do nothing;
