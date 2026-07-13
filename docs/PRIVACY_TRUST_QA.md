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


> Current product note: Klirr has no active paid tier. Legacy experiment data may remain in storage/export as archived or future-feature data, and all Budget Buddy AI uses the same summarized Privacy boundary.

## Issue #66 QA: Budget Buddy AI-aktivering

- Kontrollera att Hem visar Budget Buddy AI-kortet och att aktivering stannar på Hem utan `/api/budget-buddy`-anrop.
- Kontrollera att Buddy alltid visar `Lokalt läge`, `AI behöver aktiveras` eller `AI aktiv · sammanfattad kontext`.
- Skicka en Buddy-fråga i lokalt läge, aktivera i Buddy och verifiera en användarbubbla och ett fjärranrop.
- Stäng av AI i Sekretess och verifiera att Hem och Buddy direkt visar lokalt läge.
- Återkalla AI-samtycke och verifiera att tidigare accepterat record inte räcker om senaste matchande record är withdrawn.
- Ladda demo-data och verifiera att privacy preferences, samtycken och “Vad AI såg” finns kvar.
