import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';

export async function listProblemCategories() {
  const { data, error } = await supabase
    .from('problem_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertProblemCategory(values: TablesInsert<'problem_categories'>) {
  // Новые категории попадают в конец списка — считаем max(sort_order) + 10.
  let nextOrder = values.sort_order;
  if (nextOrder == null) {
    const { data: top } = await supabase
      .from('problem_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    nextOrder = (top?.sort_order ?? 0) + 10;
  }

  const { data, error } = await supabase
    .from('problem_categories')
    .insert({ ...values, sort_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProblemCategory(
  id: number,
  values: TablesUpdate<'problem_categories'>,
) {
  const { data, error } = await supabase
    .from('problem_categories')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Поменять местами две категории по `sort_order`. Надёжнее, чем
 * инкремент/декремент, и атомарно с точки зрения двух последовательных
 * UPDATE-ов (в худшем случае мы получим «обе с тем же order» в параллельной
 * гонке — её UI исключает, т.к. менять может один админ за раз).
 */
export async function swapCategorySortOrder(
  a: { id: number; sort_order: number },
  b: { id: number; sort_order: number },
): Promise<void> {
  if (a.sort_order === b.sort_order) {
    // Редкий случай (после ручного SQL) — страхуемся, раскидывая на 10.
    const next = (Math.max(a.sort_order, b.sort_order) || 0) + 10;
    const { error: e1 } = await supabase
      .from('problem_categories')
      .update({ sort_order: next })
      .eq('id', b.id);
    if (e1) throw e1;
    return;
  }

  const { error: e1 } = await supabase
    .from('problem_categories')
    .update({ sort_order: b.sort_order })
    .eq('id', a.id);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from('problem_categories')
    .update({ sort_order: a.sort_order })
    .eq('id', b.id);
  if (e2) {
    // Откатываем первый UPDATE, чтобы не оставить два ряда с одним sort_order.
    await supabase
      .from('problem_categories')
      .update({ sort_order: a.sort_order })
      .eq('id', a.id);
    throw e2;
  }
}
