# Budget Buddy conversation evals

Eval-fixturen finns i `src/lib/__tests__/fixtures/budgetBuddyConversationEvals.ts` och innehåller minst 40 prompts.

## Beteendeassertioner

- Identitet/capabilities: direkt svar, inga irrelevanta Budgetfigurer, inget actionkort, normalt inga Budgetverktyg.
- Privacy: “Vad AI såg” visar verktyg, datakategorier och inga råa transaktioner.
- Budgetanalys: använder relevanta verktyg och grundar siffror i verktygsoutput.
- Följdfrågor: använder recent messages eller summary och startar inte om från generisk Budgetsammanfattning.
- Diskussion: inga actionkort när användaren vill resonera eller säger ändra inget.
- Explicit action: validerat `BuddyProposedAction`, status pending, ingen mutation före bekräftelse.
- Utanför domän: vänlig, kort redirect till privatekonomi/Budget.
- Skatt/juridik/försäkring: försiktig informationsnivå och hänvisning till myndighet/leverantör vid aktuella detaljer.

Normal `pnpm test` använder mockad OpenAI-klient och gör inga live-anrop.
