import type { UserRole } from '@/lib/auth-context';

export function canManageReferences(role: UserRole | null | undefined): boolean {
  return role === 'manager' || role === 'admin';
}
