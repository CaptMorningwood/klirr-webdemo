# Release process

- **Status:** Decided target
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

The normal release flow is issue branch → PR to `tst` → CI → UAT at planned `tst.klirr.nu` → promotion PR from `tst` to `main` → production at planned `klirr.nu`. `main` is the production source of truth. Initially only one release candidate and one change are staged at a time.

Before promotion, confirm required CI, unchanged migration artifacts, UAT evidence, documentation, privacy/data review, rollout order, monitoring owner, and a tested rollback/forward-fix plan. Alex alone approves and merges. Failed UAT returns to an issue branch; do not patch `tst` or `main` directly. Production incidents follow [rollback guidance](../infrastructure/ROLLBACK.md), favoring safe application rollback and forward-only database repair.

Issue #70 alone targets `main`; after merge, Alex creates `tst` from updated `main`. This PR configures no deployment or live environment.
