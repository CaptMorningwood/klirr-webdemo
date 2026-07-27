# ADR 0004: Supabase portability boundaries

- **Status:** Accepted
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

## Context

Supabase provides useful platform capabilities, while Klirr should retain understandable migration boundaries.

## Decision

Treat Supabase as an infrastructure adapter. Isolate platform-specific RLS, Auth, Storage, Realtime, and Edge Functions behind explicit application/service boundaries. Keep domain models separate from generated or database row types. PostgreSQL-specific capabilities are allowed when valuable, but document their portability and operational implications. Use `jsonb` only for genuinely flexible data with documented shape, validation, query/index needs, and a path to normalize; do not use it to avoid modeling.

## Consequences

This is disciplined coupling, not database neutrality. Supabase-specific code remains possible but discoverable. New integrations require architecture and privacy review, migrations remain authoritative, and no premature replacement abstraction is required.
