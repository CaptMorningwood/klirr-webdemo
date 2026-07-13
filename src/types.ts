import type { OnboardingState } from './lib/onboarding';
export type CostType = 'fixed' | 'variable' | 'transfer' | 'income' | 'excluded';
export type Frequency = 'monthly' | 'quarterly' | 'yearly' | 'irregular';
export type DecisionStatus = 'pending' | 'confirmed' | 'rejected';
export type TabId =
  | 'dashboard'
  | 'buddy'
  | 'premium'
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
  labelOverride?: string;
  frequencyOverride?: Frequency;
  note?: string;
}

export interface TransferDecision {
  status: DecisionStatus;
}

export interface ReviewDecision {
  status: DecisionStatus;
  note?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  actions?: BuddyAction[];
  proposedAction?: BuddyProposedAction;
}

export type BuddyActionRiskLevel = 'low' | 'medium' | 'high';
export interface BuddyActionPreview { before?: Array<{ label: string; amount?: number; note?: string }>; after?: Array<{ label: string; amount?: number; note?: string }>; impact?: Array<{ label: string; value: string | number; tone?: 'good' | 'neutral' | 'warning' | 'danger' }> }
type BuddyActionShared = { riskLevel?: BuddyActionRiskLevel; preview?: BuddyActionPreview; undoable?: boolean };

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
    } & BuddyActionShared
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
    } & BuddyActionShared
  | {
      id: string;
      type: 'update_variable_plan';
      title: string;
      description: string;
      payload: {
        items: Array<{ id?: string; label: string; amount: number; category: string; include: boolean }>;
        availableAfterFixed?: number;
        marginLeft?: number;
        mode?: 'safe' | 'balanced' | 'free' | 'crisis';
        notes?: string;
      };
      confirmLabel: string;
      cancelLabel: string;
      status: 'pending' | 'confirmed' | 'cancelled' | 'applied';
    } & BuddyActionShared
  | { id: string; type: 'create_rule'; title: string; description: string; payload: { matchText: string; category: string; costType: CostType; note?: string }; confirmLabel: string; cancelLabel: string; status: 'pending' | 'confirmed' | 'cancelled' | 'applied' } & BuddyActionShared
  | { id: string; type: 'move_recurring_item' | 'reject_recurring_item'; title: string; description: string; payload: { recurringId: string; label: string; from?: CostType; to?: CostType; category?: string }; confirmLabel: string; cancelLabel: string; status: 'pending' | 'confirmed' | 'cancelled' | 'applied' } & BuddyActionShared
  | { id: string; type: 'fix_duplicate_income'; title: string; description: string; payload: { incomeId: string; label: string; amount?: number; reason?: string }; confirmLabel: string; cancelLabel: string; status: 'pending' | 'confirmed' | 'cancelled' | 'applied' } & BuddyActionShared
  | { id: string; type: 'create_scenario' | 'apply_scenario_off_ids'; title: string; description: string; payload: { scenarioOffIds: string[]; label?: string; currentMargin?: number; scenarioMargin?: number }; confirmLabel: string; cancelLabel: string; status: 'pending' | 'confirmed' | 'cancelled' | 'applied' } & BuddyActionShared
  | { id: string; type: 'run_budget_checkup'; title: string; description: string; payload: { issues: Array<{ label: string; severity: 'info' | 'warning' | 'danger'; nextAction?: string; tab?: TabId; message?: string; proposedAction?: BuddyProposedAction }> }; confirmLabel: string; cancelLabel: string; status: 'pending' | 'confirmed' | 'cancelled' | 'applied' } & BuddyActionShared;

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
  premiumHub: boolean;
  improvementPlan: boolean;
  developmentTracking: boolean;
  smartMonitoring: boolean;
  budgetBuddyAdvanced: boolean;
  deepAnalysis: boolean;
  proactiveInsights: boolean;
  budgetHistory: boolean;
  budgetGoals: boolean;
  reminders: boolean;
  automaticReview: boolean;
  multipleBudgets: boolean;
  sharedBudget: boolean;
  versionHistory: boolean;
}

export interface PremiumGoal {
  id: string;
  workspaceId: string;
  title: string;
  reason: string;
  targetType: 'margin_ratio' | 'buffer' | 'fixed_share' | 'review_done' | 'budget_health';
  targetValue: number;
  currentValue: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
  nextStep?: string;
  destination?: TabId;
}

export interface PremiumSnapshot {
  id: string;
  workspaceId: string;
  createdAt: string;
  totalIncome: number;
  fixedTotal: number;
  variablePlanTotal: number;
  remainingAfterPlan: number;
  budgetHealthScore: number;
  note?: string;
}

export interface PremiumMonitoringState {
  enabled: boolean;
  lastRunAt?: string;
  nextRunHint?: string;
  dismissedFingerprints?: string[];
}

export interface PremiumActivationState {
  firstActivatedAt?: string;
  onboardingShown: boolean;
  dismissedAt?: string;
}

export interface PremiumImprovementOpportunity {
  id: string;
  type: string;
  title: string;
  explanation: string;
  priority: number;
  sourceReasonIds: string[];
  destination: TabId;
  relevantBudgetArea: string;
  estimatedMarginImpact: number;
  estimatedBudgetHealthImpact: number;
  confidence: 'low' | 'medium' | 'high';
  estimationNote: string;
  suggestedAction: string;
  suggestedBuddyMessage?: string;
}

export interface PremiumPlanAlternative {
  id: string;
  mode: 'safe' | 'balanced' | 'ambitious';
  label: string;
  summary: string;
  opportunities: string[];
  estimatedMargin: number;
  estimatedHealthDirection: string;
  tradeoffs: string[];
  affectedCategories: string[];
}

export interface PremiumValueSummary {
  opportunityCount: number;
  estimatedMonthlyMarginPotential: number;
  estimatedBudgetHealthPotential: number;
  topOpportunity?: PremiumImprovementOpportunity;
  reviewAreaCount: number;
  suggestedFirstGoal: string;
  currentGoalSummary: string;
  developmentSummary: string;
  monitoringSummary: string;
  strongestPositiveChange?: string;
  strongestNegativeChange?: string;
  opportunities: PremiumImprovementOpportunity[];
  alternatives: PremiumPlanAlternative[];
  basedOnMetricsHash: string;
}

export interface BuddyActionHistoryEntry {
  id: string;
  actionId?: string;
  type: 'proposed' | 'rendered' | 'confirmed' | 'cancelled' | 'applied' | 'undone' | 'failed' | 'no_action_planned' | 'missing_info' | 'needs_user_choice';
  actionType?: string;
  message?: string;
  reason?: string;
  createdAt: string;
  undoSnapshot?: Partial<Pick<AppState, 'incomes' | 'variablePlan' | 'rules' | 'recurringDecisions' | 'scenarioOff'>>;
  previousBudgetHealthScore?: number;
  newBudgetHealthScore?: number;
  budgetHealthReasons?: string[];
}

export interface BuddyConversationSummary {
  updatedAt: string;
  topic?: string;
  activeGoal?: string;
  userPreferences?: string[];
  establishedFacts?: string[];
  decisions?: string[];
  unresolvedQuestion?: string;
}

export interface BuddySession {
  conversationSummary?: BuddyConversationSummary;
  currentGoal?: 'increase_margin' | 'make_variable_plan' | 'fix_income' | 'review_musts' | 'find_savings' | 'crisis_budget';
  preferredStyle?: 'safe' | 'balanced' | 'flexible' | 'crisis';
  lastProposedActionId?: string;
  lastRejectedReason?: string;
  rememberedPriorities?: string[];
  lastDiscussedPlan?: Array<{ label: string; amount: number; category?: string }>;
}

export type ConsentDocumentType = 'privacy_policy' | 'terms' | 'ai_features' | 'analytics' | 'marketing';
export type ConsentStatus = 'accepted' | 'declined' | 'withdrawn';
export interface ConsentRecord {
  id: string;
  type: ConsentDocumentType;
  documentVersion: string;
  status: ConsentStatus;
  decidedAt: string;
  source: 'onboarding' | 'settings' | 'migration';
  locale?: string;
}
export interface PrivacyPreferences {
  aiEnabled: boolean;
  optionalAnalyticsEnabled: boolean;
  marketingEnabled: boolean;
  privacyCenterSeenAt?: string;
  lastExportAt?: string;
}
export interface AIContextLogEntry {
  id: string;
  createdAt: string;
  purpose: string;
  requestType: string;
  workspaceId?: string;
  summaryFields: Record<string, unknown>;
  warningsIncluded: string[];
  dataCategories: string[];
  containsRawTransactions: false;
  destinationLabel: string;
  retentionExpiresAt?: string;
  outcome: 'prepared' | 'sent' | 'blocked' | 'failed';
  failureReason?: string;
}

export interface BudgetMetricSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  budgetHealthScore: number;
  totalIncome: number;
  fixedTotal: number;
  variableTotal: number;
  margin: number;
  lifeCost: number;
}

export type BudgetGoalType = 'budget_health' | 'margin_amount' | 'margin_ratio' | 'buffer_amount' | 'reduce_fixed_expenses';
export interface BudgetGoal {
  id: string;
  type: BudgetGoalType;
  label: string;
  targetValue: number;
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
  dueDate?: string;
}

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  dueAt: string;
  recurrence: 'none' | 'weekly' | 'monthly';
  status: 'active' | 'completed' | 'dismissed';
  relatedArea?: string;
}

export interface AutomaticReviewState {
  enabled: boolean;
  lastRunAt?: string;
  lastResult?: { summary: string; unclearCount: number; transferCount: number; recurringCount: number; duplicateIncomeWarnings: number };
  runIntervalDays: 7 | 14 | 30;
  lastKnownDetectionSignature?: string;
}

export interface SharedMember {
  id: string;
  name: string;
  email?: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'active' | 'simulated_invite';
}

export interface BudgetWorkspaceMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  members: SharedMember[];
  archived?: boolean;
}

export interface BudgetWorkspaceData {
  accounts: Account[];
  transactions: Transaction[];
  rules: Rule[];
  incomes: Income[];
  manualExpenses: ManualExpense[];
  variablePlan: VariablePlanItem[];
  recurringDecisions: Record<string, RecurringDecision>;
  transferDecisions: Record<string, TransferDecision>;
  reviewDecisions?: Record<string, ReviewDecision>;
  scenarioOff: string[];
  chatMessages: ChatMessage[];
  buddyActionHistory?: BuddyActionHistoryEntry[];
  buddySession?: BuddySession;
  onboardingCompleted: boolean;
  onboarding?: OnboardingState;
  householdProfile?: HouseholdProfile;
  budgetMetricSnapshots?: BudgetMetricSnapshot[];
  budgetGoals?: BudgetGoal[];
  reminders?: Reminder[];
  automaticReview?: AutomaticReviewState;
  dismissedInsightKeys?: string[];
}

export interface RestorableBudgetVersion {
  id: string;
  workspaceId: string;
  createdAt: string;
  reason: string;
  metrics: BudgetMetricSnapshot;
  data: BudgetWorkspaceData;
  hash?: string;
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
  reviewDecisions?: Record<string, ReviewDecision>;
  scenarioOff: string[];
  chatMessages: ChatMessage[];
  buddyActionHistory?: BuddyActionHistoryEntry[];
  buddySession?: BuddySession;
  onboardingCompleted: boolean;
  onboarding?: OnboardingState;
  householdProfile?: HouseholdProfile;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  entitlements?: Entitlements;
  activeWorkspaceId?: string;
  premiumGoals?: PremiumGoal[];
  premiumSnapshots?: PremiumSnapshot[];
  premiumMonitoring?: PremiumMonitoringState;
  premiumActivation?: PremiumActivationState;
  privacyPreferences?: PrivacyPreferences;
  consentRecords?: ConsentRecord[];
  aiContextLog?: AIContextLogEntry[];
  activeBudgetId?: string;
  workspaces?: BudgetWorkspaceMetadata[];
  workspaceData?: Record<string, BudgetWorkspaceData>;
  budgetMetricSnapshots?: BudgetMetricSnapshot[];
  budgetGoals?: BudgetGoal[];
  reminders?: Reminder[];
  automaticReview?: AutomaticReviewState;
  budgetVersions?: RestorableBudgetVersion[];
  dismissedInsightKeys?: string[];
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
