import { describe, expect, it } from 'vitest';
import {
  extractMentionLogins,
  getActiveMentionQuery,
  resolveLoginsToUserIds,
} from './parseCommentMentions';

describe('extractMentionLogins', () => {
  it('collects unique logins', () => {
    expect(extractMentionLogins('Привет @ivan и @maria, @ivan')).toEqual([
      'ivan',
      'maria',
    ]);
  });

  it('returns empty when no mentions', () => {
    expect(extractMentionLogins('без упоминаний')).toEqual([]);
  });
});

describe('resolveLoginsToUserIds', () => {
  it('matches case-insensitively', () => {
    expect(
      resolveLoginsToUserIds(['Ivan'], [
        { id: 'uuid-1', login: 'ivan' },
      ]),
    ).toEqual(['uuid-1']);
  });
});

describe('getActiveMentionQuery', () => {
  it('detects open mention at cursor', () => {
    const t = 'текст @iv';
    const q = getActiveMentionQuery(t, t.length);
    expect(q.active).toBe(true);
    expect(q.query).toBe('iv');
    expect(q.start).toBe(6);
  });

  it('closes after space', () => {
    const t = 'see @ivan next';
    expect(getActiveMentionQuery(t, t.length).active).toBe(false);
  });
});
