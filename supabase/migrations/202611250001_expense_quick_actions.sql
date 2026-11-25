begin;

create table if not exists public.budget_quick_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index if not exists budget_quick_actions_label_unique
  on public.budget_quick_actions(user_id, category_id, lower(btrim(label)));
alter table public.budget_quick_actions enable row level security;
drop policy if exists quick_actions_owner on public.budget_quick_actions;
create policy quick_actions_owner on public.budget_quick_actions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.budget_categories c where c.id = category_id and c.user_id = (select auth.uid())
  ));
revoke all on public.budget_quick_actions from anon;
grant select, insert, update, delete on public.budget_quick_actions to authenticated;

commit;
