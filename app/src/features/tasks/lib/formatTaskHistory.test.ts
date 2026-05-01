import { describe, expect, it } from 'vitest';
import {
  collectHistoryLookupIds,
  formatHistoryScalar,
  HISTORY_FIELD_LABEL,
} from './formatTaskHistory';

describe('collectHistoryLookupIds', () => {
  it('collects assignee and category ids', () => {
    const { userIds, categoryIds } = collectHistoryLookupIds([
      {
        field_name: 'assignee_id',
        old_value: null,
        new_value: '550e8400-e29b-41d4-a716-446655440000',
      },
      {
        field_name: 'category_id',
        old_value: 1,
        new_value: 2,
      },
    ]);
    expect(userIds).toContain('550e8400-e29b-41d4-a716-446655440000');
    expect([...categoryIds].sort((a, b) => a - b)).toEqual([1, 2]);
  });
});

describe('formatHistoryScalar', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  const maps = {
    users: new Map([
      [uid, { id: uid, full_name: 'Иван', login: 'ivan' }],
    ]),
    categories: new Map([[5, 'Категория A']]),
  };

  it('formats assignee_id', () => {
    expect(
      formatHistoryScalar('assignee_id', uid, maps),
    ).toBe('Иван (@ivan)');
  });

  it('formats category_id', () => {
    expect(formatHistoryScalar('category_id', 5, maps)).toBe('Категория A');
  });

  it('has labels for known fields', () => {
    expect(HISTORY_FIELD_LABEL.status).toBe('Статус');
  });
});
