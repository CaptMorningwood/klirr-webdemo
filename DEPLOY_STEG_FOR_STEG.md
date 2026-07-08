# Publicera Klirr på Vercel – steg för steg

## Del A: Lägg projektet på GitHub

1. Gå till github.com och logga in.
2. Klicka på `+` uppe till höger.
3. Välj `New repository`.
4. Namn: `klirr-webdemo`.
5. Välj gärna `Private` om du inte vill att koden ska vara publik.
6. Klicka `Create repository`.
7. På repo-sidan: klicka `uploading an existing file`.
8. Packa upp ZIP-filen `klirr-webdemo-vercel-v0.8.2.zip` på datorn.
9. Dra in alla filer från den uppackade mappen till GitHub-uppladdningen.
10. Klicka `Commit changes`.

Viktigt: `package.json`, `index.html`, `vercel.json` och `src`-mappen ska ligga direkt i repots rot, inte inuti en extra undermapp.

## Del B: Koppla GitHub till Vercel

1. Gå till vercel.com och logga in.
2. Välj `Add New` → `Project`.
3. Välj ditt GitHub-repo `klirr-webdemo`.
4. Klicka `Import`.
5. Kontrollera inställningar:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. Klicka `Deploy`.

När bygget är klart får du en länk som slutar på `.vercel.app`.

## Del C: Testa

1. Öppna Vercel-länken på dator.
2. Klicka `Ladda demo-data`.
3. Testa flikar: Översikt, Importera, Måsten, Budget Buddy.
4. Öppna samma länk på iPhone.
5. Testa Importera → Klistra in CSV.

## Om något går fel

- Kontrollera att `package.json` ligger i roten.
- Kontrollera att `src/main.tsx` finns.
- Kontrollera att Vercel använder `npm run build` och `dist`.
- Testa att radera projektet i Vercel och importera igen om du råkat välja fel rotmapp.
