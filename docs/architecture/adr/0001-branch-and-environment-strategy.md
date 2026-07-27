# ADR 0001: Branch and environment strategy

- **Status:** Accepted
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

## Context

Klirr needs a reviewable path from an issue to UAT and production with clear authority.

## Decision

Use short-lived issue branches and the naming rules in the [branching strategy](../../engineering/BRANCHING_STRATEGY.md). `tst` is the UAT/release-candidate branch and `main` is production. Work flows issue branch → `tst` → UAT → promotion PR to `main`. Initially stage one release candidate and one change per release. Alex alone merges `tst` or `main`; direct pushes and check bypasses are prohibited.

Issue #70 is a one-time exception: `chore/70-governance-foundation` targets `main` because `tst` does not exist. After merge, Alex creates `tst` from updated `main`.

## Consequences

Changes are traceable and rollback scope is small, at the cost of lower initial throughput. Promotion requires CI and recorded UAT. This ADR does not create branches or protection rules.
