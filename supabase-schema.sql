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

-- Aylik butce. Mevcut projede supabase-budget-migration.sql kullanin.
create table budget_incomes (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  amount numeric not null default 0 check (amount >= 0),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create index budget_incomes_user_idx on budget_incomes (user_id, created_at);

create table budget_fixed_expenses (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  amount numeric not null default 0 check (amount >= 0),
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create index budget_fixed_expenses_user_idx on budget_fixed_expenses (user_id, created_at);

create table budget_categories (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'custom' check (kind in ('custom', 'statement')),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index budget_categories_user_idx on budget_categories (user_id, created_at);

create table budget_entries (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  month date not null,
  category_id uuid references budget_categories(id) on delete cascade not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create index budget_entries_user_month_idx on budget_entries (user_id, month, created_at);

create table budget_statements (
  user_id uuid references auth.users(id) on delete cascade not null,
  month date not null,
  bank text not null check (bank in ('garanti', 'hadi', 'enpara', 'garanti-2')),
  amount numeric not null check (amount >= 0),
  primary key (user_id, month, bank)
);

alter table budget_incomes enable row level security;
alter table budget_fixed_expenses enable row level security;
alter table budget_categories enable row level security;
alter table budget_entries enable row level security;
alter table budget_statements enable row level security;

create policy "budget incomes select"
  on budget_incomes for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = budget_incomes.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "budget incomes insert"
  on budget_incomes for insert
  with check (auth.uid() = user_id);

create policy "budget incomes update"
  on budget_incomes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budget incomes delete"
  on budget_incomes for delete
  using (auth.uid() = user_id);

create policy "budget fixed select"
  on budget_fixed_expenses for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = budget_fixed_expenses.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "budget fixed insert"
  on budget_fixed_expenses for insert
  with check (auth.uid() = user_id);

create policy "budget fixed update"
  on budget_fixed_expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budget fixed delete"
  on budget_fixed_expenses for delete
  using (auth.uid() = user_id);

create policy "budget categories select"
  on budget_categories for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = budget_categories.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "budget categories insert"
  on budget_categories for insert
  with check (auth.uid() = user_id);

create policy "budget categories update"
  on budget_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budget categories delete"
  on budget_categories for delete
  using (auth.uid() = user_id);

create policy "budget entries select"
  on budget_entries for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = budget_entries.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "budget entries insert"
  on budget_entries for insert
  with check (auth.uid() = user_id);

create policy "budget entries update"
  on budget_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budget entries delete"
  on budget_entries for delete
  using (auth.uid() = user_id);

create policy "budget statements select"
  on budget_statements for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from viewers v
      where v.host_id = budget_statements.user_id
        and v.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "budget statements insert"
  on budget_statements for insert
  with check (auth.uid() = user_id);

create policy "budget statements update"
  on budget_statements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "budget statements delete"
  on budget_statements for delete
  using (auth.uid() = user_id);
