import { consumerGuidelines } from '../data/consumerGuidelines';
import type { FoodAmbition, HouseholdProfile, TransportNeed, VariablePlanItem } from '../types';

export type BudgetSuggestionMode = 'safe' | 'balanced' | 'boost';
export type GuidelineStatus = 'below' | 'near' | 'above' | 'far_above';

export interface CategoryCap {
  recommendedMin: number;
  recommendedTarget: number;
  recommendedMax: number;
  hardCap: number;
}

export interface FoodGuidelineComparison {
  referenceAmount: number;
  proposedAmount: number;
  difference: number;
  differencePct: number;
  status: GuidelineStatus;
  note: string;
}

export interface BudgetSuggestion {
  items: VariablePlanItem[];
  marginLeft: number;
  buffer: number;
  safetyTotal: number;
  explanationNotes: string[];
  note: string;
  categoryCaps: Record<string, CategoryCap>;
  clampedCategories: string[];
  overflowToSafety: number;
  guidelineComparison: { food: FoodGuidelineComparison };
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

function floor100(n: number) {
  return Math.max(0, Math.floor(n / 100) * 100);
}

export function getFoodReferenceAmount(profile?: HouseholdProfile) {
  const p = normalizeHouseholdProfile(profile);
  const exact = consumerGuidelines.food.referenceHouseholds.find(ref => ref.adults === p.adults && ref.teens === p.teens && ref.children === p.children);
  if (exact) return exact.monthlyAmount + (p.pets || 0) * consumerGuidelines.food.unitModel.pet;
  const model = consumerGuidelines.food.unitModel;
  return round100(p.adults * model.adult - Math.max(0, p.adults - 1) * (model.adult - model.secondAdult) + p.teens * model.teen + p.children * model.child + (p.pets || 0) * model.pet);
}

function compareFoodGuideline(referenceAmount: number, proposedAmount: number): FoodGuidelineComparison {
  const difference = proposedAmount - referenceAmount;
  const differencePct = referenceAmount > 0 ? difference / referenceAmount : 0;
  const status: GuidelineStatus = differencePct < -0.15 ? 'below' : Math.abs(differencePct) <= 0.2 ? 'near' : differencePct <= 0.5 ? 'above' : 'far_above';
  const note = status === 'below'
    ? 'Mat ligger under riktvärdet för hushållets storlek — det kan bli tajt.'
    : status === 'near'
      ? 'Mat ligger nära Konsumentverkets riktvärde för liknande hushåll.'
      : status === 'above'
        ? 'Mat ligger över riktvärdet, men inom rimligt spann för en bekvämare matnivå.'
        : 'Mat ligger ovanligt högt jämfört med riktvärdet och bör kontrolleras manuellt.';
  return { referenceAmount, proposedAmount, difference, differencePct, status, note };
}

export function getCategoryCaps({ available, householdProfile, mode }: { available: number; householdProfile?: HouseholdProfile; mode: BudgetSuggestionMode }): Record<string, CategoryCap> {
  const profile = normalizeHouseholdProfile(householdProfile);
  const units = Math.max(1, householdUnits(profile));
  const foodReference = getFoodReferenceAmount(profile);
  const foodFactor = mode === 'safe' ? 0.98 : mode === 'boost' ? 1.12 : 1.03;
  const transportBase = profile.transportNeed === 'low' ? 900 : profile.transportNeed === 'high' ? 3200 : 1800;
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

export function clampBudgetItemsToCaps(items: VariablePlanItem[], caps: Record<string, CategoryCap>) {
  const clampedCategories: string[] = [];
  const next = items.map(item => {
    const cap = caps[item.label];
    if (!cap || item.amount <= cap.hardCap) return item;
    clampedCategories.push(item.label);
    return { ...item, amount: cap.hardCap };
  });
  return { items: next, clampedCategories };
}

export function redistributeExcessToSafety(excess: number, mode: BudgetSuggestionMode) {
  const marginShare = mode === 'safe' ? 0.45 : mode === 'boost' ? 0.3 : 0.38;
  return { toMargin: round100(excess * marginShare), toSavings: Math.max(0, excess - round100(excess * marginShare)) };
}

export function suggestVariableBudget(input: {
  available: number;
  mode: BudgetSuggestionMode;
  householdProfile?: HouseholdProfile;
  currentVariablePlan?: VariablePlanItem[];
}): BudgetSuggestion {
  const available = Math.max(0, Math.round(Number(input.available || 0)));
  const profile = normalizeHouseholdProfile(input.householdProfile);
  const caps = getCategoryCaps({ available, householdProfile: profile, mode: input.mode });
  if (available <= 0) {
    const note = 'Klirr hittar inget utrymme efter fasta kostnader. Börja med att granska Måsten och inkomster innan du sätter en rörlig plan.';
    const guidelineComparison = { food: compareFoodGuideline(getFoodReferenceAmount(profile), 0) };
    return { marginLeft: 0, buffer: 0, safetyTotal: 0, explanationNotes: [note], note, categoryCaps: caps, clampedCategories: [], overflowToSafety: 0, guidelineComparison, items: LABELS.map(([label, category], idx) => ({ id: `vp_suggest_${idx}`, label, amount: 0, category, include: true })) };
  }

  const preset = {
    safe: { label: 'Trygg budget' },
    balanced: { label: 'Balanserad budget' },
    boost: { label: 'Lite friare budget' },
  }[input.mode];
  const lowSpace = available < caps['Mat och hushåll'].recommendedMin + caps['Transport rörligt'].recommendedMin + caps['Övrigt hushåll'].recommendedMin + 1000;
  const amounts = [
    caps['Mat och hushåll'].recommendedTarget,
    caps['Transport rörligt'].recommendedTarget,
    lowSpace ? caps.Nöje.recommendedMin : caps.Nöje.recommendedTarget,
    caps['Övrigt hushåll'].recommendedTarget,
    caps['Buffert/sparande'].recommendedTarget,
  ];
  let marginLeft = caps['Marginal kvar'].recommendedTarget;

  while (amounts.reduce((s, a) => s + a, 0) + marginLeft > available) {
    const order = [2, 4, 3, 1, 0];
    const idx = order.find(i => amounts[i] > (i === 0 ? caps['Mat och hushåll'].recommendedMin : i === 1 ? caps['Transport rörligt'].recommendedMin : i === 3 ? caps['Övrigt hushåll'].recommendedMin : 0));
    if (idx === undefined) {
      if (marginLeft > 0) marginLeft = Math.max(0, marginLeft - 100);
      else break;
    } else {
      const floor = idx === 0 ? caps['Mat och hushåll'].recommendedMin : idx === 1 ? caps['Transport rörligt'].recommendedMin : idx === 3 ? caps['Övrigt hushåll'].recommendedMin : 0;
      amounts[idx] = Math.max(floor, amounts[idx] - 100);
    }
  }

  let items: VariablePlanItem[] = LABELS.map(([label, category], idx) => ({ id: `vp_suggest_${input.mode}_${idx}`, label, amount: Math.min(amounts[idx], caps[label].hardCap), category, include: true }));
  let clampedCategories: string[] = LABELS.filter(([label], idx) => amounts[idx] > caps[label].hardCap).map(([label]) => label);
  let planned = items.reduce((s, item) => s + item.amount, 0);
  let excess = Math.max(0, available - planned - marginLeft);
  const overflowToSafety = excess;
  if (excess > 0) {
    const safety = redistributeExcessToSafety(excess, input.mode);
    items = items.map(item => item.label === 'Buffert/sparande' ? { ...item, amount: item.amount + safety.toSavings } : item);
    marginLeft += safety.toMargin;
  }
  const clamped = clampBudgetItemsToCaps(items, caps);
  items = clamped.items;
  clampedCategories = Array.from(new Set([...clampedCategories, ...clamped.clampedCategories]));
  planned = items.reduce((s, item) => s + item.amount, 0);
  marginLeft = Math.max(0, available - planned);
  const safetyTotal = (items.find(item => item.label === 'Buffert/sparande')?.amount || 0) + marginLeft;
  const foodAmount = items.find(item => item.label === 'Mat och hushåll')?.amount || 0;
  const guidelineComparison = { food: compareFoodGuideline(getFoodReferenceAmount(profile), foodAmount) };
  const capNote = clampedCategories.length ? ` ${clampedCategories.join(', ')} har begränsats till rimlighetstak.` : '';
  const overflowNote = overflowToSafety > 0 ? ` Extra utrymme (${overflowToSafety.toLocaleString('sv-SE')} kr) läggs på buffert/sparande och marginal i stället för att blåsa upp vardagskategorier.` : '';
  const note = `${preset.label}: ${lowSpace ? 'utrymmet är lågt, så mat/hushåll prioriteras och nöje hålls lågt. ' : ''}Hushåll: ${profile.adults} vuxna, ${profile.teens} tonåringar, ${profile.children} barn och ${profile.pets || 0} husdjur. Marginal kvar: cirka ${marginLeft.toLocaleString('sv-SE')} kr. Total trygghetsdel: cirka ${safetyTotal.toLocaleString('sv-SE')} kr.${capNote}${overflowNote}`;
  return { marginLeft, buffer: marginLeft, safetyTotal, note, categoryCaps: caps, clampedCategories, overflowToSafety, guidelineComparison, explanationNotes: [note, guidelineComparison.food.note, 'Siffrorna är deterministiskt beräknade i Klirr och OpenAI får bara formulera texten.'], items };
}
