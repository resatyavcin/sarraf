-- Supabase SQL Editor'de calistirin

-- Goruntuleyiciler (mail gonderilmez; host Gmail ekler)
create table viewers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users(id) on delete cascade not null,
  viewer_email text not null,
  created_at timestamptz not null default now(),
  unique (viewer_email)
);

create index viewers_host_id_idx on viewers (host_id);

alter table viewers enable row level security;

create policy "host manages viewers"
  on viewers for all
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create policy "viewer can read own row"
  on viewers for select
  using (viewer_email = lower(coalesce(auth.jwt() ->> 'email', '')));

create table portfolios (
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

create policy "Users can insert own portfolio"
  on portfolios for insert
  with check (auth.uid() = user_id);

create policy "Users can update own portfolio"
  on portfolios for update
  using (auth.uid() = user_id);

-- Aylik birikim (kullanici basi ay basi tek kayit)
create table savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  month date not null,
  amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table savings enable row level security;

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

create policy "savings insert own"
  on savings for insert
  with check (auth.uid() = user_id);

create policy "savings update own"
  on savings for update
  using (auth.uid() = user_id);

create policy "savings delete own"
  on savings for delete
  using (auth.uid() = user_id);

-- Birikim hedefi (kullanici basi tek kayit)
create table savings_goal (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_amount numeric not null check (target_amount > 0),
  target_date date not null,
  updated_at timestamptz not null default now()
);

alter table savings_goal enable row level security;

create policy "goal select own or viewer"
  on savings_goal for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = savings_goal.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "goal upsert own"
  on savings_goal for insert
  with check (auth.uid() = user_id);

create policy "goal update own"
  on savings_goal for update
  using (auth.uid() = user_id);

create policy "goal delete own"
  on savings_goal for delete
  using (auth.uid() = user_id);
