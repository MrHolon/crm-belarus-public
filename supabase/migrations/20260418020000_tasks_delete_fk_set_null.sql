-- Fix: при физическом удалении задачи (ТЗ §4.10) Postgres падал с
--   update or delete on table "tasks" violates foreign key constraint
--   "tasks_parent_task_id_fkey" on table "tasks"
-- если у задачи есть дочерние (например, developer_task), либо если на задачу
-- ссылается статья в базе знаний (kb_articles.related_task_id).
--
-- Удалять детей каскадом нельзя — в них уже могла быть выполнена работа
-- разработчиком. Правильное поведение — оставить детей и статью КБ, а
-- ссылку «обнулить» через ON DELETE SET NULL.
--
-- Остальные зависимые таблицы (task_history, task_comments, task_helpers,
-- task_tags, task_files, notifications) уже созданы с ON DELETE CASCADE,
-- поэтому их трогать не нужно.

begin;

alter table public.tasks
  drop constraint if exists tasks_parent_task_id_fkey;

alter table public.tasks
  add constraint tasks_parent_task_id_fkey
    foreign key (parent_task_id)
    references public.tasks (id)
    on delete set null;

alter table public.kb_articles
  drop constraint if exists kb_articles_related_task_id_fkey;

alter table public.kb_articles
  add constraint kb_articles_related_task_id_fkey
    foreign key (related_task_id)
    references public.tasks (id)
    on delete set null;

commit;
