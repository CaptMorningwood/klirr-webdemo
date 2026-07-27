# Branching strategy

- **Status:** Decided
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

Use short-lived `feature/<issue>-<description>`, `fix/<issue>-<description>`, `docs/<issue>-<description>`, or `chore/<issue>-<description>` branches. After the governance bootstrap, branch from and target `tst`; `tst` is the single UAT release-candidate branch and `main` represents production. Initially, allow one release candidate and one change per release to make review, UAT, and rollback unambiguous.

Promotion is a reviewed PR from `tst` to `main` after CI and recorded UAT. Alex alone merges either protected branch. Direct pushes, force pushes, bypassing checks, and merging by Codex are prohibited.

**One-time exception:** issue #70 uses `chore/70-governance-foundation` → `main` because `tst` does not exist. Alex will create `tst` from updated `main` after this PR merges; this exception is not precedent.
