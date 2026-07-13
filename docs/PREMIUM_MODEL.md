# Premium model for Klirr demo

Klirr Premium hjälper användaren att: **Förbättra Budgeten. Följ resultatet. Låt Klirr hålla koll.** Klirrs kärna ska vara komplett gratis; Premium sparar tid och ger mer automation, historik, personlig planering och fördjupning utan att låsa användarens Budget.

## Free includes
Create/edit Budget, income, fixed expenses, variable expenses, margin, household profile, Budget Health, Budget completion, CSV/TXT import, recurring detection, unclear item review, transfer review, Budget Checkup, basic Budget Buddy, action cards, confirm/cancel/undo, crisis Budget, basic scenarios, export, basic cloud save/load/sync, and account deletion.

## Premium adds
Premium adds the three Premium 2.0 pillars:

1. **Förbättra min Budget** – deterministic `premiumValue` creates a personal improvement plan with up to three prioritized opportunities.
2. **Följ min utveckling** – snapshots compare margin, fixed expenses, goals and Budget Health over time.
3. **Klirr håller koll** – local automatic review, proactive insights and reminders monitor the Budget when Klirr opens or when the user chooses to run a review.

Secondary tools live under “Mer kontroll”: multiple Budget workspaces, shared Budget demo and version history/restore.

## Entitlement matrix
Free has `csvImport`, `recurringDetection`, `budgetBuddy`, `scenarios`, `export`, and `cloudSync` enabled.

Premium additionally enables `premiumHub`, `improvementPlan`, `developmentTracking`, `smartMonitoring`, `budgetBuddyAdvanced`, `deepAnalysis`, `proactiveInsights`, `budgetHistory`, `budgetGoals`, `reminders`, `automaticReview`, `multipleBudgets`, `sharedBudget`, and `versionHistory`.

Entitlements are derived from `subscriptionPlan` and `subscriptionStatus`. `free` always receives the Free matrix. `pro` receives Premium only when status is `active` or `trialing`; `inactive` and `past_due` fall back to Free. Stored stale entitlements must not override derived entitlements.

## Premium estimates
Personalized estimates are conservative, testable and not guarantees. Duplicate income/review cleanup is counted as reliability, not guaranteed margin. Buffer can strengthen the Budget without creating free extra margin.

## Budget Buddy+ privacy boundaries
Basic Budget Buddy stays free. Premium Buddy+ may use summarized Budget context for deeper analysis, alternatives, goals, history, insights and review follow-up only when both Premium entitlement and AI consent/preferences allow it.

Premium AI must use the centralized Privacy AI layer. It must not send raw imported transactions, raw rows, `originalDescription`, counterparties, bank references, balances, txIds, file contents or imported rows. “Vad AI såg” logs the summarized context and includes workspace scope. Proposed Budget changes still require action cards and confirmation/undo safety.

## Deterministic local analysis without AI
The Premium hub, improvement plan, deterministic value summary, local analysis, snapshots, goals, reminders and monitoring work without AI. If AI is disabled or consent is withdrawn, Premium Buddy+ is blocked with a user-facing explanation while local Premium analysis remains available.

## Workspaces and Privacy scope
Premium workspace data remains workspace-specific. Privacy preferences, consent history and AI transparency logs are global unless an AI log entry includes a `workspaceId` for transparency. Switching Free/Premium must preserve both Premium workspace data and Privacy state.

## Demo gating vs production billing
This demo gating is a local UX simulator, not secure billing enforcement. Production still needs checkout, receipt validation, server-side entitlement enforcement and protected backend APIs.

## Not implemented for production
Checkout, receipt validation, server enforcement, real invitations, real-time collaboration, push notifications, background jobs and bank connectivity remain out of scope.

## Budget Buddy capability matrix

Gratis inkluderar kärncapabilities: `explain_budget`, `answer_budget_question`, `explain_budget_health`, `explain_margin`, `budget_checkup`, `import_cleanup`, `basic_suggestions`, `basic_actions`, `crisis_budget` och `basic_scenarios`. De styrs av befintlig `budgetBuddy`-entitlement och inkluderar action cards, confirm, cancel, undo, trygg planner och lokalt deterministiskt fallback-läge utan meddelandekvot.

Premium inkluderar alla kärncapabilities plus Budget Buddy+: `improvement_plan`, `alternative_plans`, `deep_analysis`, `goal_aware_advice`, `development_aware_advice`, `monitoring_advice` och `proactive_insight_followup`. De styrs av befintlig `budgetBuddyAdvanced`-entitlement. Premium ger inte AI-samtycke; fjärr-AI kräver alltid aktiv AI-inställning och aktuellt versionerat `ai_features`-samtycke.
