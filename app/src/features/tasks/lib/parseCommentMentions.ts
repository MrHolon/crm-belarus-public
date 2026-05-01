/** @login token: letters, digits, underscore, dot, hyphen (matches typical logins). */
const MENTION_TOKEN = /@([a-zA-Z0-9_.-]+)/g;

export function extractMentionLogins(text: string): string[] {
  const seen = new Set<string>();
  const re = new RegExp(MENTION_TOKEN.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    seen.add(m[1]);
  }
  return [...seen];
}

export function resolveLoginsToUserIds(
  logins: string[],
  users: { id: string; login: string }[],
): string[] {
  const byLogin = new Map(
    users.map((u) => [u.login.toLowerCase(), u.id] as const),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of logins) {
    const id = byLogin.get(raw.toLowerCase());
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Cursor-based @mention: open picker when typing @query without spaces after @. */
export function getActiveMentionQuery(
  text: string,
  cursorPos: number,
): { active: boolean; query: string; start: number; end: number } {
  const before = text.slice(0, cursorPos);
  const at = before.lastIndexOf('@');
  if (at === -1) {
    return { active: false, query: '', start: 0, end: 0 };
  }
  const afterAt = before.slice(at + 1);
  if (/\s/.test(afterAt)) {
    return { active: false, query: '', start: 0, end: 0 };
  }
  return {
    active: true,
    query: afterAt,
    start: at,
    end: cursorPos,
  };
}
