-- Birikim hedefi tablosu (Supabase SQL Editor'de calistirin)

create table if not exists savings_goal (
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
