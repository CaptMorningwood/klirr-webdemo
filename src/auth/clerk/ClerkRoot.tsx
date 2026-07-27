import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from '@clerk/react';
import { svSE } from '@clerk/localizations';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthSessionProvider } from '../AuthContext';
import type { AuthenticatedSession } from '../contracts';
import { createClerkAuthService, toAuthenticatedIdentity } from './clerkAdapter';

const publishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim();

type ResolutionState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; appUserId: string }
  | { status: 'error'; message: string };

function SafeStatus({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-status-card" role="status" aria-live="polite">
        <h1>{title}</h1>
        <p>{children}</p>
      </section>
    </main>
  );
}

async function resolveApplicationUser(getToken: () => Promise<string | null>, signal: AbortSignal) {
  const token = await getToken();
  if (!token) throw new Error('Din session kunde inte verifieras. Logga ut och försök igen.');

  const response = await fetch('/api/auth/resolve', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || 'Klirr kunde inte koppla inloggningen till ditt konto.');
  }

  const body = await response.json() as { appUserId?: unknown };
  if (typeof body.appUserId !== 'string' || !body.appUserId) {
    throw new Error('Klirr fick ett ogiltigt kontosvar. Ingen Budgetdata öppnades.');
  }
  return body.appUserId;
}

function ClerkAuthBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const [resolution, setResolution] = useState<ResolutionState>({ status: 'idle' });

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setResolution({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setResolution({ status: 'loading' });
    resolveApplicationUser(getToken, controller.signal)
      .then(appUserId => setResolution({ status: 'ready', appUserId }))
      .catch(error => {
        if (controller.signal.aborted) return;
        setResolution({
          status: 'error',
          message: error instanceof Error ? error.message : 'Klirr kunde inte verifiera kontot.',
        });
      });
    return () => controller.abort();
  }, [getToken, isLoaded, isSignedIn, user]);

  const session = useMemo<AuthenticatedSession | null>(() => {
    if (!user || resolution.status !== 'ready') return null;
    return {
      appUserId: resolution.appUserId,
      identity: toAuthenticatedIdentity(user),
      auth: createClerkAuthService({
        user,
        getToken,
        signOut: () => clerk.signOut({ redirectUrl: '/' }),
      }),
    };
  }, [clerk, getToken, resolution, user]);

  if (!isLoaded) return <SafeStatus title="Klirr">Kontrollerar din inloggning…</SafeStatus>;

  if (!isSignedIn) {
    return (
      <main className="auth-shell">
        <section className="auth-intro">
          <span className="brand-mark">K</span>
          <h1>Välkommen till Klirr</h1>
          <p>Logga in med Google eller en engångskod via e-post.</p>
        </section>
        <SignIn routing="hash" />
      </main>
    );
  }

  if (!user || resolution.status === 'idle' || resolution.status === 'loading') {
    return <SafeStatus title="Öppnar ditt Klirr">Kopplar din säkra inloggning till ditt Klirr-konto…</SafeStatus>;
  }

  if (resolution.status === 'error') {
    return (
      <main className="auth-shell">
        <section className="auth-status-card" role="alert">
          <h1>Kontot kunde inte öppnas</h1>
          <p>{resolution.message}</p>
          <button className="btn" onClick={() => clerk.signOut({ redirectUrl: '/' })}>Logga ut</button>
        </section>
      </main>
    );
  }

  return <AuthSessionProvider value={session}>{children}</AuthSessionProvider>;
}

export function ClerkRoot({ children }: { children: ReactNode }) {
  if (!publishableKey) {
    return (
      <SafeStatus title="Inloggningen är inte konfigurerad">
        Klirr öppnar ingen Budgetdata förrän miljön har en Clerk publishable key.
      </SafeStatus>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} localization={svSE}>
      <ClerkAuthBoundary>{children}</ClerkAuthBoundary>
    </ClerkProvider>
  );
}
