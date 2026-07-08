import type { BudgetLine, BudgetSummary, DetectionResult, Income, ManualExpense, RecurringDecision, VariablePlanItem } from '../types';

function toMonthlyAmount(amount: number, frequency?: 'monthly' | 'quarterly' | 'yearly' | 'irregular') {
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'quarterly') return amount / 3;
  return amount;
}

function incomeMonthly(i: Income) {
  return toMonthlyAmount(i.amount, i.frequency);
}

export function calculateBudget(input: {
  detection: DetectionResult;
  recurringDecisions: Record<string, RecurringDecision>;
  incomes: Income[];
  manualExpenses: ManualExpense[];
  variablePlan: VariablePlanItem[];
  scenarioOff?: string[];
}): BudgetSummary {
  const off = new Set(input.scenarioOff || []);
  const manualIncomeTotal = input.incomes.reduce((sum, i) => sum + incomeMonthly(i), 0);
  const incomeItems: BudgetLine[] = input.incomes.map(i => ({
    id: i.id,
    label: i.label,
    amount: incomeMonthly(i),
    category: 'Inkomst',
    source: 'manual',
    frequency: i.frequency,
  }));
  const fixedItems: BudgetLine[] = [];
  const variableItems: BudgetLine[] = [];
  const activeRecurring: BudgetLine[] = [];
  let recurringIncomeTotal = 0;

  for (const r of input.detection.recurring) {
    const d = input.recurringDecisions[r.id];
    const defaultStatus = r.costTypeDefault === 'income' ? 'pending' : (r.confidence >= 70 ? 'confirmed' : 'pending');
    const status = d?.status || defaultStatus;
    if (status === 'rejected' || off.has(r.id)) continue;
    if (status !== 'confirmed') continue;
    const costType = d?.costType || r.costTypeDefault;
    const line: BudgetLine = {
      id: r.id,
      label: r.label,
      amount: d?.monthlyAmountOverride ?? r.monthlyAmount,
      category: d?.category ?? r.category,
      source: 'recurring',
      confidence: r.confidence,
      frequency: r.frequency,
    };
    activeRecurring.push(line);
    if (costType === 'income') {
      recurringIncomeTotal += line.amount;
      incomeItems.push(line);
    } else if (costType === 'fixed') {
      fixedItems.push(line);
    } else {
      variableItems.push(line);
    }
  }

  for (const mx of input.manualExpenses) {
    if (!mx.active || off.has(mx.id)) continue;
    const line: BudgetLine = { id: mx.id, label: mx.label, amount: toMonthlyAmount(mx.amount, mx.frequency), category: mx.category, source: 'manual', frequency: mx.frequency || 'monthly' }; 
    if (mx.costType === 'fixed') fixedItems.push(line);
    else variableItems.push(line);
  }

  for (const vp of input.variablePlan) {
    if (!vp.include || off.has(vp.id)) continue;
    variableItems.push({ id: vp.id, label: vp.label, amount: vp.amount, category: vp.category, source: 'variablePlan' });
  }

  const totalIncome = manualIncomeTotal + recurringIncomeTotal;
  const fixedTotal = fixedItems.reduce((s, x) => s + x.amount, 0);
  const variablePlanTotal = variableItems.reduce((s, x) => s + x.amount, 0);
  const totalMonthlyPlan = fixedTotal + variablePlanTotal;
  const remainingAfterFixed = totalIncome - fixedTotal;
  const remainingAfterPlan = totalIncome - totalMonthlyPlan;

  const warnings: string[] = [];
  if (totalIncome > 0 && fixedTotal / totalIncome > 0.65) warnings.push('Fasta kostnader tar mer än 65 % av inkomsten. Marginalen är känslig.');
  if (remainingAfterPlan < 0) warnings.push('Månadsplanen går minus med nuvarande inkomster.');
  if (input.detection.reviewItems.length > 0) warnings.push(`${input.detection.reviewItems.length} oklara poster behöver granskas.`);

  return { totalIncome, fixedTotal, variablePlanTotal, totalMonthlyPlan, remainingAfterFixed, remainingAfterPlan, fixedItems, variableItems, activeRecurring, incomeItems, warnings };
}
