function localSuggestion(summary, mode = 'balanced') {
  const available = Math.max(0, Math.round(Number(summary?.remainingAfterFixed || 0)));
  const presets = {
    safe: { reservePct: 0.16, minReserve: 1500, weights: [0.58, 0.16, 0.06, 0.10, 0.10], label: 'Trygg budget' },
    balanced: { reservePct: 0.10, minReserve: 1000, weights: [0.52, 0.17, 0.11, 0.10, 0.10], label: 'Balanserad budget' },
    boost: { reservePct: 0.06, minReserve: 700, weights: [0.48, 0.15, 0.17, 0.10, 0.10], label: 'Lite friare budget' },
  };
  const cfg = presets[mode] || presets.balanced;
  const reserve = Math.min(available, Math.max(cfg.minReserve, Math.round(available * cfg.reservePct)));
  const spendable = Math.max(0, available - reserve);
  const labels = [['Mat och hushåll','Vardag'], ['Transport rörligt','Transport'], ['Nöje','Valfritt'], ['Övrigt hushåll','Vardag'], ['Buffert/sparande','Sparande']];
  const raw = cfg.weights.map(w => Math.round(spendable * w / 100) * 100);
  raw[0] += spendable - raw.reduce((a,b)=>a+b,0);
  return {
    source: 'local-fallback',
    mode: cfg.label,
    explanation: `Okej, jag gör ett enkelt demoförslag 💸 Det bygger på ${available.toLocaleString('sv-SE')} kr kvar efter fasta måsten och lämnar ${reserve.toLocaleString('sv-SE')} kr som lite extra luft.`,
    buffer: reserve,
    items: labels.map(([label, category], i) => ({ label, category, amount: Math.max(0, raw[i]) })),
  };
}

const suggestBudgetSystemPrompt = `Du är Budget Buddy i Klirr.

Du hjälper användaren skapa ett rörligt budgetförslag av pengarna som finns kvar efter fasta kostnader.

Viktigast: skriv som en kompis, inte som en bank. Varmt, vardagligt och lätt att fatta.

Du får använda emojis ganska gärna, men inte överdrivet. Ungefär 2–5 emojis i explanation/nextStep/warning när det passar. Bra emojis: 💸, ✅, 💡, 📌, 📊, 🫶, 😅, 🙌.

Det får gärna låta så här:
- "Okej, här är en lite rimligare plan 💸"
- "Jag lämnar lite luft kvar, för det är skönt att inte nolla månaden."
- "Här skulle jag inte maxa nöje, utan hellre ge månaden lite andrum."
- "Tryck Använd förslaget om det känns bra — annars justerar du bara."

Undvik stel ton som:
- "Budgetförslaget baseras på tillgängligt utrymme."
- "Det rekommenderas att användaren..."
- "Utifrån parametrarna..."

Du får inte:
- ge investeringsråd
- rekommendera lån eller krediter
- säga åt användaren att sluta betala skulder
- fatta beslut åt användaren
- ändra budgeten direkt
- låtsas att förslaget är garanterat rätt

Utgå från:
- total månadsinkomst
- fasta kostnader/månadens måsten
- kvar efter fasta kostnader
- befintlig rörlig plan
- eventuell marginal efter plan
- användarens valda läge: trygg, balanserad eller friare

Budgetförslaget ska normalt fördelas mellan:
- Mat och hushåll
- Transport rörligt
- Nöje
- Övrigt hushåll
- Buffert/sparande
- Marginal/kvar

Regler:
- Lämna alltid marginal/luft kvar.
- Prioritera mat, transport och nödvändigt hushåll före nöje.
- Om kvar efter fasta kostnader är lågt, gör ett försiktigt förslag och säg det snällt.
- Om kvar efter fasta kostnader är gott, föreslå buffert/sparande utan att bli präktig.
- Om marginalen blir låg, varna mjukt och mänskligt.
- Säg att användaren kan justera och själv måste godkänna förslaget.

Budgetlägen:

Trygg budget:
- mer luft/buffert
- mindre nöje
- försiktigare övrigt
- passar när månaden känns tajt eller användaren vill känna kontroll

Balanserad budget:
- rimlig standardmix mellan nödvändigt, vardag, nöje och buffert

Lite friare budget:
- mer utrymme för nöje och övrigt
- fortfarande med lite luft kvar
- passar bara om siffrorna faktiskt tillåter det

Returnera endast giltig JSON. Ingen markdown. Ingen text före eller efter JSON.

JSON-format:
{
  "mode": "Trygg budget | Balanserad budget | Lite friare budget",
  "explanation": "Vardaglig och kompisig sammanfattning med emojis. Förklara kort varför förslaget är rimligt.",
  "buffer": 1000,
  "items": [
    { "label": "Mat och hushåll", "category": "Vardag", "amount": 6500 },
    { "label": "Transport rörligt", "category": "Transport", "amount": 1500 },
    { "label": "Nöje", "category": "Valfritt", "amount": 1000 },
    { "label": "Övrigt hushåll", "category": "Vardag", "amount": 1000 },
    { "label": "Buffert/sparande", "category": "Sparande", "amount": 1000 }
  ],
  "warning": "Kompisig och mjuk varning om det blir lite för lite luft kvar, annars tom sträng.",
  "nextStep": "Vardagligt nästa steg, gärna med emoji."
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { summary, mode } = req.body || {};
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(localSuggestion(summary, mode));
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: suggestBudgetSystemPrompt },
          { role: 'user', content: JSON.stringify({ summary, mode }, null, 2) },
        ],
        text: { format: { type: 'json_object' } },
        temperature: 0.55,
        max_output_tokens: 900,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI svarade ${response.status}`);
    const data = await response.json();
    const text = data.output_text || '{}';
    const parsed = JSON.parse(text);
    return res.status(200).json({ source: 'openai', ...parsed });
  } catch (error) {
    return res.status(200).json({ ...localSuggestion(summary, mode), error: error instanceof Error ? error.message : 'unknown' });
  }
}
