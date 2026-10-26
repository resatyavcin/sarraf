-- Sabit gelir ve giderlere gecerlilik araligi.
-- Ekstre ozel kategori olmaktan cikar; normal kategori olarak kalir.

alter table budget_incomes add column if not exists valid_from date;
alter table budget_incomes add column if not exists valid_to date;
alter table budget_fixed_expenses add column if not exists valid_from date;
alter table budget_fixed_expenses add column if not exists valid_to date;

update budget_incomes
set valid_from = date_trunc('month', created_at)::date
where valid_from is null;

update budget_fixed_expenses
set valid_from = date_trunc('month', created_at)::date
where valid_from is null;

alter table budget_incomes alter column valid_from set not null;
alter table budget_fixed_expenses alter column valid_from set not null;

alter table budget_incomes drop constraint if exists budget_incomes_range;
alter table budget_incomes
  add constraint budget_incomes_range check (valid_to is null or valid_to >= valid_from);

alter table budget_fixed_expenses drop constraint if exists budget_fixed_expenses_range;
alter table budget_fixed_expenses
  add constraint budget_fixed_expenses_range check (valid_to is null or valid_to >= valid_from);

update budget_categories
set kind = 'custom'
where kind = 'statement';
