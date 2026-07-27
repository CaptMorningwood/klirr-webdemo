# ADR 0003: Database migration strategy

- **Status:** Accepted
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

## Context

Schema changes need reproducible review and identical promotion across isolated Supabase projects.

## Decision

Use the Supabase CLI and versioned SQL in `supabase/migrations/`. Once applied anywhere shared, migrations are immutable. Promote the unchanged migration files through environments. Changes are forward-only by default; repair with a new migration rather than editing history. Breaking changes use expand-and-contract across compatible releases. Dashboard-only schema changes are prohibited: capture every schema/RLS/function change in migration SQL. Seeds are synthetic only and contain no production or personal data.

## Consequences

PRs review SQL, compatibility, rollout order, and recovery. Destructive rollback is not assumed; application rollback must remain compatible or a forward fix is shipped. The existing `supabase/schema.sql` is a historical baseline and is not converted into a migration by issue #70 pending reconciliation with a live authoritative schema.
