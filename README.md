# Klirr v1.0.2 beta foundation

Klirr hjälper användaren förstå vad livet kostar varje månad: månadens fasta utgifter, inkomster, rörlig plan, interna överföringar, scenarier och Budget Buddy.

Den här versionen kräver Clerk-inloggning innan Budgetdata visas. Clerk hanterar
Google och engångskod via e-post. Klirr använder ett separat permanent användar-ID
för Budgetdata och Supabase/PostgreSQL för identitetskoppling och molnsnapshots.

## Kör lokalt

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Deploy till Vercel

```bash
pnpm install --frozen-lockfile
pnpm build
```

Pusha till GitHub och koppla repot till Vercel.

## Miljövariabler

Kopiera `.env.example` till `.env.local` lokalt eller lägg in samma variabler i Vercel.

Se `.env.example` och
[`docs/infrastructure/CLERK_AUTH_RUNBOOK.md`](docs/infrastructure/CLERK_AUTH_RUNBOOK.md).
Hemliga Clerk- och Supabase-nycklar är endast servervariabler och får aldrig ha
prefixet `VITE_`.

## Clerk och Klirr-konto

1. Konfigurera en Clerk Development-instans för lokal/Test.
2. Aktivera endast Google och email verification code.
3. Lägg miljövariablerna från `.env.example` i rätt isolerad miljö.
4. Applicera den versionerade Supabase-migrationen.
5. Kör checklistan i
   [`docs/engineering/AUTHENTICATION_UAT.md`](docs/engineering/AUTHENTICATION_UAT.md).

Clerk-ID eller e-post används aldrig som produktägarnyckel. Servern verifierar
sessionen och mappar den till `app_users.id`. Klientens ägar-ID accepteras inte
som bevis. Äldre delad webbläsardata hålls dold tills användaren uttryckligen
väljer att koppla den till sitt inloggade konto.

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
