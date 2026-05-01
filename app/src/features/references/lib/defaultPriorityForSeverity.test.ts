import { describe, expect, it } from 'vitest';
import { defaultPriorityIdForSeverity } from './defaultPriorityForSeverity';

describe('defaultPriorityIdForSeverity', () => {
  const priorities = [
    { id: 1, code: 'low' },
    { id: 2, code: 'medium' },
    { id: 3, code: 'high' },
    { id: 4, code: 'critical' },
  ];

  it('maps severity to priority code', () => {
    expect(defaultPriorityIdForSeverity('normal', priorities)).toBe(2);
    expect(defaultPriorityIdForSeverity('important', priorities)).toBe(3);
    expect(defaultPriorityIdForSeverity('critical', priorities)).toBe(4);
  });

  it('returns null when code missing', () => {
    expect(defaultPriorityIdForSeverity('normal', [{ id: 1, code: 'low' }])).toBe(
      null,
    );
  });
});
