-- Ekstreler banka karti degil, donemli zorunlu kategori.

alter table budget_categories
  add column if not exists valid_from date,
  add column if not exists valid_to date;

alter table budget_categories
  drop constraint if exists budget_categories_valid_range;

alter table budget_categories
  add constraint budget_categories_valid_range
  check (valid_to is null or valid_from is null or valid_to >= valid_from);

drop index if exists budget_categories_one_statement;

insert into budget_categories (id, user_id, name, kind, valid_from)
select gen_random_uuid(), s.user_id,
  case s.bank
    when 'garanti' then 'Garanti'
    when 'hadi' then 'Hadi'
    when 'enpara' then 'Enpara'
    when 'garanti-2' then 'Garanti 2'
  end,
  'statement',
  min(s.month)
from budget_statements s
where not exists (
  select 1 from budget_categories c
  where c.user_id = s.user_id
    and c.kind = 'statement'
    and c.name = case s.bank
      when 'garanti' then 'Garanti'
      when 'hadi' then 'Hadi'
      when 'enpara' then 'Enpara'
      when 'garanti-2' then 'Garanti 2'
    end
)
group by s.user_id, s.bank;

insert into budget_entries (id, user_id, month, category_id, label, amount)
select gen_random_uuid(), s.user_id, s.month, c.id, c.name, s.amount
from budget_statements s
join budget_categories c
  on c.user_id = s.user_id
 and c.kind = 'statement'
 and c.name = case s.bank
    when 'garanti' then 'Garanti'
    when 'hadi' then 'Hadi'
    when 'enpara' then 'Enpara'
    when 'garanti-2' then 'Garanti 2'
  end
where not exists (
  select 1 from budget_entries e
  where e.user_id = s.user_id
    and e.month = s.month
    and e.category_id = c.id
);
