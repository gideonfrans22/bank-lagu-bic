-- Bank Lagu: Sunday service setlists with canonical songs for play counts.
-- Apply with: supabase db push (CLI) or paste into Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users; role gates writes)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'contributor' check (role in ('contributor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Canonical songs (stable id for "how many times we sang X")
-- ---------------------------------------------------------------------------
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  normalized_title text generated always as (
    lower(trim(regexp_replace(title, '[[:space:]]+', ' ', 'g')))
  ) stored,
  ccli_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint songs_title_not_empty check (length(trim(title)) > 0)
);

create unique index songs_normalized_title_key on public.songs (normalized_title);

-- ---------------------------------------------------------------------------
-- One row per Sunday (adjust unique constraint if you add multiple services/day)
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  title text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_one_per_day unique (service_date)
);

create index services_service_date_idx on public.services (service_date desc);

-- ---------------------------------------------------------------------------
-- Setlist lines (same song may appear twice in one service if you list it twice)
-- ---------------------------------------------------------------------------
create table public.setlist_items (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  position smallint not null check ("position" > 0),
  song_id uuid not null references public.songs (id) on delete restrict,
  custom_title_override text,
  artist_or_source text,
  musical_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, "position")
);

create index setlist_items_service_id_idx on public.setlist_items (service_id);
create index setlist_items_song_id_idx on public.setlist_items (song_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create trigger setlist_items_set_updated_at
  before update on public.setlist_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    'contributor'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Aggregates for reporting (RLS on base tables still applies)
-- ---------------------------------------------------------------------------
-- security_invoker: counts respect caller's RLS (Postgres 15+). Omit the WITH clause on older Postgres.
create or replace view public.song_play_counts with (security_invoker = true) as
select
  s.id as song_id,
  s.title,
  s.subtitle,
  count(si.id)::bigint as line_appearances,
  count(distinct si.service_id)::bigint as sundays_count
from public.songs s
left join public.setlist_items si on si.song_id = s.id
group by s.id, s.title, s.subtitle;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.services enable row level security;
alter table public.setlist_items enable row level security;

-- Profiles
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Songs: read all; write for contributors only
create policy "songs_select_authenticated"
  on public.songs for select
  to authenticated
  using (true);

create policy "songs_insert_contributor"
  on public.songs for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

create policy "songs_update_contributor"
  on public.songs for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

create policy "songs_delete_contributor"
  on public.songs for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

-- Services
create policy "services_select_authenticated"
  on public.services for select
  to authenticated
  using (true);

create policy "services_insert_contributor"
  on public.services for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

create policy "services_update_contributor"
  on public.services for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

create policy "services_delete_contributor"
  on public.services for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

-- Setlist items
create policy "setlist_items_select_authenticated"
  on public.setlist_items for select
  to authenticated
  using (true);

create policy "setlist_items_insert_contributor"
  on public.setlist_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

create policy "setlist_items_update_contributor"
  on public.setlist_items for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );

create policy "setlist_items_delete_contributor"
  on public.setlist_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'contributor'
    )
  );
