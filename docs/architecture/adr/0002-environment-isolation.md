# ADR 0002: Environment isolation

- **Status:** Accepted
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

## Context

Development and validation must not expose production data or let experimental changes affect production.

## Decision

Recognize `local`, `preview`, `tst`, and `prd`. `tst` and `prd` are fully separate, including separate Supabase projects, credentials, secrets, data, and deployment configuration. Preview may use constrained test-only resources when isolation, access, lifetime, and cleanup are defined. Preview and Test never use production data; fixtures and seeds are synthetic.

## Consequences

Environment-specific values remain outside version control and receive least-privilege access. Some duplication is intentional. Provisioning, domains, DNS, and live project linkage are deferred and require separately approved infrastructure work.
