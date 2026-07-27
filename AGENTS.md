# Klirr repository instructions

- **Status:** Approved foundation
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

Alex is Product Owner, repository owner, final approver, and sole merge authority for `tst` and `main`. Kim is an infrastructure/DevOps advisor without GitHub access; wherever Kim advises or owns work, Alex remains co-owner. ChatGPT acts as Architect and Codex as Developer. Product and infrastructure decisions escalate to Alex; security or privacy uncertainty stops work and is escalated.

Work issue-first on short-lived `feature/`, `fix/`, `docs/`, or `chore/` branches. Never push directly to or bypass checks on `tst`/`main`; never merge without Alex. The normal flow is issue branch → `tst` (UAT) → `main`, with one release candidate and one change per release initially. Issue #70 alone may target `main`, because `tst` does not yet exist.

Run frozen installation, type checking, tests, and build before review. Tests must be deterministic and must not call live services. Document behavior, architecture, data, privacy, rollout, and rollback impact. Internal documentation is English Markdown following [documentation standards](docs/engineering/DOCUMENTATION_STANDARDS.md). Never commit secrets, personal/production data, credentials, project references, or logs containing them. Use least privilege and isolated environments. See the [documentation index](docs/README.md), [development workflow](docs/engineering/DEVELOPMENT_WORKFLOW.md), and [security/secrets policy](docs/infrastructure/SECRETS_MANAGEMENT.md).
