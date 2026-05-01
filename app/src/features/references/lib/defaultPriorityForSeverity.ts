import type { Database } from '@/types/database';

type Severity = Database['public']['Enums']['category_severity'];
type PriorityRow = { id: number; code: string };

/**
 * Matches ТЗ/03: critical→critical, important→high, normal→medium.
 */
export function defaultPriorityIdForSeverity(
  severity: Severity,
  priorities: PriorityRow[],
): number | null {
  const code =
    severity === 'critical'
      ? 'critical'
      : severity === 'important'
        ? 'high'
        : 'medium';
  return priorities.find((p) => p.code === code)?.id ?? null;
}
