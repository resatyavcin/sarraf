-- Supabase SQL Editor'de tek seferde calistirin
-- (tablolar yoksa olusturur; varsa politikaları gunceller)

-- 1) Goruntuleyiciler
create table if not exists viewers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users(id) on delete cascade not null,
  viewer_email text not null,
  created_at timestamptz not null default now(),
  unique (viewer_email)
);

create index if not exists viewers_host_id_idx on viewers (host_id);

alter table viewers enable row level security;

drop policy if exists "host manages viewers" on viewers;
create policy "host manages viewers"
  on viewers for all
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

drop policy if exists "viewer can read own row" on viewers;
create policy "viewer can read own row"
  on viewers for select
  using (viewer_email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 2) Portfolios
create table if not exists portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  gold_physical numeric not null default 0,
  gold_digital numeric not null default 0,
  usd_physical numeric not null default 0,
  usd_digital numeric not null default 0,
  eur_physical numeric not null default 0,
  eur_digital numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table portfolios enable row level security;

drop policy if exists "Users can read own portfolio" on portfolios;
create policy "Users can read own portfolio"
  on portfolios for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = portfolios.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "Users can insert own portfolio" on portfolios;
create policy "Users can insert own portfolio"
  on portfolios for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own portfolio" on portfolios;
create policy "Users can update own portfolio"
  on portfolios for update
  using (auth.uid() = user_id);

-- 3) Savings
create table if not exists savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month date not null,
  amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table savings enable row level security;

drop policy if exists "savings select own" on savings;
create policy "savings select own"
  on savings for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = savings.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists "savings insert own" on savings;
create policy "savings insert own"
  on savings for insert
  with check (auth.uid() = user_id);

drop policy if exists "savings update own" on savings;
create policy "savings update own"
  on savings for update
  using (auth.uid() = user_id);

drop policy if exists "savings delete own" on savings;
create policy "savings delete own"
  on savings for delete
  using (auth.uid() = user_id);
