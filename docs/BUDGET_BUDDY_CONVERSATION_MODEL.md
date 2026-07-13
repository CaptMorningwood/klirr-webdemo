# Budget Buddy Conversation 2.0

Budget Buddy ska svara på användarens faktiska fråga först. Budgetdata är ett verktyg, inte obligatoriskt innehåll i varje svar.

## Arkitektur

1. Klienten skickar användarens naturliga meddelande, 12–18 senaste chattmeddelanden, en konservativ samtalssammanfattning och en Privacy-säker kontext till `/api/budget-buddy`.
2. Servern håller Budgetkontexten serverside och exponerar bara validerade Responses API-funktioner till modellen.
3. AI sköter samtalet. Deterministiska verktyg sköter exakta beräkningar och föreslagna ändringar.
4. Verktygsloopen är begränsad och använder `function_call` följt av `function_call_output` med matchande `call_id`, enligt aktuell OpenAI Responses API function-calling-dokumentation.
5. `store: false` används i anropet för att följa Klirrs Privacy-design.

## Verktyg

Läsverktyg hämtar sammanfattade totals, Budgethälsa, marginaldetaljer, inkomster, fasta utgifter, rörlig Budget, kategoridetaljer, granskningsstatus, hushållsprofil, Budgetkomplettering, capabilities och samtalstillstånd. De returnerar inte råa transaktionsrader.

Planeringsverktyg kan förbereda rörlig Budget, krisbudget, inkomständring, scenario, Budget Checkup och navigation. De muterar aldrig `AppState`.

## Action boundary

En diskussion ska inte bli ett actionkort utan att användaren vill gå vidare. “Jag vill bara resonera”, “ändra inget” och “visa bara” blockerar actionkort. Tydliga uppdrag som “Sänk matbudgeten till 5 000” kan returnera ett validerat `BuddyProposedAction`, men ändringen kräver bekräftelse i Klirr.

## Lokal kontra AI

Lokalt läge är ärligt begränsat och märks med “Lokalt läge”. Det kan ge Budgetöversikt, marginalförklaring, Budgethälsa och vissa deterministiska förslag. Friare samtal kräver AI-aktivering och giltigt samtycke.

## Samtalsminne

Klirr sparar chatt historiskt som tidigare och lägger till en konservativ `BuddyConversationSummary` i Buddy-sessionen. Den innehåller topic, activeGoal, preferenser, etablerade fakta, beslut och eventuell öppen fråga. Den innehåller aldrig chain-of-thought eller hemligheter. “Ny konversation” rensar chatten och summary men bevarar Budget och actionhistorik.

## Begränsningar

Budget Buddy har inte webbsökning och ska inte hitta på aktuella skattesatser, lagar eller leverantörsvillkor. Modell väljs med `OPENAI_MODEL`; rekommendationen är en aktuell conversational-quality Responses API-modell som projektmiljön stödjer, med `gpt-4.1-mini` som verifierad fallback i denna kodbas.
