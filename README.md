# Bank Lagu

Web app for recording **Sunday worship setlists** and answering **how many times we sang song X**.

It is aimed at church teams who want a single canonical song catalog (so spelling variants do not fragment statistics), fast weekly entry, and simple reports.

## Features

- **Auth** via Supabase (email + password by default in this scaffold).
- **Services**: one saved setlist per **service date** (one Sunday per calendar day — adjust the schema if you run multiple gatherings the same day).
- **Canonical songs**: each setlist row points at a **`songs` row**. The picker searches **title**, **subtitle**, **artist**, and **lyrics** (substring match) and lets you **create** a missing song from the title alone. Optional **`artist`** and **`lyrics`** can be filled on the **Song counts** page (contributors) or in Supabase. **Lyrics** often implicate copyright — only store text your team is allowed to reproduce.
- **Statistics**: **Song counts** page reads the `song_play_counts` view (includes **artist** / **lyrics**) and lets **contributors** edit those fields inline.
  - **Line appearances** — number of setlist rows (same song twice in one Sunday counts twice).
  - **Sundays** — number of distinct service dates where the song appeared at least once.

## Roles

- **`contributor`** (default for new users): full read/write via Row Level Security.
- **`viewer`**: read-only; set `<role>viewer</role>` manually in Supabase (`profiles.role`) when you onboard someone who should never edit.

## Tech stack

- **Frontend**: React 18, Vite, TypeScript, React Router.
- **Backend**: Supabase (Postgres, Auth).

## Prerequisites

- Node.js 20+ recommended.
- A Supabase project.

## Configure Supabase

1. Create a project at [Supabase Dashboard](https://supabase.com/dashboard).
2. In **Authentication → Providers**, enable **Email** (sign up / password). Turn off confirm email for quick local testing if you want.
3. Apply the database schema (run **all** migrations in `supabase/migrations/` in order, or let the CLI apply them):
   - **Option A — CLI:** install [Supabase CLI](https://supabase.com/docs/guides/cli), link the project, then run `supabase db push` from this repo.
   - **Option B — SQL editor:** run migrations in order through `20260510130000_song_play_counts_add_artist_lyrics.sql` (updates the `song_play_counts` view so the stats page can show and edit **artist** / **lyrics**). At minimum: `20260509120000…`, `20260510120000…`, then `20260510130000…`.

The migration creates:

- `profiles`, `songs`, `services`, `setlist_items`
- `song_play_counts` view (uses `security_invoker`, requires **Postgres 15+** as on hosted Supabase)
- RLS policies and a trigger to insert a `profiles` row when a user signs up

If you need this to run on older Postgres, remove `with (security_invoker = true)` from the view definition and ensure the view still matches your security expectations.

## Run the app locally

```bash
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Project Settings → API

npm install
npm run dev
```

Open the printed local URL, register a user, then add a Sunday and save a setlist.

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe in the browser with RLS) |

Never put the **service role** key in Vite env vars.

## Project layout

- `src/components/SongPicker.tsx` — search-as-you-type on `title`, `subtitle`, `artist`, `lyrics`; select existing, or **Create** to insert a new canonical row (title only from the UI).
- `src/pages/ServiceEdit.tsx` — edit one Sunday: metadata + ordered setlist lines (each line requires a picked/created song).
- `src/pages/SongStats.tsx` — frequencies from `song_play_counts`; contributors can edit **artist** and **lyrics** per song.
- `supabase/migrations/` — source of truth for schema.

## Extending the product

- **Multiple services per day**: drop `services_one_per_day`, add a `slot` column (e.g. `morning` / `evening`), and use a composite unique key.
- **Merge duplicate songs**: add an admin flow to re-point `setlist_items.song_id` and delete the extra `songs` row.
- **CCLI / planning exports**: optional fields already include `ccli_number` on `songs` for future use.

## Blank page in dev?

1. **Environment** — Variables must be named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a **`.env` file at the project root** (not only in the OS environment). After changing `.env`, **stop and restart** `npm run dev`. If either value is missing, the app shows an on-screen **“Supabase env not set”** message instead of a blank page.
2. **Console errors** — Open **F12 → Console**. A red stack trace usually points to the cause (e.g. failed import, runtime error). The app wraps the tree in an **error boundary** so some failures show a visible message instead of a white screen.
3. **Database** — Misconfigured Supabase alone should still show the **sign-in** screen. If sign-in fails, check the Network tab for `401`/`403` or CORS issues.

## License

Use and modify freely for your church or organization.
