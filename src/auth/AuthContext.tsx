import { createContext, useContext } from 'react';
import type { AuthenticatedSession } from './contracts';

const AuthContext = createContext<AuthenticatedSession | null>(null);

export const AuthSessionProvider = AuthContext.Provider;

export function useAuthSession(): AuthenticatedSession {
  const session = useContext(AuthContext);
  if (!session) throw new Error('Authenticated Klirr session is unavailable.');
  return session;
}
