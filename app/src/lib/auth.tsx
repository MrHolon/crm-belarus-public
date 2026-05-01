import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import {
  AuthContext,
  type AuthContextValue,
  type Profile,
} from './auth-context';

/**
 * Provides Supabase session + the matching `public.users` profile row to the
 * rest of the app. Role-based UI and route guards should read from here.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsAuthReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // IMPORTANT: onAuthStateChange holds an internal auth lock while the
        // callback runs. Doing `await` on any supabase-js call inside this
        // callback can deadlock the client — subsequent DB requests hang,
        // which shows up as a blank page after refresh. So we keep the body
        // synchronous and defer side-effects with setTimeout.
        setSession(nextSession);
        if (!nextSession) {
          queryClient.clear();
          return;
        }
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          const userId = nextSession.user.id;
          setTimeout(() => {
            void supabase
              .from('users')
              .update({ last_seen_at: new Date().toISOString() })
              .eq('id', userId);
          }, 0);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const user = session?.user ?? null;

  const profileQuery = useQuery<Profile | null, Error>({
    enabled: !!user,
    queryKey: ['auth', 'profile', user?.id],
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    if (!profileQuery.isSuccess) return;
    const profile = profileQuery.data;
    if (!profile || profile.is_active !== false) return;

    void supabase.auth.signOut();
    notifications.show({
      title: 'Доступ запрещён',
      message: 'Учётная запись отключена администратором.',
      color: 'red',
    });
  }, [user?.id, profileQuery.isSuccess, profileQuery.data]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile: profileQuery.data ?? null,
      role: profileQuery.data?.role ?? null,
      isAuthReady,
      isProfileLoading: !!user && profileQuery.isPending,
      profileError: profileQuery.error ?? null,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      },
      async signUp({ email, password, fullName, login }) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, login } },
        });
        if (error) throw error;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async refreshProfile() {
        await queryClient.invalidateQueries({
          queryKey: ['auth', 'profile', user?.id],
        });
      },
    }),
    [
      session,
      user,
      profileQuery.data,
      profileQuery.isPending,
      profileQuery.error,
      isAuthReady,
      queryClient,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
