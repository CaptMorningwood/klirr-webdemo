# Premium demo QA

Use this checklist on mobile (320–430px) and desktop.

1. Fresh Gratis user: clear local storage, load app, confirm Gratis indicator and complete Budget core works.
2. Open Premium and confirm personalized Premium 2.0 preview: three pillars, opportunities, conservative estimated impact and first goal.
3. Activate Premium in the demo and verify no payment is implied.
4. Confirm the first activation experience “Premium är redo”.
5. Open “Min förbättringsplan” and verify max three priorities, estimation notes and Trygg / Balanserad / Mer offensiv alternatives.
6. Prepare action cards via Buddy+ and verify nothing changes without confirmation.
7. Open “Min utveckling”, save a snapshot and verify interpreted development text.
8. Create the suggested goal only after confirmation.
9. Run “Klirr håller koll” and verify local-only copy and contextual Premium insights in Budget views.
10. Open secondary tools under “Mer kontroll” and verify workspace, shared Budget demo and version-history positioning.
11. Toggle Gratis → Premium → Gratis; confirm Budget data, Premium data and active workspace are preserved.
12. Multiple workspaces: switch between two Budgets and verify income/expenses do not mix.
13. Migration: load a legacy export without workspaces/premium fields and confirm it becomes “Min Budget”.
14. Privacy integration: open Sekretess & data and verify AI enabled/disabled controls, consent records and “Vad AI såg”.
15. AI consent off: withdraw AI consent and confirm local Premium analysis still works but Premium Buddy+ is blocked with a user-facing explanation.
16. AI consent on: send a Premium Buddy+ request and confirm “Vad AI såg” logs summarized context with workspaceId and no raw transaction fields.
17. Premium export/deletion: export data and verify Premium + Privacy state are included; clear active Budget and verify consent history remains.
18. Free/Premium switching with Privacy: verify AI preferences, consent records and AI logs survive plan switching.
19. Accessibility: keyboard-operate the plan switch, Premium actions and Privacy controls; locked/blocked states have text explanations.

## Budget Buddy-access QA

- Gratis: öppna Budget Buddy och kontrollera `Gratis · Grundläggande Buddy` och `Lokalt läge`; kärnfrågor, Budget Checkup, importstädning, krisbudget och action cards ska fungera lokalt utan AI.
- Gratis + avancerat snabbval: visa Premiumförhandsvisning, gör inget API-anrop och erbjud `Aktivera Premium i demon` samt `Fortsätt med grundläggande Buddy`.
- Premium: alla Budget Buddy+-snabbval är olåsta, men fjärr-AI visar inline-kortet `Aktivera Budget Buddy AI ✨` tills AI-inställning och aktuellt samtycke finns.
- Planväxling ska aldrig ändra AI-inställning eller samtyckeshistorik. AI-aktivering ska aldrig ändra plan eller entitlements.
