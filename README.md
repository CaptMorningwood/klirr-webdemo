# Klirr Web Demo v0.7

Mobilanpassad webbdemo av Klirr för Vercel.

## Vad finns i den här versionen?

- Vite + React + TypeScript
- Mobilanpassat, färgglatt Klirr-UI
- Helt fiktiv demo-data
- Filimport av CSV/TXT
- Klistra-in-CSV som fallback
- Förhandsgranskning av import
- Egna konton och interna överföringar
- Återkommande utgifter
- Månadens måsten
- Manuella måsten
- Inkomster
- Rörlig plan
- Scenario
- Budget Buddy-chat
- Export av budgetrapport och transaktioner
- Lokal lagring i webbläsaren
- Radera all data

## Integritet i demo

Den här versionen skickar ingen budgetdata till server eller AI-tjänst. Data sparas i webbläsarens localStorage på den enhet som testar appen.

## Kör lokalt

```bash
npm install
npm run dev
```

Öppna sedan den lokala adressen som visas, oftast:

```text
http://localhost:5173
```

## Bygg för produktion

```bash
npm run build
```

Vite skapar då en `dist`-mapp.

## Deploy till Vercel

Rekommenderat sätt:

1. Skapa ett GitHub-repo.
2. Ladda upp allt innehåll i den här mappen till repot.
3. Gå till Vercel.
4. Välj Add New → Project.
5. Importera GitHub-repot.
6. Vercel bör känna igen Vite automatiskt.
7. Kontrollera:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
8. Klicka Deploy.

`vercel.json` finns med för att Single Page App-routing ska fungera.

## Viktigt före delning med testpersoner

Skriv gärna till testpersoner:

> Den här Klirr-demon körs lokalt i din webbläsare. Den skickar inte kontoutdrag till en server. Testa gärna med anonymiserad CSV först. Radera data under Inställningar när du är klar.
