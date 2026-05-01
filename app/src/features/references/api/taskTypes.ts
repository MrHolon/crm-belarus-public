import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';

export async function listTaskTypes() {
  const { data, error } = await supabase
    .from('task_types')
    .select('*')
    .order('order_index');
  if (error) throw error;
  return data;
}

export async function insertTaskType(values: TablesInsert<'task_types'>) {
  const { data, error } = await supabase
    .from('task_types')
    .insert(values)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskType(id: number, values: TablesUpdate<'task_types'>) {
  const { data, error } = await supabase
    .from('task_types')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
