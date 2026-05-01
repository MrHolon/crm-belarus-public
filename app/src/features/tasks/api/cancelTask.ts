import { updateTask } from './updateTask';

export async function cancelTask(taskId: number, reason: string): Promise<void> {
  await updateTask(taskId, {
    status: 'cancelled',
    cancellation_reason: reason.trim(),
  });
}
