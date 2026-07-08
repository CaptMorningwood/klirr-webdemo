const safeSystemPrompt = `Du är Budget Buddy i Klirr, en svensk privatekonomisk coach. Var konkret, trygg och icke-dömande. Ge budgetvägledning, inte investeringsrådgivning, juridisk rådgivning eller beslut. Du får aldrig uppmana användaren att sluta betala skulder eller fatta beslut utan att kontrollera konsekvenser. Föreslå nästa steg i Klirr och be användaren bekräfta allt viktigt själv.`;

function fallbackReply(message, context) {
  const s = context?.summary || {};
  const remaining = Number(s.remainingAfterFixed || 0);
  if (!process.env.OPENAI_API_KEY) {
    return {
      source: 'local-fallback',
      message: `Budget Buddy är inte kopplad till riktig AI ännu. Utifrån datan jag fick: du har cirka ${Math.round(remaining).toLocaleString('sv-SE')} kr kvar efter månadens måsten. Börja med att kontrollera Måsten, lägg in aktuell inkomst och använd Rörlig plan för att sätta en budget som lämnar marginal.`,
      actions: [{ label: 'Gå till Rörlig plan', tab: 'variablePlan' }, { label: 'Granska Måsten', tab: 'musts' }],
    };
  }
  return { source: 'local-fallback', message: `Jag kunde inte nå AI-tjänsten just nu. Testa igen om en stund.`, actions: [] };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { message, context } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(fallbackReply(message, context));

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: safeSystemPrompt },
          { role: 'user', content: JSON.stringify({ message, context }, null, 2) },
        ],
        temperature: 0.4,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI svarade ${response.status}`);
    const data = await response.json();
    const text = data.output_text || data.output?.flatMap(o => o.content || []).map(c => c.text).filter(Boolean).join('\n') || 'Jag kunde inte skapa ett svar.';
    return res.status(200).json({ source: 'openai', message: text, actions: [] });
  } catch (error) {
    return res.status(200).json({ ...fallbackReply(message, context), error: error instanceof Error ? error.message : 'unknown' });
  }
}
