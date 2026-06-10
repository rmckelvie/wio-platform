-- One row per client per date.
--   weight_kg, sleep_hours, energy and notes are all optional —
--   the client fills in whatever's relevant on the day.

create table client_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg > 0),
  sleep_hours numeric(4, 1) check (sleep_hours is null or sleep_hours >= 0),
  energy int check (energy is null or (energy >= 1 and energy <= 5)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, measured_on)
);

create index client_metrics_client_idx on client_metrics (client_id, measured_on desc);

create trigger touch_client_metrics before update on client_metrics
  for each row execute procedure public.touch_updated_at();

alter table client_metrics enable row level security;

-- Client reads / writes / deletes own; admin sees all
create policy "client_metrics_client_select" on client_metrics
  for select using (client_id = auth.uid() or public.is_admin());

create policy "client_metrics_client_insert" on client_metrics
  for insert with check (client_id = auth.uid());

create policy "client_metrics_client_update" on client_metrics
  for update using (client_id = auth.uid());

create policy "client_metrics_client_delete" on client_metrics
  for delete using (client_id = auth.uid());

create policy "client_metrics_admin_all" on client_metrics
  for all using (public.is_admin()) with check (public.is_admin());
