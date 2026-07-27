# DNS and Cloudflare

- **Status:** Current fact and planned target
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

**Current:** Strato is the registrar.

**Planned:** Cloudflare will provide DNS; `tst.klirr.nu` is the planned UAT hostname and `klirr.nu` the planned production hostname.

**Deferred/not configured here:** Cloudflare onboarding, nameserver and DNS records, proxy/TLS policy, Vercel domain verification, redirects, access controls, and cutover/rollback. Issue #70 makes no registrar, DNS, Cloudflare, Vercel, or domain change. Planned names do not imply availability.
