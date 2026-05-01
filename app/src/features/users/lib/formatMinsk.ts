/** Display timestamps stored as UTC in DB in Europe/Minsk (ТЗ / AGENTS.md). */
export function formatMinskDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-BY', {
      timeZone: 'Europe/Minsk',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}
