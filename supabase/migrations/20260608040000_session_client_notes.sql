-- Free-text reflections the client jots down at the end of a session.
-- Nullable; existing rows keep null. Trainer reads these on the
-- admin week page; the existing assigned_sessions_client_update RLS
-- policy already allows the owning client to write.

alter table assigned_sessions
  add column client_notes text;
