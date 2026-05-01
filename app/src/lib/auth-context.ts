import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Tables } from '@/types/database';

export type Profile = Tables<'users'>;
export type UserRole = Profile['role'];

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  login: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isAuthReady: boolean;
  isProfileLoading: boolean;
  profileError: Error | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function useCurrentRole(): UserRole | null {
  return useAuth().role;
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return (
    role === 'duty_officer' ||
    role === 'manager' ||
    role === 'admin' ||
    role === 'accountant' ||
    role === 'developer'
  );
}
