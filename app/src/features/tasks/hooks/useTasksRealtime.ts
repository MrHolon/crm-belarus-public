import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UseTasksRealtimeOptions {
  /** Optional Postgres row filter, e.g. `id=eq.42` or `assignee_id=eq.<uid>`. */
  filter?: string;
  /** If `false`, the subscription is skipped entirely. */
  enabled?: boolean;
  /** Called after a short debounce with a bundle of events. */
  onChange: () => void;
}

/**
 * Subscribe to INSERT/UPDATE/DELETE on `public.tasks` and fire `onChange`
 * with a short debounce so bursts of changes (multi-row updates, triggers
 * cascading into `task_history`, etc.) collapse into a single callback.
 *
 * Requires `tasks` to be part of the `supabase_realtime` publication —
 * see migration `20260418002000_realtime_publication.sql`.
 */
export function useTasksRealtime({
  filter,
  enabled = true,
  onChange,
}: UseTasksRealtimeOptions): void {
  // Keep the latest callback without re-subscribing on every render.
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        cbRef.current();
      }, 200);
    };

    const channelName = filter
      ? `realtime:tasks:${filter}`
      : `realtime:tasks:all`;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          ...(filter ? { filter } : {}),
        },
        () => {
          schedule();
        },
      )
      .subscribe();

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, filter]);
}
