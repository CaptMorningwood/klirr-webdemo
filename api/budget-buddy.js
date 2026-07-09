const safeSystemPrompt = `Du är Budget Buddy i Klirr.

Viktigast av allt: det ska kännas som att användaren chattar med en varm, smart och lite lättsam kompis som hjälper till att reda ut ekonomin. Inte som en bank. Inte som en myndighet. Inte som en stel rådgivare.

Skriv alltid på svenska och skriv vardagligt. Budget Buddy ska kännas som en bubblig och peppig budgetkompis: varm, tydlig och gärna lite glad i tonen. Använd emojis ofta, men naturligt. Målet är att användaren ska känna: ‘jag får hjälp av någon som både fattar ekonomi och hejar på mig’. Vid vanliga produkt- och budgetfrågor: våga vara glad, peppig och personlig. Vid ekonomisk stress: var fortfarande varm, men lugnare och mindre sprallig.

Din vibe:
- varm
- kompisig
- rak utan att vara hård
- lättsam när det passar
- tydlig och praktisk
- glad, peppig, trevlig och bubblig när läget passar
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

Emoji-policy:
Budget Buddy ska använda emojis ganska ofta, men naturligt.
Normalnivå: 2–6 emojis per svar.
Korta svar kan ha 1–3 emojis.
Längre svar kan ha 3–7 emojis.
Använd gärna 💸, ✅, 💡, 🧾, 📌, 📊, 🫶, 😅, 🙌, 🎄, 🎁, 🚌, 🍝, 🏠 när det passar.
Använd inte emoji i varje mening.
Använd inte samma emoji-kombination varje gång.
Om ämnet är stressigt, använd mjukare emojis och färre, men ta inte bort dem helt.
Emojis ska förstärka känslan, inte ersätta innehåll.

Kontrollfrågor:
Du får gärna ställa en kort kontrollfråga innan du ger ett skarpt råd om svaret beror på användarens preferens, hushåll, tidshorisont eller kommande utgifter.
Exempel:
- “Vill du att jag räknar tryggt eller lite mer flexibelt här?”
- “Ska jag anta att julklappar ska in i budgeten redan nu?”
- “Är målet att överleva månaden, bygga buffert eller hitta pengar till något särskilt?”
- “Vill du att jag räknar på hela hushållet eller bara din del?”

Men:
- Ställ inte kontrollfrågor hela tiden.
- Om du kan ge ett rimligt preliminärt svar, ge först ett kort svar och avsluta med en fråga.
- Max 1 kontrollfråga per svar, om användaren inte uttryckligen vill resonera mer.

Proaktiv budgethjälp:
Om datum eller månad finns i context, tänk på kommande säsongskostnader.
Exempel:
- julklappar och decemberkostnader inför höst/vinter
- skolstart inför augusti/september
- semester/sommar inför maj–juli
- vinterkläder inför höst
- bilkostnader om bilen nämns
- födelsedagar om användaren nämnt barn/familj
Du får nämna detta som en försiktig fråga, inte som ett krav.
Exempel:
“Nu när julen närmar sig lite längre fram — vill du lägga undan en liten rad för julklappar redan nu? 🎁”

Exempel på typ av beteende, kopiera inte formuleringarna exakt:
- Om användaren frågar om budgetförslag i juli/augusti: nämn försiktigt semester/skolstart om relevant.
- Om det är höst: fråga om julklappar eller vinterkostnader ska planeras.
- Om hushållsprofil finns: använd den i resonemanget.
- Om marginalen är låg: fråga om användaren vill prioritera buffert eller vardagsluft.

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
- Du får föreslå ändringar i Klirr, men aldrig påstå att ändringen är genomförd förrän användaren har bekräftat och appen har applicerat den.
- När du föreslår en ändring: sammanfatta exakt vad som ändras, fråga om användaren vill genomföra det, föreslå max en ändring åt gången och säg aldrig 'jag har uppdaterat' före bekräftelse.
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


function uid(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function round100(n) { return Math.round(n / 100) * 100; }
function estimateNet(gross, taxRate = 0.32) { return round100(Number(gross) * (1 - taxRate)); }
function extractGrossSalary(message) {
  const text = String(message).toLowerCase().replace(/\s+/g, ' ');
  if (!/(brutto|lön|inkomst|efter skatt|netto)/i.test(text)) return null;
  const matches = [...text.matchAll(/(\d[\d\s]{3,})(?:\s*kr)?/g)].map(m => Number(m[1].replace(/\s/g, ''))).filter(n => n >= 10000 && n < 500000);
  return matches[0] || null;
}
function salaryTarget(incomes = []) {
  if (!Array.isArray(incomes) || incomes.length === 0) return { strategy: 'add_new' };
  const salaryWords = ['lön', 'lon', 'salary', 'arbete', 'arbetsgivare', 'månadsinkomst', 'manadsinkomst', 'jobb'];
  const supportWords = ['barnbidrag', 'bidrag', 'csn', 'pension', 'försäkringskassan', 'forsakringskassan', 'sjukpenning', 'föräldrapenning', 'foraldrapenning', 'vab'];
  const isSalary = income => salaryWords.some(word => String(income.label || '').toLowerCase().includes(word));
  const isSupport = income => supportWords.some(word => String(income.label || '').toLowerCase().includes(word));
  const nonSupport = incomes.filter(income => !isSupport(income));
  if (nonSupport.length === 0) return { strategy: 'add_new' };
  const candidates = nonSupport.filter(isSalary);
  if (candidates.length === 1) return { strategy: 'suggest_existing', income: candidates[0] };
  if (candidates.length > 1) return { strategy: 'needs_user_choice', candidates };
  if (incomes.length === 1 && nonSupport.length === 1) return { strategy: 'update_single', income: nonSupport[0] };
  return { strategy: 'needs_user_choice', candidates: nonSupport };
}
function collectIncomeCandidates(context) {
  const candidates = [];
  const seen = new Set();
  const add = income => {
    if (!income?.id || !income?.label) return;
    const key = `${income.id}::${income.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ id: String(income.id), label: String(income.label), amount: Number(income.amount || 0), frequency: income.frequency || 'monthly', source: income.source });
  };
  (Array.isArray(context?.incomes) ? context.incomes : []).forEach(income => add({ ...income, source: 'manual' }));
  const summaryItems = Array.isArray(context?.summary?.incomeItems) ? context.summary.incomeItems : Array.isArray(context?.incomeItems) ? context.incomeItems : [];
  summaryItems.forEach(add);
  return candidates;
}
function makeIncomeAction(message, context) {
  const gross = extractGrossSalary(message);
  if (!gross && /(lön|lon|brutto|efter skatt|netto|inkomst|tjänar|får ut)/i.test(message)) return { source: 'local-fallback', message: 'Vilken bruttolön vill du att jag räknar på? Skriv gärna till exempel “50 000 kr brutto” 🧾', actions: [] };
  if (!gross) return null;
  const net = estimateNet(gross);
  if (/(ändra inget|uppdatera inte|bara räkna|vill inte ändra)/i.test(message)) return { source: 'local-fallback', message: `Grovt räknat blir ${gross.toLocaleString('sv-SE')} kr brutto ungefär ${net.toLocaleString('sv-SE')} kr efter skatt om vi antar runt 32% skatt 💸 Jag ändrar inget i Klirr.`, actions: [] };
  const manualIncomes = Array.isArray(context?.incomes) ? context.incomes : [];
  const incomes = collectIncomeCandidates(context);
  const target = salaryTarget(incomes);
  const notes = `Grovt uppskattad från ${gross.toLocaleString('sv-SE')} kr brutto med 32% skatt. Exakt nettolön beror på kommun, skattetabell, ålder och avdrag.`;
  if (target.strategy === 'needs_user_choice') {
    const action = { id: uid('buddy_action'), type: 'choose_income_to_update', title: 'Välj inkomst att ändra', description: `Grovt räknat blir ${gross.toLocaleString('sv-SE')} kr brutto ungefär ${net.toLocaleString('sv-SE')} kr efter skatt. Vilken inkomst ska jag ersätta?`, payload: { suggestedAmount: net, suggestedLabel: 'Lön efter skatt', grossMonthly: gross, estimatedNetMonthly: net, candidateIncomes: target.candidates.map(income => ({ incomeId: income.id, label: income.label, amount: income.amount })), notes }, cancelLabel: 'Nej, låt allt vara', status: 'pending' };
    return { source: 'local-fallback', message: `${action.description} Jag vill inte råka ändra fel eller skapa en dubblett 💡`, actions: [], proposedAction: action };
  }
  const existing = target.income;
  if (existing && !manualIncomes.some(income => income.id === existing.id)) return { source: 'local-fallback', message: `Jag hittade “${existing.label}” som trolig lön, men den kommer från importerade bekräftade inkomster. Jag ändrar inte Barnbidrag eller andra stöd som workaround — uppdatera den importerade posten manuellt eller be mig lägga till en ny “Lön efter skatt”.`, actions: [] };
  const replaceMode = target.strategy === 'add_new' ? 'add_new' : 'update_existing';
  const label = existing?.label || 'Lön efter skatt';
  const action = { id: uid('buddy_action'), type: 'update_income', title: replaceMode === 'add_new' ? 'Lägg till inkomst' : 'Uppdatera inkomst', description: replaceMode === 'add_new' ? `Fält som ändras: Inkomst “${label}”. Lägg till cirka ${net.toLocaleString('sv-SE')} kr/mån.` : `Fält som ändras: Inkomst “${label}”. Ändra från ${Number(existing.amount || 0).toLocaleString('sv-SE')} kr till cirka ${net.toLocaleString('sv-SE')} kr/mån.`, payload: { incomeId: existing?.id, replaceMode, label, amount: net, frequency: 'monthly', source: 'buddy', notes }, confirmLabel: replaceMode === 'add_new' ? 'Ja, lägg till inkomsten' : `Ja, ändra ${label}`, cancelLabel: 'Nej, låt den vara', status: 'pending' };
  return { source: 'local-fallback', message: `Grovt räknat blir ${gross.toLocaleString('sv-SE')} kr brutto ungefär ${net.toLocaleString('sv-SE')} kr efter skatt om vi antar runt 32% skatt 💸 ${replaceMode === 'add_new' ? 'Vill du att jag lägger till den inkomsten?' : `Vill du att jag uppdaterar “${label}” till det?`}`, actions: [], proposedAction: action };
}

function variableBudgetIntent(message) {
  const text = String(message || '').toLowerCase();
  return /(rörlig(?:a)? plan(?:en)?|ny(?:\s+rörlig)?\s+plan|lägg upp en plan|lagg upp en plan|gör en plan|gor en plan|ändra planen|andra planen|justera planen|använd planen|anvand planen|kör på planen|kor pa planen|mer buffert|mer sparande|mindre mat|mer nöje|mer noje|fördela pengarna|fordela pengarna|planera det rörliga|vardagsbudget|tryggare.*(?:rörlig|plan|budget)|(?:rörlig|rörliga) budget|budgetförslag|budgetforslag)/i.test(text);
}
function variablePlanConfirmationIntent(message) {
  return /^(\s*)(ja[,! ]*)?(gör så|gor sa|kör på det|kor pa det|kör på den|kor pa den|lägg in den|lagg in den|använd den(?: planen)?|anvand den(?: planen)?|det låter bra|det later bra|låter bra|later bra|så kör vi|sa kor vi)(\s*[!.]*)?$/i.test(String(message || '').toLowerCase());
}
const variableCategoryAliases = [
  { label: 'Mat och hushåll', category: 'Mat', pattern: /mat(?:\s+och\s+hushåll)?|hushåll/i },
  { label: 'Transport rörligt', category: 'Transport', pattern: /transport(?:\s+rörligt)?|buss|bil|resor/i },
  { label: 'Nöje', category: 'Nöje', pattern: /nöje|noje/i },
  { label: 'Övrigt hushåll', category: 'Övrigt', pattern: /övrigt(?:\s+hushåll)?|ovrigt(?:\s+hushall)?/i },
  { label: 'Buffert/sparande', category: 'Buffert', pattern: /buffert|sparande/i },
];
function extractVariablePlanItemsFromText(text) {
  const source = String(text || '').replace(/\u00a0/g, ' ');
  const found = new Map();
  for (const alias of variableCategoryAliases) {
    const categorySource = alias.pattern.source;
    const before = new RegExp(`(?:${categorySource})[^0-9]{0,30}(?:runt|ca|cirka|på|pa|till)?\\s*(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*(?:kr|kronor)?`, 'i');
    const after = new RegExp(`(?:lägg|lagg|sätt|satt|ha)?\\s*(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*(?:kr|kronor)?\\s*(?:på|pa|till|i)?\\s*(?:${categorySource})`, 'i');
    const match = source.match(before) || source.match(after);
    if (!match) continue;
    const amount = Number(match[1].replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(amount) && amount >= 0 && amount < 100000) found.set(alias.label, { label: alias.label, amount: Math.round(amount), category: alias.category, include: true });
  }
  return [...found.values()];
}
function recentPlanText(recentMessages) {
  return Array.isArray(recentMessages) ? recentMessages.slice(-8).map(m => String(m?.content || '')).join('\n') : '';
}

function makeVariablePlanAction(message, context, recentMessages = []) {
  const historyText = recentPlanText(recentMessages);
  const explicitItems = extractVariablePlanItemsFromText(`${message}\n${historyText}`);
  const isFollowup = variablePlanConfirmationIntent(message) && (variableBudgetIntent(historyText) || explicitItems.length >= 3);
  if (!variableBudgetIntent(message) && explicitItems.length < 3 && !isFollowup) return null;
  const suggestion = context?.budgetSuggestion;
  const current = Array.isArray(context?.variablePlan) ? context.variablePlan : [];
  const items = explicitItems.length >= 3 ? explicitItems : (Array.isArray(suggestion?.items) && suggestion.items.length ? suggestion.items : current);
  if (!items.length) return null;
  return { source: 'local-fallback', message: 'Jag kan göra planen lite tryggare och mer buffertvänlig 💸 Här är ett tydligt förslag — inget ändras förrän du säger ja.', actions: [], proposedAction: { id: uid('buddy_action'), type: 'update_variable_plan', title: 'Använd ny rörlig plan', description: 'Ersätt den rörliga planen med det här förslaget. Inget ändras förrän du säger ja.', payload: { items: items.map(item => ({ id: item.id, label: item.label, amount: Math.max(0, Math.round(Number(item.amount || 0))), category: item.category || 'Rörligt', include: item.include !== false })), availableAfterFixed: Number(context?.summary?.remainingAfterFixed || 0), marginLeft: Number(suggestion?.marginLeft ?? Math.max(0, Number(context?.summary?.remainingAfterFixed || 0) - items.reduce((sum, item) => sum + Number(item.amount || 0), 0))), mode: 'safe', notes: suggestion?.note || 'Förslaget är beräknat deterministiskt av Klirr.' }, confirmLabel: 'Ja, använd planen', cancelLabel: 'Nej, behåll nuvarande', status: 'pending' } };
}
function deterministicActionReply(message, context, recentMessages = []) {
  return makeIncomeAction(message, context) || makeVariablePlanAction(message, context, recentMessages);
}

function pickStyleVariation() {
  const styles = [
    'varm och praktisk med några emojis',
    'peppig men tydlig',
    'lugn och stöttande',
    'kort men personlig',
    'resonerande med en kontrollfråga om det behövs',
    'kompisig och konkret',
  ];
  return styles[Math.floor(Math.random() * styles.length)];
}


function pickEmojiDensity() {
  const emojiDensities = ['normal', 'lite mer', 'varm men sparsam'];
  return emojiDensities[Math.floor(Math.random() * emojiDensities.length)];
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
        'Just nu ser jag för lite budgetdata för att säga något smart 😊 Börja gärna med Inkomster och Måsten, eller klistra in kontoutdrag under Import, så kan jag hjälpa mer konkret 💸',
        'Vi behöver ge Klirr lite mer att jobba med först 💡 Lägg in inkomsten och de viktigaste måstena, så kan jag börja hitta vad som gör månaden tajt.',
        'Jag saknar själva kartan över månaden än så länge 🧾 Fyll i Inkomster och Måsten eller importera kontoutdrag, så kan vi reda ut nästa steg tillsammans ✅',
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
        `Jag kör lite enklare hjärna just nu 😅 Men jag kan ändå hjälpa dig få koll: cirka ${formattedRemaining} kr finns kvar efter måsten. Börja med Måsten och Rörlig plan ✅`,
        `Jag är inte helt uppkopplad ännu 💡 Lägg in OpenAI API key i Vercel för bättre chattsvar. Tills dess: du verkar ha runt ${formattedRemaining} kr kvar efter fasta kostnader, så kolla Måsten först och planera det rörliga sen.`,
        `Reservläget är på 💡 men grundspåret är tydligt: ungefär ${formattedRemaining} kr återstår efter måsten. Kika på Måsten först och sätt sedan en enkel rörlig budget 💸`,
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
      'Något strulade när jag skulle svara 😅 Prova gärna igen — ibland räcker det med ett nytt försök 🙌',
      'Jag fick inte ihop ett AI-svar just nu 🧾 Om det brådskar kan du börja med Måsten eller Rörlig plan medan jag samlar mig ✅',
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
  const emojiDensity = pickEmojiDensity();
  const currentDate = req.body?.currentDate || new Date().toISOString();
  const currentMonth = Number(req.body?.currentMonth) || new Date(currentDate).getMonth() + 1;
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
  if (/(varför|varfor|hände inget|hande inget|dök ingen|dok ingen|uppdaterades inte|ändrades inte|andrades inte|gjorde du|uppdaterade du)/i.test(message)) {
    const last = Array.isArray(context?.buddyActionHistory) ? context.buddyActionHistory.at(-1) : null;
    const msg = last ? `Jag kollar min action-historik 🛠️ Senast såg jag: ${last.type}${last.reason ? ` — ${last.reason}` : ''}. Jag ändrar inget utan bekräftelse, och om flera inkomster finns behöver jag veta vilken som ska ändras.` : 'Jag kan inte se exakt vad som hände, men jag kan hjälpa dig felsöka steg för steg 🛠️ Om ingen ruta dök upp kan Klirr ha saknat tydlig lön, inkomst eller budgetcontext.';
    return res.status(200).json({ source: 'local-fallback', message: msg, actions: [] });
  }
  const deterministic = deterministicActionReply(message, context, conversationMessages);
  if (deterministic?.proposedAction) return res.status(200).json(deterministic);
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(deterministic || fallbackReply(message, context));

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
                recentMessages: conversationMessages,
                currentDate,
                currentMonth,
                styleVariation,
                emojiDensity,
                instruction: `Svara naturligt och varierat. Använd emojis tydligt men inte överdrivet. Våga ställa en kontrollfråga om ett bättre svar kräver användarens preferens eller tidshorisont. Om du kan ge ett preliminärt svar, gör det först och ställ sedan en kort fråga. Bygg vidare på samtalet och undvik malliga öppningar. Använd denna stil just nu: ${styleVariation}. Emoji-nivå just nu: ${emojiDensity}. Även vid sparsam nivå ska minst 1 emoji användas om svaret inte gäller allvarlig kris. Upprepa inte samma öppningsfras som tidigare. Börja inte med Okej om det inte är mycket naturligt och inte användes nyss. Använd bara budgetdata som finns i context.`,
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
    const postProcessedAction = makeVariablePlanAction(`${message}\n${text}`, context, conversationMessages);
    if (postProcessedAction?.proposedAction) return res.status(200).json({ source: 'openai', message: text, actions: [], proposedAction: postProcessedAction.proposedAction });
    return res.status(200).json({ source: 'openai', message: text, actions: [] });
  } catch (error) {
    return res.status(200).json({ ...fallbackReply(message, context), error: error instanceof Error ? error.message : 'unknown' });
  }
}
