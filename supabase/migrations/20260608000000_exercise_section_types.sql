-- Tag each exercise with the section types it can be prescribed in.
-- An empty array is treated as "wildcard" by the UI (shows in every section),
-- so existing rows continue to surface everywhere until the trainer backfills tags.

alter table exercises
  add column section_types section_type[] not null default '{}';

create index exercises_section_types_idx on exercises using gin (section_types);
