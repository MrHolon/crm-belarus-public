-- C3: расширить полнотекстовый поиск — номер тикета в search_tsv (нельзя ссылаться на
-- generated ticket_number — дублируем выражение из init).
drop view if exists public.v_tasks;

drop index if exists public.tasks_search_idx;
alter table public.tasks drop column if exists search_tsv;

alter table public.tasks add column search_tsv tsvector generated always as (
  setweight(to_tsvector('russian', coalesce(title, '')), 'A')
  || setweight(to_tsvector('russian', coalesce(description, '')), 'B')
  || setweight(
       to_tsvector('simple', 'TASK-' || lpad(id::text, 5, '0')),
       'C'
     )
) stored;

create index tasks_search_idx on public.tasks using gin (search_tsv);

comment on column public.tasks.search_tsv is
  'Полнотекстовый индекс: заголовок (A), описание (B), номер TASK-xxxxx (C).';

create or replace view public.v_tasks
with (security_invoker = on) as
select
  t.*,
  (t.due_date is not null
    and t.status not in ('done', 'cancelled')
    and now() > t.due_date) as is_overdue
from public.tasks t;

comment on view public.v_tasks is
  'Задачи с вычисляемым флагом is_overdue. security_invoker = on гарантирует, что RLS таблицы tasks применяется к читателям view.';
