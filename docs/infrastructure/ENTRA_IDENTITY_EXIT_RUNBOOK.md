# Entra External ID exit runbook outline

- **Status:** Planned, not implemented
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-28

## Invariants

- Retain every stable `app_users.id`.
- Add `entra_external_id` links; do not rewrite product foreign keys.
- Never link on unverified email alone or silently merge application users.
- Keep Clerk and Entra adapters separate from domain contracts.
- Do not migrate passwords because Klirr stores none.

## Planned migration

1. Approve an Entra architecture and threat-model ADR.
2. Test Clerk user export through documented administrative/API procedures.
3. Reconcile exported identities without putting product data in either
   provider's metadata.
4. Add Entra token verification and a controlled dual-provider linking window.
5. Re-provision social/passwordless users and require re-authentication.
6. Record new Entra subject links against existing `app_user_id` values.
7. Resolve ambiguous accounts through an authorized recovery workflow.
8. End the dual-provider window only after reconciliation and UAT.
9. Revoke Clerk sessions and credentials according to the approved cutover.

Active sessions do not migrate. Users sign in again. MFA or passkeys introduced
later may require re-enrolment. Clerk remains active until rollback risk and
identity reconciliation are accepted by Alex.
