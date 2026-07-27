# ADR 0006: Clerk with provider-neutral application identity

- **Status:** Approved
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-28

## Context

Klirr needs Google and email one-time-code sign-in for its initial production
phase. Clerk is the selected initial provider, while Microsoft Entra External ID
is a likely successor. Product ownership must survive that provider change.

## Decision

Use Clerk Free for authentication and Clerk-managed sessions. Enable Google and
email verification code only. Store a permanent UUID in `app_users` and link
provider subjects through `external_identities`. Keep Clerk SDK objects within
adapters, verify sessions on every protected server request, and derive product
ownership only from the server-resolved application user.

Use Supabase/PostgreSQL as the current identity-link persistence adapter. The
service-role credential remains server-only. Browser persistence is namespaced
by `app_user_id`.

## Consequences

Product tables can retain their ownership keys during an Entra migration.
Provider migration requires new identity links and fresh user sessions, not
product foreign-key rewrites. Identity resolution and recovery are additional
security-sensitive components. Existing Supabase Auth product rows need an
explicit compatibility migration and are not silently email-merged.

Password authentication, Clerk Organizations, Entra implementation, MFA, and
passkeys remain outside this decision.
