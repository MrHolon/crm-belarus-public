import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';

export async function listTags() {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function insertTag(values: TablesInsert<'tags'>) {
  const { data, error } = await supabase
    .from('tags')
    .insert(values)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTag(id: number, values: TablesUpdate<'tags'>) {
  const { data, error } = await supabase
    .from('tags')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
