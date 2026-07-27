# Development workflow

- **Status:** Decided
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

1. Start with an approved GitHub issue and clarify scope, non-goals, acceptance criteria, architecture, data/privacy, and documentation impact.
2. Branch from the intended integration branch using the [branch naming rules](BRANCHING_STRATEGY.md). Never push directly to `tst` or `main`.
3. Implement only the approved change. Codex may implement, test, document, branch, and open PRs, but cannot decide new product/infrastructure direction, bypass checks, or merge.
4. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Tests are deterministic and use no live OpenAI, Supabase, or other external service.
5. Open a PR using the template, link the issue, obtain green required CI and review, and address documentation, rollout, rollback, privacy, and UAT.
6. Alex is final approver and sole merge authority for `tst` and `main`.

Security/privacy uncertainty, conflicting requirements, potential secret exposure, production-data access, destructive migration risk, or a required live-infrastructure decision must stop and escalate to Alex. Never commit secrets or personal/production data.
