import { useMemo, useRef, useState } from 'react';
import {
  Button,
  Group,
  Paper,
  Popover,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from '@mantine/core';
import type { MentionUser } from '../api/mentionUsers';
import {
  extractMentionLogins,
  getActiveMentionQuery,
  resolveLoginsToUserIds,
} from '../lib/parseCommentMentions';

export interface TaskCommentComposerProps {
  users: MentionUser[];
  onSubmit: (text: string, mentionIds: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function TaskCommentComposer({
  users,
  onSubmit,
  disabled,
  loading,
}: TaskCommentComposerProps) {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const syncCursor = (el: HTMLTextAreaElement | null) => {
    if (el) setCursor(el.selectionStart ?? 0);
  };

  const mentionUi = useMemo(
    () => getActiveMentionQuery(value, cursor),
    [value, cursor],
  );

  const pickerOpen = mentionUi.active;

  const filtered = useMemo(() => {
    if (!mentionUi.active) return users;
    const q = mentionUi.query.toLowerCase();
    return users.filter(
      (u) =>
        u.login.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q),
    );
  }, [users, mentionUi.active, mentionUi.query]);

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    const logins = extractMentionLogins(text);
    const ids = resolveLoginsToUserIds(logins, users);
    onSubmit(text, ids);
    setValue('');
  };

  const pickUser = (u: MentionUser) => {
    const pos = taRef.current?.selectionStart ?? value.length;
    const st = getActiveMentionQuery(value, pos);
    if (!st.active) return;
    const before = value.slice(0, st.start);
    const after = value.slice(st.end);
    const insert = `@${u.login} `;
    const next = `${before}${insert}${after}`;
    setValue(next);
    const caret = before.length + insert.length;
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
        setCursor(caret);
      }
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Text size="sm" fw={600} mb="xs">
        Новый комментарий
      </Text>
      <Popover
        opened={pickerOpen}
        position="bottom-start"
        withinPortal
        width={320}
        shadow="md"
      >
        <Popover.Target>
          <Textarea
            ref={taRef}
            placeholder="Текст… Наберите @ для упоминания пользователя."
            minRows={3}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.currentTarget.value);
              syncCursor(e.currentTarget);
            }}
            onKeyUp={(e) => {
              syncCursor(e.currentTarget);
            }}
            onSelect={(e) => {
              syncCursor(e.currentTarget);
            }}
            onClick={(e) => {
              syncCursor(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </Popover.Target>
        <Popover.Dropdown p={0}>
          <ScrollArea h={220} type="auto">
            <Stack gap={0}>
              {filtered.length === 0 ? (
                <Text size="sm" c="dimmed" p="sm">
                  Нет совпадений
                </Text>
              ) : (
                filtered.slice(0, 20).map((u) => (
                  <UnstyledButton
                    key={u.id}
                    px="sm"
                    py={6}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      pickUser(u);
                    }}
                  >
                    <Text size="sm" fw={500}>
                      {u.full_name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      @{u.login}
                    </Text>
                  </UnstyledButton>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Popover.Dropdown>
      </Popover>
      <Group justify="space-between" mt="sm" wrap="wrap">
        <Text size="xs" c="dimmed">
          Ctrl+Enter — отправить
        </Text>
        <Button onClick={submit} loading={loading} disabled={disabled}>
          Отправить
        </Button>
      </Group>
    </Paper>
  );
}
