create table public.budget_savings_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric not null default 0 check (amount >= 0 and amount <= 90071992547409.91),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.budget_savings_targets enable row level security;
create policy "targets read own or shared" on public.budget_savings_targets for select to authenticated
  using ((select auth.uid()) = user_id or exists (
    select 1 from public.viewers v where v.host_id = budget_savings_targets.user_id
    and v.viewer_email = lower(coalesce((select auth.jwt())->>'email', ''))
  ));
create policy "targets insert own" on public.budget_savings_targets for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "targets update own" on public.budget_savings_targets for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "targets delete own" on public.budget_savings_targets for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.budget_savings_targets from anon;
grant select, insert, update, delete on public.budget_savings_targets to authenticated;
