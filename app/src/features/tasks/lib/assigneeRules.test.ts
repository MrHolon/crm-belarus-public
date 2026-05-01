import { describe, expect, it } from 'vitest';
import { canAssignTaskTo } from './assigneeRules';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('canAssignTaskTo', () => {
  const creator = uid(1);

  it('always allows self', () => {
    expect(
      canAssignTaskTo('specialist', creator, { id: creator, role: 'admin' }),
    ).toBe(true);
  });

  it('specialist → specialist / duty_officer / developer / accountant (ТЗ §2.2)', () => {
    expect(
      canAssignTaskTo('specialist', creator, {
        id: uid(2),
        role: 'specialist',
      }),
    ).toBe(true);
    expect(
      canAssignTaskTo('specialist', creator, {
        id: uid(2),
        role: 'duty_officer',
      }),
    ).toBe(true);
    expect(
      canAssignTaskTo('specialist', creator, {
        id: uid(2),
        role: 'developer',
      }),
    ).toBe(true);
    expect(
      canAssignTaskTo('specialist', creator, {
        id: uid(2),
        role: 'accountant',
      }),
    ).toBe(true);
    expect(
      canAssignTaskTo('specialist', creator, {
        id: uid(2),
        role: 'manager',
      }),
    ).toBe(false);
    expect(
      canAssignTaskTo('specialist', creator, {
        id: uid(2),
        role: 'admin',
      }),
    ).toBe(false);
  });

  it('developer → specialist or self', () => {
    expect(
      canAssignTaskTo('developer', creator, {
        id: uid(2),
        role: 'specialist',
      }),
    ).toBe(true);
    expect(
      canAssignTaskTo('developer', creator, {
        id: uid(2),
        role: 'developer',
      }),
    ).toBe(false);
  });

  it('accountant → duty_officer or specialist', () => {
    expect(
      canAssignTaskTo('accountant', creator, {
        id: uid(2),
        role: 'duty_officer',
      }),
    ).toBe(true);
    expect(
      canAssignTaskTo('accountant', creator, {
        id: uid(2),
        role: 'developer',
      }),
    ).toBe(false);
  });
});
