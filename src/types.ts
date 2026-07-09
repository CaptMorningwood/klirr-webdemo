export type CostType = 'fixed' | 'variable' | 'transfer' | 'income' | 'excluded';
export type Frequency = 'monthly' | 'quarterly' | 'yearly' | 'irregular';
export type DecisionStatus = 'pending' | 'confirmed' | 'rejected';
export type TabId =
  | 'dashboard'
  | 'buddy'
  | 'plan'
  | 'importReview'
  | 'more'
  | 'musts'
  | 'variablePlan'
  | 'recurring'
  | 'review'
  | 'transfers'
  | 'transactions'
  | 'income'
  | 'rules'
  | 'scenarios'
  | 'import'
  | 'accounts'
  | 'household'
  | 'settings';

export interface Account {
  id: string;
  name: string;
  bankLabel?: string;
  isOwn: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  originalDescription?: string;
  counterparty?: string;
  bankReference?: string;
  balanceAfter?: number;
  raw?: Record<string, unknown>;
  sourceBank?: string;
  importWarnings?: string[];
}

export interface Rule {
  id: string;
  matchText: string;
  category: string;
  costType: CostType;
  note?: string;
}

export interface Income {
  id: string;
  label: string;
  amount: number;
  frequency: Frequency;
  notes?: string;
}

export interface ManualExpense {
  id: string;
  label: string;
  amount: number;
  category: string;
  costType: 'fixed' | 'variable';
  active: boolean;
  frequency?: Frequency;
  note?: string;
  endsAt?: string;
}

export interface VariablePlanItem {
  id: string;
  label: string;
  amount: number;
  category: string;
  include: boolean;
}

export interface TransferMatch {
  id: string;
  debitTxId: string;
  creditTxId: string;
  confidence: number;
  reason: string;
}

export interface ReviewItem {
  id: string;
  type: 'amount_outlier' | 'duplicate' | 'low_confidence' | 'unusual_income' | 'possible_transfer' | 'import_warning' | 'possible_late_payment' | 'possible_one_off';
  description: string;
  amount: number;
  date?: string;
  note: string;
  txId?: string;
  recurringId?: string;
}

export interface RecurringExpense {
  id: string;
  normName: string;
  label: string;
  category: string;
  costTypeDefault: 'fixed' | 'variable' | 'income';
  frequency: Frequency;
  occurrences: number;
  monthlyAmount: number;
  meanAmount: number;
  minAmount: number;
  maxAmount: number;
  amountVaries: boolean;
  confidence: number;
  lastDate: string;
  txIds: string[];
  reason: string;
}

export interface RecurringDecision {
  status: DecisionStatus;
  costType?: 'fixed' | 'variable' | 'income';
  category?: string;
  monthlyAmountOverride?: number;
}

export interface TransferDecision {
  status: DecisionStatus;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  actions?: BuddyAction[];
  proposedAction?: BuddyProposedAction;
}

export type BuddyProposedAction =
  | {
      id: string;
      type: 'update_income';
      title: string;
      description: string;
      payload: {
        incomeId?: string;
        replaceMode?: 'add_new' | 'update_existing';
        label: string;
        amount: number;
        frequency: 'monthly';
        source?: 'manual' | 'buddy';
        notes?: string;
      };
      confirmLabel: string;
      cancelLabel: string;
      status: 'pending' | 'confirmed' | 'cancelled' | 'applied';
    }
  | {
      id: string;
      type: 'choose_income_to_update';
      title: string;
      description: string;
      payload: {
        suggestedAmount: number;
        suggestedLabel: string;
        grossMonthly?: number;
        estimatedNetMonthly?: number;
        candidateIncomes: Array<{ incomeId: string; label: string; amount: number }>;
        notes?: string;
      };
      confirmLabel?: string;
      cancelLabel: string;
      status: 'pending' | 'confirmed' | 'cancelled' | 'applied';
    }
  | {
      id: string;
      type: 'update_variable_plan';
      title: string;
      description: string;
      payload: {
        items: Array<{ id?: string; label: string; amount: number; category: string; include: boolean }>;
        marginLeft?: number;
        mode?: 'safe' | 'balanced' | 'free';
        notes?: string;
      };
      confirmLabel: string;
      cancelLabel: string;
      status: 'pending' | 'confirmed' | 'cancelled' | 'applied';
    };

export interface BuddyAction {
  label: string;
  tab?: TabId;
  scenarioOffIds?: string[];
  message?: string;
}

export type HouseholdType = 'single' | 'couple' | 'family' | 'shared' | 'other';
export type FoodAmbition = 'budget' | 'normal' | 'comfortable';
export type TransportNeed = 'low' | 'normal' | 'high';

export interface HouseholdProfile {
  adults: number;
  children: number;
  teens: number;
  pets?: number;
  householdType?: HouseholdType;
  foodAmbition?: FoodAmbition;
  transportNeed?: TransportNeed;
}

export type SubscriptionPlan = 'free' | 'pro';
export type SubscriptionStatus = 'inactive' | 'active' | 'trialing' | 'past_due';

export interface Entitlements {
  csvImport: boolean;
  recurringDetection: boolean;
  budgetBuddy: boolean;
  scenarios: boolean;
  export: boolean;
  cloudSync: boolean;
}

export interface BuddyActionHistoryEntry {
  id: string;
  actionId?: string;
  type: 'proposed' | 'rendered' | 'confirmed' | 'cancelled' | 'applied' | 'failed' | 'no_action_planned' | 'missing_info' | 'needs_user_choice';
  actionType?: string;
  message?: string;
  reason?: string;
  createdAt: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  rules: Rule[];
  incomes: Income[];
  manualExpenses: ManualExpense[];
  variablePlan: VariablePlanItem[];
  recurringDecisions: Record<string, RecurringDecision>;
  transferDecisions: Record<string, TransferDecision>;
  scenarioOff: string[];
  chatMessages: ChatMessage[];
  buddyActionHistory?: BuddyActionHistoryEntry[];
  onboardingCompleted: boolean;
  householdProfile?: HouseholdProfile;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  entitlements?: Entitlements;
}

export interface DetectionResult {
  transfers: TransferMatch[];
  recurring: RecurringExpense[];
  reviewItems: ReviewItem[];
}

export interface BudgetLine {
  id: string;
  label: string;
  amount: number;
  category: string;
  source: 'recurring' | 'manual' | 'variablePlan';
  confidence?: number;
  frequency?: Frequency;
}

export interface BudgetSummary {
  totalIncome: number;
  fixedTotal: number;
  variablePlanTotal: number;
  totalMonthlyPlan: number;
  remainingAfterFixed: number;
  remainingAfterPlan: number;
  fixedItems: BudgetLine[];
  variableItems: BudgetLine[];
  activeRecurring: BudgetLine[];
  incomeItems: BudgetLine[];
  warnings: string[];
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
}
