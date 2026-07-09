# Klirr v1.0.2 beta foundation

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

## Supabase och Klirr-konto

1. Skapa Supabase-projekt.
2. Kör `supabase/schema.sql` i SQL Editor.
3. Lägg in `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` i Vercel.
4. Aktivera Google som provider under Supabase Auth → Providers.
5. Aktivera Apple som provider under Supabase Auth → Providers.
6. Lägg till korrekta redirect URLs i Supabase Auth för lokal utveckling, Vercel Preview och produktion, till exempel:
   - `http://localhost:5173/**`
   - `https://*.vercel.app/**`
   - `https://din-produktionsdomän.se/**`
7. Kontrollera att samma miljövariabler finns i Vercel för Preview och Production:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Under Inställningar i Klirr blir panelen **Mitt Klirr-konto**. Där kan användare logga in med Google, Apple, magisk e-postlänk eller e-post/lösenord och sedan spara, hämta eller radera sin egen molnsnapshot. Utan Supabase-nycklar fungerar Klirr fortfarande i lokalt demo-läge.

## AI

Vercel API-routes finns i:

- `api/budget-buddy.js`
- `api/suggest-budget.js`

Om `OPENAI_API_KEY` saknas svarar de med lokal fallback. När nyckeln finns används server-side API-koppling, så nyckeln exponeras inte i frontend.

## Viktig status

Detta är inte en färdig fintech-produkt. Det är en beta foundation. Inför riktig lansering behövs juridisk GDPR-granskning, säkerhetsgranskning, tydlig integritetspolicy, driftansvar och mer robust backend.


## v1.0.1 npm registry fix

Denna version innehåller `.npmrc` som tvingar publika npm-registret och saknar `package-lock.json`, så Vercel inte försöker hämta paket från en intern byggmiljö.

## v1.0.2 Vercel pnpm fix

Denna version låser projektet till pnpm via `packageManager`, inkluderar `pnpm-lock.yaml` och godkänner `esbuild` i `pnpm-workspace.yaml`. Det gör att Vercel använder pnpm istället för att fastna i `npm install`.
