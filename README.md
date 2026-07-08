# Klirr v1.0 beta foundation

Klirr hjälper användaren förstå vad livet kostar varje månad: månadens måsten, inkomster, rörlig plan, interna överföringar, scenarier och Budget Buddy.

Den här versionen är byggd för att fungera på två sätt:

1. **Demo/lokalt läge** – fungerar direkt utan Supabase eller OpenAI.
2. **Beta-ready läge** – förberedd för Supabase Auth/databas och riktig AI via Vercel API-routes.

## Kör lokalt

```bash
npm install
npm run dev
```

## Deploy till Vercel

```bash
npm install
npm run build
```

Pusha till GitHub och koppla repot till Vercel.

## Miljövariabler

Kopiera `.env.example` till `.env.local` lokalt eller lägg in samma variabler i Vercel.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Utan nycklar fungerar Klirr fortfarande som lokal demo.

## Supabase

1. Skapa Supabase-projekt.
2. Kör `supabase/schema.sql` i SQL Editor.
3. Lägg in `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` i Vercel.
4. Under Inställningar i Klirr kan användare skapa konto/logga in och spara/hämta molnsnapshot.

## AI

Vercel API-routes finns i:

- `api/budget-buddy.js`
- `api/suggest-budget.js`

Om `OPENAI_API_KEY` saknas svarar de med lokal fallback. När nyckeln finns används server-side API-koppling, så nyckeln exponeras inte i frontend.

## Viktig status

Detta är inte en färdig fintech-produkt. Det är en beta foundation. Inför riktig lansering behövs juridisk GDPR-granskning, säkerhetsgranskning, tydlig integritetspolicy, driftansvar och mer robust backend.
