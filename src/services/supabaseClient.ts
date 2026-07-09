import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AppState } from '../types';

const env = (import.meta as any).env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const supabaseSetupMessage = 'Supabase är inte konfigurerat ännu. Lägg in VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY i Vercel.';

export type OAuthProvider = 'google' | 'apple';

export type LinkedIdentity = {
  id?: string;
  provider?: string;
  identity_data?: {
    email?: string;
    name?: string;
    full_name?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function getAuthRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

export async function signInWithOAuthProvider(provider: OAuthProvider) {
  if (!supabase) throw new Error(supabaseSetupMessage);

  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getAuthRedirectUrl(),
    },
  });
}

export async function signInWithMagicLink(email: string) {
  if (!supabase) throw new Error(supabaseSetupMessage);

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });
}

export async function getLinkedIdentities(): Promise<LinkedIdentity[]> {
  if (!supabase) return [];

  const authWithIdentities = supabase.auth as typeof supabase.auth & {
    getUserIdentities?: () => Promise<{
      data?: { identities?: LinkedIdentity[] | null } | null;
      error?: Error | null;
    }>;
  };

  if (typeof authWithIdentities.getUserIdentities !== 'function') return [];

  const { data, error } = await authWithIdentities.getUserIdentities();
  if (error) throw error;
  return (data?.identities || []) as unknown as LinkedIdentity[];
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) throw new Error(supabaseSetupMessage);
  return supabase.auth.signUp({ email, password });
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error(supabaseSetupMessage);
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function saveCloudSnapshot(state: AppState) {
  if (!supabase) throw new Error('Supabase är inte konfigurerat.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Du måste vara inloggad för att spara till molnet.');
  const { error } = await supabase.from('app_snapshots').insert({ user_id: user.id, state, version: '1.0' });
  if (error) throw error;
}

export async function loadLatestCloudSnapshot(): Promise<AppState | null> {
  if (!supabase) throw new Error('Supabase är inte konfigurerat.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Du måste vara inloggad för att hämta molndata.');
  const { data, error } = await supabase
    .from('app_snapshots')
    .select('state')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.state as AppState) || null;
}

export async function deleteCloudData() {
  if (!supabase) throw new Error('Supabase är inte konfigurerat.');
  const user = await getCurrentUser();
  if (!user) throw new Error('Du måste vara inloggad för att radera molndata.');
  const { error } = await supabase.from('app_snapshots').delete().eq('user_id', user.id);
  if (error) throw error;
}
