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
