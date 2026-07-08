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
          { role: 'system', content: 'Du är Budget Buddy i Klirr. Returnera endast JSON med mode, explanation, buffer och items. items ska ha label, category och amount. Ge försiktiga svenska budgetförslag baserat på kvar efter fasta kostnader.' },
          { role: 'user', content: JSON.stringify({ summary, mode }) },
        ],
        text: { format: { type: 'json_object' } },
        temperature: 0.2,
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
