-- Track when a client marks a session complete.
-- Nullable so existing sessions stay "not done" by default.

alter table assigned_sessions
  add column completed_at timestamptz;

-- Let the owning client mark their own sessions complete (any column technically,
-- but the only path through the app sets `completed_at`). RLS for admin write
-- already exists; new policy ORs with it.

create policy "assigned_sessions_client_update" on assigned_sessions
  for update using (
    exists (
      select 1
      from assignment_weeks aw
      join client_assignments ca on ca.id = aw.assignment_id
      where aw.id = assigned_sessions.assignment_week_id
        and ca.client_id = auth.uid()
    )
  );
