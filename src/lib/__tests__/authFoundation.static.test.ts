import { describe, expect, it } from 'vitest';
import contracts from '../../auth/contracts.ts?raw';
import clerkBoundary from '../../auth/clerk/ClerkRoot.tsx?raw';
import clerkAdapter from '../../auth/clerk/clerkAdapter.ts?raw';
import snapshotsApi from '../../../api/account/snapshots.js?raw';
import authResolveApi from '../../../api/auth/resolve.js?raw';
import clerkServer from '../../../api/_lib/clerkAuth.js?raw';
import migration from '../../../supabase/migrations/20260728010000_provider_neutral_identity.sql?raw';

describe('Clerk identity foundation boundaries', () => {
  it('keeps provider SDK types out of domain contracts', () => {
    expect(contracts).toContain("provider: IdentityProvider");
    expect(contracts).not.toMatch(/@clerk|UserResource|SessionResource/);
    expect(clerkAdapter).toContain("provider: 'clerk'");
  });

  it('does not render protected children before auth and app-user resolution', () => {
    expect(clerkBoundary).toContain("if (!isLoaded)");
    expect(clerkBoundary).toContain("if (!isSignedIn)");
    expect(clerkBoundary).toContain("resolution.status === 'loading'");
    expect(clerkBoundary).toContain('<AuthSessionProvider value={session}>{children}</AuthSessionProvider>');
  });

  it('has safe signed-out and expired-session behavior', () => {
    expect(clerkBoundary).toContain('<SignIn routing="hash" />');
    expect(clerkBoundary).toContain("clerk.signOut({ redirectUrl: '/' })");
    expect(authResolveApi).toContain('status(401)');
    expect(authResolveApi).toContain('ogiltig eller har gått ut');
  });

  it('derives snapshot ownership server-side and never trusts a client owner ID', () => {
    expect(snapshotsApi).toContain('authenticated.appUserId');
    expect(snapshotsApi).toContain("app_user_id: appUserId");
    expect(snapshotsApi).not.toMatch(/req\.body\.(appUserId|app_user_id|userId|user_id|ownerId)/);
  });

  it('verifies Clerk sessions with an authorized-party allowlist', () => {
    expect(clerkServer).toContain("acceptsToken: 'session_token'");
    expect(clerkServer).toContain('authorizedParties: authorizedParties()');
    expect(clerkServer).not.toContain('VITE_CLERK_SECRET');
  });

  it('enforces unique provider subjects and atomic callback resolution', () => {
    expect(migration).toContain('unique (provider, provider_subject)');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('ambiguous_verified_email');
    expect(migration).toContain('p_email_verified');
  });
});
