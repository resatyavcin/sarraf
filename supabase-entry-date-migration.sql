-- Hareketin gercek gunu. Ay kolonu ayin ilk gunu olarak kalir.

alter table budget_entries add column if not exists spent_on date;

update budget_entries
set spent_on = (created_at at time zone 'Europe/Istanbul')::date
where spent_on is null;
