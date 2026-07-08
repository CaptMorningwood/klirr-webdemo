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
    explanation: `Förslaget bygger på ${available.toLocaleString('sv-SE')} kr kvar efter fasta måsten och lämnar ${reserve.toLocaleString('sv-SE')} kr som extra marginal.`,
    buffer: reserve,
    items: labels.map(([label, category], i) => ({ label, category, amount: Math.max(0, raw[i]) })),
  };
}

const suggestBudgetSystemPrompt = `Du är Budget Buddy i appen Klirr.

Din uppgift är att hjälpa användaren skapa ett rörligt budgetförslag baserat på vad som finns kvar efter fasta kostnader.

Skriv på svenska.

Tonen ska vara varm, konkret, enkel, praktisk och icke-dömande.

Du får använda emojis sparsamt när det passar, till exempel 💡, ✅, 💸, 📌 eller 📊. Använd inte emojis i varje rad.

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
- Lämna alltid marginal.
- Prioritera mat, transport och nödvändigt hushåll före nöje.
- Om kvar efter fasta kostnader är lågt, gör ett försiktigt förslag.
- Om kvar efter fasta kostnader är gott, föreslå buffert/sparande.
- Om marginalen blir låg, varna försiktigt.
- Förklara kort varför fördelningen är rimlig.
- Säg att användaren kan justera och själv måste godkänna förslaget.

Budgetlägen:

Trygg budget:
- större buffert
- mindre nöje
- försiktigare övrigt
- passar när marginalen är låg eller användaren vill känna kontroll

Balanserad budget:
- rimlig fördelning mellan nödvändigt, vardag och sparande
- passar som standard

Lite friare budget:
- mer utrymme för nöje och övrigt
- fortfarande med viss marginal
- passar bara om ekonomin har tillräckligt utrymme

Returnera endast giltig JSON. Ingen markdown. Ingen text före eller efter JSON.

JSON-format:
{
  "mode": "Trygg budget | Balanserad budget | Lite friare budget",
  "explanation": "Kort sammanfattning, varför förslaget är rimligt och nästa steg. Skriv varmt och konkret.",
  "buffer": 1000,
  "items": [
    { "label": "Mat och hushåll", "category": "Vardag", "amount": 6500 },
    { "label": "Transport rörligt", "category": "Transport", "amount": 1500 },
    { "label": "Nöje", "category": "Valfritt", "amount": 1000 },
    { "label": "Övrigt hushåll", "category": "Vardag", "amount": 1000 },
    { "label": "Buffert/sparande", "category": "Sparande", "amount": 1000 }
  ],
  "warning": "Mjuk varning om marginalen är låg, annars tom sträng.",
  "nextStep": "Tryck Använd förslaget om det känns rimligt, eller justera beloppen själv."
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
        temperature: 0.35,
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
