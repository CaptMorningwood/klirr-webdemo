# Klirr – Developer Brief v1.0.1

## Produkt

Klirr är en privatekonomiapp som fokuserar på frågan: **Vad kostar mitt liv varje månad?**

Appen identifierar fasta fasta utgifter, rörlig plan, inkomster, interna överföringar och ekonomiskt utrymme framåt. Budget Buddy är en chattliknande ekonomikompis som förklarar siffror och guidar i appen.

## Nuvarande teknisk bas

- Vite + React + TypeScript
- Vercel-ready frontend
- Vercel API-routes för AI
- Supabase Auth/databas förberett
- Lokal demo fallback
- CSV-import med bankdetektion, kolumnmappning, förhandsgranskning och dublettkontroll
- LocalStorage för demo-läge
- Snapshot-lagring till Supabase för beta

## Viktiga filer

- `src/App.tsx` – huvudsakliga appen
- `src/lib/csvParsers.ts` – CSV/importlogik
- `src/lib/recurrenceEngine.ts` – återkommande-detektion
- `src/lib/budgetCalculator.ts` – budgetsummering
- `src/lib/budgetBuddy.ts` – lokal Budget Buddy fallback
- `src/components/AuthSyncPanel.tsx` – Supabase login/sync
- `src/services/supabaseClient.ts` – Supabase-klient
- `api/budget-buddy.js` – AI-chat endpoint
- `api/suggest-budget.js` – AI-budgetförslag endpoint
- `supabase/schema.sql` – databas/RLS

## Nästa tekniska steg

1. Bryt ut App.tsx i vy-komponenter.
2. Ersätt snapshot-sparning med strukturerad CRUD per tabell.
3. Lägg till servervalidering för importer.
4. Lägg till rate limiting på AI-endpoints.
5. Lägg till audit logg och export/radering som backend-funktioner.
6. Säkerhetsgranska RLS och datamodell.
