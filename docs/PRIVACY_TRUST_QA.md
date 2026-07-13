# Privacy & Trust QA

Kör på desktop och 320/360/375/390/414/430 px.

1. Öppna Mer → Sekretess & data.
2. Verifiera lokal/cloud/AI-status och att okända värden är “Ej konfigurerat” eller “Kan inte verifieras”.
3. Försök Budget Buddy med AI av: blockerat, Budgeten kan fortfarande redigeras.
4. Aktivera AI-samtycke, skicka Buddy-fråga och öppna “Vad AI såg”.
5. Kontrollera att inga råa transaktionsrader eller denylist-fält finns.
6. Återkalla AI-samtycke och verifiera import, review, Budgethälsa och manuell Budget.
7. Exportera alla data, validera JSON, svenska tecken och counts.
8. Testa radera importerat konto, rensa aktiv Budget, all lokal data, molndata failure och användarkonto unsupported.
9. Öppna juridiska utkast och kontrollera placeholders.
10. Bekräfta ingen cookie banner och att analytics/marketing inte har aktiv toggle.
11. Växla Free/Premium demo om tillgängligt och kontrollera att samtycken inte ändras.

## Budget Buddy local/AI QA

- Med AI av: grundläggande Budget Buddy ska ge lokala svar och action cards utan att skapa samtycke eller anropa `/api/budget-buddy`.
- När AI behövs: samtalet visar inline-kortet `Aktivera Budget Buddy AI ✨` med valen aktivera, fortsätt utan AI och läs hur AI används.
- Aktivering från Buddy ska sätta `aiEnabled`, lägga till aktuellt versionerat `ai_features`-samtycke och återuppta frågan en gång utan dubblettbubbla.
- `Fortsätt utan AI` och integritetslänken får inte skapa samtycke.
