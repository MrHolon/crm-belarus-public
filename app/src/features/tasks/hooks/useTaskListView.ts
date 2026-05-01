import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { updateMyProfile } from '@/features/settings/api/profile';

const STORAGE_KEY = 'crm:tasks:preferred_view';

export type TaskListViewMode = 'list' | 'kanban';

function readStoredView(): TaskListViewMode | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'list' || s === 'kanban') return s;
  } catch {
    /* ignore */
  }
  return null;
}

export function useTaskListView() {
  const { user, profile, refreshProfile } = useAuth();

  const [view, setViewState] = useState<TaskListViewMode>(
    () => readStoredView() ?? 'kanban',
  );

  useEffect(() => {
    if (!profile?.preferred_view) return;
    if (readStoredView() != null) return;
    const v = profile.preferred_view;
    if (v === 'list' || v === 'kanban') {
      // Нет локального выбора — однократно подставляем preferred_view из профиля.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- гидратация из БД при первой загрузке
      setViewState(v);
    }
  }, [profile?.preferred_view]);

  const setView = useCallback(
    async (next: TaskListViewMode) => {
      setViewState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      if (!user?.id) return;
      try {
        await updateMyProfile(user.id, { preferred_view: next });
        await refreshProfile();
      } catch {
        /* сохранён localStorage; профиль можно обновить из настроек */
      }
    },
    [user, refreshProfile],
  );

  return { view, setView };
}
