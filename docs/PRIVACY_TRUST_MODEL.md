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
