/** Extract a human-readable message from anything thrown by supabase-js.
 *
 * Supabase `PostgrestError` is a plain object (not an Error instance), so
 * `String(err)` yields `"[object Object]"`. We peek into its shape and fall
 * back to `JSON.stringify` only as a last resort. */
function extractErrorMessage(err: unknown): string {
  if (err == null) return '';
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof rec.message === 'string' && rec.message) parts.push(rec.message);
    if (typeof rec.details === 'string' && rec.details) parts.push(rec.details);
    if (typeof rec.hint === 'string' && rec.hint) parts.push(rec.hint);
    if (typeof rec.code === 'string' && rec.code) parts.push(`(code ${rec.code})`);
    if (parts.length > 0) return parts.join(' — ');
    try {
      return JSON.stringify(err);
    } catch {
      return '[object Object]';
    }
  }
  return String(err);
}

/** Map Postgres trigger / PostgREST messages to Russian UI copy (B4, B7, B8). */
export function formatTaskUpdateError(err: unknown): string {
  const m = extractErrorMessage(err);
  if (m.includes('request_task_help:')) {
    if (m.includes('comment required')) {
      return 'Укажите комментарий о том, какая нужна помощь.';
    }
    if (m.includes('at least one helper')) {
      return 'Выберите хотя бы одного помощника.';
    }
    if (m.includes('only assignee')) {
      return 'Запросить помощь может только исполнитель.';
    }
    if (m.includes('invalid status')) {
      return 'Запрос доступен только в статусе «В работе».';
    }
    if (m.includes('invalid helper user')) {
      return 'Один из выбранных пользователей недоступен.';
    }
    if (m.includes('not authenticated')) {
      return 'Сессия недействительна. Войдите снова.';
    }
    return m.replace(/^.*request_task_help:\s*/i, '');
  }
  if (m.includes('join_task_as_helper:')) {
    if (m.includes('task not in needs_help')) {
      return 'Задача не в статусе «Нужна помощь».';
    }
    if (m.includes('assignee cannot join')) {
      return 'Исполнитель не может добавить себя как помощника.';
    }
    if (m.includes('role not allowed')) {
      return 'Ваша роль не может присоединяться к пулу помощи.';
    }
    if (m.includes('already a helper')) {
      return 'Вы уже помощник по этой задаче.';
    }
    if (m.includes('user profile missing')) {
      return 'Профиль пользователя не найден в системе.';
    }
    if (m.includes('not authenticated')) {
      return 'Сессия недействительна. Войдите снова.';
    }
    return m.replace(/^.*join_task_as_helper:\s*/i, '');
  }
  if (m.includes('reject_task:')) {
    if (m.includes('reason must be at least 10')) {
      return 'Причина отклонения — не короче 10 символов.';
    }
    if (m.includes('only assignee')) {
      return 'Отклонить может только текущий исполнитель.';
    }
    if (m.includes('invalid status')) {
      return 'Отклонение доступно только в статусах «Новая» или «В работе».';
    }
    if (m.includes('not authenticated')) {
      return 'Сессия недействительна. Войдите снова.';
    }
    return m.replace(/^.*reject_task:\s*/i, '');
  }
  if (!m.includes('invalid_status_transition')) {
    return m;
  }
  if (m.includes('cancellation requires reason')) {
    return 'Для отмены укажите причину не короче 5 символов.';
  }
  if (m.includes('needs_help requires help_comment')) {
    return 'Для перевода в «Нужна помощь» укажите комментарий.';
  }
  if (m.includes('needs_help requires at least one active helper')) {
    return 'Для «Нужна помощь» нужен хотя бы один помощник — используйте форму «Запросить помощь».';
  }
  if (m.includes('helper may only change status')) {
    return 'Помощник может менять только статус задачи.';
  }
  if (m.includes('in_progress requires assignee')) {
    return 'Для статуса «В работе» должен быть назначен исполнитель.';
  }
  if (m.includes('cancelled is terminal')) {
    return 'Отменённую задачу нельзя изменить.';
  }
  if (m.includes('not authenticated')) {
    return 'Сессия недействительна. Войдите снова.';
  }
  if (m.includes('user profile missing')) {
    return 'Профиль пользователя не найден в системе.';
  }
  return 'Этот переход статуса запрещён правилами процесса.';
}
