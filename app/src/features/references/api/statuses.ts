import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

export async function listStatuses() {
  const { data, error } = await supabase
    .from('statuses')
    .select('*')
    .order('order_index');
  if (error) throw error;
  return data;
}

export async function updateStatus(id: number, values: TablesUpdate<'statuses'>) {
  const { data, error } = await supabase
    .from('statuses')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
