function buildDeterministicSuggestion(summary, mode = 'balanced') {
  const available = Math.max(0, Math.round(Number(summary?.remainingAfterFixed || 0)));
  const labels = [
    ['Mat och hushåll', 'Vardag'],
    ['Transport rörligt', 'Transport'],
    ['Nöje', 'Valfritt'],
    ['Övrigt hushåll', 'Vardag'],
    ['Buffert/sparande', 'Sparande'],
  ];

  if (available <= 0) {
    return {
      source: 'deterministic',
      mode: 'Balanserad budget',
      explanation: 'Klirr hittar inget utrymme efter fasta måsten. Börja med att granska Måsten och inkomster innan du sätter en rörlig plan.',
      buffer: 0,
      safetyTotal: 0,
      items: labels.map(([label, category]) => ({ label, category, amount: 0 })),
      warning: 'Det finns inget positivt utrymme att fördela just nu.',
      nextStep: 'Granska Måsten och inkomster först, så kan du skapa en plan när det finns utrymme.',
    };
  }

  const lowSpace = available < 6000;
  const presets = {
    safe: {
      label: 'Trygg budget',
      percentages: lowSpace ? [50, 12, 3, 8, 17, 10] : [45, 12, 6, 10, 17, 10],
      note: lowSpace
        ? 'Tryggt förslag: utrymmet är lågt, så nöje hålls extra lågt och trygghetsdelen prioriteras.'
        : 'Tryggt förslag: mest buffert/sparande och marginal kvar, med låg nöjesdel och försiktig vardag.',
    },
    balanced: {
      label: 'Balanserad budget',
      percentages: lowSpace ? [48, 12, 6, 9, 15, 10] : [45, 13, 10, 12, 12, 8],
      note: lowSpace
        ? 'Balanserat förslag: fortfarande försiktigt eftersom utrymmet är lågt, men med lite mer vardagsutrymme än Trygg budget.'
        : 'Balanserat förslag: en mellanväg där vardag, nöje, buffert/sparande och marginal får plats.',
    },
    boost: {
      label: 'Lite friare budget',
      percentages: lowSpace ? [45, 11, 10, 11, 13, 10] : [43, 12, 17, 13, 9, 6],
      note: lowSpace
        ? 'Lite friare förslag: ger mest till nöje av lägena, men behåller marginal eftersom utrymmet är lågt.'
        : 'Lite friare förslag: mer till nöje och övrigt, men med lägst trygghetsdel av lägena.',
    },
  };
  const cfg = presets[mode] || presets.balanced;
  const amounts = cfg.percentages.slice(0, 5).map(percentage => Math.round((available * percentage) / 100 / 100) * 100);
  const targetMargin = Math.round((available * cfg.percentages[5]) / 100 / 100) * 100;
  const plannedTotal = amounts.reduce((sum, amount) => sum + amount, 0) + targetMargin;
  amounts[0] = Math.max(0, amounts[0] + available - plannedTotal);
  const buffer = Math.max(0, available - amounts.reduce((sum, amount) => sum + amount, 0));
  const safetyTotal = amounts[4] + buffer;

  return {
    source: 'deterministic',
    mode: cfg.label,
    explanation: `${cfg.note} Marginal kvar: cirka ${buffer.toLocaleString('sv-SE')} kr. Total trygghetsdel: cirka ${safetyTotal.toLocaleString('sv-SE')} kr.`,
    buffer,
    safetyTotal,
    items: labels.map(([label, category], index) => ({ label, category, amount: Math.max(0, amounts[index]) })),
    warning: lowSpace ? 'Utrymmet är lågt, så förslaget är extra försiktigt och lämnar ändå marginal.' : '',
    nextStep: 'Tryck Använd förslaget om det känns bra — annars justerar du bara raderna själv.',
  };
}

const suggestBudgetSystemPrompt = `Du är Budget Buddy i Klirr.

Skriv en kort, varm och vardaglig explanation för ett budgetförslag där siffrorna redan är bestämda av Klirrs kod.

Du får inte ändra, föreslå eller hitta på belopp. Siffrorna i budgetförslaget är låsta.

Förklara varför valt läge känns rimligt:
- Trygg budget betyder störst Buffert/sparande + Marginal kvar och lägst Nöje.
- Balanserad budget ligger mellan Trygg och Lite friare.
- Lite friare budget har mest Nöje och lägst Buffert/sparande + Marginal kvar.

Returnera endast giltig JSON. Ingen markdown. Ingen text före eller efter JSON.

JSON-format:
{
  "explanation": "Vardaglig och kompisig sammanfattning med emojis. Nämn marginal kvar och total trygghetsdel.",
  "warning": "Kompisig och mjuk varning om utrymmet är lågt, annars tom sträng.",
  "nextStep": "Vardagligt nästa steg, gärna med emoji."
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { summary, mode } = req.body || {};
  const suggestion = buildDeterministicSuggestion(summary, mode);
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(suggestion);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: suggestBudgetSystemPrompt },
          { role: 'user', content: JSON.stringify({ summary, mode, lockedSuggestion: suggestion }, null, 2) },
        ],
        text: { format: { type: 'json_object' } },
        temperature: 0.55,
        max_output_tokens: 500,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI svarade ${response.status}`);
    const data = await response.json();
    const text = data.output_text || '{}';
    const parsed = JSON.parse(text);
    return res.status(200).json({
      ...suggestion,
      source: 'openai-explanation',
      explanation: parsed.explanation || suggestion.explanation,
      warning: typeof parsed.warning === 'string' ? parsed.warning : suggestion.warning,
      nextStep: parsed.nextStep || suggestion.nextStep,
    });
  } catch (error) {
    return res.status(200).json({ ...suggestion, error: error instanceof Error ? error.message : 'unknown' });
  }
}
