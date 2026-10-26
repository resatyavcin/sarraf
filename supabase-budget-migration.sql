-- Supabase SQL Editor'de tek seferde calistirin.
-- Aylik butce: sabit gelir, sabit gider, kategoriler, ekstre ve giderler.

create table if not exists budget_incomes (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists budget_incomes_user_idx on budget_incomes (user_id, created_at);

create table if not exists budget_fixed_expenses (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists budget_fixed_expenses_user_idx on budget_fixed_expenses (user_id, created_at);

create table if not exists budget_categories (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'custom' check (kind in ('custom', 'statement')),
  created_at timestamptz not null default now()
);

create unique index if not exists budget_categories_one_statement
  on budget_categories (user_id)
  where kind = 'statement';

create index if not exists budget_categories_user_idx on budget_categories (user_id, created_at);

create table if not exists budget_entries (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  month date not null,
  category_id uuid references budget_categories(id) on delete cascade not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists budget_entries_user_month_idx on budget_entries (user_id, month, created_at);

alter table budget_incomes enable row level security;
alter table budget_fixed_expenses enable row level security;
alter table budget_categories enable row level security;
alter table budget_entries enable row level security;

drop policy if exists "budget incomes select" on budget_incomes;
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

drop policy if exists "budget incomes insert" on budget_incomes;
create policy "budget incomes insert"
  on budget_incomes for insert
  with check (auth.uid() = user_id);

drop policy if exists "budget incomes update" on budget_incomes;
create policy "budget incomes update"
  on budget_incomes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budget incomes delete" on budget_incomes;
create policy "budget incomes delete"
  on budget_incomes for delete
  using (auth.uid() = user_id);

drop policy if exists "budget fixed select" on budget_fixed_expenses;
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

drop policy if exists "budget fixed insert" on budget_fixed_expenses;
create policy "budget fixed insert"
  on budget_fixed_expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "budget fixed update" on budget_fixed_expenses;
create policy "budget fixed update"
  on budget_fixed_expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budget fixed delete" on budget_fixed_expenses;
create policy "budget fixed delete"
  on budget_fixed_expenses for delete
  using (auth.uid() = user_id);

drop policy if exists "budget categories select" on budget_categories;
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

drop policy if exists "budget categories insert" on budget_categories;
create policy "budget categories insert"
  on budget_categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "budget categories update" on budget_categories;
create policy "budget categories update"
  on budget_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budget categories delete" on budget_categories;
create policy "budget categories delete"
  on budget_categories for delete
  using (auth.uid() = user_id);

drop policy if exists "budget entries select" on budget_entries;
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

drop policy if exists "budget entries insert" on budget_entries;
create policy "budget entries insert"
  on budget_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "budget entries update" on budget_entries;
create policy "budget entries update"
  on budget_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budget entries delete" on budget_entries;
create policy "budget entries delete"
  on budget_entries for delete
  using (auth.uid() = user_id);
