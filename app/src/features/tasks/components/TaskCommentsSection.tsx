import { useEffect } from 'react';
import { Loader, Stack, Text, Timeline } from '@mantine/core';
import { notifications as notify } from '@mantine/notifications';
import { IconMessage } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { fetchMentionUsers } from '../api/mentionUsers';
import { insertTaskComment, listTaskComments } from '../api/taskComments';
import { formatTaskDateTime } from '../lib/formatTaskDate';
import { CommentBody } from './CommentBody';
import { TaskCommentComposer } from './TaskCommentComposer';

export interface TaskCommentsSectionProps {
  taskId: number;
}

export function TaskCommentsSection({ taskId }: TaskCommentsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ['task', 'comments', taskId],
    queryFn: () => listTaskComments(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
    // Short poll as a belt-and-braces fallback in case the Realtime channel
    // misses an INSERT (e.g. transient WS reconnect). Paired with the
    // subscription below, this keeps comments visible within ~5s.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const mentionUsersQuery = useQuery({
    queryKey: ['users', 'mention-list'],
    queryFn: fetchMentionUsers,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!Number.isFinite(taskId) || taskId <= 0) return;

    const channel = supabase
      .channel(`task-comments:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['task', 'comments', taskId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  const commentMut = useMutation({
    mutationFn: async (payload: { text: string; mentionIds: string[] }) => {
      if (!user?.id) throw new Error('Нет пользователя');
      await insertTaskComment(taskId, user.id, payload.text, payload.mentionIds);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', 'comments', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e: Error) => {
      notify.show({
        title: 'Ошибка',
        message: e.message,
        color: 'red',
      });
    },
  });

  const rows = commentsQuery.data ?? [];

  return (
    <Stack gap="md">
      {commentsQuery.isPending ? (
        <Loader size="sm" />
      ) : rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          Комментариев пока нет.
        </Text>
      ) : (
        <Timeline
          active={rows.length > 0 ? rows.length - 1 : 0}
          bulletSize={24}
          lineWidth={2}
        >
          {rows.map((c) => (
            <Timeline.Item
              key={c.id}
              bullet={<IconMessage size={12} />}
              title={
                <Text size="sm" fw={600} component="span">
                  {c.author?.full_name ?? 'Пользователь'}{' '}
                  <Text span size="xs" c="dimmed" fw={400}>
                    @{c.author?.login ?? '—'} · {formatTaskDateTime(c.created_at)}
                  </Text>
                </Text>
              }
            >
              <CommentBody text={c.comment_text} />
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      <TaskCommentComposer
        users={mentionUsersQuery.data ?? []}
        onSubmit={(text, mentionIds) => commentMut.mutate({ text, mentionIds })}
        disabled={!user || mentionUsersQuery.isError}
        loading={commentMut.isPending}
      />
    </Stack>
  );
}
