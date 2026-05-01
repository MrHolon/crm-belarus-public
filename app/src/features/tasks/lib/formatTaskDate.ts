/** Display due / updated in Europe/Minsk. */
export function formatTaskDateTime(iso: string | null | undefined): string {
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
