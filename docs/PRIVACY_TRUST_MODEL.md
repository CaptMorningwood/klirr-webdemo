# Privacy & Trust model

Klirr ska låta användaren förstå, exportera och radera sin data. Modellen är ett produkt- och teknikunderlag, inte juridisk slutgranskning.

- Lokal först: Budget, import, Buddy-historik och privacy state finns i localStorage.
- Cloud: endast när befintlig auth/sync är konfigurerad; okända regioner/retention visas inte som verifierade.
- AI: av som standard. AI kräver separat samtycke och kan återkallas utan att Budgeten blockeras.
- AI boundary: `src/lib/aiPrivacy.ts` bygger sammanfattad kontext och stoppar råa transaktionsfält.
- Consent: versionerade records för policy/villkor/AI/analytics/marketing; optional defaults off. Analytics/marketing visas som används inte.
- Export: komplett lokal JSON med raw user-owned imports, men inga tokens eller hemligheter.
- Deletion: radera importerat konto, rensa aktiv Budget, radera all lokal data, radera molndata och radera användarkonto är skilda begrepp.
- Premium: nuvarande kodbas saknar flera Epic 2-fält; exporten reserverar kategorier och markerar simulerade/tomma data.
- Non-goals: ingen compliance-certifiering, ingen cookie banner utan tracking, ingen falsk cloud/account deletion.

- Premium 2.0: lokal förbättringsplan, utvecklingssnapshots och lokal monitorering kan köras utan AI; Budget Buddy+ följer samma AI-samtycke och sammanfattade kontextgräns som Budget Buddy.


> Current product note: Klirr has no active paid tier. Legacy experiment data may remain in storage/export as archived or future-feature data, and all Budget Buddy AI uses the same summarized Privacy boundary.

## Budget Buddy AI status och samtycke

Budget Buddy AI-status är härledd och sparas inte separat:

- `Lokalt läge`: AI-preferensen är av, även om ett historiskt accepterat AI-samtycke finns.
- `AI aktiv · sammanfattad kontext`: AI-preferensen är på och senaste relevanta consent-record för `ai_features` och aktuell AI-informationsversion är accepterad.
- `AI behöver aktiveras`: AI-preferensen är på men aktuellt giltigt AI-samtycke saknas eller har återkallats.

Aktivering från Hem, Budget Buddy och Sekretess/Inställningar använder samma domänhjälpare. Hjälparen normaliserar privacy state, sätter AI-preferensen till på och lägger bara till ett nytt accepterat consent-record när aktuellt giltigt samtycke saknas. Upprepade klick ska därför inte skapa dubbletter.

Avaktivering betyder “Stäng av AI”: den sätter `aiEnabled = false` men återkallar inte historiskt samtycke. Separat “Återkalla AI-samtycke” skapar ett withdrawn-record. Båda stoppar externa AI-anrop eftersom anrop kräver både påslagen preferens och aktuellt accepterat samtycke.

Om en Buddy-fråga blockeras av AI-status sparas frågan i sessionen så att aktivering i Buddy kan återuppta exakt samma fråga en gång utan en extra användarbubbla. Hem- och Settings-aktivering skickar aldrig en AI-förfrågan.

Demo-data ersätter Budget-/demo-innehåll men bevarar privacy preferences, consent records och AI-transparenslogg. Full lokal återställning kan återgå till inaktiv AI enligt initialt state.

## Budget Buddy verktygsprivacy

Budget Buddy Conversation 2.0 skickar inte hela Budgetkontexten som användartext till modellen. Servern tar emot en Privacy-säker kontext och modellen får bara relevanta sammanfattade delar via verktyg. “Vad AI såg” loggar verktygsnamn, datakategorier, fältsammanfattningar/counts och outcome, men inte råa transaktioner, dolda resonemang, systemprompt eller hemligheter.
