import { supabase } from '@/lib/supabase';

export type ReportOpenByAssigneeRow = {
  assignee_id: string;
  full_name: string;
  login: string;
  open_count: number;
};

export type ReportOverdueRow = {
  task_id: number;
  ticket_number: string | null;
  title: string;
  category_name: string;
  assignee_name: string;
  due_date: string;
};

export type ReportAvgResolutionRow = {
  category_id: number;
  category_name: string;
  assignee_id: string;
  assignee_name: string;
  tasks_done: number;
  avg_resolution_hours: number;
};

export type ReportTopCategoriesRow = {
  category_id: number;
  category_name: string;
  task_count: number;
};

export type ReportHelpStatsRow = {
  task_id: number;
  ticket_number: string | null;
  title: string;
  assignee_name: string;
  help_requested_at: string;
  hours_in_needs_help: number;
  active_helpers: number;
};

export async function fetchReportOpenByAssignee(pFrom: string, pTo: string) {
  const { data, error } = await supabase.rpc('report_open_by_assignee', {
    p_from: pFrom,
    p_to: pTo,
  });
  if (error) throw error;
  return (data ?? []) as ReportOpenByAssigneeRow[];
}

export async function fetchReportOverdue(pFrom: string, pTo: string) {
  const { data, error } = await supabase.rpc('report_overdue', {
    p_from: pFrom,
    p_to: pTo,
  });
  if (error) throw error;
  return (data ?? []) as ReportOverdueRow[];
}

export async function fetchReportAvgResolution(pFrom: string, pTo: string) {
  const { data, error } = await supabase.rpc('report_avg_resolution', {
    p_from: pFrom,
    p_to: pTo,
  });
  if (error) throw error;
  return (data ?? []) as ReportAvgResolutionRow[];
}

export async function fetchReportTopCategories(pFrom: string, pTo: string) {
  const { data, error } = await supabase.rpc('report_top_categories', {
    p_from: pFrom,
    p_to: pTo,
  });
  if (error) throw error;
  return (data ?? []) as ReportTopCategoriesRow[];
}

export async function fetchReportHelpStats(pFrom: string, pTo: string) {
  const { data, error } = await supabase.rpc('report_help_stats', {
    p_from: pFrom,
    p_to: pTo,
  });
  if (error) throw error;
  return (data ?? []) as ReportHelpStatsRow[];
}
