-- Добавляем управляемый пользователем порядок сортировки категорий проблем.
-- По умолчанию используется для всех выпадающих списков (форма «Новая задача»,
-- фильтры, админка справочников). Значения backfill-ятся по текущему
-- алфавитному порядку, чтобы существующие UI сразу выглядели привычно.

begin;

alter table public.problem_categories
  add column if not exists sort_order int not null default 0;

-- Backfill: десятки для id-чисел, чтобы между соседями было место вставить
-- новую категорию без массовых UPDATE.
with ordered as (
  select id, row_number() over (order by name) * 10 as rn
  from public.problem_categories
)
update public.problem_categories c
   set sort_order = o.rn
  from ordered o
 where o.id = c.id
   and c.sort_order = 0;

-- Индекс для стабильной сортировки в v_tasks / списках.
create index if not exists problem_categories_sort_idx
  on public.problem_categories (sort_order, name);

comment on column public.problem_categories.sort_order is
  'Ручной порядок категорий в выпадающих списках. Меньше — выше. Меняется руководителем/админом в справочниках.';

commit;
