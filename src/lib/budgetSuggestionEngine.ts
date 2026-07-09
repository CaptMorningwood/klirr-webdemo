import type { FoodAmbition, HouseholdProfile, TransportNeed, VariablePlanItem } from '../types';

export type BudgetSuggestionMode = 'safe' | 'balanced' | 'boost';

export interface BudgetSuggestion {
  items: VariablePlanItem[];
  marginLeft: number;
  buffer: number;
  safetyTotal: number;
  explanationNotes: string[];
  note: string;
}

const LABELS = [
  ['Mat och hushåll', 'Vardag'],
  ['Transport rörligt', 'Transport'],
  ['Nöje', 'Valfritt'],
  ['Övrigt hushåll', 'Vardag'],
  ['Buffert/sparande', 'Sparande'],
] as const;

export const defaultHouseholdProfile: Required<Pick<HouseholdProfile, 'adults' | 'children' | 'teens' | 'pets' | 'foodAmbition' | 'transportNeed'>> = {
  adults: 1,
  children: 0,
  teens: 0,
  pets: 0,
  foodAmbition: 'normal',
  transportNeed: 'normal',
};

export function normalizeHouseholdProfile(profile?: HouseholdProfile): HouseholdProfile {
  const foodAmbition: FoodAmbition = profile?.foodAmbition === 'budget' || profile?.foodAmbition === 'comfortable' ? profile.foodAmbition : 'normal';
  const transportNeed: TransportNeed = profile?.transportNeed === 'low' || profile?.transportNeed === 'high' ? profile.transportNeed : 'normal';
  return {
    ...profile,
    adults: Math.max(1, Math.round(Number(profile?.adults || defaultHouseholdProfile.adults))),
    children: Math.max(0, Math.round(Number(profile?.children || 0))),
    teens: Math.max(0, Math.round(Number(profile?.teens || 0))),
    pets: Math.max(0, Math.round(Number(profile?.pets || 0))),
    foodAmbition,
    transportNeed,
  };
}

export function householdUnits(profile?: HouseholdProfile) {
  const p = normalizeHouseholdProfile(profile);
  return p.adults * 1 + p.teens * 0.9 + p.children * 0.6 + (p.pets || 0) * 0.2;
}

function round100(n: number) {
  return Math.max(0, Math.round(n / 100) * 100);
}

export function suggestVariableBudget(input: {
  available: number;
  mode: BudgetSuggestionMode;
  householdProfile?: HouseholdProfile;
  currentVariablePlan?: VariablePlanItem[];
}): BudgetSuggestion {
  const available = Math.max(0, Math.round(Number(input.available || 0)));
  if (available <= 0) {
    const note = 'Klirr hittar inget utrymme efter fasta kostnader. Börja med att granska Måsten och inkomster innan du sätter en rörlig plan.';
    return { marginLeft: 0, buffer: 0, safetyTotal: 0, explanationNotes: [note], note, items: LABELS.map(([label, category], idx) => ({ id: `vp_suggest_${idx}`, label, amount: 0, category, include: true })) };
  }

  const profile = normalizeHouseholdProfile(input.householdProfile);
  const units = Math.max(1, householdUnits(profile));
  const foodGuides = {
    budget: { base: 3000, extra: 1700 },
    normal: { base: 4000, extra: 2400 },
    comfortable: { base: 5200, extra: 3100 },
  } satisfies Record<FoodAmbition, { base: number; extra: number }>;
  const foodNeed = foodGuides[profile.foodAmbition || 'normal'].base + Math.max(0, units - 1) * foodGuides[profile.foodAmbition || 'normal'].extra;
  const householdNeed = 900 + Math.max(0, units - 1) * 450;
  const transportNeed = profile.transportNeed === 'low' ? 900 : profile.transportNeed === 'high' ? 3000 : 1800;
  const lowSpace = available < Math.max(6500, foodNeed + householdNeed + transportNeed + 1500);
  const preset = {
    safe: { label: 'Trygg budget', funPct: lowSpace ? 0.03 : 0.06, savingPct: lowSpace ? 0.18 : 0.19, marginPct: lowSpace ? 0.13 : 0.11 },
    balanced: { label: 'Balanserad budget', funPct: lowSpace ? 0.06 : 0.10, savingPct: lowSpace ? 0.15 : 0.13, marginPct: lowSpace ? 0.08 : 0.08 },
    boost: { label: 'Lite friare budget', funPct: lowSpace ? 0.10 : 0.17, savingPct: lowSpace ? 0.12 : 0.09, marginPct: lowSpace ? 0.05 : 0.05 },
  }[input.mode] || { label: 'Balanserad budget', funPct: 0.10, savingPct: 0.13, marginPct: 0.08 };

  const marginTarget = round100(available * preset.marginPct);
  const amounts = [0, 0, 0, 0, 0];
  amounts[0] = round100(Math.min(foodNeed * (input.mode === 'safe' ? 0.95 : input.mode === 'boost' ? 1.05 : 1), available * 0.56));
  amounts[1] = round100(Math.min(transportNeed, available * (profile.transportNeed === 'high' ? 0.20 : 0.16)));
  amounts[3] = round100(Math.min(householdNeed, available * 0.16));
  amounts[2] = round100(available * preset.funPct);
  amounts[4] = round100(available * preset.savingPct);

  while (amounts.reduce((s, a) => s + a, 0) + marginTarget > available) {
    const order = [2, 3, 1, 4, 0];
    const idx = order.find(i => amounts[i] > 0);
    if (idx === undefined) break;
    amounts[idx] -= 100;
  }
  const marginLeft = Math.max(0, available - amounts.reduce((s, a) => s + a, 0));
  const safetyTotal = amounts[4] + marginLeft;
  const note = `${preset.label}: ${lowSpace ? 'utrymmet är lågt, så mat/hushåll prioriteras före nöje. ' : ''}Hushåll: ${profile.adults} vuxna, ${profile.teens} tonåringar, ${profile.children} barn och ${profile.pets || 0} husdjur. Marginal kvar: cirka ${marginLeft.toLocaleString('sv-SE')} kr. Total trygghetsdel: cirka ${safetyTotal.toLocaleString('sv-SE')} kr.`;
  return {
    marginLeft,
    buffer: marginLeft,
    safetyTotal,
    note,
    explanationNotes: [note, 'Siffrorna är deterministiskt beräknade i Klirr och OpenAI får bara formulera texten.'],
    items: LABELS.map(([label, category], idx) => ({ id: `vp_suggest_${input.mode}_${idx}`, label, amount: amounts[idx], category, include: true })),
  };
}
