import { Text } from '@mantine/core';

/** Renders plain text with @login segments highlighted. */
export function CommentBody({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
  return (
    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text
            key={i}
            component="span"
            c="var(--mantine-color-blue-filled)"
            fw={600}
          >
            {part}
          </Text>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </Text>
  );
}
