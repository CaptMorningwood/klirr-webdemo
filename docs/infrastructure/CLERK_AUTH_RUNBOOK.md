# Clerk authentication environment runbook

- **Status:** Review required before shared-environment activation
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-28

## Environment separation

Use a Clerk Development instance for local, Preview, and Test while that shared
test arrangement is approved. Use a separate Clerk Production instance for
production. Clerk Development users cannot be transferred to another instance;
test accounts are never assumed to become production accounts.

Clerk does not provide a first-class staging instance. If Test later needs full
isolation, create a separate Clerk application and document its ownership,
domain, credentials, and cleanup.

## Dashboard configuration

For each intended instance:

1. Enable Google as a social connection.
2. Enable email verification code (OTP).
3. Disable password, username, email link, phone, Apple, Microsoft, passkeys,
   MFA, Enterprise SSO, and Organizations for this release.
4. Configure exact redirect/origin domains for the environment.
5. In production, provide environment-specific Google OAuth credentials.
6. Keep Google's email-subaddress protection enabled unless Alex accepts a
   documented exception.

Official references:

- [React/Vite quickstart](https://clerk.com/docs/react/getting-started/quickstart)
- [Authentication strategies](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options)
- [Google social connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)
- [Managing environments](https://clerk.com/docs/guides/development/managing-environments)
- [Production deployment](https://clerk.com/docs/guides/development/deployment/production)

## Variables

Copy `.env.example` and provide values through local ignored files or the
deployment platform's encrypted environment settings:

- `VITE_CLERK_PUBLISHABLE_KEY`: browser-safe Clerk publishable key.
- `CLERK_PUBLISHABLE_KEY`: server copy used during request verification.
- `CLERK_SECRET_KEY`: server-only Clerk secret.
- `CLERK_AUTHORIZED_PARTIES`: comma-separated exact application origins.
- `SUPABASE_URL`: server database API URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only database service role.

Never expose either secret through a `VITE_` variable. Do not include instance
IDs, project references, credentials, or copied production logs in Git.
The installed Clerk SDK requires Node.js 20.9 or newer; `package.json` declares
that runtime floor.

## Database rollout

1. Back up and reconcile the target schema against `supabase/schema.sql`.
2. Review `20260728010000_provider_neutral_identity.sql`.
3. Apply it in an isolated local/Test database before shared Test.
4. Verify tables, constraints, grants, the RPC, and legacy snapshot
   compatibility.
5. Deploy server functions and variables before exposing the protected client.
6. Complete the authentication UAT checklist.

The migration is forward-only after shared use. Do not edit it in place.

## Rollback

Disable traffic to the new release or redeploy the last known-good compatible
application. Do not drop identity tables or external links as an application
rollback. Preserve the migration and data for investigation; ship a reviewed
forward repair if schema behavior is wrong. Remove or rotate secrets only when
containment requires it, then invalidate affected sessions.

Rollback triggers include cross-user data visibility, ownership mismatch,
unverified-token acceptance, secrets in a client bundle/log, duplicate identity
creation, or widespread sign-in failure. Alex decides release and rollback.
