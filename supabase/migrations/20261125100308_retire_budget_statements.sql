-- Run the entire file in Supabase SQL Editor with a database-owner account.
-- Transfers positive statements and retires the source table in one transaction.
-- Ambiguous matches, changed amounts or dependent objects abort EVERYTHING.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

do $migration$
declare
  source_count bigint;
  reused_count bigint;
  inserted_count bigint;
begin
  if to_regclass('public.budget_statements') is null then
    raise notice 'budget_statements does not exist; nothing to migrate.';
    return;
  end if;

  lock table public.budget_statements in access exclusive mode;
  lock table public.budget_categories, public.budget_entries in share row exclusive mode;

  -- One real Kart Ekstresi category for each owner with a positive statement.
  insert into public.budget_categories (id, user_id, name, kind)
  select gen_random_uuid(), s.user_id, 'Kart Ekstresi', 'custom'
  from public.budget_statements s
  where s.amount > 0 and not exists (
    select 1 from public.budget_categories c
    where c.user_id = s.user_id and lower(btrim(c.name)) = 'kart ekstresi'
  )
  group by s.user_id;

  create temporary table _sarraf_statement_plan on commit drop as
  select s.user_id, s.month, s.bank, s.amount,
    case s.bank
      when 'garanti' then 'Garanti'
      when 'garanti-2' then 'Garanti 2'
      when 'enpara' then 'Enpara'
      when 'hadi' then 'Hadi'
    end as bank_label,
    (select c.id from public.budget_categories c
      where c.user_id = s.user_id and lower(btrim(c.name)) = 'kart ekstresi'
      order by c.created_at, c.id limit 1) as category_id,
    null::uuid as target_id,
    false as reused
  from public.budget_statements s where s.amount > 0;

  if exists (select 1 from _sarraf_statement_plan where bank_label is null or category_id is null) then
    raise exception 'Unknown bank or missing category. No changes were applied.';
  end if;

  -- Find earlier transfers before grouping bank categories. An entry matches a
  -- bank when its category is that bank, or its Kart Ekstresi label is that bank.
  -- Compare bank/month first, then amount: a changed amount must not create a
  -- second expense silently.
  create temporary table _sarraf_statement_candidates on commit drop as
  select p.user_id, p.month, p.bank, e.id, e.amount
  from _sarraf_statement_plan p
  join public.budget_entries e on e.user_id = p.user_id and e.month = p.month
  join public.budget_categories c on c.id = e.category_id and c.user_id = p.user_id
  where replace(lower(btrim(c.name)), '-', ' ') = lower(p.bank_label)
    or (lower(btrim(c.name)) = 'kart ekstresi'
        and replace(lower(btrim(e.label)), '-', ' ') = lower(p.bank_label));

  if exists (
    select 1 from _sarraf_statement_candidates group by user_id, month, bank having count(*) > 1
  ) then
    raise exception 'Multiple expenses match a statement. Resolve the duplicate bank/month records and rerun. No changes were applied.';
  end if;
  if exists (
    select 1 from _sarraf_statement_candidates c
    join _sarraf_statement_plan p using (user_id, month, bank)
    where c.amount is distinct from p.amount
  ) then
    raise exception 'A previously transferred statement has a different amount. Reconcile it before retiring the source. No changes were applied.';
  end if;

  update _sarraf_statement_plan p set target_id = c.id, reused = true
  from _sarraf_statement_candidates c
  where c.user_id = p.user_id and c.month = p.month and c.bank = p.bank;
  update _sarraf_statement_plan set target_id = gen_random_uuid() where target_id is null;

  -- Preserve the existing transaction IDs, labels, dates and amounts on reuse.
  update public.budget_entries e set category_id = p.category_id
  from _sarraf_statement_plan p where p.reused and e.id = p.target_id and e.user_id = p.user_id;

  insert into public.budget_entries (id, user_id, month, category_id, label, amount, spent_on)
  select target_id, user_id, month, category_id, bank_label, amount, month
  from _sarraf_statement_plan where not reused;

  -- Verify every positive source row against its exact destination record.
  if exists (
    select 1 from _sarraf_statement_plan p
    left join public.budget_entries e on e.id = p.target_id and e.user_id = p.user_id
    where e.id is null or e.month is distinct from p.month
      or e.amount is distinct from p.amount or e.category_id is distinct from p.category_id
  ) then
    raise exception 'Statement transfer verification failed. No changes were applied.';
  end if;
  if exists (select target_id from _sarraf_statement_plan group by target_id having count(*) > 1) then
    raise exception 'Two source statements share a destination. No changes were applied.';
  end if;

  select count(*), count(*) filter (where reused), count(*) filter (where not reused)
    into source_count, reused_count, inserted_count from _sarraf_statement_plan;

  -- RESTRICT is deliberate: unexpected dependent views/functions prevent
  -- retirement and roll back the transfer, instead of being dropped by CASCADE.
  drop table public.budget_statements restrict;
  raise notice 'Verified % positive statements: % reused, % inserted. budget_statements retired.', source_count, reused_count, inserted_count;
end
$migration$;

commit;
