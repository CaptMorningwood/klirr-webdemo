# Incident and data request runbook

Utkast för drift. Ersätter inte juridisk/incident review.

- Exportförfrågan: guida till Sekretess & data → Exportera alla mina data; dokumentera om cloud-only data saknas.
- Raderingsförfrågan: skilj lokal data, molndata och användarkonto; rapportera partial failures.
- Misstänkt dataläcka: stoppa berört flöde, säkra logs, inventera källor/destinationer, eskalera juridiskt.
- Misslyckad cloud deletion: bevara lokal status och erbjud retry när säkert.
- Fel AI-payload: inaktivera AI, kontrollera `aiPrivacy` denylist/tester, informera berörda enligt review.
- Consent/version change: skapa ny dokumentversion och kräv ny acknowledgement utan att blockera manuell Budget i demo.
- Provider change: uppdatera processorlista, juridiska dokument, QA och användarcopy.
- Legal document update: versionera, sätt effective date och dokumentera review.
