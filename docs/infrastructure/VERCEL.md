# Vercel

- **Status:** Current facts with target documented
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

**Current:** Vercel is used and Preview Deployments are enabled; `vercel.json` contains repository routing/build configuration.

**Decided target:** previews validate issue branches with test-only dependencies. `tst` supports UAT and `main` represents production, each with isolated environment configuration.

**Deferred:** issue #70 changes no Vercel projects, domains, deployments, environment variables, access, or live settings. Exact preview resource policy and deployment promotion configuration require a separate approved change. Never copy production secrets or data into previews.
