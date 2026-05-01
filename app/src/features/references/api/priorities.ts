import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';

export async function listPriorities() {
  const { data, error } = await supabase
    .from('priorities')
    .select('*')
    .order('order_index');
  if (error) throw error;
  return data;
}

export async function insertPriority(values: TablesInsert<'priorities'>) {
  const { data, error } = await supabase
    .from('priorities')
    .insert(values)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePriority(
  id: number,
  values: TablesUpdate<'priorities'>,
) {
  const { data, error } = await supabase
    .from('priorities')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
