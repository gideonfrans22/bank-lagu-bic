export type ProfileRole = "contributor" | "viewer";

export type Profile = {
  id: string;
  display_name: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
};

export type Song = {
  id: string;
  title: string;
  subtitle: string | null;
  artist: string | null;
  lyrics: string | null;
  ccli_number: string | null;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  service_date: string;
  title: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SetlistItem = {
  id: string;
  service_id: string;
  position: number;
  song_id: string;
  custom_title_override: string | null;
  artist_or_source: string | null;
  musical_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SongPlayCount = {
  song_id: string;
  title: string;
  subtitle: string | null;
  artist: string | null;
  lyrics: string | null;
  line_appearances: number;
  sundays_count: number;
};
