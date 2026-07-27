# Testing strategy

- **Status:** Decided
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

Required PR checks use the pinned repository pnpm version and run frozen install, TypeScript type checking, the Vitest suite, and the production build. Check names remain stable for future branch protection. Tests must be deterministic, isolated, repeatable, and must not make live OpenAI, Supabase, network, or production-data calls; use controlled fixtures and synthetic data.

Authors add focused unit/static tests for changed behavior and regression tests for fixes. UAT on `tst` validates acceptance criteria, critical journeys, data/privacy expectations, and rollback readiness before promotion. Record tester, environment, result, and relevant issue/PR. CI does not replace UAT.

Future hardening, after policy and ownership approval: Dependabot or Renovate, dependency review, secret scanning, CodeQL, SBOM generation, license checks, and a severity/remediation policy. These are intentionally not blocking in this bootstrap.
