-- Per-exercise timing config.
--
-- rest_seconds:           seconds of rest after each logged set. Triggers the
--                         RestTimer on the client. Null = no auto-timer.
-- work_interval_seconds:  if set, exercise is a fixed-interval pattern (EMOM /
--                         similar). Each "set" cycles every N seconds. Null =
--                         standard "log when ready" mode.

alter table assigned_exercises
  add column rest_seconds int
    check (rest_seconds is null or (rest_seconds >= 0 and rest_seconds <= 7200));

alter table assigned_exercises
  add column work_interval_seconds int
    check (work_interval_seconds is null or (work_interval_seconds >= 5 and work_interval_seconds <= 7200));
