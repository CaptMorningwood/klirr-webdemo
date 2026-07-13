import type { AppState, DetectionResult, HouseholdProfile, Income, ManualExpense, VariablePlanItem } from '../types';
import { detectPossibleIncomeDuplicates } from './incomeReconciliation';

export type OnboardingPath = 'manual' | 'import' | 'explore';
export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SKIPPED' | 'IMPORT_PATH' | 'MANUAL_PATH' | 'COMPLETED';
export type OnboardingStep = 'start' | 'household' | 'income' | 'musts' | 'variablePlan' | 'import' | 'importReview' | 'confirmImport' | 'buddyCheckup' | 'summary' | 'finish';

export interface OnboardingState {
  status: OnboardingStatus;
  path?: OnboardingPath;
  currentStep: OnboardingStep;
  started: boolean;
  importCompleted: boolean;
  reviewCompleted: boolean;
  firstRunGuideDismissed?: boolean;
  skippedBuddyIntroShown?: boolean;
}

export const defaultOnboardingState: OnboardingState = {
  status: 'NOT_STARTED',
  currentStep: 'start',
  started: false,
  importCompleted: false,
  reviewCompleted: false,
  firstRunGuideDismissed: false,
};

export const manualSteps: OnboardingStep[] = ['start', 'household', 'income', 'musts', 'variablePlan', 'summary', 'finish'];
export const importSteps: OnboardingStep[] = ['start', 'household', 'import', 'importReview', 'confirmImport', 'buddyCheckup', 'summary', 'finish'];

export function normalizeOnboardingState(state?: Partial<OnboardingState>, onboardingCompleted = false): OnboardingState {
  const merged = { ...defaultOnboardingState, ...(state || {}) };
  if (onboardingCompleted) return { ...merged, status: 'COMPLETED', currentStep: merged.currentStep === 'start' ? 'finish' : merged.currentStep };
  if (!state) return merged;
  if (!merged.status || merged.status === 'NOT_STARTED') {
    if (merged.path === 'import' && merged.started) return { ...merged, status: 'IMPORT_PATH' };
    if (merged.path === 'manual' && merged.started) return { ...merged, status: merged.currentStep === 'start' ? 'IN_PROGRESS' : 'MANUAL_PATH' };
  }
  return merged;
}

export function migrateOnboardingState(input: { onboarding?: Partial<OnboardingState>; onboardingCompleted?: boolean }): OnboardingState {
  return normalizeOnboardingState(input.onboarding, input.onboardingCompleted);
}

export function shouldShowForcedWelcome(onboarding?: Partial<OnboardingState>, onboardingCompleted = false) {
  return normalizeOnboardingState(onboarding, onboardingCompleted).status === 'NOT_STARTED';
}

export function getOnboardingStepNumber(onboarding?: Partial<OnboardingState>) {
  const normalized = normalizeOnboardingState(onboarding);
  const steps = normalized.path === 'import' ? importSteps : manualSteps;
  const index = Math.max(0, steps.indexOf(normalized.currentStep));
  return { index, total: steps.length, label: `${index + 1} av ${steps.length}` };
}

export function buildManualOnboardingPatch(input: {
  existing: AppState;
  householdProfile: HouseholdProfile;
  incomes: Income[];
  musts: Array<{ label: string; amount: string | number; category: string }>;
  variablePlan: VariablePlanItem[];
}): Pick<AppState, 'householdProfile' | 'incomes' | 'manualExpenses' | 'variablePlan'> {
  const onboardingIncomeIds = new Set(input.existing.incomes.filter(i => i.id.startsWith('inc_onboarding')).map(i => i.id));
  const preservedIncomes = input.existing.incomes.filter(i => !onboardingIncomeIds.has(i.id));
  const nextIncomeLabels = new Set(input.incomes.map(i => i.label.trim().toLowerCase()).filter(Boolean));
  const incomes = [
    ...preservedIncomes.filter(i => !nextIncomeLabels.has(i.label.trim().toLowerCase())),
    ...input.incomes,
  ];
  const manualExpenses: ManualExpense[] = [
    ...input.existing.manualExpenses.filter(item => !item.id.startsWith('mx_onboarding')),
    ...input.musts.filter(item => Number(item.amount) > 0).map(item => ({
      id: `mx_onboarding_${item.label}_${item.category}`,
      label: item.label,
      amount: Math.round(Number(item.amount)),
      category: item.category || 'Fast kostnad',
      costType: 'fixed' as const,
      active: true,
      frequency: 'monthly' as const,
    })),
  ];
  return { householdProfile: input.householdProfile, incomes, manualExpenses, variablePlan: input.variablePlan };
}

export function onboardingWarnings(input: {
  state: AppState;
  totalIncome: number;
  fixedTotal: number;
  remainingAfterFixed: number;
  variablePlanTotal: number;
  remainingAfterPlan: number;
  detection?: DetectionResult;
}): string[] {
  const warnings: string[] = [];
  if (input.totalIncome <= 0) warnings.push('Inkomst saknas. Lägg till lön, Barnbidrag/support eller annan inkomst innan du litar på budgeten.');
  if (!input.state.householdProfile) warnings.push('Hushållsprofil saknas. Då blir mat, transport och vardag svårare att föreslå rimligt.');
  if (input.totalIncome > 0 && input.fixedTotal > input.totalIncome) warnings.push('Fasta utgifter är högre än inkomsten. Budgeten behöver justeras innan månaden känns trygg.');
  if (input.variablePlanTotal > input.remainingAfterFixed) warnings.push('Den rörliga planen är högre än det som finns kvar efter fasta utgifter.');
  if (input.remainingAfterPlan < 0) warnings.push('Marginalen efter planen är negativ.');
  const food = input.state.variablePlan.find(item => item.include !== false && /mat|hushåll/i.test(item.label))?.amount || 0;
  if (food > 0 && food < 1800) warnings.push('Matbudgeten ser väldigt låg ut. Dubbelkolla att den räcker för hushållet.');
  if (input.detection) {
    const duplicates = detectPossibleIncomeDuplicates(input.state.incomes, input.detection.recurring.filter(item => item.costTypeDefault === 'income').map(item => ({ id: item.id, label: item.label, amount: item.monthlyAmount, category: item.category, source: 'recurring' as const })));
    if (duplicates.length) warnings.push('Det kan finnas både manuell och importerad inkomst för samma pengar. Räkna inte samma lön två gånger.');
  }
  return warnings;
}

export const budgetBuddyCheckupMessage = 'Kör Budget Buddy Checkup för min onboarding-budget';
