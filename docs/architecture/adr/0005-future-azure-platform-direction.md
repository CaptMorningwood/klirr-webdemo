# ADR 0005: Future Azure platform direction

- **Status:** Accepted direction; implementation deferred
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

## Context

Azure may become a future platform, but the current application uses Vercel and Supabase and has no approved Azure implementation.

## Decision

Azure is future-only. If pursued, Azure Database for PostgreSQL is preferred because it best preserves PostgreSQL semantics and migration assets. Azure SQL would require a deliberate, separately scoped migration project covering schema, SQL, types, security, data movement, testing, and rollback. Do not create Azure resources or premature Azure abstractions now.

## Consequences

Current work focuses on clean domain/database boundaries and portability notes rather than speculative adapters. Platform selection, topology, cost, security, and migration planning require future ADRs and approval.
