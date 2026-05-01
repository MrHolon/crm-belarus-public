import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createServiceClient,
  errMsg,
  firstCategoryId,
  hardDeleteNotificationsForTasks,
  hardDeleteTasks,
  signInAs,
  taskTypeId,
  TEST_USERS,
} from './fixtures';

/** Every task id this suite creates — cleaned up in afterAll. */
const CREATED_TASK_IDS: number[] = [];

async function createTaskAs(opts: {
  creatorRole: Parameters<typeof signInAs>[0];
  title: string;
  assigneeId?: string | null;
  typeCode?: string;
  severity?: 'normal' | 'important' | 'critical';
  parentTaskId?: number | null;
}) {
  const { client } = await signInAs(opts.creatorRole);
  const categoryId = await firstCategoryId(opts.severity ?? 'normal');
  const typeId = await taskTypeId(opts.typeCode ?? 'regular');
  const creatorId = TEST_USERS[opts.creatorRole].id;

  const { data, error } = await client
    .from('tasks')
    .insert({
      title: opts.title,
      description: `e2e-role test: ${opts.title}`,
      category_id: categoryId,
      task_type_id: typeId,
      creator_id: creatorId,
      assignee_id: opts.assigneeId ?? null,
      parent_task_id: opts.parentTaskId ?? null,
      complexity: 3,
    })
    .select('id, status, assignee_id, creator_id, ticket_number')
    .single();
  if (error) throw new Error(`createTaskAs(${opts.creatorRole}): ${errMsg(error)}`);
  CREATED_TASK_IDS.push(data.id);
  return { client, task: data };
}

beforeAll(async () => {
  // Sanity: service role key works and all 6 users exist with expected role.
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('users')
    .select('id, role, is_active')
    .in(
      'id',
      Object.values(TEST_USERS).map((u) => u.id),
    );
  if (error) throw new Error(`service role probe failed: ${errMsg(error)}`);
  expect(data).toHaveLength(6);
  for (const row of data ?? []) {
    expect(row.is_active).toBe(true);
  }
});

afterAll(async () => {
  if (CREATED_TASK_IDS.length > 0) {
    await hardDeleteNotificationsForTasks(CREATED_TASK_IDS);
    await hardDeleteTasks(CREATED_TASK_IDS);
  }
});

// ---------------------------------------------------------------------------
// Scenario 1: specialist solo — creator == assignee — full happy path.
// ---------------------------------------------------------------------------

describe('lifecycle: specialist solo', () => {
  it('new → in_progress → on_review → done', async () => {
    const me = TEST_USERS.specialist;
    const { client, task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: specialist solo',
      assigneeId: me.id,
    });
    expect(task.status).toBe('new');

    const take = await client
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(take.error, errMsg(take.error)).toBeNull();
    expect(take.data?.status).toBe('in_progress');

    const review = await client
      .from('tasks')
      .update({ status: 'on_review' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(review.error, errMsg(review.error)).toBeNull();
    expect(review.data?.status).toBe('on_review');

    const done = await client
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(done.error, errMsg(done.error)).toBeNull();
    expect(done.data?.status).toBe('done');

    // History must contain at least one status change.
    const hist = await client
      .from('task_history')
      .select('field_name, new_value')
      .eq('task_id', task.id)
      .eq('field_name', 'status');
    expect(hist.error, errMsg(hist.error)).toBeNull();
    expect((hist.data ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: duty_officer + specialist + helper(developer) — help-room flow.
// ---------------------------------------------------------------------------

describe('lifecycle: duty → specialist → helper(developer)', () => {
  it('new → assigned → in_progress → needs_help (+helper join) → in_progress → on_review → done', async () => {
    const specialist = TEST_USERS.specialist;
    const developer = TEST_USERS.developer;

    // Duty creates task directly on specialist.
    const { task } = await createTaskAs({
      creatorRole: 'duty_officer',
      title: 'role-test: help-room flow',
      assigneeId: specialist.id,
    });

    // Specialist takes it.
    const specClient = (await signInAs('specialist')).client;
    const take = await specClient
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(take.error, errMsg(take.error)).toBeNull();
    expect(take.data?.status).toBe('in_progress');

    // Specialist requests help with a single helper via the RPC.
    const req = await specClient.rpc('request_task_help', {
      p_task_id: task.id,
      p_help_comment: 'need help with diagnostics',
      p_helper_ids: [developer.id],
    });
    expect(req.error, errMsg(req.error)).toBeNull();

    // Task must now be in needs_help with at least one active helper.
    const after = await specClient
      .from('tasks')
      .select('status')
      .eq('id', task.id)
      .maybeSingle();
    expect(after.data?.status).toBe('needs_help');

    // Developer (helper) sees help_requested notification.
    const devClient = (await signInAs('developer')).client;
    const notifs = await devClient
      .from('notifications')
      .select('type, task_id')
      .eq('task_id', task.id)
      .eq('type', 'help_requested');
    expect(notifs.error, errMsg(notifs.error)).toBeNull();
    expect((notifs.data ?? []).length).toBeGreaterThanOrEqual(1);

    // Helper (developer) moves it back to in_progress as "investigation done".
    const back = await devClient
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(back.error, errMsg(back.error)).toBeNull();

    // Only the assignee (specialist) can move in_progress -> on_review.
    const rev = await specClient
      .from('tasks')
      .update({ status: 'on_review' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(rev.error, errMsg(rev.error)).toBeNull();

    // Duty officer reviews and closes.
    const dutyClient = (await signInAs('duty_officer')).client;
    const close = await dutyClient
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(close.error, errMsg(close.error)).toBeNull();
    expect(close.data?.status).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: reject + reassign (B7).
// ---------------------------------------------------------------------------

describe('lifecycle: reject → reassign clears rejection', () => {
  it('assignee rejects with reason, creator reassigns, fields clear', async () => {
    const specialist = TEST_USERS.specialist;

    const { task } = await createTaskAs({
      creatorRole: 'duty_officer',
      title: 'role-test: reject flow',
      assigneeId: specialist.id,
    });

    const specClient = (await signInAs('specialist')).client;
    // Specialist must be able to take it first — reject is only from new or in_progress.
    await specClient
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id);

    const rej = await specClient.rpc('reject_task', {
      p_task_id: task.id,
      p_reason: 'not my area of expertise — please reassign',
    });
    expect(rej.error, errMsg(rej.error)).toBeNull();

    // As duty officer, task should be back in `new` with cleared assignee.
    const dutyClient = (await signInAs('duty_officer')).client;
    const afterReject = await dutyClient
      .from('tasks')
      .select('status, assignee_id, rejection_reason, rejected_by_id')
      .eq('id', task.id)
      .maybeSingle();
    expect(afterReject.error, errMsg(afterReject.error)).toBeNull();
    expect(afterReject.data?.status).toBe('new');
    expect(afterReject.data?.assignee_id).toBeNull();
    expect(afterReject.data?.rejection_reason).toContain('not my area');
    expect(afterReject.data?.rejected_by_id).toBe(specialist.id);

    // Reassign: duty picks another assignee (developer this time).
    const reassign = await dutyClient
      .from('tasks')
      .update({ assignee_id: TEST_USERS.developer.id })
      .eq('id', task.id)
      .select('assignee_id, rejection_reason, rejected_at, rejected_by_id')
      .single();
    expect(reassign.error, errMsg(reassign.error)).toBeNull();
    expect(reassign.data?.assignee_id).toBe(TEST_USERS.developer.id);
    expect(reassign.data?.rejection_reason).toBeNull();
    expect(reassign.data?.rejected_at).toBeNull();
    expect(reassign.data?.rejected_by_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: cancel requires ≥5-char reason (B10).
// ---------------------------------------------------------------------------

describe('lifecycle: cancel requires reason', () => {
  it('short reason rejected; valid reason accepted', async () => {
    const me = TEST_USERS.specialist;
    const { client, task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: cancel flow',
      assigneeId: me.id,
    });

    const short = await client
      .from('tasks')
      .update({ status: 'cancelled', cancellation_reason: 'no' })
      .eq('id', task.id);
    expect(short.error, 'cancellation with short reason must fail').toBeTruthy();
    expect(errMsg(short.error)).toMatch(/cancellation requires reason/i);

    const ok = await client
      .from('tasks')
      .update({
        status: 'cancelled',
        cancellation_reason: 'мимо по делу',
      })
      .eq('id', task.id)
      .select('status, cancellation_reason')
      .single();
    expect(ok.error, errMsg(ok.error)).toBeNull();
    expect(ok.data?.status).toBe('cancelled');
    expect(ok.data?.cancellation_reason).toBe('мимо по делу');
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: accountant scope — cannot join help-room, cannot create for dev.
// ---------------------------------------------------------------------------

describe('scope: accountant restrictions', () => {
  it('rejects join_task_as_helper for accountant role', async () => {
    // Build a needs_help task so there is something to join.
    const specialist = TEST_USERS.specialist;
    const developer = TEST_USERS.developer;

    const { task } = await createTaskAs({
      creatorRole: 'duty_officer',
      title: 'role-test: accountant cannot join',
      assigneeId: specialist.id,
    });
    const specClient = (await signInAs('specialist')).client;
    await specClient
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id);
    await specClient.rpc('request_task_help', {
      p_task_id: task.id,
      p_help_comment: 'need another set of eyes',
      p_helper_ids: [developer.id],
    });

    const accClient = (await signInAs('accountant')).client;
    const attempt = await accClient.rpc('join_task_as_helper', {
      p_task_id: task.id,
      p_comment: 'joining in',
    });
    expect(attempt.error, 'accountant must be blocked').toBeTruthy();
    expect(errMsg(attempt.error)).toMatch(/role not allowed|join_task_as_helper/i);
  });

  it('RLS hides unrelated tasks from accountant', async () => {
    const { task } = await createTaskAs({
      creatorRole: 'duty_officer',
      title: 'role-test: hidden from accountant',
      assigneeId: TEST_USERS.specialist.id,
    });
    const accClient = (await signInAs('accountant')).client;
    const probe = await accClient
      .from('tasks')
      .select('id')
      .eq('id', task.id)
      .maybeSingle();
    expect(probe.error, errMsg(probe.error)).toBeNull();
    expect(probe.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: parent → developer child (B9) and notification.
// ---------------------------------------------------------------------------

describe('lifecycle: developer child task (B9)', () => {
  it('parent on specialist → specialist creates dev-child → developer sees notification', async () => {
    const specialist = TEST_USERS.specialist;
    const developer = TEST_USERS.developer;

    const { task: parent } = await createTaskAs({
      creatorRole: 'duty_officer',
      title: 'role-test: parent',
      assigneeId: specialist.id,
    });

    const specClient = (await signInAs('specialist')).client;
    const categoryId = await firstCategoryId('normal');
    const devTypeId = await taskTypeId('developer_task');

    const child = await specClient
      .from('tasks')
      .insert({
        title: 'DEV: investigate root cause',
        description: 'from parent',
        category_id: categoryId,
        task_type_id: devTypeId,
        creator_id: specialist.id,
        assignee_id: developer.id,
        parent_task_id: parent.id,
        complexity: 3,
      })
      .select('id, parent_task_id, task_type_id, assignee_id')
      .single();
    expect(child.error, errMsg(child.error)).toBeNull();
    expect(child.data?.parent_task_id).toBe(parent.id);
    expect(child.data?.assignee_id).toBe(developer.id);
    CREATED_TASK_IDS.push(child.data!.id);

    const devClient = (await signInAs('developer')).client;
    const notifs = await devClient
      .from('notifications')
      .select('type')
      .eq('task_id', child.data!.id)
      .eq('type', 'developer_task_created');
    expect(notifs.error, errMsg(notifs.error)).toBeNull();
    expect((notifs.data ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: edit task — creator, staff, others.
// ---------------------------------------------------------------------------

describe('edit task: creator / staff / others', () => {
  it('creator may fix title + description on status=new; history is logged', async () => {
    const me = TEST_USERS.specialist;
    const { client, task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: edit-typo',
      assigneeId: me.id,
    });

    const upd = await client
      .from('tasks')
      .update({
        title: 'role-test: edit-fixed',
        description: 'clarified description',
      })
      .eq('id', task.id)
      .select('title, description')
      .single();
    expect(upd.error, errMsg(upd.error)).toBeNull();
    expect(upd.data?.title).toBe('role-test: edit-fixed');
    expect(upd.data?.description).toBe('clarified description');

    // Bumping priority should land in task_history via log_task_changes.
    const priUpd = await client
      .from('tasks')
      .update({ priority: 'high' })
      .eq('id', task.id);
    expect(priUpd.error, errMsg(priUpd.error)).toBeNull();

    const history = await client
      .from('task_history')
      .select('field_name, new_value')
      .eq('task_id', task.id)
      .eq('field_name', 'priority');
    expect(history.error, errMsg(history.error)).toBeNull();
    expect((history.data ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('creator may still edit after task is in_progress (not done/cancelled)', async () => {
    const me = TEST_USERS.specialist;
    const { client, task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: edit-in-progress',
      assigneeId: me.id,
    });
    const startWork = await client
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(startWork.error, errMsg(startWork.error)).toBeNull();
    expect(startWork.data?.status).toBe('in_progress');

    const upd = await client
      .from('tasks')
      .update({ description: 'extra context while in progress' })
      .eq('id', task.id)
      .select('description, status')
      .single();
    expect(upd.error, errMsg(upd.error)).toBeNull();
    expect(upd.data?.description).toBe('extra context while in progress');
    expect(upd.data?.status).toBe('in_progress');
  });

  it('duty_officer may edit any active task even if not creator', async () => {
    const specialist = TEST_USERS.specialist;
    const { task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: staff-edit',
      assigneeId: specialist.id,
    });

    const dutyClient = (await signInAs('duty_officer')).client;
    const upd = await dutyClient
      .from('tasks')
      .update({
        title: 'role-test: staff-edit (rewritten)',
        priority: 'critical',
      })
      .eq('id', task.id)
      .select('title, priority')
      .single();
    expect(upd.error, errMsg(upd.error)).toBeNull();
    expect(upd.data?.title).toBe('role-test: staff-edit (rewritten)');
    expect(upd.data?.priority).toBe('critical');
  });

  it('RLS hides unrelated task from accountant — edit simply affects 0 rows', async () => {
    const specialist = TEST_USERS.specialist;
    const { task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: edit-rls',
      assigneeId: specialist.id,
    });

    const accClient = (await signInAs('accountant')).client;
    const upd = await accClient
      .from('tasks')
      .update({ title: 'hijack attempt' })
      .eq('id', task.id)
      .select('id');
    // RLS filter: no error, but no row visible → nothing updated.
    expect(upd.error).toBeNull();
    expect(upd.data ?? []).toHaveLength(0);

    // Verify the original title is untouched.
    const svc = createServiceClient();
    const { data: check } = await svc
      .from('tasks')
      .select('title')
      .eq('id', task.id)
      .single();
    expect(check?.title).toBe('role-test: edit-rls');
  });

  it('done task is frozen — edits must be blocked', async () => {
    const me = TEST_USERS.specialist;
    const { client, task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: edit-done',
      assigneeId: me.id,
    });

    await client
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id);
    const finish = await client
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', task.id)
      .select('status')
      .single();
    expect(finish.error, errMsg(finish.error)).toBeNull();
    expect(finish.data?.status).toBe('done');

    // DB layer: editing a done task via raw UPDATE currently does NOT throw
    // (no trigger forbids it) — the client guard (`canEditTask`) is what
    // freezes the UI. We assert the DB behaviour explicitly so that if we
    // ever add a server-side guard, this test will flag the behaviour change.
    const upd = await client
      .from('tasks')
      .update({ description: 'should be ignored by UI, allowed by DB' })
      .eq('id', task.id)
      .select('description, status')
      .single();
    expect(upd.error).toBeNull();
    expect(upd.data?.status).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: assignee matrix — specialist may assign to accountant (ТЗ §2.2).
// ---------------------------------------------------------------------------

describe('assignee matrix: specialist → accountant', () => {
  it('specialist creates a task for accountant and accountant can pick it up', async () => {
    const accountant = TEST_USERS.accountant;
    const { client, task } = await createTaskAs({
      creatorRole: 'specialist',
      title: 'role-test: spec→acc',
      assigneeId: accountant.id,
    });
    expect(task.assignee_id).toBe(accountant.id);
    expect(task.status).toBe('new');

    const accClient = (await signInAs('accountant')).client;
    const pickup = await accClient
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id)
      .select('status, assignee_id')
      .single();
    expect(pickup.error, errMsg(pickup.error)).toBeNull();
    expect(pickup.data?.status).toBe('in_progress');
    expect(pickup.data?.assignee_id).toBe(accountant.id);

    const notifs = await accClient
      .from('notifications')
      .select('type')
      .eq('task_id', task.id)
      .eq('user_id', accountant.id)
      .eq('type', 'assigned');
    expect(notifs.error, errMsg(notifs.error)).toBeNull();
    expect((notifs.data ?? []).length).toBeGreaterThanOrEqual(1);

    // Creator retains visibility via RLS.
    const seen = await client
      .from('tasks')
      .select('id')
      .eq('id', task.id)
      .maybeSingle();
    expect(seen.error).toBeNull();
    expect(seen.data?.id).toBe(task.id);
  });
});

// ---------------------------------------------------------------------------
// Scenario: deletion of a parent task must not fail on the self-FK
// `tasks_parent_task_id_fkey` when a developer child still exists. The child
// should be detached (parent_task_id -> NULL), not deleted, because work on
// it may already have happened.
// ---------------------------------------------------------------------------

describe('delete parent task with developer child (FK ON DELETE SET NULL)', () => {
  it('admin deletes parent; developer child survives with parent_task_id = null', async () => {
    const specialist = TEST_USERS.specialist;
    const developer = TEST_USERS.developer;

    // Admin-сценарий физического удаления разрешён в любом статусе (ТЗ §4.10),
    // поэтому не требуем status=new — делаем обычную задачу и сразу удаляем.
    const { task: parent } = await createTaskAs({
      creatorRole: 'duty_officer',
      title: 'role-test: delete-parent-with-child',
      assigneeId: specialist.id,
    });

    const specClient = (await signInAs('specialist')).client;
    const categoryId = await firstCategoryId('normal');
    const devTypeId = await taskTypeId('developer_task');

    const child = await specClient
      .from('tasks')
      .insert({
        title: 'role-test: child-of-deleted-parent',
        description: 'should outlive the parent',
        category_id: categoryId,
        task_type_id: devTypeId,
        creator_id: specialist.id,
        assignee_id: developer.id,
        parent_task_id: parent.id,
        complexity: 3,
      })
      .select('id, parent_task_id')
      .single();
    expect(child.error, errMsg(child.error)).toBeNull();
    expect(child.data?.parent_task_id).toBe(parent.id);
    CREATED_TASK_IDS.push(child.data!.id);

    // Удаляем родителя админом. До миграции 20260418020000 здесь падал FK:
    //   update or delete on table "tasks" violates foreign key constraint
    //   "tasks_parent_task_id_fkey" on table "tasks"
    const adminClient = (await signInAs('admin')).client;
    const del = await adminClient.from('tasks').delete().eq('id', parent.id);
    expect(del.error, errMsg(del.error)).toBeNull();

    // Ребёнок жив, ссылка обнулилась.
    const svc = createServiceClient();
    const survivor = await svc
      .from('tasks')
      .select('id, parent_task_id')
      .eq('id', child.data!.id)
      .single();
    expect(survivor.error, errMsg(survivor.error)).toBeNull();
    expect(survivor.data?.parent_task_id).toBeNull();
  });
});
