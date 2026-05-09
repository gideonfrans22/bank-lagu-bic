-- Canonical song catalog: artist + lyrics for expanded picker search.
-- Substring search benefits from pg_trgm GIN indexes as the catalog grows.

create extension if not exists pg_trgm;

alter table public.songs
  add column if not exists artist text,
  add column if not exists lyrics text;

-- GIN trigram indexes help PostgREST `ilike('%term%')` filters on moderate/large catalogs.
create index if not exists songs_title_trgm_idx on public.songs using gin (title gin_trgm_ops);
create index if not exists songs_subtitle_trgm_idx on public.songs using gin (subtitle gin_trgm_ops);
create index if not exists songs_artist_trgm_idx on public.songs using gin (artist gin_trgm_ops);
create index if not exists songs_lyrics_trgm_idx on public.songs using gin (lyrics gin_trgm_ops);
