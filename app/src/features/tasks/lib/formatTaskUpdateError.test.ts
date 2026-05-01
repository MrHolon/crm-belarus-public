import { describe, expect, it } from 'vitest';
import { formatTaskUpdateError } from './formatTaskUpdateError';

describe('formatTaskUpdateError', () => {
  it('passes through unrelated errors', () => {
    expect(formatTaskUpdateError(new Error('network'))).toBe('network');
  });

  it('maps invalid_status_transition to Russian', () => {
    expect(
      formatTaskUpdateError(
        new Error('invalid_status_transition: needs_help requires help_comment'),
      ),
    ).toContain('Нужна помощь');
  });

  it('maps reject_task errors to Russian (B7)', () => {
    expect(
      formatTaskUpdateError(new Error('reject_task: reason must be at least 10 characters')),
    ).toContain('10');
    expect(formatTaskUpdateError(new Error('reject_task: only assignee can reject'))).toContain(
      'исполнител',
    );
    expect(formatTaskUpdateError(new Error('reject_task: invalid status'))).toContain('Новая');
  });
});
