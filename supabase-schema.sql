-- Supabase SQL Editor'de calistirin

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
  using (auth.uid() = user_id);

create policy "Users can insert own portfolio"
  on portfolios for insert
  with check (auth.uid() = user_id);

create policy "Users can update own portfolio"
  on portfolios for update
  using (auth.uid() = user_id);
