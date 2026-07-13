# Data-flow inventory – Privacy & Trust

Utkast för intern produkt/teknisk review. Ersätter inte juridisk granskning.

## Källor och lagring
- Manuell Budget: inkomster, manuella fasta/rörliga utgifter, hushållsprofil och rörlig plan sparas i `localStorage` AppState.
- Importerade kontoutdrag: rå filtext används bara i importflödet; importerade transaktionsobjekt sparas lokalt, inklusive användarägda råfält när parsern skapar dem.
- Supabase/auth/cloud sync: finns som integration i appen när miljö är konfigurerad; demo kan inte verifiera region/retention.
- Budget Buddy: chatthistorik sparas i AppState. AI får bara sammanfattad kontext via `src/lib/aiPrivacy.ts`.
- Premium/demo: planmetadata och entitlements sparas lokalt; Epic 2-workspacefält saknas i denna kodbas och exporteras därför som tomma demo-kategorier.
- Privacy: preferenser, versionsbaserade samtycken och AI-transparenslogg sparas lokalt.

## Destinationer
- Browser/device local storage: full lokal AppState.
- Cloud storage: endast via befintlig AuthSyncPanel/Supabase-stöd om konfigurerat.
- AI request payload: sammanfattade totals, Budgethälsa, completion, counts, hushållsräkning och säkra kategorietiketter.
- Downloads: JSON-export innehåller användarägd lokal data inklusive importerade transaktioner.
- Logs: AIContextLogEntry innehåller inte råa transaktioner eller full prompt.

## Delete/export coverage
Export omfattar lokal Budget, konton, transaktioner, regler/beslut, Buddy-meddelanden, samtycken, privacy settings och AI-logg. Radera importerat konto tar bort konto och transaktioner. Privacy Center skiljer mellan aktiv Budget, all lokal data, molndata och användarkonto. Cloud/user account deletion är ärligt markerat som ej tillgängligt i demo när backendstöd saknas.

## AI leakage audit
Tidigare Budget Buddy-kontext byggdes nära anropet och innehöll `summary`, `recurring` och andra objekt med transaktions-ID-risk. Nu går `/api/budget-buddy` genom `prepareSafeAiContext`, som har denylist-test för `transactions`, `raw`, `originalDescription`, `counterparty`, `bankReference`, `balanceAfter`, `txIds`, `importedRows` och `fileContent`.

- Premium 2.0: förbättringsplaner härleds från aktuell Budget; mål, snapshots, monitoreringsstatus och aktiveringsstatus sparas i AppState och ingår i exporten. Lokal Premium-analys skickas inte till AI.


> Current product note: Klirr has no active paid tier. Legacy experiment data may remain in storage/export as archived or future-feature data, and all Budget Buddy AI uses the same summarized Privacy boundary.

## Budget Buddy Conversation 2.0 dataflöde

AI request payload består av naturligt meddelande, recent messages, eventuell `BuddyConversationSummary`, requestMetadata och safeContext. SafeContext hålls för verktygskörning; modellen ser bara verktygsoutput för valda verktyg. Tool usage-loggen sparar verktygsnamn och datakategorier per fråga.
