# Secrets management

- **Status:** Decided policy
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

Never commit credentials, tokens, private keys, service-role keys, project refs, environment files, personal data, production data, or sensitive logs. Store secrets only in an approved environment secret store, scoped per `local`, Preview, `tst`, or `prd`, with least privilege. `tst` and `prd` never share secrets; preview receives test-only credentials under explicit constraints. CI in this foundation requires no secrets.

Document variable names and purpose, not values. Before review, inspect staged changes and history for accidental disclosure. If exposure is suspected: stop, notify Alex, avoid repeating the value, revoke/rotate it at the provider, remove it safely from pending changes/history, assess logs and access, and document the incident through an approved private channel. Deleting a Git line alone does not rotate a secret.
