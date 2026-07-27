# Environments

- **Status:** Current facts and decided target
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-28

| Environment | Current | Decided target | Deferred / not configured by issue #70 |
|---|---|---|---|
| Local | Repository runs with pnpm/Vite | Synthetic data and local-only credentials | Supabase CLI service initialization |
| Preview | Vercel Preview Deployments are enabled | Test-only, constrained resources; no production data | Resource topology and secret provisioning |
| `tst` | Branch exists; UAT host is not verified | Separate UAT at `tst.klirr.nu`; separate Supabase and Clerk configuration/secrets | Deployment, domain, DNS, project linking |
| `prd` | Vercel is used | `main` represents production at `klirr.nu`; separate Supabase project/secrets | Domain/DNS and infrastructure changes |

`tst` and `prd` must be fully isolated. Preview/Test use synthetic data only. Repository documentation is not evidence that any planned hostname or service is live.

Clerk Development may be shared by local/Preview/Test only after explicit
environment review. Production uses a separate Clerk Production instance.
Development users cannot transfer to Production.
