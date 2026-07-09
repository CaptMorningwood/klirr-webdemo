function normalizeHouseholdProfile(profile) {
  const foodAmbition = profile?.foodAmbition === 'budget' || profile?.foodAmbition === 'comfortable' ? profile.foodAmbition : 'normal';
  const transportNeed = profile?.transportNeed === 'low' || profile?.transportNeed === 'high' ? profile.transportNeed : 'normal';
  return {
    adults: Math.max(1, Math.round(Number(profile?.adults || 1))),
    children: Math.max(0, Math.round(Number(profile?.children || 0))),
    teens: Math.max(0, Math.round(Number(profile?.teens || 0))),
    pets: Math.max(0, Math.round(Number(profile?.pets || 0))),
    foodAmbition,
    transportNeed,
    householdType: profile?.householdType || 'single',
  };
}


const consumerGuidelines = {
  source: 'Konsumentverket', year: 2026,
  notes: 'Riktvärden ska användas som ungefärlig jämförelse, inte absolut gräns.',
  food: { referenceHouseholds: [{ adults: 1, teens: 0, children: 0, monthlyAmount: 3600 }, { adults: 2, teens: 0, children: 2, monthlyAmount: 8440 }], unitModel: { adult: 3600, secondAdult: 2800, teen: 3100, child: 1800, pet: 250 } },
};
const round100 = n => Math.max(0, Math.round(n / 100) * 100);
const floor100 = n => Math.max(0, Math.floor(n / 100) * 100);
function getFoodReferenceAmount(profile) {
  const p = normalizeHouseholdProfile(profile);
  const exact = consumerGuidelines.food.referenceHouseholds.find(ref => ref.adults === p.adults && ref.teens === p.teens && ref.children === p.children);
  if (exact) return exact.monthlyAmount + (p.pets || 0) * consumerGuidelines.food.unitModel.pet;
  const m = consumerGuidelines.food.unitModel;
  return round100(p.adults * m.adult - Math.max(0, p.adults - 1) * (m.adult - m.secondAdult) + p.teens * m.teen + p.children * m.child + (p.pets || 0) * m.pet);
}
function compareFoodGuideline(referenceAmount, proposedAmount) {
  const difference = proposedAmount - referenceAmount;
  const differencePct = referenceAmount > 0 ? difference / referenceAmount : 0;
  const status = differencePct < -0.15 ? 'below' : Math.abs(differencePct) <= 0.2 ? 'near' : differencePct <= 0.5 ? 'above' : 'far_above';
  const note = status === 'below' ? 'Mat ligger under riktvärdet för hushållets storlek — det kan bli tajt.' : status === 'near' ? 'Mat ligger nära Konsumentverkets riktvärde för liknande hushåll.' : status === 'above' ? 'Mat ligger över riktvärdet, men inom rimligt spann för en bekvämare matnivå.' : 'Mat ligger ovanligt högt jämfört med riktvärdet och bör kontrolleras manuellt.';
  return { referenceAmount, proposedAmount, difference, differencePct, status, note };
}
function getCategoryCaps({ available, householdProfile, mode }) {
  const p = normalizeHouseholdProfile(householdProfile);
  const units = Math.max(1, p.adults + p.teens * 0.9 + p.children * 0.6 + (p.pets || 0) * 0.2);
  const foodReference = getFoodReferenceAmount(p);
  const foodFactor = mode === 'safe' ? 0.98 : mode === 'boost' ? 1.12 : 1.03;
  const transportBase = p.transportNeed === 'low' ? 900 : p.transportNeed === 'high' ? 3200 : 1800;
  const householdTarget = 900 + Math.max(0, units - 1) * 450;
  const funTarget = mode === 'safe' ? 1200 + units * 250 : mode === 'boost' ? 2200 + units * 650 : 1600 + units * 450;
  return {
    'Mat och hushåll': { recommendedMin: floor100(foodReference * 0.82), recommendedTarget: round100(foodReference * foodFactor), recommendedMax: round100(foodReference * 1.35), hardCap: round100(foodReference * 1.5) },
    'Transport rörligt': { recommendedMin: floor100(transportBase * 0.55), recommendedTarget: round100(transportBase), recommendedMax: round100(transportBase * 1.45), hardCap: round100(transportBase * 1.9) },
    'Nöje': { recommendedMin: mode === 'boost' ? 500 : 200, recommendedTarget: round100(funTarget), recommendedMax: round100(funTarget * 1.55), hardCap: round100(funTarget * 2.2) },
    'Övrigt hushåll': { recommendedMin: floor100(householdTarget * 0.55), recommendedTarget: round100(householdTarget), recommendedMax: round100(householdTarget * 1.45), hardCap: round100(householdTarget * 1.9) },
    'Buffert/sparande': { recommendedMin: round100(available * (mode === 'safe' ? 0.16 : mode === 'boost' ? 0.08 : 0.12)), recommendedTarget: round100(available * (mode === 'safe' ? 0.24 : mode === 'boost' ? 0.12 : 0.17)), recommendedMax: available, hardCap: available },
    'Marginal kvar': { recommendedMin: round100(available * (mode === 'safe' ? 0.10 : mode === 'boost' ? 0.04 : 0.07)), recommendedTarget: round100(available * (mode === 'safe' ? 0.14 : mode === 'boost' ? 0.06 : 0.09)), recommendedMax: available, hardCap: available },
  };
}
function buildDeterministicSuggestion(summary, mode = 'balanced', householdProfile) {
  const available = Math.max(0, Math.round(Number(summary?.remainingAfterFixed || 0)));
  const labels = [['Mat och hushåll', 'Vardag'], ['Transport rörligt', 'Transport'], ['Nöje', 'Valfritt'], ['Övrigt hushåll', 'Vardag'], ['Buffert/sparande', 'Sparande']];
  const profile = normalizeHouseholdProfile(householdProfile);
  const caps = getCategoryCaps({ available, householdProfile: profile, mode });
  if (available <= 0) return { source: 'deterministic', mode: 'Balanserad budget', explanation: 'Klirr hittar inget utrymme efter fasta måsten.', buffer: 0, marginLeft: 0, safetyTotal: 0, householdProfile: profile, categoryCaps: caps, clampedCategories: [], overflowToSafety: 0, guidelineComparison: { food: compareFoodGuideline(getFoodReferenceAmount(profile), 0) }, items: labels.map(([label, category]) => ({ label, category, amount: 0 })), warning: 'Det finns inget positivt utrymme att fördela just nu.', nextStep: 'Granska Måsten och inkomster först.' };
  const lowSpace = available < caps['Mat och hushåll'].recommendedMin + caps['Transport rörligt'].recommendedMin + caps['Övrigt hushåll'].recommendedMin + 1000;
  const label = mode === 'safe' ? 'Trygg budget' : mode === 'boost' ? 'Lite friare budget' : 'Balanserad budget';
  const amounts = [caps['Mat och hushåll'].recommendedTarget, caps['Transport rörligt'].recommendedTarget, lowSpace ? caps.Nöje.recommendedMin : caps.Nöje.recommendedTarget, caps['Övrigt hushåll'].recommendedTarget, caps['Buffert/sparande'].recommendedTarget];
  let marginLeft = caps['Marginal kvar'].recommendedTarget;
  while (amounts.reduce((s, a) => s + a, 0) + marginLeft > available) {
    const idx = [2, 4, 3, 1, 0].find(i => amounts[i] > (i === 0 ? caps['Mat och hushåll'].recommendedMin : i === 1 ? caps['Transport rörligt'].recommendedMin : i === 3 ? caps['Övrigt hushåll'].recommendedMin : 0));
    if (idx === undefined) { marginLeft = Math.max(0, marginLeft - 100); if (marginLeft === 0) break; } else amounts[idx] = Math.max(idx === 0 ? caps['Mat och hushåll'].recommendedMin : idx === 1 ? caps['Transport rörligt'].recommendedMin : idx === 3 ? caps['Övrigt hushåll'].recommendedMin : 0, amounts[idx] - 100);
  }
  let clampedCategories = [];
  let items = labels.map(([itemLabel, category], i) => { if (amounts[i] > caps[itemLabel].hardCap) clampedCategories.push(itemLabel); return { label: itemLabel, category, amount: Math.min(amounts[i], caps[itemLabel].hardCap) }; });
  let excess = Math.max(0, available - items.reduce((s, i) => s + i.amount, 0) - marginLeft);
  const overflowToSafety = excess;
  if (excess > 0) { const toMargin = round100(excess * (mode === 'safe' ? 0.45 : mode === 'boost' ? 0.3 : 0.38)); items = items.map(i => i.label === 'Buffert/sparande' ? { ...i, amount: i.amount + excess - toMargin } : i); marginLeft += toMargin; }
  items = items.map(i => i.amount > caps[i.label].hardCap ? (clampedCategories.push(i.label), { ...i, amount: caps[i.label].hardCap }) : i);
  marginLeft = Math.max(0, available - items.reduce((s, i) => s + i.amount, 0));
  const safetyTotal = (items.find(i => i.label === 'Buffert/sparande')?.amount || 0) + marginLeft;
  const foodAmount = items.find(i => i.label === 'Mat och hushåll')?.amount || 0;
  const guidelineComparison = { food: compareFoodGuideline(getFoodReferenceAmount(profile), foodAmount) };
  const explanation = `${label}: ${lowSpace ? 'utrymmet är lågt, så mat/hushåll prioriteras och nöje hålls lågt. ' : ''}Marginal kvar: cirka ${marginLeft.toLocaleString('sv-SE')} kr. Total trygghetsdel: cirka ${safetyTotal.toLocaleString('sv-SE')} kr. Extra utrymme läggs på buffert/sparande och marginal i stället för att blåsa upp vardagskategorier.`;
  return { source: 'deterministic', mode: label, explanation, note: explanation, buffer: marginLeft, marginLeft, safetyTotal, householdProfile: profile, categoryCaps: caps, clampedCategories: [...new Set(clampedCategories)], overflowToSafety, guidelineComparison, explanationNotes: [explanation, guidelineComparison.food.note, 'Siffrorna är deterministiskt beräknade i Klirr och OpenAI får bara formulera texten.'], items, warning: lowSpace ? 'Utrymmet är lågt för hushållets storlek.' : '', nextStep: 'Tryck Använd förslaget om det känns bra — annars justerar du bara raderna själv.' };
}


const suggestBudgetSystemPrompt = `Du är Budget Buddy i Klirr.

Skriv en kort, varm och vardaglig explanation för ett budgetförslag där siffrorna redan är bestämda av Klirrs kod.

Du får inte ändra, föreslå eller hitta på belopp. Siffrorna i deterministicSuggestion är låsta och appen använder alltid dessa deterministiska belopp.

Förklara varför valt läge känns rimligt:
- Trygg budget betyder störst Buffert/sparande + Marginal kvar och lägst Nöje.
- Balanserad budget ligger mellan Trygg och Lite friare.
- Lite friare budget har mest Nöje och lägst Buffert/sparande + Marginal kvar.
- Hushållsprofilen påverkar mat, hushåll och transport. Nämn gärna den om det hjälper förklaringen.

Returnera endast giltig JSON. Ingen markdown. Ingen text före eller efter JSON.

JSON-format:
{
  "explanation": "Vardaglig och kompisig sammanfattning med emojis. Nämn marginal kvar och total trygghetsdel.",
  "warning": "Kompisig och mjuk varning om utrymmet är lågt, annars tom sträng.",
  "nextStep": "Vardagligt nästa steg, gärna med emoji."
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { summary, mode, householdProfile } = req.body || {};
  const suggestion = buildDeterministicSuggestion(summary, mode, householdProfile);
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(suggestion);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: suggestBudgetSystemPrompt },
          { role: 'user', content: JSON.stringify({ summary, mode, householdProfile: suggestion.householdProfile, deterministicSuggestion: suggestion, guidelineComparison: suggestion.guidelineComparison, instruction: 'Skriv en kort mänsklig förklaring av budgetförslaget. Ändra inga belopp. Om något ligger högt/lågt jämfört med riktvärden, nämn det. Ställ max en kontrollfråga om det behövs.' }, null, 2) },
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
