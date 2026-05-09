-- Expose catalog artist + lyrics on the stats view.
-- Must DROP first: Postgres rejects CREATE OR REPLACE when new columns precede unchanged names
-- (it would incorrectly treat that as renaming e.g. line_appearances to artist).

drop view if exists public.song_play_counts;

create view public.song_play_counts with (security_invoker = true) as
select
  s.id as song_id,
  s.title,
  s.subtitle,
  s.artist,
  s.lyrics,
  count(si.id)::bigint as line_appearances,
  count(distinct si.service_id)::bigint as sundays_count
from public.songs s
left join public.setlist_items si on si.song_id = s.id
group by s.id, s.title, s.subtitle, s.artist, s.lyrics;
