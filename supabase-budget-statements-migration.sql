-- Aylik ekstre tutarlari. Banka basina ayda bir kayit.

create table budget_statements (
  user_id uuid references auth.users(id) on delete cascade not null,
  month date not null,
  bank text not null check (bank in ('garanti', 'hadi', 'enpara', 'garanti-2')),
  amount numeric not null check (amount >= 0),
  primary key (user_id, month, bank)
);

alter table budget_statements enable row level security;

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
