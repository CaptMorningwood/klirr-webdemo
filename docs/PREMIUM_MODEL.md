# Premium model for Klirr demo

Klirrs kärna ska vara komplett gratis. Premium sparar tid och ger mer automation, historik och fördjupning. Premium får aldrig låsa användarens möjlighet att förstå eller underhålla sin Budget.

## Free includes
Create/edit Budget, income, fixed expenses, variable expenses, margin, household profile, Budget Health, Budget completion, CSV/TXT import, recurring detection, unclear item review, transfer review, Budget Checkup, basic Budget Buddy, action cards, confirm/cancel/undo, crisis Budget, basic scenarios, export, basic cloud save/load/sync, and account deletion.

## Premium adds
Budget Buddy+, deep Budget analysis, proactive insights, Budget development/history, Budget goals, in-app reminders, automatic re-review, multiple Budget workspaces, shared Budget demo, and full version history/restore.

## Entitlement matrix
Free has `csvImport`, `recurringDetection`, `budgetBuddy`, `scenarios`, `export`, and `cloudSync` enabled. Premium additionally enables `budgetBuddyAdvanced`, `deepAnalysis`, `proactiveInsights`, `budgetHistory`, `budgetGoals`, `reminders`, `automaticReview`, `multipleBudgets`, `sharedBudget`, and `versionHistory`.

Entitlements are derived from `subscriptionPlan` and `subscriptionStatus`. `free` always receives the Free matrix. `pro` receives Premium only when status is `active` or `trialing`; `inactive` and `past_due` fall back to Free.

## Demo switch behavior
Settings contains “Demo: abonnemangsläge” with Gratis/Premium. It changes local plan/status immediately, recalculates entitlements, does not reload, and does not delete Budget or Premium-created data. Demo data/imported exports preserve the locally selected demo plan.

## Demo gating vs production billing
This demo gating is a local UX simulator, not secure billing enforcement. Production still needs checkout, receipt validation, server-side entitlement enforcement, and protected backend APIs.

## Data preservation
Premium workspaces, goals, reminders, history, versions, shared members, automatic review settings/results, and dismissed insights remain stored when switching to Gratis. In Gratis, the active Budget core remains editable and Premium actions are locked/read-only previews.

## Budget Buddy+ boundaries
Basic Budget Buddy stays free. Premium Buddy+ may use summarized Budget context for deeper analysis, alternatives, goals, history, insights, and re-review follow-up. It must not send raw imported transactions, mutate state without action cards, or bypass confirmation/undo safety.

## Not implemented for production
Checkout, receipt validation, server enforcement, real invitations, real-time collaboration, push notifications, background jobs, and bank connectivity remain out of scope.
