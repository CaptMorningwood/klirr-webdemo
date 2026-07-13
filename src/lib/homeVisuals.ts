import type { BudgetLine } from '../types';

export type Segment = { key: string; label: string; value: number; share: number; width: number };

export function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function buildBudgetDistribution(input: { totalIncome: number; fixedTotal: number; variablePlanTotal: number; margin: number }) {
  const totalIncome = Math.max(0, Number(input.totalIncome) || 0);
  const fixed = Math.max(0, Number(input.fixedTotal) || 0);
  const variable = Math.max(0, Number(input.variablePlanTotal) || 0);
  const realMargin = Number(input.margin) || 0;
  const positiveMargin = Math.max(0, realMargin);
  const allocated = fixed + variable;
  const denominator = totalIncome > 0 ? totalIncome : Math.max(allocated + positiveMargin, 1);
  const overAllocated = totalIncome > 0 && allocated > totalIncome;
  const widthBase = overAllocated ? allocated || 1 : denominator;
  const segments: Segment[] = [
    { key: 'fixed', label: 'Fasta utgifter', value: fixed, share: totalIncome > 0 ? (fixed / totalIncome) * 100 : 0, width: allocated > 0 || positiveMargin > 0 ? (fixed / widthBase) * 100 : 0 },
    { key: 'variable', label: 'Rörliga utgifter', value: variable, share: totalIncome > 0 ? (variable / totalIncome) * 100 : 0, width: allocated > 0 || positiveMargin > 0 ? (variable / widthBase) * 100 : 0 },
    { key: 'margin', label: 'Marginal', value: positiveMargin, share: totalIncome > 0 ? (realMargin / totalIncome) * 100 : 0, width: overAllocated ? 0 : (positiveMargin / widthBase) * 100 },
  ].map(segment => ({ ...segment, width: clampPct(segment.width) }));
  return { segments, overAllocated, deficit: overAllocated ? allocated - totalIncome : Math.max(0, -realMargin) };
}

export function mustsStatus(fixedTotal: number, totalIncome: number) {
  if (totalIncome <= 0) return { share: 0, width: 0, text: 'Andel kan inte beräknas ännu' };
  const share = (fixedTotal / totalIncome) * 100;
  const text = share >= 90 ? 'Tar nästan hela inkomsten' : share > 65 ? 'Tar en stor del av inkomsten' : 'Lämnar gott om utrymme';
  return { share, width: clampPct(share), text };
}

const variableGroups = [
  { key: 'food', label: 'Mat och hushåll', pattern: /mat|hushåll|hushall|livsmedel|vardag/i },
  { key: 'transport', label: 'Transport', pattern: /transport|bil|buss|tåg|tag|pendel|resa/i },
  { key: 'fun', label: 'Nöje', pattern: /nöje|noje|fritid|valfritt|restaurang/i },
  { key: 'buffer', label: 'Buffert/sparande', pattern: /buffert|spar|sparande/i },
] as const;

export function groupVariableDistribution(items: BudgetLine[]) {
  const totals = new Map<string, { label: string; value: number }>();
  for (const group of variableGroups) totals.set(group.key, { label: group.label, value: 0 });
  totals.set('other', { label: 'Övrigt', value: 0 });
  for (const item of items) {
    const value = Math.max(0, Number(item.amount) || 0);
    const text = `${item.label} ${item.category}`;
    const group = variableGroups.find(candidate => candidate.pattern.test(text));
    const key = group?.key || 'other';
    const current = totals.get(key)!;
    current.value += value;
  }
  const total = Array.from(totals.values()).reduce((sum, group) => sum + group.value, 0);
  const order = ['food', 'transport', 'fun', 'other', 'buffer'];
  const segments = order.map(key => {
    const group = totals.get(key)!;
    return { key, label: group.label, value: group.value, share: total > 0 ? (group.value / total) * 100 : 0, width: total > 0 ? (group.value / total) * 100 : 0 };
  }).filter(segment => segment.value > 0);
  const largest = segments.slice().sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'sv'))[0];
  return { total, segments, largest };
}

export function marginSafety(margin: number, totalIncome: number) {
  const share = totalIncome > 0 ? (margin / totalIncome) * 100 : 0;
  const state = margin < 0 ? 'negative' : share < 5 ? 'thin' : share < 15 ? 'reasonable' : 'strong';
  const text = state === 'negative' ? 'Budgeten har underskott efter plan' : state === 'thin' ? 'Marginalen är mycket tunn' : state === 'reasonable' ? 'Marginalen är rimlig' : 'Marginalen är stark';
  return { share, width: clampPct(share), state, text };
}

export function incomeSourceDistribution(items: BudgetLine[]) {
  const groups = [
    { key: 'salary', label: 'Lön', pattern: /lön|lon|salary|arbete/i },
    { key: 'support', label: 'Stöd', pattern: /bidrag|support|csn|försäkring|forsakring|a-kassa|pension/i },
    { key: 'other', label: 'Övrigt', pattern: /.*/i },
  ];
  const totals = new Map(groups.map(group => [group.key, { label: group.label, value: 0 }]));
  for (const item of items) {
    const group = groups.find(candidate => candidate.pattern.test(`${item.label} ${item.category}`)) || groups[2];
    totals.get(group.key)!.value += Math.max(0, Number(item.amount) || 0);
  }
  const total = Array.from(totals.values()).reduce((sum, group) => sum + group.value, 0);
  const segments = groups.map(group => ({ key: group.key, label: group.label, value: totals.get(group.key)!.value, share: total > 0 ? totals.get(group.key)!.value / total * 100 : 0, width: total > 0 ? totals.get(group.key)!.value / total * 100 : 0 })).filter(segment => segment.value > 0);
  return { total, segments, shouldShow: segments.length >= 2 };
}
