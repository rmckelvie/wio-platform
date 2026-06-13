-- Track whether a video URL can actually be embedded in an iframe.
--
--   true:  confirmed embeddable via YouTube oEmbed
--   false: oEmbed returned 401/403/404 — uploader disabled embedding,
--          video is private, or doesn't exist. Client view falls back
--          to the "Watch demo" text link.
--   null:  not yet checked (legacy rows pre-migration, non-YouTube URL,
--          or transient network error during save). Treated optimistically
--          on the client — we still attempt the embed. Admins can run the
--          "Re-check video embeds" action to backfill these.

alter table exercises
  add column embed_allowed boolean;

comment on column exercises.embed_allowed is
  'YouTube oEmbed check result. null = unknown, true = embeddable, false = disabled.';
