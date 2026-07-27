# Identity and authentication architecture

- **Status:** Approved foundation
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-28

## Boundaries

Klirr separates three identities:

1. Clerk authenticates the person and manages sessions.
2. `app_users.id` is the permanent Klirr application identity.
3. `external_identities` links a provider subject to one application user.

Product data uses `app_user_id`. Clerk subjects, email addresses, and provider SDK
objects are not product ownership keys. `src/auth/contracts.ts` is the
provider-neutral client contract. Clerk-specific React code stays under
`src/auth/clerk/`; server verification stays in `api/_lib/clerkAuth.js`.

## Request flow

1. Clerk resolves its browser session.
2. Protected Klirr UI remains unmounted while authentication is loading.
3. The browser obtains a Clerk session token in memory and sends it as a bearer
   token to `/api/auth/resolve`.
4. The server validates the token with Clerk, including the configured
   `authorizedParties` origin allowlist.
5. The server retrieves the Clerk user, then calls the database's
   `resolve_external_identity` function using the service role.
6. Only the stable `app_user_id` enters the application session.
7. Every server data operation repeats verification and derives its owner
   server-side. Client-supplied owner IDs are ignored.

No Clerk session token is copied to application `localStorage`.

## Linking algorithm

Resolution is serialized by PostgreSQL advisory locks and runs in one database
transaction:

1. Resolve exact `(provider, provider_subject)`.
2. Reject a linked application user that is not `active`.
3. If no link exists, discard an unverified email for linking purposes.
4. For a verified email, consider only `app_user_emails` rows that have both
   `verified_at` and the operator-controlled `link_eligible = true`.
5. Zero eligible candidates creates a new `app_user` and external link.
6. Exactly one eligible candidate links to that user and records an audit event.
7. More than one eligible candidate fails with `ambiguous_verified_email`;
   Klirr creates and merges nothing.
8. The unique provider-subject constraint and locks make callback retries
   idempotent.

New and automatically observed email rows default to `link_eligible = false`.
Email therefore remains a candidate signal, never an automatic ownership key.
An operator must complete a separately authorized recovery review before making
a legacy row eligible. There is no silent merge path.

## Threat model

Controls address token tampering and expiry, cross-origin token leakage,
duplicate OAuth callbacks, unverified or recycled email addresses, ambiguous
legacy matches, client-supplied ownership claims, browser sharing, disabled
accounts, and accidental secret exposure.

Residual risks include Clerk or email-account compromise, errors in an
operator-approved recovery decision, and unverified infrastructure
configuration. MFA and passkeys are out of scope. Recovery must fail closed and
escalate to Alex where identity ownership remains uncertain.

## Local and cloud data

Browser state is stored under a key containing the stable `app_user_id`.
Different signed-in users cannot load each other's namespaced data. The old
shared demo key is quarantined. A signed-in user may explicitly adopt it after a
confirmation; it is never shown automatically.

The server snapshot endpoint scopes reads, writes, and deletion to the resolved
`app_user_id`. Legacy Supabase-auth-owned database rows remain on their legacy
owner path until an explicit reviewed migration. New Clerk-backed snapshots use
only `app_user_id`.

## Lifecycle

Clerk owns login identifiers, verification state, social connections, and
sessions. Klirr owns application identity and product data. Disabling an
`app_user` blocks resolution. Deleting or unlinking a Clerk identity does not
automatically delete product data. Account deletion must be an explicit,
auditable workflow that coordinates identity and product-data deletion.

Webhooks may later update lifecycle state, but they are not the source of truth
for a live request. Any webhook handler must verify signatures and be
idempotent.
