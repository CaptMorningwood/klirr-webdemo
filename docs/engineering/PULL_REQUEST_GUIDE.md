# Pull request guide

- **Status:** Current
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

Every PR links an issue and uses the repository template. Keep one coherent approved change per PR and state summary, scope/non-goals, architecture, data/privacy, tests, documentation, UAT, rollout, and rollback. Disclose migrations and configuration needs without embedding secrets.

PRs normally target `tst`. A promotion PR targets `main`, contains the tested release candidate without unrelated changes, references UAT evidence, and lists exact rollback steps. Issue #70 is the documented bootstrap exception. Green required CI is necessary but not sufficient: Alex provides final approval and is the sole merge authority. Authors must not self-merge or bypass checks.
