import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type TestRole =
  | 'specialist'
  | 'duty_officer'
  | 'developer'
  | 'accountant'
  | 'manager'
  | 'admin';

export interface TestUser {
  role: TestRole;
  login: string;
  email: string;
  /** Matches `public.users.id` and `auth.users.id`. Hard-coded so tests can
   *  assert ownership without a lookup. */
  id: string;
}

/** The 6 accounts seeded by `supabase/seed/local_test_users.sql`.
 *
 *  All share a single password provided via TEST_USER_PASSWORD (see
 *  `local-test-accounts.md`). Ids come from production-local DB but are
 *  verified in the `beforeAll` below, so tests still pass on a fresh reset. */
export const TEST_USERS: Record<TestRole, TestUser> = {
  specialist: {
    role: 'specialist',
    login: 'specialist',
    email: 'specialist@crm.local',
    id: 'fd2c28a6-fdb5-4461-9f0d-882ae386bd23',
  },
  duty_officer: {
    role: 'duty_officer',
    login: 'duty',
    email: 'duty@crm.local',
    id: '09a33ec5-e8fb-44e1-b8b2-5333fd61707d',
  },
  developer: {
    role: 'developer',
    login: 'developer',
    email: 'developer@crm.local',
    id: 'e5ed0ead-b57f-4c2e-a3dd-e5d90d83013d',
  },
  accountant: {
    role: 'accountant',
    login: 'accountant',
    email: 'accountant@crm.local',
    id: '02632255-dab8-44b9-9746-b3c3df55ca67',
  },
  manager: {
    role: 'manager',
    login: 'manager',
    email: 'manager@crm.local',
    id: '99442095-8cca-4b99-9359-2afcb87cf3e9',
  },
  admin: {
    role: 'admin',
    login: 'admin',
    email: 'admin@crm.local',
    id: 'c89d8da3-de53-4750-a126-33bd8b29f318',
  },
};

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Check .env / .env.example.`,
    );
  }
  return v;
}

const SUPABASE_URL = env('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = env('VITE_SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = env(
  'SUPABASE_SERVICE_ROLE_KEY',
  process.env.SERVICE_ROLE_KEY,
);
const TEST_PASSWORD = env('TEST_USER_PASSWORD', 'LocalCRM_Dev_2026!');

/** Anon-key client with a fresh session store — used as one specific user. */
export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Service-role client — bypasses RLS. Only for fixture setup / cleanup. */
export function createServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Signs in as `role`. Each call returns a fresh client so different tests
 *  can hold multiple authenticated sessions in parallel. */
export async function signInAs(role: TestRole): Promise<{
  client: SupabaseClient<Database>;
  user: TestUser;
}> {
  const user = TEST_USERS[role];
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw new Error(
      `signInAs(${role}): ${error.message}. ` +
        'Is docker-compose up and did you seed local test users?',
    );
  }
  return { client, user };
}

/** Bypass RLS to physically delete a list of tasks and their dependent rows. */
export async function hardDeleteTasks(taskIds: number[]): Promise<void> {
  if (taskIds.length === 0) return;
  const svc = createServiceClient();
  const { error } = await svc.from('tasks').delete().in('id', taskIds);
  if (error) {
    // Swallow — cleanup failures shouldn't mask the actual test error.
    console.warn('hardDeleteTasks:', error.message);
  }
}

/** Bypass RLS to delete notifications touching given tasks (keep table clean). */
export async function hardDeleteNotificationsForTasks(
  taskIds: number[],
): Promise<void> {
  if (taskIds.length === 0) return;
  const svc = createServiceClient();
  const { error } = await svc.from('notifications').delete().in('task_id', taskIds);
  if (error) console.warn('hardDeleteNotificationsForTasks:', error.message);
}

/** Reads the first active category with the given severity. Cached. */
let cachedCategoryIds: Partial<Record<'normal' | 'important' | 'critical', number>> = {};
export async function firstCategoryId(
  severity: 'normal' | 'important' | 'critical' = 'normal',
): Promise<number> {
  if (cachedCategoryIds[severity]) return cachedCategoryIds[severity]!;
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('problem_categories')
    .select('id')
    .eq('is_active', true)
    .eq('severity', severity)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No active category with severity=${severity}`);
  cachedCategoryIds[severity] = data.id;
  return data.id;
}

let cachedTaskTypeIds: Partial<Record<string, number>> = {};
export async function taskTypeId(code: string = 'regular'): Promise<number> {
  if (cachedTaskTypeIds[code]) return cachedTaskTypeIds[code]!;
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('task_types')
    .select('id')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No task_type with code=${code}`);
  cachedTaskTypeIds[code] = data.id;
  return data.id;
}

/** Friendly error accessor — supabase-js throws plain objects. */
export function errMsg(err: unknown): string {
  if (!err) return '';
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const r = err as Record<string, unknown>;
    return [r.message, r.details, r.hint].filter(Boolean).join(' — ');
  }
  return String(err);
}
