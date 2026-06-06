# Supabase migrations

Schema migrations live in [`migrations/`](./migrations/). Each file is named
`<YYYYMMDDHHMMSS>_<short_name>.sql` so they sort lexicographically. This matches
the Supabase CLI convention, so we can adopt the CLI later without renaming.

## Running a migration (manual, for now)

1. Open the [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **SQL Editor** → **New query**.
3. Paste the contents of the migration file.
4. Click **Run**.
5. If you see "Success. No rows returned" — it worked.

## After the first migration: promote yourself to admin

The signup trigger gives new users `role='client'` by default. To make your
account the admin, run this once in SQL Editor (replace the email):

```sql
update profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
```

Verify:

```sql
select id, email, role from profiles;
```

## When we want CLI migrations later

```bash
brew install supabase/tap/supabase
supabase login
cd ~/Code/wio-platform
supabase init           # creates supabase/config.toml
supabase link --project-ref abgibgafhhovxcrwqrft
supabase db push        # runs any unapplied migrations
```

Until then, paste-into-SQL-Editor is fine for a one-person side project.
