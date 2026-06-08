-- Drop the UNIQUE constraints on (parent, ordering) so that swap-based
-- reordering can run two simple UPDATEs without violating uniqueness
-- between the statements. Ordering is still deterministic via
-- ORDER BY ... index, id (id breaks ties).
--
-- These were nice-to-haves, not correctness invariants. The CHECK
-- constraints on > 0 / >= 0 stay in place.

alter table assigned_sessions
  drop constraint if exists assigned_sessions_assignment_week_id_session_index_key;

alter table assigned_sections
  drop constraint if exists assigned_sections_assigned_session_id_order_index_key;

alter table assigned_exercises
  drop constraint if exists assigned_exercises_assigned_section_id_order_index_key;
