import { describe, expect, it } from 'vitest';
import {
  allowedNextStatuses,
  canTransition,
  canUserMutateTaskRow,
} from './transitions';

describe('canUserMutateTaskRow', () => {
  it('allows staff regardless of assignment', () => {
    expect(
      canUserMutateTaskRow({
        role: 'duty_officer',
        userId: 'u1',
        creatorId: 'c1',
        assigneeId: 'a1',
      }),
    ).toBe(true);
  });

  it('allows assignee and creator', () => {
    expect(
      canUserMutateTaskRow({
        role: 'specialist',
        userId: 'a1',
        creatorId: 'c1',
        assigneeId: 'a1',
      }),
    ).toBe(true);
    expect(
      canUserMutateTaskRow({
        role: 'specialist',
        userId: 'c1',
        creatorId: 'c1',
        assigneeId: 'a1',
      }),
    ).toBe(true);
  });

  it('denies unrelated specialist', () => {
    expect(
      canUserMutateTaskRow({
        role: 'specialist',
        userId: 'x',
        creatorId: 'c1',
        assigneeId: 'a1',
      }),
    ).toBe(false);
  });

  it('allows active helper (B8)', () => {
    expect(
      canUserMutateTaskRow({
        role: 'specialist',
        userId: 'h1',
        creatorId: 'c1',
        assigneeId: 'a1',
        isHelper: true,
      }),
    ).toBe(true);
  });
});

describe('canTransition', () => {
  const base = {
    role: 'specialist' as const,
    isAssignee: false,
    isCreator: false,
    isHelper: false,
    hasAssignee: false,
  };

  it('allows creator to take unassigned new task to in_progress', () => {
    expect(
      canTransition('new', 'in_progress', {
        ...base,
        isCreator: true,
        hasAssignee: false,
      }),
    ).toBe(true);
  });

  it('denies non-creator specialist from starting unassigned new task', () => {
    expect(
      canTransition('new', 'in_progress', {
        ...base,
        isCreator: false,
        hasAssignee: false,
      }),
    ).toBe(false);
  });

  it('forbids new → done', () => {
    expect(
      canTransition('new', 'done', {
        ...base,
        isCreator: true,
        hasAssignee: true,
        isAssignee: true,
      }),
    ).toBe(false);
  });

  it('forbids cancelled → anything', () => {
    expect(
      canTransition('cancelled', 'new', {
        ...base,
        isCreator: true,
      }),
    ).toBe(false);
  });

  it('allows duty_officer to cancel from new', () => {
    expect(
      canTransition('new', 'cancelled', {
        ...base,
        role: 'duty_officer',
      }),
    ).toBe(true);
  });
});

describe('allowedNextStatuses', () => {
  it('new: assignee can start and cancel if creator', () => {
    const next = allowedNextStatuses('new', {
      role: 'specialist',
      isAssignee: true,
      isCreator: true,
      isHelper: false,
      hasAssignee: true,
    });
    expect(next).toContain('in_progress');
    expect(next).toContain('cancelled');
  });

  it('new: specialist without assignee cannot start unless creator', () => {
    const next = allowedNextStatuses('new', {
      role: 'specialist',
      isAssignee: false,
      isCreator: false,
      isHelper: false,
      hasAssignee: false,
    });
    expect(next).not.toContain('in_progress');
  });

  it('done: only creator can reopen', () => {
    expect(
      allowedNextStatuses('done', {
        role: 'specialist',
        isAssignee: true,
        isCreator: false,
        isHelper: false,
        hasAssignee: true,
      }),
    ).toEqual([]);

    expect(
      allowedNextStatuses('done', {
        role: 'specialist',
        isAssignee: false,
        isCreator: true,
        isHelper: false,
        hasAssignee: true,
      }),
    ).toContain('in_progress');
  });
});
