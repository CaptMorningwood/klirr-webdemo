# Deploy Klirr v1.0 till Vercel

1. Packa upp zippen.
2. Lägg filerna i roten av GitHub-repot.
3. Committa till main.
4. Vercel bygger automatiskt.
5. Lägg in miljövariabler i Vercel → Project Settings → Environment Variables:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
OPENAI_API_KEY
OPENAI_MODEL
```

6. Skapa Supabase-projekt och kör `supabase/schema.sql`.
7. Redeploya i Vercel efter att env vars lagts in.
8. Testa:
   - lokal demo-data
   - skapa konto
   - spara till molnet
   - hämta från molnet
   - Budget Buddy
   - Föreslå budget
