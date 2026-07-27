# Supabase

- **Status:** Current audit and decided target
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

**Current audit:** the application depends on `@supabase/supabase-js`, uses environment-driven client setup, and had `supabase/schema.sql` but no CLI config or migrations directory before issue #70. The schema file is preserved; its authority relative to any live project is unverified.

**Repository baseline:** issue #70 adds a minimal unlinked `supabase/config.toml`, empty `supabase/migrations/`, and empty documented `supabase/seed.sql`. It includes no project ref, secrets, schema speculation, or data. Install/use a compatible Supabase CLI separately, then run `supabase start`, `supabase status`, `supabase db reset`, and `supabase stop` locally. Do not link or push without an approved environment procedure.

**Decided target:** separate `tst` and `prd` Supabase projects, secrets, and data; versioned immutable migrations promoted unchanged; synthetic seeds only; no dashboard-only schema changes. See [ADR 0003](../architecture/adr/0003-database-migration-strategy.md).

**Deferred:** creating/linking projects, reconciling `schema.sql`, credentials, remote migrations, live access, and service configuration.
