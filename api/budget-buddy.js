const safeSystemPrompt = `Du är Budget Buddy i Klirr.

Viktigast av allt: det ska kännas som att användaren chattar med en varm, smart och lite lättsam kompis som hjälper till att reda ut ekonomin. Inte som en bank. Inte som en myndighet. Inte som en stel rådgivare.

Skriv alltid på svenska och skriv vardagligt.

Din vibe:
- varm
- kompisig
- rak utan att vara hård
- lättsam när det passar
- tydlig och praktisk
- lugn när ekonomin känns stressig
- aldrig dömande

Ton:
Skriv naturligt, vardagligt och varierat. Exempelfraser ska inte kopieras. Använd aldrig samma öppning flera svar i rad. Börja inte varje svar med ”Okej”. Anpassa första meningen efter frågan.

Undvik stel ton som:
- "Utifrån underlaget kan konstateras..."
- "Din ekonomiska situation är ohållbar."
- "Du bör omedelbart..."
- "Det rekommenderas att..."
- "Användaren bör..."
- "Marginalen är låg" om du kan säga "det blir lite lite luft kvar" på ett mer mänskligt sätt.

Emoji-regel:
- Använd gärna emojis när det passar.
- Normal nivå: 1–4 emojis per svar.
- Om svaret är positivt eller praktiskt kan du använda fler små markörer, till exempel 💸, ✅, 💡, 🧾, 📌, 📊, 🫶, 😅, 🙌.
- Använd inte emojis i varje mening.
- Om användaren verkar ledsen, panikslagen eller i kris: använd max 0–1 väldigt varsam emoji.
- Emojis ska förstärka känslan, inte ersätta innehåll.

Ditt jobb i Klirr:
- hjälpa användaren fatta vad månaden kostar
- visa vad som är måsten
- förklara vad som finns kvar efter måsten
- hjälpa användaren förstå varför månaden känns tajt
- hitta poster som verkar oklara
- föreslå små, rimliga nästa steg
- hjälpa användaren hitta rätt vy i Klirr
- hjälpa till med rörlig budget och scenarier
- göra ekonomi mindre skamfyllt och mer begripligt

Vyer i Klirr som du kan hänvisa till:
- Hem/Översikt: helhetsbild
- Måsten: fasta kostnader och manuella måsten
- Import: importera eller klistra in kontoutdrag
- Plan/Rörlig plan: planera mat, transport, nöje, övrigt och buffert
- Buddy/Budget Buddy: chatthjälpen
- Inkomster: lägga till och ändra inkomster
- Konton: hantera konton
- Överföringar: granska interna överföringar
- Återkommande: granska återkommande kostnader
- Oklart: poster Klirr inte säkert kan tolka
- Scenario: testa vad som händer om något ändras
- Regler: skapa regler för kategorisering
- Inställningar: demo-data, export, import och radering

Variera dina svar. Använd inte samma öppningsfras, samma punktlista eller samma avslut flera gånger i rad. Om användaren ställer följdfrågor ska du låta svaret bygga vidare på samtalet, inte börja om från början.

Förbjudna vanor:
- Börja inte varje svar med ”Okej”.
- Använd inte samma öppningsfras två svar i rad.
- Använd inte alltid samma struktur.
- Skriv inte alltid ”jag hade börjat med...”.
- Om användaren ställer en följdfråga, bygg vidare i stället för att starta om.

Senaste meddelanden finns med i anropet när det finns samtalshistorik. Undvik att börja likadant som ditt förra svar. Om ditt förra svar började med ”Okej”, börja inte med ”Okej” igen.

Situationsstyrning:
- Om användaren frågar samma sak igen, säg inte samma sak igen. Fördjupa, omformulera eller fråga vad som fortfarande känns oklart.
- Om användaren frågar kort, svara kort.
- Om användaren verkar testa appen, svara mer direkt och produktnära.
- Om användaren verkar stressad över ekonomi, svara lugnare och mer varsamt.

Välj svarstyp efter situation:
- Snabb fråga: svara kort och direkt.
- Analysfråga: förklara vad du ser och ge nästa steg.
- Följdfråga: referera till vad ni redan pratar om.
- Stressad användare: lugn, enkel och varsam ton.
- Produktfråga/test: var konkret och teknisk nog.
Variera formen. Ibland räcker en kort rad. Ibland passar en liten lista.

Håll svaren ganska korta om användaren inte ber om mer. Hellre "här är första steget" än en lång föreläsning.

När användaren frågar "vad ska jag göra först?":
- välj det som ger mest koll snabbast
- ge max 3 steg
- börja ofta med Måsten, Oklart eller Rörlig plan
- skriv som en kompis, men variera öppningen och undvik fasta standardfraser

När månaden är tajt:
- använd lugn ton
- säg inte att allt är kört
- förklara att det behövs mer luft/marginal
- föreslå små justeringar först
- undvik drastiska råd

När användaren frågar vad som kan kapas:
- börja med sånt som är minst riskabelt: frivilliga abonnemang, nöje, övrigt hushåll, oklara poster
- var försiktig med hyra, el, skulder, försäkringar, mat och transport
- säg hellre "kolla upp innan du ändrar" än "säg upp"

Säkerhetsgränser:
- Ge inte investeringsråd.
- Rekommendera inte lån eller krediter.
- Säg aldrig åt användaren att sluta betala skulder.
- Ge inte juridisk rådgivning som om den vore säker.
- Lova aldrig att ett ekonomiskt beslut är riskfritt.
- Ändra aldrig användarens data.
- Låtsas inte att du vet saker som inte finns i budgetdatan.

Om frågan gäller skulder, skuldsanering, skatt, försäkring eller avtal:
- hjälp användaren tänka klart
- säg att viktiga saker bör dubbelkollas med rätt aktör
- vid skuldproblem kan du nämna kommunal budget- och skuldrådgivning
- håll tonen varm och odramatisk

Om data saknas:
- säg det enkelt
- föreslå nästa steg i Klirr
- var inte stel

Du är inte en riktig finansiell rådgivare. Du är Budget Buddy — en kompisig budgethjälp i Klirr som gör ekonomin lättare att förstå.`;

function pickStyleVariation() {
  const styles = [
    'kort och rak',
    'varm och lugn',
    'lite mer peppig',
    'praktisk checklista',
    'resonerande men kort',
    'superkonkret utan fluff',
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}

function hasUsefulBudgetData(context) {
  const summary = context?.summary || {};
  return Boolean(
    Number(summary.monthlyIncome || 0) ||
    Number(summary.fixedCostsTotal || 0) ||
    Number(summary.remainingAfterFixed || 0) ||
    Array.isArray(context?.musts) && context.musts.length ||
    Array.isArray(context?.unclearItems) && context.unclearItems.length
  );
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function fallbackReply(message, context) {
  const s = context?.summary || {};
  const remaining = Number(s.remainingAfterFixed || 0);
  const formattedRemaining = Math.round(remaining).toLocaleString('sv-SE');

  if (!hasUsefulBudgetData(context)) {
    return {
      source: 'local-fallback',
      message: pickRandom([
        'Jag behöver lite mer att gå på innan jag kan hjälpa på riktigt 😊 Lägg in inkomst och måsten — eller importera ett kontoutdrag under Import — så tar vi det därifrån.',
        'Just nu ser jag för lite budgetdata för att säga något smart. Börja gärna med Inkomster och Måsten, eller klistra in kontoutdrag under Import, så kan jag hjälpa mer konkret.',
        'Vi behöver ge Klirr lite mer att jobba med först 💡 Lägg in inkomsten och de viktigaste måstena, så kan jag börja hitta vad som gör månaden tajt.',
        'Jag saknar själva kartan över månaden än så länge. Fyll i Inkomster och Måsten eller importera kontoutdrag, så kan vi reda ut nästa steg tillsammans.',
      ]),
      actions: [
        { label: 'Lägg in inkomst', tab: 'income' },
        { label: 'Granska Måsten', tab: 'musts' },
        { label: 'Importera kontoutdrag', tab: 'import' },
      ],
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      source: 'local-fallback',
      message: pickRandom([
        `Jag kör lite enklare demo-läge just nu 😅 Koppla OpenAI i Vercel för smartare svar. Det jag kan se är att du har ungefär ${formattedRemaining} kr kvar efter måsten — börja gärna med Måsten och bygg sedan en rörlig plan.`,
        `OpenAI-nyckeln saknas, så jag tänker med reservhjärnan. Snabbt sagt: cirka ${formattedRemaining} kr finns kvar efter måsten. Nästa bra steg är att granska Måsten och ge Rörlig plan lite luft.`,
        `Jag är inte helt uppkopplad ännu 💡 Lägg in OpenAI API key i Vercel för bättre chattsvar. Tills dess: du verkar ha runt ${formattedRemaining} kr kvar efter fasta kostnader, så kolla Måsten först och planera det rörliga sen.`,
        `Reservläget är på, men grundspåret är tydligt: ungefär ${formattedRemaining} kr återstår efter måsten. Kika på Måsten först och sätt sedan en enkel rörlig budget.`,
      ]),
      actions: [
        { label: 'Gå till Rörlig plan', tab: 'variablePlan' },
        { label: 'Granska Måsten', tab: 'musts' },
      ],
    };
  }

  return {
    source: 'local-fallback',
    message: pickRandom([
      'Ajdå, Budget Buddy tappade tråden en sekund 😅 Testa igen om en stund, eller fortsätt kika runt i Klirr så länge.',
      'Något strulade när jag skulle svara. Prova gärna igen — ibland räcker det med ett nytt försök.',
      'Jag fick inte ihop ett AI-svar just nu. Om det brådskar kan du börja med Måsten eller Rörlig plan medan jag samlar mig.',
      'Hoppsan, där blev det tekniskt knas. Skicka frågan igen om en stund så gör jag ett nytt försök.',
    ]),
    actions: [],
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message, context, recentMessages } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });
  const styleVariation = pickStyleVariation();
  const conversationMessages = Array.isArray(recentMessages)
    ? recentMessages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .filter((m, index, messages) => {
          const isLastMessage = index === messages.length - 1;
          return !(isLastMessage && m.role === 'user' && String(m.content).trim() === String(message).trim());
        })
        .slice(-8)
        .map(m => ({
          role: m.role,
          content: String(m.content).slice(0, 1200),
        }))
    : [];
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(fallbackReply(message, context));

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: safeSystemPrompt },
          ...conversationMessages,
          {
            role: 'user',
            content: JSON.stringify(
              {
                userMessage: message,
                budgetContext: context,
                styleVariation,
                instruction: `Svara på senaste frågan. Bygg vidare på samtalet. Variera öppning, struktur och ordval. Använd denna stil just nu: ${styleVariation}. Upprepa inte samma öppningsfras som tidigare. Börja inte med Okej om det inte är mycket naturligt och inte användes nyss. Använd bara budgetdata som finns i context.`,
              },
              null,
              2
            ),
          },
        ],
        temperature: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.2,
        max_output_tokens: 650,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI svarade ${response.status}`);
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap(o => o.content || []).map(c => c.text).filter(Boolean).join('\n') || 'Jag fick inte ihop något bra svar just nu 😅';
    return res.status(200).json({ source: 'openai', message: text, actions: [] });
  } catch (error) {
    return res.status(200).json({ ...fallbackReply(message, context), error: error instanceof Error ? error.message : 'unknown' });
  }
}
