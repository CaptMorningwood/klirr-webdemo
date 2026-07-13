import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { Account, AppState, BudgetGoal, BuddyAction, BuddyProposedAction, ChatMessage, CostType, DetectionResult, FoodAmbition, Frequency, HouseholdProfile, Income, ManualExpense, Reminder, RecurringDecision, ReviewDecision, Rule, TabId, Transaction, TransferDecision, TransportNeed, VariablePlanItem } from './types';
import { buildDemoData } from './data/demoData';
import { calculateBudget } from './lib/budgetCalculator';
import { defaultHouseholdProfile, householdUnits, normalizeHouseholdProfile, suggestVariableBudget, type BudgetSuggestionMode } from './lib/budgetSuggestionEngine';
import { buddySuggestionItems, initialBuddyMessage, makeBuddyReply, type BuddySuggestionGroup } from './lib/budgetBuddy';
import { knowledgeBaseCategories } from './data/recurringKnowledgeBase';
import { BANK_FORMATS, type BankKey, detectBank, guessMapping, parseCsvToRows, parseRowsWithMapping, readCsvTable, rowsToTransactions, transactionFingerprint } from './lib/csvParsers';
import { decodeTextFile } from './lib/fileDecoding';
import { supportedBankFormats } from './lib/bankFormats';
import { exportBudgetReport, exportTransactionsCsv } from './lib/exporters';
import { downloadText } from './lib/exporters';
import { fmt, fmtSigned, pct, todayIso, uid } from './lib/format';
import { categorize } from './lib/rulesEngine';
import { actionableCandidateReason, detectRecurring, getActionableRecurringCandidates } from './lib/recurrenceEngine';
import { detectPossibleIncomeDuplicates, getUnifiedIncomeItems } from './lib/incomeReconciliation';
import { countHandledReviewItems, getVisibleReviewItems } from './lib/reviewVisibility';
import { getEntitlements } from './lib/entitlements';
import { clearState, loadState, saveState } from './lib/storage';
import { ensureWorkspaceState } from './lib/premiumWorkspace';
import { appendBuddyActionHistory, applyBuddyActionWithResult, findPendingBuddyAction, undoLastBuddyAction } from './lib/buddyActions';
import { detectBuddyActionIntent } from './lib/buddyActionIntents';
import { estimateSwedishNetSalary } from './lib/taxEstimate';
import { deleteAccountAndRelatedData } from './lib/accountDeletion';
import { buildImportChecklist, buildImportResultSummary, importBuddyCleanupMessage, type ImportResultSummary } from './lib/importSummary';
import { budgetBuddyCheckupMessage, buildManualOnboardingPatch, getOnboardingStepNumber, normalizeOnboardingState, onboardingWarnings, shouldShowForcedWelcome, type OnboardingStep } from './lib/onboarding';
import { calculateBudgetCompletion } from './lib/budgetCompletion';
import { planBuddyAction } from './lib/buddyActionPlanner';
import { budgetHealthImprovementMessage, budgetHealthNextSteps, budgetHealthShortStatus, calculateBudgetHealth, explainBudgetHealthChange, splitBudgetHealthReasons } from './lib/budgetHealth';
import { buildBudgetDistribution, groupVariableDistribution, incomeSourceDistribution, marginSafety, mustsStatus, type Segment } from './lib/homeVisuals';
import { Card, Empty, MetricCard, PageTitle } from './components/UI';
import { AuthSyncPanel } from './components/AuthSyncPanel';
import { addConsentRecord, appendAiLog, buildDataExport, defaultPrivacyPreferences, hasAcceptedConsent, legalDocumentConfig, normalizePrivacyState, withdrawAiConsent } from './lib/privacy';
import { prepareSafeAiContext } from './lib/aiPrivacy';
import licenseArtifact from './generated/licenses.json';

const defaultVariablePlan: VariablePlanItem[] = [
  { id: 'vp_food', label: 'Mat och hushåll', amount: 6000, category: 'Vardag', include: true },
  { id: 'vp_transport', label: 'Bil/transport rörligt', amount: 2500, category: 'Transport', include: true },
  { id: 'vp_fun', label: 'Nöje', amount: 1500, category: 'Valfritt', include: true },
  { id: 'vp_household', label: 'Övrigt hushåll', amount: 2000, category: 'Vardag', include: true },
  { id: 'vp_savings', label: 'Sparande', amount: 1000, category: 'Sparande', include: true },
];

const initialState: AppState = {
  accounts: [],
  transactions: [],
  rules: [],
  incomes: [],
  manualExpenses: [],
  variablePlan: defaultVariablePlan,
  recurringDecisions: {},
  transferDecisions: {},
  reviewDecisions: {},
  scenarioOff: [],
  chatMessages: [initialBuddyMessage()],
  buddyActionHistory: [],
  onboardingCompleted: false,
  onboarding: normalizeOnboardingState(),
  householdProfile: { ...defaultHouseholdProfile, householdType: 'single' },
  subscriptionPlan: 'free',
subscriptionStatus: 'inactive',
  entitlements: getEntitlements('free', 'inactive'),
  activeWorkspaceId: 'local-demo-workspace',
  activeBudgetId: 'ws_default',
  workspaces: [{ id: 'ws_default', name: 'Min Budget', createdAt: todayIso(), updatedAt: todayIso(), members: [{ id: 'member_owner', name: 'Du', role: 'owner', status: 'active' }] }],
  workspaceData: {},
  premiumGoals: [],
  premiumSnapshots: [],
  premiumMonitoring: { enabled: false, nextRunHint: 'Nästa gång Klirr öppnas eller när du väljer Kör nu.' },
  premiumActivation: { onboardingShown: false },
  budgetMetricSnapshots: [],
  budgetGoals: [],
  reminders: [],
  automaticReview: { enabled: false, runIntervalDays: 14 },
  budgetVersions: [],
  dismissedInsightKeys: [],
  privacyPreferences: defaultPrivacyPreferences(),
  consentRecords: [],
  aiContextLog: [],
};

const nav: Array<{ id: TabId; label: string; shortLabel: string; icon: string }> = [
  { id: 'dashboard', label: 'Översikt', shortLabel: 'Hem', icon: '⌁' },
  { id: 'plan', label: 'Plan', shortLabel: 'Plan', icon: '🧮' },
  { id: 'importReview', label: 'Import & granskning', shortLabel: 'Import', icon: '⬆' },
  { id: 'household', label: 'Hushåll', shortLabel: 'Hushåll', icon: '🏠' },
  { id: 'buddy', label: 'Budget Buddy', shortLabel: 'Buddy', icon: '✨' },
  { id: 'more', label: 'Mer / Inställningar', shortLabel: 'Mer', icon: '⋯' },
];

const primaryMobileTabs: TabId[] = ['dashboard', 'plan', 'importReview', 'household', 'buddy'];
const primaryMobileNav = nav.filter(item => primaryMobileTabs.includes(item.id));
const drawerNav = nav.filter(item => !primaryMobileTabs.includes(item.id));

type PlanSection = 'musts' | 'variablePlan' | 'scenarios';
type ImportReviewSection = 'import' | 'accounts' | 'transactions' | 'transfers' | 'recurring' | 'review';
type HouseholdSection = 'profile' | 'income';
type MoreSection = 'rules' | 'settings' | 'privacy';

const legacyTabMap: Partial<Record<TabId, { tab: TabId; section?: PlanSection | ImportReviewSection | HouseholdSection | MoreSection }>> = {
  musts: { tab: 'plan', section: 'musts' },
  variablePlan: { tab: 'plan', section: 'variablePlan' },
  scenarios: { tab: 'plan', section: 'scenarios' },
  import: { tab: 'importReview', section: 'import' },
  accounts: { tab: 'importReview', section: 'accounts' },
  transactions: { tab: 'importReview', section: 'transactions' },
  transfers: { tab: 'importReview', section: 'transfers' },
  recurring: { tab: 'importReview', section: 'recurring' },
  review: { tab: 'importReview', section: 'review' },
  income: { tab: 'household', section: 'income' },
  rules: { tab: 'more', section: 'rules' },
  settings: { tab: 'more', section: 'settings' },
  premium: { tab: 'dashboard' },
};

function getTabLabel(id: TabId) {
  return nav.find(item => item.id === id)?.label || 'Klirr';
}

function frequencyLabel(frequency?: Frequency) {
  const labels: Record<Frequency, string> = {
    monthly: 'Månadsvis',
    quarterly: 'Kvartalsvis',
    yearly: 'Årsvis',
    irregular: 'Oregelbundet',
  };
  return frequency ? labels[frequency] || frequency : 'Okänd frekvens';
}

function statusLabel(status?: 'pending' | 'confirmed' | 'rejected') {
  if (status === 'confirmed') return 'Bekräftad';
  if (status === 'rejected') return 'Bortvald';
  return 'Obekräftad';
}

function statusTone(status?: 'pending' | 'confirmed' | 'rejected') {
  if (status === 'confirmed') return 'green';
  if (status === 'rejected') return 'danger';
  return 'warn';
}

function costTypeLabel(costType?: CostType | 'fixed' | 'variable' | 'income') {
  if (costType === 'fixed') return 'Fast utgift';
  if (costType === 'variable') return 'Rörlig utgift';
  if (costType === 'income') return 'Inkomst';
  if (costType === 'transfer') return 'Intern överföring';
  if (costType === 'excluded') return 'Borträknad';
  return 'Okänd typ';
}

function sourceLabel(source?: 'recurring' | 'manual' | 'variablePlan') {
  if (source === 'recurring') return 'Återkommande';
  if (source === 'manual') return 'Manuell';
  if (source === 'variablePlan') return 'Rörliga utgifter';
  return source || '';
}



type ExpandableBudgetItemProps = {
  id: string;
  title: string;
  amount?: string;
  meta?: string;
  status?: string;
  tone?: 'green' | 'warn' | 'danger';
  warning?: string;
  visual?: ReactNode;
  children: ReactNode;
};

function ExpandableBudgetItem({ id, title, amount, meta, status, tone, warning, visual, children }: ExpandableBudgetItemProps) {
  const reactId = useId();
  const [open, setOpen] = useState(false);
  const buttonId = `${reactId}-${id}-button`;
  const panelId = `${reactId}-${id}-panel`;
  useEffect(() => {
    function closeOther(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    }
    window.addEventListener('klirr:accordion-open', closeOther);
    return () => window.removeEventListener('klirr:accordion-open', closeOther);
  }, [id]);
  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = !open;
    setOpen(next);
    if (next) {
      window.dispatchEvent(new CustomEvent('klirr:accordion-open', { detail: id }));
      window.setTimeout(() => event.currentTarget.closest('.budget-row')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
    }
  }
  return <section className={`budget-row ${open ? 'open' : ''} ${warning ? 'has-warning' : ''}`} data-budget-row-id={id}>
    <button id={buttonId} className="budget-row-button" type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
      <span className="budget-row-main"><span className="budget-row-title">{title}</span>{meta && <span className="budget-row-meta">{meta}</span>}{warning && <span className="budget-row-warning">⚠ {warning}</span>}{visual}</span>
      <span className="budget-row-side">{amount && <b className="mono budget-row-amount">{amount}</b>}{status && <span className={`budget-row-status ${tone || ''}`}>{status}</span>}<span className="budget-row-chevron" aria-hidden="true">⌄</span></span>
    </button>
    <div id={panelId} className="budget-row-panel" role="region" aria-labelledby={buttonId}>{children}</div>
  </section>;
}


function MiniProgressBar({ value, label, tone = 'default' }: { value: number; label: string; tone?: 'default' | 'danger' | 'warn' | 'green' }) {
  const width = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return <span className={`mini-progress ${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)}><span style={{ width: `${width}%` }} /></span>;
}

const segmentClass: Record<string, string> = { fixed: 'seg-fixed', variable: 'seg-variable', margin: 'seg-margin', food: 'seg-food', transport: 'seg-transport', fun: 'seg-fun', other: 'seg-other', buffer: 'seg-buffer', salary: 'seg-fixed', support: 'seg-variable' };
function SegmentedBudgetBar({ segments, label }: { segments: Segment[]; label: string }) {
  return <span className="segmented-bar" role="img" aria-label={label}>{segments.filter(segment => segment.width > 0).map(segment => <span key={segment.key} className={segmentClass[segment.key] || 'seg-other'} style={{ width: `${Math.max(0, Math.min(100, segment.width))}%` }} />)}</span>;
}

function BudgetHealthRing({ score, label }: { score: number; label: string }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 18;
  return <span className="health-ring" role="img" aria-label={`Budgethälsa ${safeScore} procent, ${label}`}><svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><circle className="health-ring-track" cx="22" cy="22" r="18" /><circle className="health-ring-value" cx="22" cy="22" r="18" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - safeScore / 100)} /></svg><b className="mono">{safeScore}</b></span>;
}

function CompactSummary({ items }: { items: Array<{ label: string; value: string; tone?: 'good' | 'bad' }> }) {
  return <Card className="compact-summary"><div className="compact-summary-grid">{items.map(item => <div key={item.label}><span className="metric-label">{item.label}</span><b className={`mono ${item.tone === 'bad' ? 'amount-neg' : item.tone === 'good' ? 'amount-pos' : ''}`}>{item.value}</b></div>)}</div></Card>;
}

function reviewTypeLabel(type: string) {
  const labels: Record<string, string> = {
    amount_outlier: 'Avvikande belopp',
    duplicate: 'Möjlig dubblett',
    low_confidence: 'Osäker återkommande post',
    unusual_income: 'Oklart plusbelopp',
    possible_transfer: 'Möjlig intern överföring',
    import_warning: 'Importvarning',
    possible_late_payment: 'Möjlig eftersläpning',
    possible_one_off: 'Möjlig engångspost',
  };
  return labels[type] || type;
}

export default function App() {
const [state, setState] = useState<AppState>(() => { const saved = loadState(); const onboarding = normalizeOnboardingState(saved?.onboarding, saved?.onboardingCompleted); return normalizePrivacyState(ensureWorkspaceState({ ...initialState, ...(saved || {}), entitlements: getEntitlements(saved?.subscriptionPlan || initialState.subscriptionPlan, saved?.subscriptionStatus || initialState.subscriptionStatus), onboarding, onboardingCompleted: onboarding.status === 'COMPLETED', buddyActionHistory: saved?.buddyActionHistory || [] })); });
  const [tab, setTab] = useState<TabId>('dashboard');
  const [planSection, setPlanSection] = useState<PlanSection>('musts');
  const [importReviewSection, setImportReviewSection] = useState<ImportReviewSection>('import');
  const [householdSection, setHouseholdSection] = useState<HouseholdSection>('profile');
  const [moreSection, setMoreSection] = useState<MoreSection>('settings');
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [buddyAutoMessage, setBuddyAutoMessage] = useState('');
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => { setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveState(state); }, [state, loaded]);

  const detection = useMemo(() => detectRecurring(state.transactions, state.accounts, state.rules, state.transferDecisions), [state.transactions, state.accounts, state.rules, state.transferDecisions]);
  const summary = useMemo(() => calculateBudget({ detection, recurringDecisions: state.recurringDecisions, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan }), [detection, state.recurringDecisions, state.incomes, state.manualExpenses, state.variablePlan]);
  const budgetCompletion = useMemo(() => calculateBudgetCompletion({ state, summary, detection, visibleReviewCount: getVisibleReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: state.recurringDecisions, reviewDecisions: state.reviewDecisions }).length, handledReviewCount: countHandledReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: state.recurringDecisions, reviewDecisions: state.reviewDecisions }) }), [state, summary, detection]);
  const budgetHealth = useMemo(() => calculateBudgetHealth({ summary, detection, state, possibleIncomeDuplicates: detectPossibleIncomeDuplicates(state.incomes, getUnifiedIncomeItems(summary, state.incomes).filter(item => item.source === 'recurring')), visibleReviewCount: getVisibleReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: state.recurringDecisions, reviewDecisions: state.reviewDecisions }).length, handledReviewCount: countHandledReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: state.recurringDecisions, reviewDecisions: state.reviewDecisions }) }), [summary, detection, state]);
  const scenarioSummary = useMemo(() => calculateBudget({ detection, recurringDecisions: state.recurringDecisions, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan, scenarioOff: state.scenarioOff }), [detection, state.recurringDecisions, state.incomes, state.manualExpenses, state.variablePlan, state.scenarioOff]);
  const visibleReviewItems = useMemo(() => getVisibleReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: state.recurringDecisions, reviewDecisions: state.reviewDecisions }), [detection.reviewItems, state.recurringDecisions, state.reviewDecisions]);
  const handledReviewCount = useMemo(() => countHandledReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: state.recurringDecisions, reviewDecisions: state.reviewDecisions }), [detection.reviewItems, state.recurringDecisions, state.reviewDecisions]);
  const possibleIncomeDuplicates = useMemo(() => detectPossibleIncomeDuplicates(state.incomes, summary.incomeItems.filter(item => item.source === 'recurring')), [state.incomes, summary.incomeItems]);

  const hasAnyBudgetData =
    state.transactions.length > 0 ||
    state.incomes.length > 0 ||
    state.manualExpenses.length > 0 ||
    state.variablePlan.some(item => item.amount > 0 && item.include) ||
    Object.keys(state.recurringDecisions).length > 0;

  const setPartial = (patch: Partial<AppState>) => setState(prev => ({ ...prev, ...patch }));
  const badges: Partial<Record<TabId, number>> = {
    importReview: visibleReviewItems.length + detection.transfers.filter(t => !state.transferDecisions[t.id]?.status || state.transferDecisions[t.id].status === 'pending').length + getActionableRecurringCandidates(detection.recurring).filter(r => !state.recurringDecisions[r.id]?.status).length,
  };

  function selectTab(nextTab: TabId) {
    setOnboardingOpen(false);
    const mapped = legacyTabMap[nextTab];
    if (mapped) {
      if (mapped.tab === 'plan') setPlanSection(mapped.section as PlanSection);
      if (mapped.tab === 'importReview') setImportReviewSection(mapped.section as ImportReviewSection);
      if (mapped.tab === 'household') setHouseholdSection(mapped.section as HouseholdSection);
      if (mapped.tab === 'more') setMoreSection(mapped.section as MoreSection);
      setTab(mapped.tab);
    } else {
      setTab(nextTab);
    }
    setMobileMenuOpen(false);
  }

  const appAccessible = !shouldShowForcedWelcome(state.onboarding, state.onboardingCompleted);
  const showOnboarding = !appAccessible || onboardingOpen;

  function loadDemo() {
    const demo = buildDemoData();
    setState({
      ...initialState,
      accounts: demo.accounts,
      transactions: demo.transactions,
      incomes: demo.incomes,
      manualExpenses: demo.manualExpenses,
      variablePlan: demo.variablePlan,
      rules: demo.rules,
      chatMessages: [initialBuddyMessage()],
      buddyActionHistory: [],
      onboardingCompleted: true,
      onboarding: { ...normalizeOnboardingState(), status: 'COMPLETED', currentStep: 'finish', started: true },
      subscriptionPlan: state.subscriptionPlan,
      subscriptionStatus: state.subscriptionStatus,
      entitlements: getEntitlements(state.subscriptionPlan, state.subscriptionStatus),
    });
    setOnboardingOpen(false);
    selectTab('dashboard');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar desktop-sidebar">
        <div className="logo">
          <div className="logo-title">Klirr</div>
          <div className="logo-sub">Vad livet kostar varje månad</div>
        </div>
        <nav className="nav">
          {nav.map(item => (
            <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}>
              <span>{item.icon} {item.label}</span>
              {!!badges[item.id] && <span className="badge">{badges[item.id]}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <header className="mobile-topbar">
        <div className="mobile-brand-stack">
          <div className="mobile-brand">Klirr</div>
          <div className="mobile-tagline">Vad livet kostar varje månad</div>
          <div className="mobile-context">{getTabLabel(tab)}</div>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Öppna meny">☰</button>
      </header>

      {mobileMenuOpen && <div className="drawer-backdrop" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="drawer-head">
          <div>
            <div className="logo-title">Klirr</div>
            <div className="logo-sub">Fler verktyg</div>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Stäng meny">×</button>
        </div>
        <nav className="nav drawer-nav">
          {drawerNav.map(item => (
            <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}>
              <span>{item.icon} {item.label}</span>
              {!!badges[item.id] && <span className="badge">{badges[item.id]}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        {showOnboarding && <OnboardingView initialState={initialState} state={state} setState={setState} loadDemo={loadDemo} setTab={selectTab} onExit={() => setOnboardingOpen(false)} />}
        {!showOnboarding && appAccessible && tab === 'dashboard' && <DashboardView summary={summary} budgetHealth={budgetHealth} budgetCompletion={budgetCompletion} detection={detection} visibleReviewCount={visibleReviewItems.length} loadDemo={loadDemo} setTab={selectTab} hasData={hasAnyBudgetData} onboarding={state.onboarding} dismissFirstRunGuide={() => setPartial({ onboarding: { ...normalizeOnboardingState(state.onboarding), firstRunGuideDismissed: true } })} onExport={() => exportBudgetReport(summary, detection)} onImproveBudgetHealth={() => { setBuddyAutoMessage(budgetHealthImprovementMessage); selectTab('buddy'); }} />}
        {!showOnboarding && appAccessible && tab === 'plan' && <PlanView active={planSection} setActive={setPlanSection} summary={summary} scenarioSummary={scenarioSummary} detection={detection} state={state} setState={setState} setVariablePlan={(variablePlan) => setPartial({ variablePlan })} />}
        {!showOnboarding && appAccessible && tab === 'importReview' && <ImportReviewView active={importReviewSection} setActive={setImportReviewSection} detection={detection} state={state} setPartial={setPartial} loadDemo={loadDemo} setTab={selectTab} visibleReviewItems={visibleReviewItems} onBuddyCleanup={() => { setBuddyAutoMessage(importBuddyCleanupMessage); selectTab('buddy'); }} onboardingActive={normalizeOnboardingState(state.onboarding, state.onboardingCompleted).status === 'IMPORT_PATH'} onContinueOnboarding={() => { setPartial({ onboarding: { ...normalizeOnboardingState(state.onboarding), path: 'import', started: true, importCompleted: true, currentStep: 'importReview' } }); setTab('dashboard'); setOnboardingOpen(true); }} />}
        {!showOnboarding && appAccessible && tab === 'household' && <HouseholdView active={householdSection} setActive={setHouseholdSection} householdProfile={state.householdProfile} setHouseholdProfile={(householdProfile) => setPartial({ householdProfile })} incomes={state.incomes} setIncomes={(incomes) => setPartial({ incomes })} summary={summary} detection={detection} recurringDecisions={state.recurringDecisions} setRecurringDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} />}
        {!showOnboarding && appAccessible && tab === 'buddy' && <BudgetBuddyView state={state} setState={setState} summary={summary} detection={detection} visibleReviewCount={visibleReviewItems.length} handledReviewCount={handledReviewCount} possibleIncomeDuplicates={possibleIncomeDuplicates} setTab={selectTab} setScenarioOff={(ids) => setPartial({ scenarioOff: ids })} autoMessage={buddyAutoMessage || (!state.onboardingCompleted && normalizeOnboardingState(state.onboarding).currentStep === 'buddyCheckup' ? budgetBuddyCheckupMessage : '')} onAutoMessageHandled={() => setBuddyAutoMessage('')} />}
        {!showOnboarding && appAccessible && tab === 'more' && <MoreView active={moreSection} setActive={setMoreSection} state={state} setState={setState} loadDemo={loadDemo} openOnboarding={() => { setTab('dashboard'); setOnboardingOpen(true); }} onReset={() => { clearState(); setState({ ...initialState, onboardingCompleted: false, onboarding: normalizeOnboardingState() }); selectTab('dashboard'); }} />}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Viktigaste funktioner">
        {primaryMobileNav.map(item => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}>
            <span className="bottom-icon">{item.icon}</span>
            <span>{item.shortLabel}</span>
            {!!badges[item.id] && <span className="bottom-badge">{badges[item.id]}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}


function OnboardingView({ initialState, state, setState, loadDemo, setTab, onExit }: { initialState: AppState; state: AppState; setState: (s: AppState) => void; loadDemo: () => void; setTab: (t: TabId) => void; onExit: () => void }) {
  const onboarding = normalizeOnboardingState(state.onboarding);
  const [profile, setProfile] = useState<HouseholdProfile>(normalizeHouseholdProfile(state.householdProfile));
  const [incomes, setIncomes] = useState<Income[]>(state.incomes.length ? state.incomes : [{ id: uid('inc_onboarding_salary'), label: 'Lön efter skatt', amount: 0, frequency: 'monthly' }, { id: uid('inc_onboarding_support'), label: 'Barnbidrag/support', amount: 0, frequency: 'monthly' }]);
  const [grossIncome, setGrossIncome] = useState('');
  const [musts, setMusts] = useState<Array<{ label: string; amount: string; category: string }>>(state.manualExpenses.length ? state.manualExpenses.map(item => ({ label: item.label, amount: String(item.amount || ''), category: item.category })) : [
    { label: 'Hyra/boende', amount: '', category: 'Boende' },
    { label: 'Lån/skulder', amount: '', category: 'Skulder' },
    { label: 'El', amount: '', category: 'El' },
    { label: 'Försäkringar', amount: '', category: 'Försäkring' },
    { label: 'Mobil/bredband', amount: '', category: 'Kommunikation' },
    { label: 'Abonnemang', amount: '', category: 'Abonnemang' },
  ]);
  const [mode, setMode] = useState<BudgetSuggestionMode>('balanced');
  const summary = calculateBudget({ detection: detectRecurring(state.transactions, state.accounts, state.rules, state.transferDecisions), recurringDecisions: state.recurringDecisions, incomes, manualExpenses: musts.filter(m => Number(m.amount) > 0).map(m => ({ id: `mx_preview_${m.label}`, label: m.label, amount: Number(m.amount), category: m.category, costType: 'fixed', active: true, frequency: 'monthly' })), variablePlan: state.variablePlan });
  const incomeAmount = incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const fixedTotal = musts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const suggestion = suggestVariableBudget({ available: incomeAmount - fixedTotal, mode, householdProfile: profile });
  const proposedPlan = suggestion.items.map(item => ({ ...item, id: item.id || uid('vp_onboarding') }));
  const variableTotal = proposedPlan.reduce((sum, item) => sum + item.amount, 0);
  const warnings = onboardingWarnings({ state: { ...state, householdProfile: profile, incomes, variablePlan: proposedPlan }, totalIncome: incomeAmount || summary.totalIncome, fixedTotal, remainingAfterFixed: (incomeAmount || summary.totalIncome) - fixedTotal, variablePlanTotal: variableTotal, remainingAfterPlan: (incomeAmount || summary.totalIncome) - fixedTotal - variableTotal, detection: detectRecurring(state.transactions, state.accounts, state.rules, state.transferDecisions) });
  const stepInfo = getOnboardingStepNumber(onboarding);
  function patchOnboarding(currentStep: OnboardingStep, patch: Partial<AppState['onboarding']> = {}) { const next = { ...onboarding, started: true, currentStep, ...patch }; setState({ ...state, onboardingCompleted: next.status === 'COMPLETED', onboarding: next }); }
  function pause(currentStep: OnboardingStep = step) { setState({ ...state, onboarding: { ...onboarding, started: true, currentStep, status: onboarding.status === 'IMPORT_PATH' ? 'IMPORT_PATH' : onboarding.path === 'import' ? 'IMPORT_PATH' : 'MANUAL_PATH' } }); onExit(); setTab('dashboard'); }
  const PauseButton = () => <button className="btn secondary" onClick={() => pause()}>Fortsätt senare</button>;
  function applyDraft(complete = false, nextTab: TabId = 'dashboard') {
    const patch = buildManualOnboardingPatch({ existing: state, householdProfile: profile, incomes: incomes.filter(i => Number(i.amount) > 0).map(i => ({ ...i, amount: Math.round(Number(i.amount)) })), musts, variablePlan: proposedPlan });
    setState({ ...initialState, ...state, ...patch, onboardingCompleted: complete, onboarding: { ...onboarding, started: true, status: complete ? 'COMPLETED' : (onboarding.path === 'import' ? 'IMPORT_PATH' : 'MANUAL_PATH'), reviewCompleted: true, currentStep: complete ? 'finish' : 'summary' } });
    if (complete) onExit();
    setTab(nextTab);
  }
  function addIncome(label = 'Annan inkomst') { setIncomes([...incomes, { id: uid('inc_onboarding'), label, amount: 0, frequency: 'monthly' }]); }
  const grossIncomeNumber = Number(grossIncome);
  const estimatedNet = Number.isFinite(grossIncomeNumber) && grossIncomeNumber > 0 ? estimateSwedishNetSalary({ grossMonthly: grossIncomeNumber }).netMonthly : 0;
  const step = onboarding.currentStep;
  return <><PageTitle title="Kom igång med Klirr" subtitle="Välj manuell budget eller import — Budget Buddy hjälper dig till en trygg första plan." />
    <Card className="soft"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><b>Budget Buddy ✨ · Steg {stepInfo.label}</b><p className="hint" style={{ marginBottom: 0 }}>Vi sparar framstegen lokalt och ändrar inget utan din bekräftelse.</p></div></div></Card>
    {step === 'start' && <Card><h3>👋 Välkommen till Klirr</h3><p className="hint">Hur vill du komma igång?</p><div className="grid grid-3 compact-grid"><button className="btn primary choice-card" aria-label="Bygg min första Budget, rekommenderas" onClick={() => patchOnboarding('household', { path: 'manual', status: 'MANUAL_PATH' })}><span className="pill green">Rekommenderas</span><br/><b>Bygg min första Budget</b><br/><span>Vi bygger din Budget steg för steg tillsammans.</span></button><button className="btn choice-card" onClick={() => { setState({ ...state, onboarding: { ...onboarding, status: 'SKIPPED', path: 'explore', started: true } }); onExit(); setTab('dashboard'); }}><b>Jag utforskar själv</b><br/><span>Jag vill titta runt först och bygga Budgeten i min egen takt.</span></button><button className="btn choice-card" onClick={() => { setState({ ...state, onboarding: { ...onboarding, status: 'IMPORT_PATH', path: 'import', started: true, currentStep: 'import' } }); onExit(); setTab('import'); }}><b>Importera min Budget</b><br/><span>Jag har redan koll och vill komma igång snabbare med ett kontoutdrag.</span></button></div><button className="btn small ghost" style={{ marginTop: 12 }} onClick={loadDemo}>Testa med demo-data</button></Card>}
    {step === 'household' && <Card><h3>Hushåll 🏠</h3><p className="hint">Det här hjälper Klirr sätta rimliga nivåer för mat, transport och vardag 🏠🍝</p><div className="grid grid-3"><label>Vuxna<input className="input" type="number" min={1} value={profile.adults} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, adults: Number(e.target.value) }))} /></label><label>Barn<input className="input" type="number" min={0} value={profile.children} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, children: Number(e.target.value) }))} /></label><label>Tonåringar<input className="input" type="number" min={0} value={profile.teens} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, teens: Number(e.target.value) }))} /></label></div><div className="grid grid-3" style={{ marginTop: 12 }}><label>Husdjur<input className="input" type="number" min={0} value={profile.pets} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, pets: Number(e.target.value) }))} /></label><select className="select" value={profile.foodAmbition} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, foodAmbition: e.target.value as FoodAmbition }))}><option value="budget">Matnivå: budget</option><option value="normal">Matnivå: normal</option><option value="comfortable">Matnivå: bekväm</option></select><select className="select" value={profile.transportNeed} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, transportNeed: e.target.value as TransportNeed }))}><option value="low">Transport: lågt</option><option value="normal">Transport: normalt</option><option value="high">Transport: högt</option></select></div><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => onboarding.path === 'import' ? patchOnboarding('import') : patchOnboarding('income')}>Nästa</button><PauseButton /></div></Card>}
    {step === 'import' && <Card><h3>Importera kontoutdrag</h3><p className="hint">Klirr skickar inte banktransaktioner till OpenAI. Importen sker lokalt och onboarding fortsätter efter filen är importerad.</p><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => { setState({ ...state, householdProfile: profile, onboarding }); onExit(); setTab('import'); }}>Öppna Import & granskning</button><PauseButton /></div></Card>}
    {step === 'income' && <Card><h3>Inkomster 💸</h3><p className="hint">Använd helst månadsbelopp efter skatt. Bruttolön är bara en uppskattning. Håll lön och stöd separat — Barnbidrag och andra stöd ska inte skrivas över som lön.</p><div className="stack">{incomes.map((i, idx) => <div className="edit-row" key={i.id}><input className="input" value={i.label} onChange={e => setIncomes(incomes.map(x => x.id === i.id ? { ...x, label: e.target.value } : x))} /><input className="input money-input" type="number" value={i.amount || ''} onChange={e => setIncomes(incomes.map(x => x.id === i.id ? { ...x, amount: Number(e.target.value) } : x))} /><button className="btn small danger" onClick={() => setIncomes(incomes.filter((_, n) => n !== idx))}>Ta bort</button></div>)}</div><div className="row"><button className="btn small" onClick={() => addIncome('Lön efter skatt')}>+ Lön</button><button className="btn small" onClick={() => addIncome('Barnbidrag/support')}>+ Barnbidrag/support</button><button className="btn small" onClick={() => addIncome('Annan inkomst')}>+ Annan inkomst</button></div><div className="row"><input className="input" type="number" placeholder="Bruttolön för grov uppskattning" value={grossIncome} onChange={e => setGrossIncome(e.target.value)} />{estimatedNet > 0 && <button className="btn" onClick={() => addIncome(`Uppskattad nettolön ${fmt(estimatedNet)}`)}>Lägg till uppskattad nettolön {fmt(estimatedNet)}</button>}</div><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => patchOnboarding('musts')}>Nästa</button><PauseButton /></div></Card>}
    {step === 'musts' && <Card><h3>Fasta utgifter 📌</h3><p className="hint">Fasta utgifter är återkommande eller förutsägbara kostnader som normalt måste betalas även när Budgeten är pressad: hyra, el, lån, försäkringar och abonnemang.</p><div className="stack">{musts.map((item, i) => <div className="edit-row" key={`${item.label}-${i}`}><input className="input" value={item.label} onChange={e => setMusts(musts.map((m, idx) => idx === i ? { ...m, label: e.target.value } : m))} /><input className="input money-input" type="number" placeholder="kr/mån" value={item.amount} onChange={e => setMusts(musts.map((m, idx) => idx === i ? { ...m, amount: e.target.value } : m))} /><input className="input" value={item.category} onChange={e => setMusts(musts.map((m, idx) => idx === i ? { ...m, category: e.target.value } : m))} /><button className="btn small danger" onClick={() => setMusts(musts.filter((_, idx) => idx !== i))}>Ta bort</button></div>)}</div><button className="btn small" onClick={() => setMusts([...musts, { label: 'Ny fast kostnad', amount: '', category: 'Fast kostnad' }])}>+ Lägg till rad</button><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => patchOnboarding('variablePlan')}>Nästa</button><PauseButton /></div></Card>}
    {step === 'variablePlan' && <Card><h3>Rörliga utgifter 💡</h3><div className="grid grid-3"><MetricCard label="Kvar efter fasta utgifter" value={fmtSigned(incomeAmount - fixedTotal)} /><MetricCard label="Föreslagna rörliga utgifter" value={fmt(variableTotal)} /><MetricCard label="Marginal efter plan" value={fmtSigned(incomeAmount - fixedTotal - variableTotal)} tone={incomeAmount - fixedTotal - variableTotal >= 0 ? 'good' : 'bad'} /></div><select className="select" value={mode} onChange={e => setMode(e.target.value as BudgetSuggestionMode)}><option value="safe">Trygg: mer marginal och buffert</option><option value="balanced">Balanserad: jämn fördelning</option><option value="boost">Lite friare: mer vardag och mindre marginal</option></select><div className="stack">{proposedPlan.map(item => <div className="list-line" key={item.id}><span>{item.label}<br/><small>{item.category}</small></span><b className="mono">{fmt(item.amount)}</b></div>)}</div><p className="hint">Buffert/sparande: {fmt(proposedPlan.filter(i => /spar|buffert/i.test(i.label + i.category)).reduce((s, i) => s + i.amount, 0))}. Mat: {fmt(proposedPlan.find(i => /mat/i.test(i.label))?.amount || 0)}.</p><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => applyDraft(false)}>Visa sammanfattning</button><PauseButton /></div></Card>}
    {(step === 'importReview' || step === 'confirmImport' || step === 'buddyCheckup') && <Card><h3>Granska importen ✨</h3><p className="hint">Gå igenom inkomster, överföringar, återkommande fasta utgifter och oklara poster. Kör gärna “Städa min Budget” innan du slutför.</p><div className="row"><button className="btn" onClick={() => setTab('recurring')}>Bekräfta inkomster och fasta utgifter</button><button className="btn" onClick={() => setTab('transfers')}>Granska överföringar</button><button className="btn" onClick={() => setTab('review')}>Oklara poster</button><button className="btn primary" onClick={() => { setState({ ...state, onboarding: { ...onboarding, currentStep: 'buddyCheckup', reviewCompleted: true } }); setTab('buddy'); }}>Låt Budget Buddy hjälpa mig justera ✨</button></div><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => patchOnboarding('summary', { reviewCompleted: true })}>Fortsätt till sammanfattning</button><PauseButton /></div></Card>}
    {step === 'summary' && <Card><h3>Din första Budget är redo 🎉</h3>{warnings.length > 0 && <div className="warn" style={{ padding: 12, borderRadius: 12 }}><b>Varm koll innan du går vidare</b><ul>{warnings.map(w => <li key={w}>{w}</li>)}</ul><button className="btn" onClick={() => { setState({ ...state, onboarding }); setTab('buddy'); }}>Låt Budget Buddy hjälpa mig justera ✨</button></div>}<div className="grid grid-3"><MetricCard label="Total inkomst" value={fmt(incomeAmount || summary.totalIncome)} /><MetricCard label="Fasta kostnader" value={fmt(fixedTotal || summary.fixedTotal)} /><MetricCard label="Rörliga utgifter" value={fmt(variableTotal || summary.variablePlanTotal)} /><MetricCard label="Buffer/sparande" value={fmt(proposedPlan.filter(i => /spar|buffert/i.test(i.label + i.category)).reduce((s, i) => s + i.amount, 0))} /><MetricCard label="Kvar efter plan" value={fmtSigned((incomeAmount || summary.totalIncome) - (fixedTotal || summary.fixedTotal) - (variableTotal || summary.variablePlanTotal))} /></div><div className="row"><button className="btn primary" onClick={() => applyDraft(true, 'dashboard')}>Gå till min översikt</button><button className="btn" onClick={() => { setState({ ...state, onboarding: { ...onboarding, currentStep: 'buddyCheckup', reviewCompleted: true } }); setTab('buddy'); }}>Kör Budget Buddy Checkup ✨</button><button className="btn" onClick={() => onboarding.path === 'import' ? patchOnboarding('confirmImport') : patchOnboarding('variablePlan')}>Justera planen</button></div></Card>}
  </>;
}

function DashboardView({ summary, budgetHealth, budgetCompletion, detection, visibleReviewCount, loadDemo, setTab, hasData, onboarding, dismissFirstRunGuide, onExport, onImproveBudgetHealth }: { summary: ReturnType<typeof calculateBudget>; budgetHealth: ReturnType<typeof calculateBudgetHealth>; budgetCompletion: ReturnType<typeof calculateBudgetCompletion>; detection: DetectionResult; visibleReviewCount: number; loadDemo: () => void; setTab: (t: TabId) => void; hasData: boolean; onboarding?: AppState['onboarding']; dismissFirstRunGuide: () => void; onExport: () => void; onImproveBudgetHealth: () => void }) {
  const fixedPct = summary.totalIncome > 0 ? (summary.fixedTotal / summary.totalIncome) * 100 : 0;
  const lifeCost = summary.fixedTotal + summary.variablePlanTotal;
  const activeIncomeCount = summary.incomeItems.length;
  const buffer = summary.variableItems.filter(item => /buffert|sparande/i.test(`${item.label} ${item.category}`)).reduce((sum, item) => sum + item.amount, 0);
  const food = summary.variableItems.filter(item => /mat|hushåll|hushall|livsmedel/i.test(`${item.label} ${item.category}`)).reduce((sum, item) => sum + item.amount, 0);
  const reviewCount = visibleReviewCount + getActionableRecurringCandidates(detection.recurring).length;
  const healthReasons = splitBudgetHealthReasons(budgetHealth.reasons);
  const nextSteps = budgetHealthNextSteps(budgetHealth.reasons);
  const completionLabel = budgetCompletion.percentage >= 100 ? 'Setup täcker grunderna' : `${budgetCompletion.missingItems.length} delar saknas`;
  const marginRatio = summary.totalIncome > 0 ? (summary.remainingAfterPlan / summary.totalIncome) * 100 : 0;
  const topDistribution = buildBudgetDistribution({ totalIncome: summary.totalIncome, fixedTotal: summary.fixedTotal, variablePlanTotal: summary.variablePlanTotal, margin: summary.remainingAfterPlan });
  const topDistributionText = topDistribution.segments.map(segment => `${segment.label} ${Math.round(segment.share)} %`).join(' · ');
  const musts = mustsStatus(summary.fixedTotal, summary.totalIncome);
  const variableDistribution = groupVariableDistribution(summary.variableItems);
  const marginVisual = marginSafety(summary.remainingAfterPlan, summary.totalIncome);
  const incomeDistribution = incomeSourceDistribution(summary.incomeItems);
  const row = (id: string, title: string, value: string, subtitle: string, content: ReactNode, important = false, tone?: 'green' | 'warn' | 'danger', visual?: ReactNode) => <ExpandableBudgetItem key={id} id={`home-${id}`} title={title} amount={value} meta={subtitle} status={important ? 'Viktigt' : undefined} tone={tone || (important ? 'warn' : undefined)} warning={important ? 'Behöver uppmärksamhet' : undefined} visual={visual}>{content}</ExpandableBudgetItem>;

  if (!hasData || budgetCompletion.percentage < 100) {
    return <><PageTitle title="Din Budget" subtitle="Vad livet kostar varje månad just nu — och hur hållbar Budgeten är." />
      {normalizeOnboardingState(onboarding).status === 'SKIPPED' && <Card className="soft"><p role="status">Inga problem 😊 Du kan alltid starta guiden senare under Inställningar eller fråga Budget Buddy.</p></Card>}
      <Card className="home-hero"><div className="metric-label">Primär överblick</div><div className="metric-value mono">Ditt liv kostar cirka {fmt(lifeCost)} /mån</div><p className="hint">Din Budget behöver lite mer information innan Budgethälsan blir riktigt träffsäker.</p></Card>
      <Card className="budget-list-card"><h3>Bygg klart i lugn takt</h3><div className="budget-list">
        {row('completion', 'Budgetkomplettering', `${budgetCompletion.percentage}%`, completionLabel, <><p>Budgetkomplettering mäter setup-täckning. Budgethälsa mäter hållbarhet.</p><ul>{budgetCompletion.items.map(item => <li key={item.key}>{item.completed ? 'Klart:' : 'Saknas:'} {item.label}</li>)}</ul></>)}
        {row('health', 'Budgethälsa', 'Väntar', 'Mer underlag behövs', <p>Budgethälsa visas tydligare när inkomst, Fasta utgifter och Rörliga utgifter finns på plats. Den mäter Budgetens hållbarhet — inte rikedom eller personligt värde.</p>)}
      </div><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => setTab('income')}>Lägg till inkomst</button><button className="btn" onClick={() => setTab('musts')}>Lägg till fast utgift</button><button className="btn" onClick={() => setTab('import')}>Importera kontoutdrag</button><button className="btn" onClick={() => setTab('buddy')}>Låt Budget Buddy guida mig</button><button className="btn ghost" onClick={loadDemo}>Testa demo-data</button></div></Card></>;
  }

  return <>
    <PageTitle title="Din Budget" subtitle="Vad livet kostar varje månad just nu — och hur hållbar Budgeten är." />
    {onboarding?.currentStep === 'finish' && !onboarding.firstRunGuideDismissed && <Card className="soft"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><b>Snabbguide för din första Budget</b><p className="hint">Kolla inkomster, fasta utgifter, Rörliga utgifter och marginal. Budget Buddy kan hjälpa dig justera utan att ändra något förrän du bekräftar.</p></div><button className="btn small ghost" onClick={dismissFirstRunGuide}>Stäng</button></div></Card>}
    <Card className="home-hero"><div className="metric-label">Vad livet kostar varje månad just nu</div><div className="metric-value mono">Ditt liv kostar cirka {fmt(lifeCost)} /mån</div><div className="home-budget-distribution"><SegmentedBudgetBar segments={topDistribution.segments} label={`Nuvarande Budgetfördelning: ${topDistributionText}`} /><p className="hint">{topDistributionText}. {topDistribution.overAllocated ? `Fasta utgifter och Rörliga utgifter överstiger inkomsten med ${fmt(topDistribution.deficit)}; stapeln visar full fördelning av planerade delar.` : 'Visar nuvarande Budgetfördelning, inte historisk konsumtion.'}</p></div><p className="hint">Bygger på bekräftade inkomster, fasta utgifter och Rörliga utgifter — inte historisk transaktionskonsumtion eller kontosaldo.</p></Card>
    {summary.remainingAfterPlan < 0 && <Card className="danger"><b>Budgeten går minus efter plan.</b><p>Det här behöver hanteras innan Budgeten kan kallas hållbar.</p><button className="btn primary" onClick={() => setTab('variablePlan')}>Justera Rörliga utgifter</button></Card>}
    <Card className="budget-list-card"><div className="budget-list">
      {row('budget-health', 'Budgethälsa', `${budgetHealth.score}%`, `${budgetHealth.label}. ${budgetHealthShortStatus(budgetHealth)}`, <div className="stack"><p><b>Vad betyder scoret?</b> Budgethälsa mäter hur hållbar och stabil din Budget är. Den mäter inte hur rik du är eller hur ”duktig” du är med pengar.</p><div className="grid grid-2 compact-grid"><div><h4>Stärker Budgethälsan</h4>{healthReasons.positive.map(r => <div className="list-line" key={r.id}><span>{r.label}</span><b className="mono">+{r.impact}</b></div>)}</div><div><h4>Drar ner Budgethälsan</h4>{healthReasons.negative.map(r => <div className="list-line" key={r.id}><span>{r.label}</span><b className="mono">{r.impact}</b></div>)}</div></div><p className="hint">Beräkningen är deterministisk och baseras på nuvarande Budgetläge: inkomst, marginal, Fasta utgifter, Rörliga utgifter, buffert, granskningsläge och hushållsprofil.</p><h4>Nästa steg</h4><ul>{nextSteps.map(step => <li key={step}>{step}</li>)}</ul><div className="row"><button className="btn primary" onClick={onImproveBudgetHealth}>Hjälp mig förbättra Budgethälsan ✨</button><button className="btn" onClick={() => setTab('variablePlan')}>Visa Rörliga utgifter</button></div></div>, budgetHealth.score < 60, budgetHealth.score < 60 ? 'danger' : budgetHealth.score < 75 ? 'warn' : 'green', <BudgetHealthRing score={budgetHealth.score} label={budgetHealth.label} />)}
      {row('income', 'Inkomster', fmt(summary.totalIncome), `${activeIncomeCount} aktiva källor`, <><p>Återkommande inkomst som Budgeten räknar med.</p>{summary.incomeItems.slice(0, 5).map(i => <div className="list-line" key={i.id}><span>{i.label}</span><b className="mono">{fmt(i.amount)}</b></div>)}<button className="btn small" onClick={() => setTab('income')}>Visa inkomster</button></>, false, undefined, incomeDistribution.shouldShow ? <><SegmentedBudgetBar segments={incomeDistribution.segments} label={`Inkomstfördelning: ${incomeDistribution.segments.map(segment => `${segment.label} ${Math.round(segment.share)} procent`).join(', ')}`} /><span className="visual-summary">{incomeDistribution.segments.map(segment => `${segment.label} ${Math.round(segment.share)} %`).join(' · ')}</span></> : undefined)}
      {row('musts', 'Fasta utgifter', fmt(summary.fixedTotal), summary.totalIncome > 0 ? `${pct(fixedPct)} av inkomsten · ${musts.text}` : musts.text, <><p>Fasta utgifter är kostnader som påverkar Budgeten framåt.</p><div className="progress"><div style={{ width: `${Math.min(100, fixedPct)}%` }} /></div>{summary.fixedItems.slice(0, 6).map(i => <div className="list-line" key={i.id}><span>{i.label}</span><b className="mono">{fmt(i.amount)}</b></div>)}<button className="btn small" onClick={() => setTab('musts')}>Visa fasta utgifter</button></>, fixedPct > 65, fixedPct > 80 ? 'danger' : 'warn', <MiniProgressBar value={musts.width} label={summary.totalIncome > 0 ? `Fasta utgifter är ${Math.round(musts.share)} procent av inkomsten` : musts.text} tone={fixedPct > 80 ? 'danger' : fixedPct > 65 ? 'warn' : 'green'} />)}
      {row('variable', 'Rörliga utgifter', fmt(summary.variablePlanTotal), variableDistribution.total > 0 && variableDistribution.largest ? `Störst: ${variableDistribution.largest.label} ${Math.round(variableDistribution.largest.share)} %` : `${summary.variableItems.length} kategorier`, <><p>Planerat utrymme för vardagliga och flexibla delar.</p>{summary.variableItems.slice(0, 6).map(i => <div className="list-line" key={i.id}><span>{i.label}</span><b className="mono">{fmt(i.amount)}</b></div>)}<p className="hint">Buffert/sparande: {fmt(buffer)}. Mat: {fmt(food)}.</p><button className="btn small" onClick={() => setTab('variablePlan')}>Visa Rörliga utgifter</button></>, false, undefined, variableDistribution.total > 0 ? <SegmentedBudgetBar segments={variableDistribution.segments} label={`Rörliga utgifter: ${variableDistribution.segments.map(segment => `${segment.label} ${Math.round(segment.share)} procent`).join(', ')}`} /> : undefined)}
      {row('margin', 'Marginal', fmtSigned(summary.remainingAfterPlan), `${marginVisual.text} · ${pct(marginRatio)} av inkomsten`, <><p>Marginal är det som finns kvar efter Fasta utgifter och Rörliga utgifter. Den visar hur mycket Budgeten tål innan den blir sårbar.</p><p>Marginal som andel av inkomsten: <b>{pct(marginRatio)}</b>.</p><div className="row"><button className="btn small" onClick={() => setTab('variablePlan')}>Justera Rörliga utgifter</button><button className="btn small" onClick={onImproveBudgetHealth}>Fråga Buddy</button></div></>, summary.remainingAfterPlan < summary.totalIncome * 0.05, summary.remainingAfterPlan < 0 ? 'danger' : 'warn', <MiniProgressBar value={marginVisual.width} label={`${marginVisual.text}, ${Math.round(marginVisual.share)} procent av inkomsten`} tone={marginVisual.state === 'negative' ? 'danger' : marginVisual.state === 'thin' ? 'warn' : 'green'} />)}
      {row('completion', 'Budgetkomplettering', `${budgetCompletion.percentage}%`, completionLabel, <><p>Budgetkomplettering mäter setup-täckning. Budgethälsa mäter hållbarhet.</p><ul>{budgetCompletion.items.map(item => <li key={item.key}>{item.completed ? 'Klart:' : 'Saknas:'} {item.label}</li>)}</ul></>)}
      {reviewCount > 0 && row('review', 'Import & granskning', String(reviewCount), 'Saker behöver granskas', <><p>Oklara importposter eller obekräftade återkommande förslag kan göra Budgeten mindre tillförlitlig.</p><button className="btn small" onClick={() => setTab('review')}>Öppna Import & granskning</button></>, true)}
    </div></Card>
    <div className="row" style={{ marginTop: 14 }}><button className="btn primary" onClick={summary.remainingAfterPlan < summary.totalIncome * 0.05 ? () => setTab('variablePlan') : onImproveBudgetHealth}>{summary.remainingAfterPlan < summary.totalIncome * 0.05 ? 'Se över Rörliga utgifter' : 'Hjälp mig förbättra Budgethälsan ✨'}</button><button className="btn ghost" onClick={onExport}>Exportera rapport</button></div>
  </>;
}

function SectionTabs<T extends string>({ items, active, onChange }: { items: Array<{ id: T; label: string; badge?: number }>; active: T; onChange: (id: T) => void }) {
  return <div className="section-tabs">{items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>{item.label}{!!item.badge && <span className="badge">{item.badge}</span>}</button>)}</div>;
}

function PlanView({ active, setActive, summary, scenarioSummary, detection, state, setState, setVariablePlan }: { active: PlanSection; setActive: (s: PlanSection) => void; summary: ReturnType<typeof calculateBudget>; scenarioSummary: ReturnType<typeof calculateBudget>; detection: DetectionResult; state: AppState; setState: (s: AppState) => void; setVariablePlan: (p: VariablePlanItem[]) => void }) {
  return <><PageTitle title="Plan" subtitle="Planera Budgeten framåt: Fasta utgifter, Rörliga utgifter och scenarier." />
    <SectionTabs<PlanSection> active={active} onChange={setActive} items={[{ id: 'musts', label: 'Fasta utgifter' }, { id: 'variablePlan', label: 'Rörliga utgifter' }, { id: 'scenarios', label: 'Scenarier' }]} />
    {active === 'musts' && <MustsView summary={summary} detection={detection} state={state} setState={setState} />}
    {active === 'variablePlan' && <VariablePlanView variablePlan={state.variablePlan} setVariablePlan={setVariablePlan} summary={summary} householdProfile={state.householdProfile} state={state} setState={setState} />}
    {active === 'scenarios' && <ScenariosView summary={summary} scenarioSummary={scenarioSummary} state={state} setState={setState} />}
  </>;
}

function ImportReviewView({ active, setActive, detection, state, setPartial, loadDemo, setTab, visibleReviewItems, onBuddyCleanup, onboardingActive, onContinueOnboarding }: { active: ImportReviewSection; setActive: (s: ImportReviewSection) => void; detection: DetectionResult; state: AppState; setPartial: (patch: Partial<AppState>) => void; loadDemo: () => void; setTab: (tab: TabId) => void; visibleReviewItems: DetectionResult['reviewItems']; onBuddyCleanup: () => void; onboardingActive?: boolean; onContinueOnboarding?: () => void }) {
  const transferCount = detection.transfers.filter(t => !state.transferDecisions[t.id]?.status || state.transferDecisions[t.id].status === 'pending').length;
  const actionableRecurring = getActionableRecurringCandidates(detection.recurring);
  const recurringCount = actionableRecurring.filter(r => !state.recurringDecisions[r.id]?.status).length;
  return <><PageTitle title="Import & granskning" subtitle="Importera kontoutdrag och granska hur Klirr tolkar transaktioner, överföringar och återkommande poster." />
    <SectionTabs<ImportReviewSection> active={active} onChange={setActive} items={[{ id: 'import', label: 'Importera' }, { id: 'accounts', label: 'Konton' }, { id: 'transactions', label: 'Transaktioner' }, { id: 'transfers', label: 'Överföringar', badge: transferCount }, { id: 'recurring', label: 'Återkommande', badge: recurringCount }, { id: 'review', label: 'Oklara poster', badge: visibleReviewItems.length }]} />
    {active === 'import' && <ImportView accounts={state.accounts} setAccounts={(accounts) => setPartial({ accounts })} setTransactions={(transactions) => setPartial({ transactions })} transactions={state.transactions} rules={state.rules} transferDecisions={state.transferDecisions} loadDemo={loadDemo} onImported={(section = 'recurring') => { setActive(section); const ob = normalizeOnboardingState(state.onboarding, state.onboardingCompleted); if (ob.status === 'IMPORT_PATH') setPartial({ onboarding: { ...ob, importCompleted: true, currentStep: 'importReview' } }); }} onAskBuddy={onBuddyCleanup} onboardingActive={onboardingActive} onContinueOnboarding={onContinueOnboarding} />}
    {active === 'accounts' && <AccountsView accounts={state.accounts} transactions={state.transactions} state={state} setState={(nextState) => setPartial(nextState)} />}
    {active === 'transactions' && <TransactionsView transactions={state.transactions} accounts={state.accounts} rules={state.rules} onExport={() => exportTransactionsCsv(state.transactions, state.accounts)} />}
    {active === 'transfers' && <TransfersView detection={detection} transactions={state.transactions} accounts={state.accounts} decisions={state.transferDecisions} setDecisions={(transferDecisions) => setPartial({ transferDecisions })} />}
    {active === 'recurring' && <RecurringView detection={detection} decisions={state.recurringDecisions} setDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} addRule={(rule) => setPartial({ rules: [...state.rules, rule] })} />}
    {active === 'review' && <ReviewView reviewItems={visibleReviewItems} recurringDecisions={state.recurringDecisions} setRecurringDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} reviewDecisions={state.reviewDecisions || {}} setReviewDecisions={(reviewDecisions) => setPartial({ reviewDecisions })} />}
  </>;
}


function MoreView({ active, setActive, state, setState, onReset, loadDemo, openOnboarding }: { active: MoreSection; setActive: (s: MoreSection) => void; state: AppState; setState: (s: AppState) => void; onReset: () => void; loadDemo: () => void; openOnboarding: () => void }) {
  return <><PageTitle title="Mer / Inställningar" subtitle="Regler, export, sync, demo-data och inställningar." />
    <SectionTabs<MoreSection> active={active} onChange={setActive} items={[{ id: 'rules', label: 'Regler' }, { id: 'settings', label: 'Inställningar' }, { id: 'privacy', label: 'Sekretess & data' }]} />
    {active === 'rules' && <RulesView rules={state.rules} setRules={(rules) => setState({ ...state, rules })} />}
    {active === 'settings' && <SettingsView state={state} setState={setState} loadDemo={loadDemo} onReset={onReset} openOnboarding={openOnboarding} restartOnboarding={() => { setState({ ...state, onboardingCompleted: false, onboarding: { ...normalizeOnboardingState(state.onboarding), status: 'MANUAL_PATH', path: 'manual', started: true, currentStep: 'household' } }); openOnboarding(); }} />}
    {active === 'privacy' && <PrivacyCenterView state={state} setState={setState} onReset={onReset} />}
  </>;
}

function BudgetBuddyView({ state, setState, summary, detection, visibleReviewCount, handledReviewCount, possibleIncomeDuplicates, setTab, setScenarioOff, autoMessage, onAutoMessageHandled }: { state: AppState; setState: (s: AppState) => void; summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; visibleReviewCount: number; handledReviewCount: number; possibleIncomeDuplicates: ReturnType<typeof detectPossibleIncomeDuplicates>; setTab: (t: TabId) => void; setScenarioOff: (ids: string[]) => void; autoMessage?: string; onAutoMessageHandled?: () => void }) {
  const [draft, setDraft] = useState('');
  const [buddyBusy, setBuddyBusy] = useState(false);
  const [composerComposing, setComposerComposing] = useState(false);
  const [quickChoicesOpen, setQuickChoicesOpen] = useState(false);
  const quickChoicesId = useId();
  const quickChoicesRef = useRef<HTMLDivElement | null>(null);
  const quickChoicesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userMessageCount = state.chatMessages.filter(m => m.role === 'user').length;
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [state.chatMessages]);
  useEffect(() => {
    const ob = normalizeOnboardingState(state.onboarding, state.onboardingCompleted);
    if (ob.status === 'SKIPPED' && !ob.skippedBuddyIntroShown && state.chatMessages.filter(m => m.role === 'user').length === 0) {
      const intro: ChatMessage = { id: uid('msg'), role: 'assistant', createdAt: todayIso(), content: 'Hej! 👋 Jag såg att du valde att utforska Klirr själv. Det är helt okej 😊 Jag kan hjälpa dig bygga Budgeten när det passar dig. Vad vill du börja med?', actions: [
        { label: 'Lägg till inkomst', tab: 'income' }, { label: 'Lägg till fast utgift', tab: 'musts' }, { label: 'Importera kontoutdrag', tab: 'import' }, { label: 'Planera rörliga utgifter', tab: 'variablePlan' }, { label: 'Städa min Budget', message: 'Städa min Budget' },
      ] };
      setState({ ...state, onboarding: { ...ob, skippedBuddyIntroShown: true }, chatMessages: [...state.chatMessages, intro] });
    }
  }, []);
  useEffect(() => { if (userMessageCount > 0) setQuickChoicesOpen(false); }, [userMessageCount]);
  useEffect(() => { if (autoMessage && !buddyBusy) { setQuickChoicesOpen(false); onAutoMessageHandled?.(); void send(autoMessage); } }, [autoMessage, buddyBusy]);
  useEffect(() => { setQuickChoicesOpen(false); }, [setTab]);
  useEffect(() => {
    if (!quickChoicesOpen) return;
    function closeFromPointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (quickChoicesRef.current?.contains(target) || quickChoicesTriggerRef.current?.contains(target)) return;
      setQuickChoicesOpen(false);
      quickChoicesTriggerRef.current?.focus();
    }
    function closeFromEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setQuickChoicesOpen(false);
      quickChoicesTriggerRef.current?.focus();
    }
    document.addEventListener('mousedown', closeFromPointer);
    document.addEventListener('touchstart', closeFromPointer);
    document.addEventListener('keydown', closeFromEscape);
    window.setTimeout(() => quickChoicesRef.current?.querySelector<HTMLButtonElement>('button[data-suggestion-item="true"]')?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', closeFromPointer);
      document.removeEventListener('touchstart', closeFromPointer);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [quickChoicesOpen]);

  function updateActionStatus(actionId: string, status: BuddyProposedAction['status'], baseState = state) {
    return { ...baseState, chatMessages: baseState.chatMessages.map(m => m.proposedAction?.id === actionId ? { ...m, proposedAction: { ...m.proposedAction, status } as BuddyProposedAction } : m) };
  }
  function applyOrCancel(action: BuddyProposedAction, intent: 'confirm' | 'cancel', baseState = state) {
    const beforeHealth = calculateBudgetHealth({ summary, detection, state, possibleIncomeDuplicates, visibleReviewCount, handledReviewCount });
    const statusState = updateActionStatus(action.id, intent === 'confirm' ? 'applied' : 'cancelled', baseState);
    const logged = appendBuddyActionHistory(statusState, { actionId: action.id, actionType: action.type, type: intent === 'confirm' ? 'confirmed' : 'cancelled', message: intent === 'confirm' ? 'Användaren bekräftade Budget Buddy-action.' : 'Användaren avbröt Budget Buddy-action.' });
    const result = intent === 'confirm' ? applyBuddyActionWithResult(logged, action) : { state: logged, status: 'applied' as const, message: action.type === 'update_variable_plan' ? 'Ingen fara, jag behåller den Rörliga Budgeten som den är 👍' : 'Ingen fara, jag låter inkomsten vara som den är 👍' };
    let finalState = intent === 'confirm' ? appendBuddyActionHistory(result.state, { actionId: action.id, actionType: action.type, type: result.status === 'applied' ? 'applied' : result.status === 'needs_choice' ? 'needs_user_choice' : 'failed', reason: result.message }) : result.state;
    const afterSummary = calculateBudget({ detection, recurringDecisions: finalState.recurringDecisions, incomes: finalState.incomes, manualExpenses: finalState.manualExpenses, variablePlan: finalState.variablePlan, scenarioOff: finalState.scenarioOff });
    const afterHealth = calculateBudgetHealth({ summary: afterSummary, detection, state: finalState, possibleIncomeDuplicates, visibleReviewCount, handledReviewCount });
    const healthText = intent === 'confirm' && result.status === 'applied' && action.type !== 'run_budget_checkup' ? ` ${explainBudgetHealthChange(beforeHealth, afterHealth)} ${action.undoable !== false ? 'Du kan ångra ändringen.' : ''}` : '';
    if (intent === 'confirm' && result.status === 'applied') finalState = appendBuddyActionHistory(finalState, { actionId: action.id, actionType: action.type, type: 'applied', message: healthText.trim(), previousBudgetHealthScore: beforeHealth.score, newBudgetHealthScore: afterHealth.score, budgetHealthReasons: afterHealth.reasons.map(r => r.label) });
    const msg: ChatMessage = { id: uid('msg'), role: 'assistant', createdAt: todayIso(), content: `${result.message}${healthText}`.trim() };
    setState({ ...finalState, chatMessages: [...finalState.chatMessages, msg] });
  }
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || buddyBusy) return;
    const pending = findPendingBuddyAction(state);
    const intent = pending ? detectBuddyActionIntent(trimmed) : null;
    const userMsg: ChatMessage = { id: uid('msg'), role: 'user', content: trimmed, createdAt: todayIso() };
    const afterUserState = { ...state, chatMessages: [...state.chatMessages, userMsg] };
    setDraft('');
    setQuickChoicesOpen(false);
    if (pending && intent) {
      applyOrCancel(pending, intent, afterUserState);
      return;
    }
    const isPlanningBuddyRequest = /förbättringsplan|alternativa planer|viktigaste mål|Budgetutveckling|hålla koll/i.test(trimmed);
    const safeAi = prepareSafeAiContext({ state: afterUserState, summary, detection, userMessage: trimmed, requestType: isPlanningBuddyRequest ? 'budget_buddy_planning' : 'budget_buddy_chat', purpose: isPlanningBuddyRequest ? 'Budget Buddy planering' : 'Budget Buddy-fråga', visibleReviewCount, handledReviewCount, workspaceId: state.activeWorkspaceId });
    if (!safeAi.allowed) {
      const blockedState = appendAiLog(afterUserState, safeAi.logEntry);
      setState({ ...blockedState, chatMessages: [...blockedState.chatMessages, { id: uid('msg'), role: 'assistant', createdAt: todayIso(), content: `Aktivera Budget Buddy AI ✨\n\n${safeAi.reason}\n\nBudget Buddy kan skicka en sammanfattad Budgetkontext om du aktiverar AI. Råa importerade transaktionsrader skickas inte. Du kan granska “Vad AI såg”, stänga av AI igen och fortsätta använda lokalt Budget Buddy utan AI.`, actions: [{ label: 'Aktivera Budget Buddy', tab: 'more' }, { label: 'Fortsätt utan AI', message: trimmed }, { label: 'Läs hur AI används', tab: 'more' }] }] });
      return;
    }
    setState(afterUserState);
    setBuddyBusy(true);
    try {
      const currentDate = new Date().toISOString();
      const budgetSuggestion = suggestVariableBudget({ available: summary.remainingAfterFixed, mode: trimmed.toLowerCase().includes('kris') ? 'crisis' : 'safe', householdProfile: state.householdProfile, currentVariablePlan: state.variablePlan });
      const actionableCandidates = getActionableRecurringCandidates(detection.recurring);
      const completion = calculateBudgetCompletion({ state, summary, detection, visibleReviewCount, handledReviewCount });
      const ob = normalizeOnboardingState(state.onboarding, state.onboardingCompleted);
      const context = safeAi.context;
      const localPlan = planBuddyAction({ message: trimmed, context, incomes: state.incomes, variablePlan: state.variablePlan, householdProfile: state.householdProfile, pendingAction: pending });
      const recentMessages = state.chatMessages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/budget-buddy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: trimmed, context, recentMessages, currentDate, currentMonth: new Date(currentDate).getMonth() + 1 }) });
      const data = await response.json();
      const proposedAction = data.proposedAction || localPlan.proposedAction;
      const reply: ChatMessage = { id: uid('msg'), role: 'assistant', content: data.message || localPlan.clarificationQuestion || 'Jag kunde inte svara just nu. Inga ändringar gjordes.', createdAt: todayIso(), actions: Array.isArray(data.actions) ? data.actions as BuddyAction[] : undefined, proposedAction };
      let nextState: AppState = appendAiLog({ ...state, chatMessages: [...afterUserState.chatMessages, reply], buddySession: { ...(state.buddySession || {}), currentGoal: proposedAction?.type === 'update_variable_plan' && proposedAction.payload.mode === 'crisis' ? 'crisis_budget' : proposedAction?.type === 'update_variable_plan' ? 'make_variable_plan' : proposedAction?.type === 'update_income' ? 'fix_income' : state.buddySession?.currentGoal, preferredStyle: proposedAction?.type === 'update_variable_plan' && proposedAction.payload.mode === 'crisis' ? 'crisis' : state.buddySession?.preferredStyle, lastProposedActionId: proposedAction?.id || state.buddySession?.lastProposedActionId, lastDiscussedPlan: proposedAction?.type === 'update_variable_plan' ? proposedAction.payload.items.map((item: { label: string; amount: number; category: string }) => ({ label: item.label, amount: item.amount, category: item.category })) : state.buddySession?.lastDiscussedPlan } }, { ...safeAi.logEntry, outcome: 'sent' });
      if (proposedAction) {
        nextState = appendBuddyActionHistory(nextState, { actionId: proposedAction.id, actionType: proposedAction.type, type: proposedAction.type === 'choose_income_to_update' ? 'needs_user_choice' : 'proposed', message: trimmed, reason: localPlan.explanationHints?.join(' ') });
        nextState = appendBuddyActionHistory(nextState, { actionId: proposedAction.id, actionType: proposedAction.type, type: 'rendered', message: proposedAction.title });
      } else if (localPlan.intent !== 'none') {
        nextState = appendBuddyActionHistory(nextState, { type: localPlan.missingInfo?.length ? 'missing_info' : 'no_action_planned', message: trimmed, reason: localPlan.clarificationQuestion || localPlan.explanationHints?.join(' ') });
      }
      setState(nextState);
    } catch {
      const reply = makeBuddyReply(trimmed, { summary, detection, rules: state.rules });
      setState({ ...state, chatMessages: [...afterUserState.chatMessages, { ...reply, content: `${reply.content}

Obs: Budget Buddy kunde inte svara via AI just nu. Inga ändringar gjordes — detta är ett lokalt tryggt fallback-svar.` }] });
    } finally {
      setBuddyBusy(false);
    }
  }
  function undoLast() { const result = undoLastBuddyAction(state); setState({ ...result.state, chatMessages: [...result.state.chatMessages, { id: uid('msg'), role: 'assistant', createdAt: todayIso(), content: result.message }] }); }
  function handleSuggestion(suggestion: string) {
    setQuickChoicesOpen(false);
    quickChoicesTriggerRef.current?.focus();
    void send(suggestion);
  }
  function handleComposerSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (composerComposing) return;
    void send(draft);
  }
  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (composerComposing || e.nativeEvent.isComposing || e.shiftKey || e.key !== 'Enter') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    void send(draft);
  }
  function runAction(action: NonNullable<ChatMessage['actions']>[number]) {
    if (action.tab) setTab(action.tab);
    if (action.scenarioOffIds) setScenarioOff(action.scenarioOffIds);
    if (action.message) send(action.message);
  }
  function actionSummary(action: BuddyProposedAction) {
    const riskText = action.riskLevel === 'high' ? 'Hög risk — dubbelkolla extra' : action.riskLevel === 'medium' ? 'Medelrisk — kräver tydligt ja' : action.riskLevel === 'low' ? 'Låg risk' : null;
    const preview = action.preview && <div className="stack">{action.preview.before?.length ? <><b>Före</b>{action.preview.before.map((item, i) => <div className="list-line" key={`b-${i}`}><span>{item.label}</span><b className="mono">{typeof item.amount === 'number' ? fmt(item.amount) : item.note}</b></div>)}</> : null}{action.preview.after?.length ? <><b>Efter</b>{action.preview.after.map((item, i) => <div className="list-line" key={`a-${i}`}><span>{item.label}</span><b className="mono">{typeof item.amount === 'number' ? fmt(item.amount) : item.note}</b></div>)}</> : null}{action.preview.impact?.map((item, i) => <div className="list-line" key={`i-${i}`}><span>{item.label}</span><b className="mono">{item.value}</b></div>)}</div>;
    if (action.type === 'update_income') return <div className="stack"><div className="list-line"><span>{action.description}</span><b className="mono">{fmt(action.payload.amount)}/mån</b></div>{preview}{action.payload.notes && <p className="hint">{action.payload.notes}</p>}{riskText && <span className="pill">{riskText}</span>}</div>;
    if (action.type === 'choose_income_to_update') return <div className="stack">{action.payload.candidateIncomes.map(item => <div className="list-line" key={item.incomeId}><span>{item.label}</span><b className="mono">{fmt(item.amount)}/mån</b></div>)}<p className="hint">Skriv namnet på inkomsten du vill ändra. Jag skapar ingen dubblett automatiskt.</p>{action.payload.notes && <p className="hint">{action.payload.notes}</p>}</div>;
    if (action.type === 'update_variable_plan') {
      const included = action.payload.items.filter(item => item.include !== false);
      const total = included.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const currentTotal = state.variablePlan.filter(item => item.include !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return <div className="stack">{action.payload.mode === 'crisis' && <p className="hint">🛟 Tillfälligt krisläge: mat skyddas först; nöje, sparande och marginal sänks innan mat blir orimligt låg. Granska manuellt.</p>}<div className="list-line"><span>Nuvarande rörliga utgifter</span><b className="mono">{fmt(currentTotal)}</b></div><div className="list-line"><span>Föreslagna rörliga utgifter</span><b className="mono">{fmt(total)}</b></div>{action.payload.items.map(item => <div className="list-line" key={item.id || item.label}><span>{item.label}<br/><small>{item.category}</small></span><b className="mono">{fmt(item.amount)}</b></div>)}{Number.isFinite(action.payload.marginLeft) && <div className="list-line"><span>Uppskattat kvar efter plan</span><b className="mono">{fmt(action.payload.marginLeft || 0)}</b></div>}<p className="hint">Jag vill dubbelkolla innan jag ändrar något 🫶 Det här ersätter de nuvarande rörliga utgifterna först när du bekräftar.</p>{action.payload.notes && <p className="hint">{action.payload.notes}</p>}{riskText && <span className="pill">{riskText}</span>}</div>;
    }
    if (action.type === 'run_budget_checkup') return <div className="stack">{action.payload.issues.map((issue, i) => <div className="list-line" key={i}><span>{issue.label}<br/><small>{issue.nextAction}</small>{issue.tab && <><br/><small>👉 Gå till: {issue.tab}</small></>}{issue.message && <><br/><small>💬 Säg till Buddy: “{issue.message}”</small></>}{issue.proposedAction && <><br/><small>✨ Kan följas upp med: {issue.proposedAction.title}</small></>}</span><span className="pill">{issue.severity}</span></div>)}</div>;
    if (action.type === 'create_rule') return <div className="stack"><div className="list-line"><span>Matcha text</span><b>{action.payload.matchText}</b></div><div className="list-line"><span>Kategori</span><b>{action.payload.category}</b></div><div className="list-line"><span>Typ</span><b>{action.payload.costType}</b></div>{preview}</div>;
    if (action.type === 'move_recurring_item' || action.type === 'reject_recurring_item' || action.type === 'fix_duplicate_income') return <div className="stack"><div className="list-line"><span>{action.payload.label}</span><b>{action.type}</b></div>{preview}<p className="hint">Kontoutdraget ändras inte — bara budgettolkningen.</p></div>;
    if (action.type === 'create_scenario' || action.type === 'apply_scenario_off_ids') return <div className="stack">{preview}<p className="hint">Scenario: {action.payload.label || action.payload.scenarioOffIds.join(', ')}</p></div>;
    return <div className="stack">{preview}<p className="hint">Ingen direkt ändring görs utan bekräftelse.</p></div>;
  }
  return <Card className="chat-shell">
    <div className="chat-header"><h2 style={{ margin: 0 }}>Budget Buddy ✨</h2><p style={{ margin: '3px 0 0', color: 'var(--muted)' }}>Din Budget-kompis. Inget ändras förrän du säger ja.</p></div>
    <div className="chat-messages" ref={scrollRef}>
      {state.chatMessages.map((m, index) => <div key={m.id} className={`message ${m.role}`}><div>{m.content}</div>{m.proposedAction && <div className="suggestion-box action-card"><h3>{m.proposedAction.title}</h3><p>{m.proposedAction.description}</p>{actionSummary(m.proposedAction)}<div className="row action-card-controls"><button className="btn primary" disabled={m.proposedAction.status !== 'pending'} onClick={() => applyOrCancel(m.proposedAction!, 'confirm')}>{m.proposedAction.confirmLabel || 'Skriv vilken inkomst'} </button><button className="btn" disabled={m.proposedAction.status !== 'pending'} onClick={() => applyOrCancel(m.proposedAction!, 'cancel')}>{m.proposedAction.cancelLabel}</button><span className={`pill ${m.proposedAction.status === 'applied' ? 'green' : m.proposedAction.status === 'cancelled' ? 'danger' : 'warn'}`} aria-live="polite">{m.proposedAction.status === 'pending' ? 'Föreslagen · inte ändrad än' : m.proposedAction.status === 'applied' ? 'Applicerad · Budgeten ändrad' : m.proposedAction.status === 'cancelled' ? 'Avbruten · inget ändrat' : m.proposedAction.status}</span></div></div>}{m.content.toLowerCase().includes('ångra') && <div className="message-actions"><button className="btn small" onClick={undoLast}>Ångra senaste</button></div>}{m.actions && <div className="message-actions">{m.actions.map((a, i) => <button className="btn small" key={i} onClick={() => runAction(a)}>{a.label}</button>)}</div>}</div>)}
    </div>
    <div className="chat-footer">
      <div className="quick-choice-anchor"><button ref={quickChoicesTriggerRef} className="btn small ghost quick-choice-trigger" type="button" aria-haspopup="dialog" aria-expanded={quickChoicesOpen} aria-controls={quickChoicesId} disabled={buddyBusy} onClick={() => setQuickChoicesOpen(open => !open)}>Snabbval ✨</button>{quickChoicesOpen && <div id={quickChoicesId} ref={quickChoicesRef} className="quick-choice-popover" role="dialog" aria-modal="false" aria-labelledby={`${quickChoicesId}-title`}><div className="quick-choice-head"><h3 id={`${quickChoicesId}-title`}>Vad vill du ha hjälp med?</h3><button className="btn small ghost" type="button" onClick={() => { setQuickChoicesOpen(false); quickChoicesTriggerRef.current?.focus(); }} aria-label="Stäng snabbval">×</button></div>{(['Förstå', 'Förbättra', 'Ändra', 'Import och koll'] as BuddySuggestionGroup[]).map(group => <section className="quick-choice-group" key={group} aria-labelledby={`${quickChoicesId}-${group}`}><h4 id={`${quickChoicesId}-${group}`}>{group}</h4>{buddySuggestionItems.filter(item => item.group === group).map(item => <button data-suggestion-item="true" className="quick-choice-item" type="button" key={item.label} onClick={() => handleSuggestion(item.message || item.label)}><span><b>{item.label}</b>{item.description && <small>{item.description}</small>}</span><span aria-hidden="true">›</span></button>)}</section>)}</div>}</div><form className="chat-input" onSubmit={handleComposerSubmit}><textarea className="textarea" rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleComposerKeyDown} onCompositionStart={() => setComposerComposing(true)} onCompositionEnd={() => setComposerComposing(false)} placeholder="Fråga om din Budget…" /><button className="btn primary send-button" type="submit" disabled={buddyBusy || !draft.trim()} aria-label="Skicka meddelande"><span className="send-button-label">{buddyBusy ? 'Tänker…' : 'Skicka'}</span><span className="send-button-icon" aria-hidden="true">➤</span></button></form>
      {buddyBusy && <p className="thinking-note" role="status">Budget Buddy tänker…</p>}
    </div>
  </Card>;
}

function MustsView({ summary, detection, state, setState }: { summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; state: AppState; setState: (s: AppState) => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('Fast kostnad');
  const manualMusts = state.manualExpenses.filter(m => m.costType === 'fixed');
  const recurringMusts = detection.recurring.filter(r => {
    const d = state.recurringDecisions[r.id];
    const status = d?.status || (r.costTypeDefault === 'income' ? 'pending' : (r.confidence >= 70 ? 'confirmed' : 'pending'));
    const costType = d?.costType || r.costTypeDefault;
    return costType === 'fixed' && (status === 'confirmed' || status === 'rejected');
  });
  const hasMusts = manualMusts.length > 0 || recurringMusts.length > 0;
  function add() {
    if (!label || !amount) return;
    const mx: ManualExpense = { id: uid('mx'), label, amount: Number(amount), category, costType: 'fixed', active: true, frequency: 'monthly' };
    setState({ ...state, manualExpenses: [...state.manualExpenses, mx] });
    setLabel(''); setAmount('');
  }
  function updateManual(id: string, patch: Partial<ManualExpense>) {
    setState({ ...state, manualExpenses: state.manualExpenses.map(m => m.id === id ? { ...m, ...patch } : m) });
  }
  function removeManual(id: string) {
    setState({ ...state, manualExpenses: state.manualExpenses.filter(m => m.id !== id) });
  }
  function updateRecurring(id: string, patch: Partial<RecurringDecision>) {
    const current = state.recurringDecisions[id];
    setState({ ...state, recurringDecisions: { ...state.recurringDecisions, [id]: { ...current, status: 'confirmed', costType: 'fixed', ...patch } } });
  }
  function rejectRecurring(id: string) {
    const current = state.recurringDecisions[id];
    setState({ ...state, recurringDecisions: { ...state.recurringDecisions, [id]: { ...current, status: 'rejected', costType: current?.costType || 'fixed' } } });
  }
  function moveRecurringToVariable(id: string) {
    const current = state.recurringDecisions[id];
    setState({ ...state, recurringDecisions: { ...state.recurringDecisions, [id]: { ...current, status: 'confirmed', costType: 'variable' } } });
  }
  return <><PageTitle title="Fasta utgifter" subtitle="Fasta kostnader som måste betalas varje månad. Lägg manuella fasta utgifter här, inte under inkomster." />
    <CompactSummary items={[{ label: 'Fasta utgifter per månad', value: fmt(summary.fixedTotal) }, { label: 'Aktiva poster', value: String(manualMusts.filter(m => m.active).length + recurringMusts.filter(r => (state.recurringDecisions[r.id]?.status || (r.confidence >= 70 ? 'confirmed' : 'pending')) !== 'rejected').length) }]} />
    <Card className="budget-list-card"><div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><div><h3>Överblick över fasta utgifter</h3><p className="hint">Importerade fasta utgifter redigeras som overrides. Kontoutdraget ändras inte.</p></div></div><div className="budget-list">
      {manualMusts.map(m => <ExpandableBudgetItem key={m.id} id={m.id} title={m.label} amount={fmt(m.amount)} meta={`${m.category} · ${frequencyLabel(m.frequency)} · Manuell`} status={m.active ? 'Aktiv' : 'Av'} tone={m.active ? 'green' : 'warn'}>
        <div className="budget-detail-grid"><label>Aktiv<label className="checkbox-card"><input type="checkbox" checked={m.active} onChange={e => updateManual(m.id, { active: e.target.checked })} /> På</label></label><label>Namn<input className="input" value={m.label} onChange={e => updateManual(m.id, { label: e.target.value })} /></label><label>Belopp/mån<input className="input" type="number" value={m.amount} onChange={e => updateManual(m.id, { amount: Number(e.target.value) })} /></label><label>Kategori<input className="input" value={m.category} onChange={e => updateManual(m.id, { category: e.target.value })} /></label><label>Frekvens<select className="select" value={m.frequency || 'monthly'} onChange={e => updateManual(m.id, { frequency: e.target.value as Frequency })}><option value="monthly">Månad</option><option value="quarterly">Kvartal</option><option value="yearly">År</option><option value="irregular">Tillfällig</option></select></label></div><div className="budget-detail-actions"><button className="btn small danger" onClick={() => removeManual(m.id)}>Ta bort</button></div>
      </ExpandableBudgetItem>)}
      {recurringMusts.map(r => { const d = state.recurringDecisions[r.id]; const status = d?.status || (r.confidence >= 70 ? 'confirmed' : 'pending'); const counted = status !== 'rejected'; const labelText = d?.labelOverride ?? r.label; const amountValue = d?.monthlyAmountOverride ?? Math.round(r.monthlyAmount); return <ExpandableBudgetItem key={r.id} id={r.id} title={labelText} amount={fmt(amountValue)} meta={`${d?.category ?? r.category} · ${frequencyLabel(d?.frequencyOverride ?? r.frequency)} · Importerad återkommande`} status={statusLabel(status)} tone={statusTone(status)} warning={!counted ? 'Räknas inte i Budgeten' : undefined}>
        <p className="hint imported-override">Från bankimport · {r.confidence}% säkerhet. Ändringar här är overrides och ändrar inte kontoutdraget.</p><div className="budget-detail-grid"><label>Namn<input className="input" value={labelText} onChange={e => updateRecurring(r.id, { labelOverride: e.target.value })} disabled={!counted} /></label><label>Belopp/mån<input className="input" type="number" value={amountValue} onChange={e => updateRecurring(r.id, { monthlyAmountOverride: Number(e.target.value) })} disabled={!counted} /></label><label>Kategori<input className="input" value={d?.category ?? r.category} onChange={e => updateRecurring(r.id, { category: e.target.value })} disabled={!counted} /></label><label>Frekvens<select className="select" value={d?.frequencyOverride ?? r.frequency} onChange={e => updateRecurring(r.id, { frequencyOverride: e.target.value as Frequency })} disabled={!counted}><option value="monthly">Månad</option><option value="quarterly">Kvartal</option><option value="yearly">År</option><option value="irregular">Tillfällig</option></select></label></div><div className="budget-detail-actions">{counted ? <><button className="btn small" onClick={() => moveRecurringToVariable(r.id)}>Flytta till rörlig</button><button className="btn small danger" onClick={() => rejectRecurring(r.id)}>Räkna bort</button></> : <button className="btn small" onClick={() => updateRecurring(r.id, { status: 'confirmed' })}>Räkna med igen</button>}</div>
      </ExpandableBudgetItem>; })}
      {!hasMusts && <Empty><b>Inga fasta utgifter ännu.</b><br/>Lägg till fasta utgifter som hyra, el och försäkring så Klirr kan visa vad livet kostar varje månad.</Empty>}
    </div></Card>
    <Card><h3>Lägg till fast utgift</h3><div className="row"><input className="input" placeholder="Namn" value={label} onChange={e => setLabel(e.target.value)} /><input className="input money-input" type="number" placeholder="kr/mån" value={amount} onChange={e => setAmount(e.target.value)} /><input className="input category-input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><button className="btn primary" onClick={add}>Lägg till</button></div></Card>
  </>;
}

function VariablePlanView({ variablePlan, setVariablePlan, summary, householdProfile, state, setState }: { variablePlan: VariablePlanItem[]; setVariablePlan: (p: VariablePlanItem[]) => void; summary: ReturnType<typeof calculateBudget>; householdProfile?: HouseholdProfile; state: AppState; setState: (s: AppState) => void }) {
  const [mode, setMode] = useState<BudgetSuggestionMode>('balanced');
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestVariableBudget> | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const total = variablePlan.filter(v => v.include).reduce((s, v) => s + v.amount, 0);
  const remainingAfterFixed = summary.remainingAfterFixed;
  const fixedItemIds = new Set(summary.fixedItems.map(item => item.id));
  const incomeItemIds = new Set(summary.incomeItems.map(item => item.id));
  const recurringVariableExpenses = summary.activeRecurring.filter(item => {
    const decisionType = state.recurringDecisions[item.id]?.costType;
    return decisionType === 'variable' || (!decisionType && !fixedItemIds.has(item.id) && !incomeItemIds.has(item.id));
  });
  const manualVariableExpenses = state.manualExpenses.filter(expense => expense.costType === 'variable');
  function update(id: string, patch: Partial<VariablePlanItem>) { setVariablePlan(variablePlan.map(v => v.id === id ? { ...v, ...patch } : v)); }
  function add() { setVariablePlan([...variablePlan, { id: uid('vp'), label: 'Ny rörlig post', amount: 0, category: 'Rörligt', include: true }]); }
  function updateRecurringVariable(id: string, patch: Partial<RecurringDecision>) {
    const current: RecurringDecision = state.recurringDecisions[id] || { status: 'confirmed', costType: 'variable' };
    setState({ ...state, recurringDecisions: { ...state.recurringDecisions, [id]: { ...current, status: current.status || 'confirmed', costType: 'variable', ...patch } } });
  }
  function updateManualVariable(id: string, patch: Partial<ManualExpense>) {
    setState({ ...state, manualExpenses: state.manualExpenses.map(expense => expense.id === id ? { ...expense, ...patch, costType: 'variable' } : expense) });
  }
  function addManualVariable() {
    setState({ ...state, manualExpenses: [...state.manualExpenses, { id: uid('mx_var'), label: 'Ny rörlig utgift', amount: 0, category: 'Rörligt', costType: 'variable', active: true, frequency: 'monthly' }] });
  }
  function removeManualVariable(id: string) {
    setState({ ...state, manualExpenses: state.manualExpenses.filter(expense => expense.id !== id) });
  }
  async function makeSuggestion(nextMode = mode) {
    setSuggestBusy(true);
    try {
      const response = await fetch('/api/suggest-budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary, mode: nextMode, householdProfile: normalizeHouseholdProfile(householdProfile) }) });
      const data = await response.json();
      if (Array.isArray(data.items)) {
        setSuggestion({
          marginLeft: Number(data.marginLeft ?? data.buffer ?? 0),
          buffer: Number(data.buffer || data.marginLeft || 0),
          safetyTotal: Number(data.safetyTotal || 0),
          note: data.explanation || 'Budget Buddy skapade ett förslag baserat på kvar efter fasta utgifter.',
          explanationNotes: Array.isArray(data.explanationNotes) ? data.explanationNotes : [data.explanation || 'Budget Buddy skapade ett förslag baserat på kvar efter fasta utgifter.'],
          items: data.items.map((item: any, idx: number) => ({ id: `vp_ai_api_${Date.now()}_${idx}`, label: String(item.label || 'Rörlig post'), amount: Number(item.amount || 0), category: String(item.category || 'Rörligt'), include: true })),
          categoryCaps: data.categoryCaps || {},
          clampedCategories: Array.isArray(data.clampedCategories) ? data.clampedCategories : [],
          overflowToSafety: Number(data.overflowToSafety || 0),
          guidelineComparison: data.guidelineComparison || suggestVariableBudget({ available: remainingAfterFixed, mode: nextMode, householdProfile }).guidelineComparison,
        });
      } else {
        setSuggestion(suggestVariableBudget({ available: remainingAfterFixed, mode: nextMode, householdProfile, currentVariablePlan: variablePlan }));
      }
    } catch {
      setSuggestion(suggestVariableBudget({ available: remainingAfterFixed, mode: nextMode, householdProfile, currentVariablePlan: variablePlan }));
    } finally {
      setSuggestBusy(false);
    }
  }
  function applySuggestion() {
    if (!suggestion) return;
    setVariablePlan(suggestion.items.map(item => ({ ...item, id: uid('vp_ai') })));
  }
  return <><PageTitle title="Rörliga utgifter" subtitle="Pengarna du kan styra efter fasta utgifter: mat, transport, nöje, sparande och övrigt." />
    <div className="grid grid-3"><MetricCard label="Kvar efter fasta utgifter" value={fmtSigned(remainingAfterFixed)} tone={remainingAfterFixed >= 0 ? 'good' : 'bad'} /><MetricCard label="Rörliga utgifter totalt" value={fmt(total)} /><MetricCard label="Marginal" value={fmtSigned(summary.remainingAfterPlan)} tone={summary.remainingAfterPlan >= 0 ? 'good' : 'bad'} /></div>
    <Card className="soft"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h3>✨ Föreslå budget</h3><p className="hint">Budget Buddy räknar på vad du har kvar efter fasta kostnader och föreslår rörliga utgifter. Förslaget ändrar inget förrän du trycker på "Använd förslaget".</p></div><span className="pill green">AI-ready / lokal fallback</span></div><div className="row" style={{ marginTop: 12 }}><select className="select" style={{ maxWidth: 230 }} value={mode} onChange={e => { const next = e.target.value as BudgetSuggestionMode; setMode(next); makeSuggestion(next); }}><option value="safe">Trygg budget</option><option value="balanced">Balanserad budget</option><option value="boost">Lite friare budget</option></select><button className="btn primary" disabled={suggestBusy} onClick={() => makeSuggestion()}>{suggestBusy ? 'Tar fram förslag…' : 'Föreslå budget'}</button>{suggestion && <button className="btn" onClick={applySuggestion}>Använd förslaget</button>}</div>{suggestion && <div className="suggestion-box"><p><b>Budget Buddys förslag:</b> {suggestion.note}</p><p className="hint">Lämnar cirka <b>{fmt(suggestion.marginLeft ?? suggestion.buffer)}</b> som extra marginal efter de rörliga utgifterna. Total trygghetsdel: <b>{fmt(suggestion.safetyTotal)}</b>.</p>{suggestion.overflowToSafety > 0 && <p className="hint">Matbudgeten och andra vardagskategorier har rimlighetstak. Extra utrymme på <b>{fmt(suggestion.overflowToSafety)}</b> läggs hellre på buffert och marginal.</p>}<div className="stack">{suggestion.items.map(item => <div className="list-line" key={item.id}><span>{item.label}<br/><small style={{ color: 'var(--muted)' }}>{item.category}{suggestion.clampedCategories.includes(item.label) ? ' · begränsad till rimlig nivå' : ''}</small>{item.label === 'Mat och hushåll' && suggestion.guidelineComparison?.food && <><br/><small style={{ color: 'var(--muted)' }}>Jämfört med Konsumentverkets riktvärde: cirka {fmtSigned(suggestion.guidelineComparison.food.difference)}. {suggestion.guidelineComparison.food.note}</small></>}</span><b className="mono">{fmt(item.amount)}</b></div>)}</div></div>}</Card>
    <Card><h3>Redigera Rörliga utgifter</h3><p className="hint">Budgetraderna är schabloner för sådant du styr själv, till exempel mat, nöje och sparande.</p><div className="stack">{variablePlan.map(v => <div className="edit-row variable-edit-row" key={v.id}><label className="toggle-label"><input type="checkbox" checked={v.include} onChange={e => update(v.id, { include: e.target.checked })} /> På</label><input className="input" aria-label="Namn" value={v.label} onChange={e => update(v.id, { label: e.target.value })} /><input className="input money-input" aria-label="Belopp" type="number" value={v.amount} onChange={e => update(v.id, { amount: Number(e.target.value) })} /><input className="input category-input" aria-label="Kategori" value={v.category} onChange={e => update(v.id, { category: e.target.value })} /><button className="btn small danger" onClick={() => setVariablePlan(variablePlan.filter(x => x.id !== v.id))}>Ta bort</button></div>)}</div><button className="btn" style={{ marginTop: 12 }} onClick={add}>Lägg till rad</button></Card>
    <Card><h3>Redigera rörliga utgifter</h3><p className="hint">Här ändrar du rörliga utgifter som kommer från importerade återkommande transaktioner eller som du lagt in manuellt. Ändringar sparas direkt och påverkar Budgeten.</p><div className="stack">{recurringVariableExpenses.map(expense => <div className="edit-row variable-expense-edit-row" key={expense.id}><span className="pill">Import</span><input className="input" aria-label="Namn" value={expense.label} onChange={e => updateRecurringVariable(expense.id, { labelOverride: e.target.value })} /><input className="input money-input" aria-label="Belopp per månad" type="number" value={Math.round(expense.amount)} onChange={e => updateRecurringVariable(expense.id, { monthlyAmountOverride: Number(e.target.value) })} /><input className="input category-input" aria-label="Kategori" value={expense.category} onChange={e => updateRecurringVariable(expense.id, { category: e.target.value })} /><select className="select frequency-input" aria-label="Frekvens" value={expense.frequency || 'monthly'} onChange={e => updateRecurringVariable(expense.id, { frequencyOverride: e.target.value as Frequency })}><option value="monthly">Månad</option><option value="quarterly">Kvartal</option><option value="yearly">År</option><option value="irregular">Tillfällig</option></select><button className="btn small" onClick={() => updateRecurringVariable(expense.id, { status: 'rejected' })}>Räkna bort</button></div>)}{manualVariableExpenses.map(expense => <div className="edit-row variable-expense-edit-row" key={expense.id}><label className="toggle-label"><input type="checkbox" checked={expense.active} onChange={e => updateManualVariable(expense.id, { active: e.target.checked })} /> På</label><input className="input" aria-label="Namn" value={expense.label} onChange={e => updateManualVariable(expense.id, { label: e.target.value })} /><input className="input money-input" aria-label="Belopp" type="number" value={expense.amount} onChange={e => updateManualVariable(expense.id, { amount: Number(e.target.value) })} /><input className="input category-input" aria-label="Kategori" value={expense.category} onChange={e => updateManualVariable(expense.id, { category: e.target.value })} /><select className="select frequency-input" aria-label="Frekvens" value={expense.frequency || 'monthly'} onChange={e => updateManualVariable(expense.id, { frequency: e.target.value as Frequency })}><option value="monthly">Månad</option><option value="quarterly">Kvartal</option><option value="yearly">År</option><option value="irregular">Tillfällig</option></select><button className="btn small danger" onClick={() => removeManualVariable(expense.id)}>Ta bort</button></div>)}{!recurringVariableExpenses.length && !manualVariableExpenses.length && <Empty><b>Inga rörliga återkommande utgifter ännu.</b><br/>Här hamnar återkommande men styrbara kostnader som påverkar din Rörliga Budget. Nästa steg: lägg till en manuell rad eller bekräfta rörliga återkommande poster under Import & granskning.</Empty>}</div><button className="btn" style={{ marginTop: 12 }} onClick={addManualVariable}>Lägg till rörlig utgift</button></Card>
  </>;
}

function RecurringView({ detection, decisions, setDecisions, addRule }: { detection: DetectionResult; decisions: Record<string, RecurringDecision>; setDecisions: (d: Record<string, RecurringDecision>) => void; addRule: (r: Rule) => void }) {
  const items = getActionableRecurringCandidates(detection.recurring);
  const incomeItems = items.filter(r => r.costTypeDefault === 'income').length;
  const expenseItems = items.length - incomeItems;
  function patch(id: string, p: Partial<RecurringDecision>) { const current: RecurringDecision = decisions[id] || { status: 'pending' }; setDecisions({ ...decisions, [id]: { ...current, ...p } }); }
  return <><PageTitle title="Återkommande inkomster och utgifter" subtitle="Bekräfta vad Klirr ska räkna med framåt. Inkomster räknas inte in förrän du bekräftar dem." />
    <CompactSummary items={[{ label: 'Att granska', value: String(items.length) }, { label: 'Möjliga inkomster', value: String(incomeItems) }, { label: 'Möjliga utgifter', value: String(expenseItems) }]} />
    <div className="budget-list">{items.map(r => { const d = decisions[r.id]; const status = d?.status || 'pending'; const currentCostType = d?.costType || r.costTypeDefault; const isIncome = currentCostType === 'income'; return <ExpandableBudgetItem key={r.id} id={r.id} title={r.label} amount={`${isIncome ? '+' : ''}${fmt(d?.monthlyAmountOverride ?? r.monthlyAmount)}`} meta={`${r.category} · ${costTypeLabel(currentCostType)} · ${frequencyLabel(r.frequency)}`} status={statusLabel(status)} tone={statusTone(status)} warning={status === 'pending' ? 'Väntar på beslut' : undefined}>
      <p className="hint">{actionableCandidateReason(r)} · {r.reason}. {r.occurrences} förekomster · {r.confidence}% säkerhet från import.</p><div className="budget-detail-grid"><label>Klassning<select className="select" value={currentCostType} onChange={e => patch(r.id, { costType: e.target.value as RecurringDecision['costType'] })}><option value="fixed">Fast utgift</option><option value="variable">Rörlig utgift</option><option value="income">Inkomst</option></select></label><label>Belopp/mån<input className="input" type="number" value={d?.monthlyAmountOverride ?? Math.round(r.monthlyAmount)} onChange={e => patch(r.id, { monthlyAmountOverride: Number(e.target.value) })} /></label></div><div className="budget-detail-actions"><button className="btn small primary" onClick={() => patch(r.id, { status: 'confirmed' })}>Bekräfta</button><button className="btn small" onClick={() => patch(r.id, { status: 'rejected' })}>Räkna bort</button><button className="btn small" onClick={() => addRule({ id: uid('rule'), matchText: r.normName.split(' ')[0], category: r.category, costType: currentCostType || r.costTypeDefault })}>Spara regel</button></div>
    </ExpandableBudgetItem>; })}{!items.length && <Empty><b>Inget att granska just nu 🎉</b><br/>När du importerar kontoutdrag visar Klirr möjliga återkommande inkomster och kostnader här.</Empty>}</div></>;
}

function ReviewView({ reviewItems, recurringDecisions, setRecurringDecisions, reviewDecisions, setReviewDecisions }: { reviewItems: DetectionResult['reviewItems']; recurringDecisions: Record<string, RecurringDecision>; setRecurringDecisions: (d: Record<string, RecurringDecision>) => void; reviewDecisions: Record<string, ReviewDecision>; setReviewDecisions: (d: Record<string, ReviewDecision>) => void }) {
  function decide(item: DetectionResult['reviewItems'][number], status: 'confirmed' | 'rejected') {
    if (item.recurringId) setRecurringDecisions({ ...recurringDecisions, [item.recurringId]: { ...recurringDecisions[item.recurringId], status } });
    else setReviewDecisions({ ...reviewDecisions, [item.id]: { status, note: status === 'confirmed' ? 'Hanterad från Oklara poster.' : 'Borträknad från Oklara poster.' } });
  }
  return <><PageTitle title="Oklara poster" subtitle="Saker som Klirr inte vill räkna in utan att du kontrollerar dem." />
    <CompactSummary items={[{ label: 'Kvar att granska', value: String(reviewItems.length) }, { label: 'Prioritet', value: reviewItems.length ? 'Kontrollera innan Budgeten känns klar' : 'Inget kvar' }]} />
    <div className="budget-list">{reviewItems.map(it => <ExpandableBudgetItem key={it.id} id={it.id} title={it.description} amount={fmt(Math.abs(it.amount))} meta={`${it.date} · ${reviewTypeLabel(it.type)}`} status="Oklart" tone="warn" warning="Behöver beslut">
      <p className="hint">{it.note}</p><div className="budget-detail-actions"><button className="btn small primary" onClick={() => decide(it, 'confirmed')}>Räkna med</button><button className="btn small" onClick={() => decide(it, 'rejected')}>Räkna bort</button><span className="hint">Beslutet sparas och döljer posten.</span></div>
    </ExpandableBudgetItem>)}{!reviewItems.length && <Empty><b>Inget att granska just nu 🎉</b><br/>Oklara poster visas här när Klirr behöver din hjälp för att skydda Budgeten.</Empty>}</div></>;
}

function ScenariosView({ summary, scenarioSummary, state, setState }: { summary: ReturnType<typeof calculateBudget>; scenarioSummary: ReturnType<typeof calculateBudget>; state: AppState; setState: (s: AppState) => void }) {
  const all = [...summary.fixedItems, ...summary.variableItems];
  const off = new Set(state.scenarioOff);
  function toggle(id: string) { setState({ ...state, scenarioOff: off.has(id) ? state.scenarioOff.filter(x => x !== id) : [...state.scenarioOff, id] }); }
  return <><PageTitle title="Scenarier" subtitle="Testa hur Budgeten påverkas om något förändras. Scenarier är tillfälliga och ändrar inte originalet." />
    <div className="grid grid-3"><MetricCard label="Nuvarande kvar" value={fmtSigned(summary.remainingAfterPlan)} /><MetricCard label="Scenario kvar" value={fmtSigned(scenarioSummary.remainingAfterPlan)} tone={scenarioSummary.remainingAfterPlan >= summary.remainingAfterPlan ? 'good' : 'bad'} /><MetricCard label="Skillnad" value={fmtSigned(scenarioSummary.remainingAfterPlan - summary.remainingAfterPlan)} /></div>
    <Card><div className="stack">{all.map(i => <label className="list-line" key={i.id}><span><input type="checkbox" checked={!off.has(i.id)} onChange={() => toggle(i.id)} /> {i.label}</span><b className="mono">{fmt(i.amount)}</b></label>)}</div><button className="btn" style={{ marginTop: 12 }} onClick={() => setState({ ...state, scenarioOff: [] })}>Återställ</button></Card>
  </>;
}

function TransfersView({ detection, transactions, accounts, decisions, setDecisions }: { detection: DetectionResult; transactions: Transaction[]; accounts: Account[]; decisions: Record<string, TransferDecision>; setDecisions: (d: Record<string, TransferDecision>) => void }) {
  const tx = new Map(transactions.map(t => [t.id, t])); const acc = new Map(accounts.map(a => [a.id, a.name]));
  function patch(id: string, status: TransferDecision['status']) { setDecisions({ ...decisions, [id]: { status } }); }
  return <><PageTitle title="Interna överföringar" subtitle="Mellan egna konton. Räknas inte som inkomst eller utgift." />
    <CompactSummary items={[{ label: 'Möjliga överföringar', value: String(detection.transfers.length) }, { label: 'Väntar', value: String(detection.transfers.filter(t => (decisions[t.id]?.status || 'pending') === 'pending').length) }]} />
    <div className="budget-list">{detection.transfers.map(t => { const d = tx.get(t.debitTxId)!; const c = tx.get(t.creditTxId)!; const status = decisions[t.id]?.status || 'pending'; return <ExpandableBudgetItem key={t.id} id={t.id} title={`${acc.get(d.accountId)} → ${acc.get(c.accountId)}`} amount={fmt(Math.abs(d.amount))} meta={`${d.date} / ${c.date} · Intern överföring?`} status={statusLabel(status)} tone={statusTone(status)} warning={status === 'pending' ? 'Väntar' : undefined}>
      <p className="hint">Varför Klirr tror det: {t.reason} · {t.confidence}% säkerhet. Bekräftade överföringar påverkar inte Budgeten som inkomst eller kostnad.</p><div className="budget-detail-actions"><button className="btn small primary" onClick={() => patch(t.id, 'confirmed')}>Bekräfta</button><button className="btn small" onClick={() => patch(t.id, 'rejected')}>Inte intern</button></div>
    </ExpandableBudgetItem>; })}{!detection.transfers.length && <Empty><b>Inga interna överföringar hittades.</b><br/>Importera fler konton eller gå vidare till återkommande poster.</Empty>}</div></>;
}

function IncomeView({ incomes, setIncomes, summary, detection, recurringDecisions, setRecurringDecisions }: { incomes: Income[]; setIncomes: (i: Income[]) => void; summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; recurringDecisions: Record<string, RecurringDecision>; setRecurringDecisions: (d: Record<string, RecurringDecision>) => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState('');
  const unifiedIncomeItems = getUnifiedIncomeItems(summary, incomes);
  const recurringIncomeItems = unifiedIncomeItems.filter(item => item.source === 'recurring');
  const possibleDuplicates = detectPossibleIncomeDuplicates(incomes, recurringIncomeItems);
  function addIncome() {
    if (!label || !amount) return;
    setIncomes([...incomes, { id: uid('inc'), label, amount: Number(amount), frequency: 'monthly' }]);
    setLabel(''); setAmount('');
  }
  function updateIncome(id: string, patch: Partial<Income>) {
    setIncomes(incomes.map(i => i.id === id ? { ...i, ...patch } : i));
  }
  function removeIncome(id: string) {
    setIncomes(incomes.filter(i => i.id !== id));
  }
  function updateRecurringIncome(id: string, patch: Partial<RecurringDecision>) {
    setRecurringDecisions({ ...recurringDecisions, [id]: { ...recurringDecisions[id], status: 'confirmed', costType: 'income', ...patch } });
  }
  function rejectRecurringIncome(id: string) {
    setRecurringDecisions({ ...recurringDecisions, [id]: { ...recurringDecisions[id], status: 'rejected' } });
  }
  function originalRecurring(id: string) {
    return detection.recurring.find(r => r.id === id);
  }
  return <><PageTitle title="Inkomster" subtitle="Här visas både manuella inkomster och importerade inkomster som du har bekräftat från kontoutdrag." />
    <CompactSummary items={[{ label: 'Inkomst per månad', value: fmt(summary.totalIncome) }, { label: 'Aktiva inkomstkällor', value: String(incomes.length + recurringIncomeItems.length) }]} />
    {!!possibleDuplicates.length && <Card className="warn"><h3>Möjlig dubbelräkning</h3><p>Det ser ut som att du kan ha både manuell lön och importerad lön aktiverad. Om det är samma inkomst bör du räkna bort en av dem.</p><div className="stack">{possibleDuplicates.map(dup => <div className="list-line" key={`${dup.manual.id}-${dup.recurring.id}`}><span>{dup.manual.label} + {dup.recurring.label}<br/><small>{dup.reasons.join(', ')}</small></span><b className="mono">{fmt(dup.recurring.amount)}</b></div>)}</div></Card>}
    <Card className="budget-list-card"><h3>Inkomstkällor</h3><div className="budget-list">{incomes.map(i => <ExpandableBudgetItem key={i.id} id={i.id} title={i.label} amount={fmt(i.amount)} meta={`${frequencyLabel(i.frequency)} · Manuell`} status="Manuell">
      <div className="budget-detail-grid"><label>Namn<input className="input" value={i.label} onChange={e => updateIncome(i.id, { label: e.target.value })} /></label><label>Belopp<input className="input" type="number" value={i.amount} onChange={e => updateIncome(i.id, { amount: Number(e.target.value) })} /></label><label>Frekvens<select className="select" value={i.frequency} onChange={e => updateIncome(i.id, { frequency: e.target.value as Frequency })}><option value="monthly">Varje månad</option><option value="quarterly">Varje kvartal</option><option value="yearly">Varje år</option><option value="irregular">Oregelbundet</option></select></label></div><div className="budget-detail-actions"><button className="btn small danger" onClick={() => removeIncome(i.id)}>Ta bort</button></div>
    </ExpandableBudgetItem>)}{recurringIncomeItems.map(i => { const original = originalRecurring(i.id); const d = recurringDecisions[i.id]; return <ExpandableBudgetItem key={i.id} id={i.id} title={i.label} amount={fmt(i.amount)} meta={`${i.category} · ${frequencyLabel(i.frequency)} · Importerad`} status="Bekräftad" tone="green">
      <p className="hint imported-override">Importerad inkomst. Overrides ändrar inte kontoutdraget.{original && d?.monthlyAmountOverride !== undefined && d.monthlyAmountOverride !== original.monthlyAmount ? ` Ändrad från importerat snitt: ${fmt(original.monthlyAmount)}.` : i.confidence ? ` ${i.confidence}% säkerhet.` : ''}</p><div className="budget-detail-grid"><label>Namn<input className="input" value={i.label} onChange={e => updateRecurringIncome(i.id, { labelOverride: e.target.value })} /></label><label>Belopp/mån<input className="input" type="number" value={i.amount} onChange={e => updateRecurringIncome(i.id, { monthlyAmountOverride: Number(e.target.value) })} /></label><label>Frekvens<select className="select" value={i.frequency || 'monthly'} onChange={e => updateRecurringIncome(i.id, { frequencyOverride: e.target.value as Frequency })}><option value="monthly">Varje månad</option><option value="quarterly">Varje kvartal</option><option value="yearly">Varje år</option><option value="irregular">Oregelbundet</option></select></label></div><div className="budget-detail-actions"><button className="btn small danger" onClick={() => rejectRecurringIncome(i.id)}>Räkna bort</button></div>
    </ExpandableBudgetItem>; })}{!incomes.length && !recurringIncomeItems.length && <Empty><b>Du har inga inkomster ännu.</b><br/>Lägg till det som återkommer varje månad eller bekräfta importerade plusposter.</Empty>}</div></Card>
    <Card><h3>Lägg till inkomst</h3><div className="row" style={{ marginTop: 12 }}><input className="input" placeholder="Lön, barnbidrag, frilansintäkt…" value={label} onChange={e => setLabel(e.target.value)} /><input className="input money-input" type="number" placeholder="kr" value={amount} onChange={e => setAmount(e.target.value)} /><button className="btn primary" onClick={addIncome}>Lägg till</button></div></Card>
  </>;
}

function TransactionsView({ transactions, accounts, rules, onExport }: { transactions: Transaction[]; accounts: Account[]; rules: Rule[]; onExport: () => void }) {
  const acc = new Map(accounts.map(a => [a.id, a.name]));
  const rows = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  return <><PageTitle title="Alla transaktioner" subtitle={`${transactions.length} transaktioner över ${accounts.length} konton.`} />
    <button className="btn" onClick={onExport}>Exportera CSV</button><div className="table-wrap" style={{ marginTop: 12 }}><table><thead><tr><th>Datum</th><th>Beskrivning</th><th>Konto</th><th>Kategori</th><th>Belopp</th></tr></thead><tbody>{rows.slice(0, 250).map(t => { const cat = categorize(t.description, rules); return <tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{acc.get(t.accountId)}</td><td>{cat.category}</td><td className={t.amount >= 0 ? 'amount-pos mono' : 'amount-neg mono'}>{fmtSigned(t.amount)}</td></tr>; })}</tbody></table></div>{rows.length > 250 && <p className="hint">Visar de 250 senaste transaktionerna för att hålla mobilen snabb. Exporten innehåller alla rader.</p>}</>;
}

function RulesView({ rules, setRules }: { rules: Rule[]; setRules: (r: Rule[]) => void }) {
  const [matchText, setMatchText] = useState(''); const [category, setCategory] = useState(''); const [costType, setCostType] = useState<CostType>('fixed');
  function add() { if (!matchText || !category) return; setRules([...rules, { id: uid('rule'), matchText, category, costType }]); setMatchText(''); setCategory(''); }
  return <><PageTitle title="Regler" subtitle="Regler går före Klirrs automatiska gissning." />
    <CompactSummary items={[{ label: 'Aktiva regler', value: String(rules.length) }]} />
    <Card><div className="budget-list">{rules.map(r => <ExpandableBudgetItem key={r.id} id={r.id} title={r.matchText} meta={`${r.category} · ${costTypeLabel(r.costType)}`} status="Aktiv" tone="green">
      <div className="budget-detail-grid"><label>Matcha text<input className="input" value={r.matchText} onChange={e => setRules(rules.map(x => x.id === r.id ? { ...x, matchText: e.target.value } : x))} /></label><label>Kategori<input className="input" value={r.category} onChange={e => setRules(rules.map(x => x.id === r.id ? { ...x, category: e.target.value } : x))} /></label><label>Typ<select className="select" value={r.costType} onChange={e => setRules(rules.map(x => x.id === r.id ? { ...x, costType: e.target.value as CostType } : x))}><option value="fixed">Fast utgift</option><option value="variable">Rörlig utgift</option><option value="transfer">Intern överföring</option><option value="income">Inkomst</option><option value="excluded">Borträknad</option></select></label></div><div className="budget-detail-actions"><button className="btn small danger" onClick={() => setRules(rules.filter(x => x.id !== r.id))}>Ta bort</button></div>
    </ExpandableBudgetItem>)}</div><div className="row" style={{ marginTop: 14 }}><input className="input" placeholder="Text att matcha" value={matchText} onChange={e => setMatchText(e.target.value)} /><input className="input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><select className="select" style={{ maxWidth: 160 }} value={costType} onChange={e => setCostType(e.target.value as CostType)}><option value="fixed">Fast utgift</option><option value="variable">Rörlig utgift</option><option value="transfer">Intern överföring</option><option value="income">Inkomst</option><option value="excluded">Borträknad</option></select><button className="btn primary" onClick={add}>Skapa regel</button></div></Card>
  </>;
}

function ImportView({ accounts, setAccounts, transactions, setTransactions, rules, transferDecisions, loadDemo, onImported, onAskBuddy, onboardingActive, onContinueOnboarding }: { accounts: Account[]; setAccounts: (a: Account[]) => void; transactions: Transaction[]; setTransactions: (t: Transaction[]) => void; rules: Rule[]; transferDecisions: Record<string, TransferDecision>; loadDemo: () => void; onImported: (section?: ImportReviewSection) => void; onAskBuddy: () => void; onboardingActive?: boolean; onContinueOnboarding?: () => void }) {
  const [pending, setPending] = useState<{ fileName: string; raw: string; bankKey: BankKey; accountName: string; isOwn: boolean; useExistingAccountId: string; rows: ReturnType<typeof parseCsvToRows>; mapping: { date: string; description: string; amount: string }; duplicateCount: number; skipDuplicates: boolean } | null>(null);
  const [csvText, setCsvText] = useState('');
  const [lastImportSummary, setLastImportSummary] = useState<ImportResultSummary | null>(null);
  const [lastEncodingInfo, setLastEncodingInfo] = useState<{ encoding: string; hadReplacementCharacters: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const sampleCsv = `Datum;Beskrivning;Belopp
2026-06-25;Lön Exempelbolaget;32500
2026-06-01;Hemlyftet Bostadshyra;-12450
2026-06-03;Elbolaget Norr;-1010
2026-06-05;Streamio Familjepaket;-449
2026-06-12;Klirr Kortkonto Top-up;-4500
2026-06-15;Träningsklubben Medlemskap;-299
2026-06-24;Matboden City;-840`;

  function countDuplicates(rows: ReturnType<typeof parseCsvToRows>, accountId: string) {
    if (!accountId) return 0;
    const existing = new Set(transactions.map(transactionFingerprint));
    return rowsToTransactions(rows, accountId).filter(t => existing.has(transactionFingerprint(t))).length;
  }

  function buildPending(raw: string, sourceName: string, bankKey: BankKey, mapping?: { date: string; description: string; amount: string }) {
    const table = readCsvTable(raw);
    const guessed = mapping || guessMapping(table.headers);
    const rows = parseRowsWithMapping(raw, guessed).length ? parseRowsWithMapping(raw, guessed) : parseCsvToRows(raw, bankKey);
    const existingId = accounts[0]?.id || '';
    setPending({
      fileName: sourceName,
      raw,
      bankKey,
      accountName: sourceName.replace(/\.[^.]+$/, '') || 'Nytt konto',
      isOwn: true,
      useExistingAccountId: '',
      rows,
      mapping: guessed,
      duplicateCount: existingId ? countDuplicates(rows, existingId) : 0,
      skipDuplicates: true,
    });
  }

  function prepareImport(raw: string, sourceName = 'inklippt-csv.csv') {
    if (!raw.trim()) return;
    buildPending(raw, sourceName, detectBank(raw));
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const decoded = await decodeTextFile(file);
    setLastEncodingInfo({ encoding: decoded.encoding, hadReplacementCharacters: decoded.hadReplacementCharacters });
    prepareImport(decoded.text, file.name);
  }

  function updatePending(patch: Partial<NonNullable<typeof pending>>) {
    if (!pending) return;
    const next = { ...pending, ...patch };
    const rows = patch.mapping || patch.bankKey ? (parseRowsWithMapping(next.raw, next.mapping).length ? parseRowsWithMapping(next.raw, next.mapping) : parseCsvToRows(next.raw, next.bankKey)) : next.rows;
    const accountId = next.useExistingAccountId || '';
    setPending({ ...next, rows, duplicateCount: accountId ? countDuplicates(rows, accountId) : 0 });
  }

  function confirm() {
    if (!pending || !pending.rows.length) return;
    let accountId = pending.useExistingAccountId;
    let nextAccounts = accounts;
    if (!accountId) {
      const account: Account = { id: uid('acc'), name: pending.accountName || 'Nytt konto', isOwn: pending.isOwn, bankLabel: pending.bankKey };
      accountId = account.id;
      nextAccounts = [...accounts, account];
    }
    const existing = new Set(transactions.map(transactionFingerprint));
    let imported = rowsToTransactions(pending.rows, accountId);
    if (lastEncodingInfo?.hadReplacementCharacters) imported = imported.map(t => ({ ...t, importWarnings: [...(t.importWarnings || []), 'encoding_replacement_characters'] }));
    const skippedDuplicateCount = pending.skipDuplicates ? imported.filter(t => existing.has(transactionFingerprint(t))).length : 0;
    if (pending.skipDuplicates) imported = imported.filter(t => !existing.has(transactionFingerprint(t)));
    setAccounts(nextAccounts);
    setTransactions([...transactions, ...imported]);
    const previewDetection = detectRecurring([...transactions, ...imported], nextAccounts, rules, transferDecisions);
    setLastImportSummary(buildImportResultSummary({ importedTransactionCount: imported.length, skippedDuplicateCount, encodingInfo: lastEncodingInfo, detection: previewDetection }));
    setCsvText('');
    setPending(null);
    onImported();
  }

  const headers = pending ? readCsvTable(pending.raw).headers : [];

  return <><PageTitle title="Importera" subtitle="Ladda upp CSV, klistra in text eller mappa kolumner manuellt. Allt tolkas lokalt i webbläsaren." />
    <Card className="privacy-card"><b>Trygg demo:</b> Klirr skickar inte kontoutdrag till server eller AI. All import sker i din webbläsare och sparas lokalt.</Card>
    <div className="grid grid-2">
      <Card><h3>Snabbstart</h3><div className="stack"><p style={{ color: 'var(--muted)' }}>Använd fiktiv demo-data om du bara vill visa Klirr utan riktiga kontoutdrag.</p><button className="btn primary" onClick={loadDemo}>✨ Ladda demo-data</button></div></Card>
      <Card><h3>Importera fil</h3><div className="stack"><p style={{ color: 'var(--muted)' }}>Välj CSV/TXT från dator eller mobil. Testa gärna ett anonymiserat utdrag först.</p><button className="btn primary" onClick={() => fileRef.current?.click()}>Välj CSV-fil</button><input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e => handleFile(e.target.files?.[0])} /></div></Card>
    </div>

    {lastImportSummary && <Card className="soft"><h3>Importen är klar ✨</h3><p>Nu behöver Klirr bara lite hjälp att tolka vad som ska räknas in i din Budget och vad som påverkar din Budget. Börja här så undviker vi dubbelräkning.</p><div className="grid grid-3 compact-grid"><MetricCard label="Importerade rader" value={String(lastImportSummary.importedTransactionCount)} /><MetricCard label="Överhoppade dubletter" value={String(lastImportSummary.skippedDuplicateCount)} /><MetricCard label="Möjliga inkomster" value={String(lastImportSummary.possibleIncomeCount)} /><MetricCard label="Möjliga fasta utgifter/återkommande" value={String(lastImportSummary.possibleRecurringExpenseCount)} /><MetricCard label="Möjliga överföringar" value={String(lastImportSummary.possibleTransferCount)} /><MetricCard label="Oklara poster" value={String(lastImportSummary.unclearReviewItemCount)} /></div>{lastImportSummary.encodingInfo?.hadReplacementCharacters && <p className="hint" style={{ color: 'var(--warn)' }}>Encoding-varning: filen lästes som {lastImportSummary.encodingInfo.encoding}, men vissa tecken kan ha blivit fel. Kontrollera texter med konstiga symboler.</p>}<p className="hint">Budgeten kan se konstig ut innan du har granskat inkomster, återkommande poster och överföringar.</p><h4>Nästa steg</h4><div className="stack">{buildImportChecklist(lastImportSummary).map(item => <div className="list-line" key={item.id}><span>{item.label}{lastImportSummary.recommendedFirstStep === item.target && item.id !== 'buddy' ? <><br/><small>Rekommenderad första åtgärd</small></> : null}</span><button className={lastImportSummary.recommendedFirstStep === item.target ? 'btn small primary' : 'btn small'} onClick={() => item.target === 'buddy' ? onAskBuddy() : onImported(item.target)}>{item.buttonLabel}</button></div>)}</div><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={onAskBuddy}>Städa min Budget ✨</button>{onboardingActive && <button className="btn primary" onClick={onContinueOnboarding}>Fortsätt onboarding</button>}<button className="btn" onClick={() => onImported('recurring')}>Granska inkomster</button><button className="btn" onClick={() => onImported('recurring')}>Granska fasta utgifter</button><button className="btn" onClick={() => onImported('transfers')}>Granska överföringar</button><button className="btn" onClick={() => onImported('import')}>Utforska själv</button></div></Card>}

    <Card><h3>Klistra in CSV</h3><p style={{ color: 'var(--muted)' }}>Fallback om filväljaren strular. Formatet kan vara med semikolon, tabbar eller komma.</p><textarea className="textarea" rows={9} placeholder={sampleCsv} value={csvText} onChange={e => setCsvText(e.target.value)} /><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => prepareImport(csvText, 'inklippt-kontoutdrag.csv')}>Analysera inklistrad CSV</button><button className="btn" onClick={() => setCsvText(sampleCsv)}>Fyll med exempel</button><button className="btn ghost" onClick={() => { setCsvText(''); setPending(null); }}>Rensa</button></div></Card>

    {pending && <Card><h3>Förhandsgranska import</h3><p>Hittade <b>{pending.rows.length}</b> importerbara rader i <span className="kbd">{pending.fileName}</span>.</p>
      <div className="grid grid-2 compact-grid">
        <label>Bank/format<select className="select" value={pending.bankKey} onChange={e => updatePending({ bankKey: e.target.value as BankKey })}>{BANK_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
        <label>Importera till konto<select className="select" value={pending.useExistingAccountId} onChange={e => updatePending({ useExistingAccountId: e.target.value })}><option value="">Skapa nytt konto</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        {!pending.useExistingAccountId && <><label>Kontonamn<input className="input" value={pending.accountName} onChange={e => updatePending({ accountName: e.target.value })} /></label><label className="checkbox-card"><input type="checkbox" checked={pending.isOwn} onChange={e => updatePending({ isOwn: e.target.checked })} /> Detta är mitt eget konto</label></>}
      </div>

      <h4>Kolumnmappning</h4><p className="hint">Om Klirr läser fel kan du välja vilka kolumner som betyder datum, text och belopp.</p>
      <div className="grid grid-3 compact-grid">
        <label>Datum<select className="select" value={pending.mapping.date} onChange={e => updatePending({ mapping: { ...pending.mapping, date: e.target.value } })}>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
        <label>Beskrivning<select className="select" value={pending.mapping.description} onChange={e => updatePending({ mapping: { ...pending.mapping, description: e.target.value } })}>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
        <label>Belopp<select className="select" value={pending.mapping.amount} onChange={e => updatePending({ mapping: { ...pending.mapping, amount: e.target.value } })}>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
      </div>

      <div className="row" style={{ marginTop: 12 }}><label className="checkbox-card"><input type="checkbox" checked={pending.skipDuplicates} onChange={e => updatePending({ skipDuplicates: e.target.checked })} /> Hoppa över dubletter {pending.useExistingAccountId && pending.duplicateCount ? `(${pending.duplicateCount} hittade)` : ''}</label><button className="btn primary" disabled={!pending.rows.length} onClick={confirm}>Importera {pending.skipDuplicates ? pending.rows.length - pending.duplicateCount : pending.rows.length} rader</button></div>
      {!pending.rows.length && <p style={{ color: 'var(--danger)' }}>Klirr kunde inte läsa några rader. Testa kolumnmappningen ovan.</p>}
      {!!pending.rows.length && <div className="table-wrap" style={{ marginTop: 14 }}><table><thead><tr><th>Datum</th><th>Beskrivning</th><th>Belopp</th></tr></thead><tbody>{pending.rows.slice(0, 8).map((r, i) => <tr key={`${r.date}-${i}`}><td>{r.date}</td><td>{r.description}</td><td className="mono">{fmtSigned(r.amount)}</td></tr>)}</tbody></table></div>}
    </Card>}

    <Card><h3>Importerade konton</h3>{accounts.map(a => <div className="list-line" key={a.id}><span>{a.name}<br/><small style={{ color: 'var(--muted)' }}>{a.bankLabel || 'okänt format'}</small></span><span>{a.isOwn ? 'Eget konto' : 'Externt'}</span></div>)}{!accounts.length && <Empty><b>Inga konton importerade ännu.</b><br/>Konton hjälper Klirr förstå vilka överföringar som är interna och vilka poster som påverkar Budgeten. Nästa steg: välj eller klistra in en CSV-fil.</Empty>}<p style={{ color: 'var(--muted)' }}>Importerade transaktioner just nu: <b>{transactions.length}</b>.</p></Card>
  </>;
}

function AccountsView({ accounts, transactions, state, setState }: { accounts: Account[]; transactions: Transaction[]; state: AppState; setState: (s: AppState) => void }) {
  function patch(id: string, patch: Partial<Account>) { setState({ ...state, accounts: accounts.map(a => a.id === id ? { ...a, ...patch } : a) }); }
  function remove(account: Account) {
    const count = transactions.filter(t => t.accountId === account.id).length;
    if (count > 0 && !window.confirm(`Vill du ta bort kontot “${account.name}” och ${count} importerade transaktioner? Detta tar även bort tolkningar, överföringar och återkommande beslut som bygger på dessa transaktioner. Manuella inkomster, fasta utgifter och rörliga utgifter påverkas inte. Detta går inte att ångra.`)) return;
    setState(deleteAccountAndRelatedData(state, account.id));
  }
  return <><PageTitle title="Konton" subtitle="Markera vilka konton som är dina egna. Det styr interna överföringar." />
    <CompactSummary items={[{ label: 'Importerade konton', value: String(accounts.length) }, { label: 'Egna konton', value: String(accounts.filter(a => a.isOwn).length) }, { label: 'Transaktioner', value: String(transactions.length) }]} />
    <div className="budget-list">{accounts.map(a => { const count = transactions.filter(t => t.accountId === a.id).length; return <ExpandableBudgetItem key={a.id} id={a.id} title={a.name} amount={`${count} trans.`} meta={a.bankLabel || 'Importerad källa'} status={a.isOwn ? 'Eget konto' : 'Externt'} tone={a.isOwn ? 'green' : 'warn'}>
      <p className="hint">Konton används för att förstå interna överföringar — inte för bankbalans eller historisk bokföring.</p><div className="budget-detail-grid"><label>Inkludera som eget konto<label className="checkbox-card"><input type="checkbox" checked={a.isOwn} onChange={e => patch(a.id, { isOwn: e.target.checked })} /> Eget konto</label></label><label>Kontonamn<input className="input" value={a.name} onChange={e => patch(a.id, { name: e.target.value })} /></label><label>Bank/källa<input className="input" value={a.bankLabel || ''} onChange={e => patch(a.id, { bankLabel: e.target.value })} /></label></div><div className="budget-detail-actions"><button className="btn small danger" onClick={() => remove(a)}>{count ? 'Ta bort konto och transaktioner' : 'Ta bort konto'}</button></div>
    </ExpandableBudgetItem>; })}{!accounts.length && <Empty><b>Inga konton ännu.</b><br/>Importera CSV först så Klirr kan koppla transaktioner till rätt konto och hålla Budgeten ren från interna överföringar.</Empty>}</div>
  </>;
}



function HouseholdView({ active, setActive, householdProfile, setHouseholdProfile, incomes, setIncomes, summary, detection, recurringDecisions, setRecurringDecisions }: { active: HouseholdSection; setActive: (s: HouseholdSection) => void; householdProfile?: HouseholdProfile; setHouseholdProfile: (p: HouseholdProfile) => void; incomes: Income[]; setIncomes: (i: Income[]) => void; summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; recurringDecisions: Record<string, RecurringDecision>; setRecurringDecisions: (d: Record<string, RecurringDecision>) => void }) {
  const profile = normalizeHouseholdProfile(householdProfile);
  function patch(patch: Partial<HouseholdProfile>) {
    setHouseholdProfile(normalizeHouseholdProfile({ ...profile, ...patch }));
  }
  const units = householdUnits(profile).toLocaleString('sv-SE', { maximumFractionDigits: 1 });
  return <><PageTitle title="Hushåll" subtitle="Berätta vilka budgeten gäller och vilka inkomster hushållet har." />
    <SectionTabs<HouseholdSection> active={active} onChange={setActive} items={[{ id: 'profile', label: 'Hushållsprofil' }, { id: 'income', label: 'Inkomster' }]} />
    {active === 'profile' && <>
      <Card className="soft"><p>En ensam person och en stor familj behöver inte samma rörliga budget. Klirr använder hushållsprofilen när Budget Buddy föreslår mat, hushåll, transport och buffert.</p><span className="pill green">Behovsvikt: {units} hushållsenheter</span></Card>
      <Card><h3>Hushållsprofil</h3><div className="grid grid-3">
        <label><span className="metric-label">Antal vuxna</span><input className="input" type="number" min={1} value={profile.adults} onChange={e => patch({ adults: Number(e.target.value) })} /></label>
        <label><span className="metric-label">Antal barn</span><input className="input" type="number" min={0} value={profile.children} onChange={e => patch({ children: Number(e.target.value) })} /></label>
        <label><span className="metric-label">Antal tonåringar</span><input className="input" type="number" min={0} value={profile.teens} onChange={e => patch({ teens: Number(e.target.value) })} /></label>
        <label><span className="metric-label">Antal husdjur</span><input className="input" type="number" min={0} value={profile.pets || 0} onChange={e => patch({ pets: Number(e.target.value) })} /></label>
      </div><div className="grid grid-2" style={{ marginTop: 14 }}>
        <label><span className="metric-label">Matnivå</span><select className="select" value={profile.foodAmbition} onChange={e => patch({ foodAmbition: e.target.value as FoodAmbition })}><option value="budget">Budget</option><option value="normal">Normal</option><option value="comfortable">Bekväm</option></select></label>
        <label><span className="metric-label">Transportbehov</span><select className="select" value={profile.transportNeed} onChange={e => patch({ transportNeed: e.target.value as TransportNeed })}><option value="low">Lågt</option><option value="normal">Normalt</option><option value="high">Högt</option></select></label>
      </div></Card>
    </>}
    {active === 'income' && <IncomeView incomes={incomes} setIncomes={setIncomes} summary={summary} detection={detection} recurringDecisions={recurringDecisions} setRecurringDecisions={setRecurringDecisions} />}
  </>;
}


function PrivacyCenterView({ state, setState, onReset }: { state: AppState; setState: (s: AppState) => void; onReset: () => void }) {
  const normalized = normalizePrivacyState(state);
  const prefs = normalized.privacyPreferences!;
  const latestAi = normalized.aiContextLog && normalized.aiContextLog.length ? normalized.aiContextLog[normalized.aiContextLog.length - 1] : undefined;
  const aiConsentOk = hasAcceptedConsent(normalized, 'ai_features', legalDocumentConfig.aiInfoVersion);
  const exportData = buildDataExport(normalized);
  const [deleteKind, setDeleteKind] = useState<'budget' | 'local' | 'cloud' | 'user'>('budget');
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState('');
  function enableAi() { setState(addConsentRecord({ ...normalized, privacyPreferences: { ...prefs, aiEnabled: true } }, { type: 'ai_features', documentVersion: legalDocumentConfig.aiInfoVersion, status: 'accepted', source: 'settings', locale: 'sv-SE' })); }
  function disableAi() { setState(withdrawAiConsent(normalized)); }
  function exportAll() {
    const next = normalizePrivacyState({ ...normalized, privacyPreferences: { ...prefs, lastExportAt: new Date().toISOString() } });
    setState(next);
    downloadText(`klirr-dataexport-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(buildDataExport(next), null, 2), 'application/json;charset=utf-8');
  }
  function clearBudget() {
    if (confirmText !== 'RADERA') return;
    setState({ ...normalized, incomes: [], manualExpenses: [], variablePlan: defaultVariablePlan, recurringDecisions: {}, transferDecisions: {}, reviewDecisions: {}, scenarioOff: [], chatMessages: [initialBuddyMessage()], buddyActionHistory: [] });
    setResult('Aktiv Budget rensades lokalt. Sekretessinställningar och samtyckeshistorik sparades. Molndata raderades inte.');
  }
  function runDeletion() {
    if (deleteKind === 'budget') return clearBudget();
    if (deleteKind === 'local') return onReset();
    if (deleteKind === 'cloud') return setResult('Radera molndata: Inte tillgängligt i denna demo. Ingen lokal data ändrades.');
    return setResult('Radera användarkonto: Inte tillgängligt i denna demo eftersom backendflöde för auth-radering saknas. Ingen lokal data ändrades.');
  }
  const legalDocs = [
    ['Integritetspolicy', legalDocumentConfig.privacyPolicyVersion, legalDocumentConfig.policyEffectiveDate],
    ['Användarvillkor', legalDocumentConfig.termsVersion, legalDocumentConfig.termsEffectiveDate],
    ['AI-information', legalDocumentConfig.aiInfoVersion, 'Ej fastställd'],
    ['Cookie- och spårningsinformation', 'utkast-0.1', 'Ej fastställd'],
  ];
  return <><PageTitle title="Sekretess & data" subtitle="Förstå, exportera och radera din data. Juridiska texter är utkast och kräver slutlig granskning före produktion." />
    <Card className="soft"><h3>Översikt</h3><div className="grid grid-3 compact-grid"><MetricCard label="Lagring" value={normalized.accounts.length || normalized.transactions.length || normalized.incomes.length ? 'Lokal data finns' : 'Ingen lokal Budgetdata'} /><MetricCard label="Molnsynk" value="Kan inte verifieras i demon" /><MetricCard label="AI" value={prefs.aiEnabled && aiConsentOk ? 'Aktiverad' : 'Avstängd'} /><MetricCard label="Senaste AI-kontext" value={latestAi ? new Date(latestAi.createdAt).toLocaleString('sv-SE') : 'Ingen skickad'} /><MetricCard label="Export" value="Tillgänglig lokalt" /><MetricCard label="Radering" value="Lokal radering finns" /></div></Card>
    <details open><summary><b>Din datalagring</b></summary><Card><h3>Data- och säkerhetsstatus</h3><div className="stack"><div className="list-line"><span>Local storage</span><span className="pill">configured</span></div><div className="list-line"><span>Authentication</span><span className="pill">signed out/kan inte verifieras här</span></div><div className="list-line"><span>Cloud sync</span><span className="pill">unknown</span></div><div className="list-line"><span>AI raw-transaction protection</span><span className="pill green">verified by code path</span></div><div className="list-line"><span>Legal identity</span><span className="pill">missing</span></div></div><p className="hint">Klirr visar inte påståenden om kryptering, region, full säkerhet eller regelefterlevnad när detta inte kan verifieras i demon.</p></Card></details>
    <details><summary><b>AI & Budget Buddy</b></summary><Card><h3>Använd AI-funktioner</h3><p>Budgeten fungerar även utan AI. När AI är avstängt kan du fortfarande importera, granska och ändra Budgeten manuellt.</p><div className="row"><button className="btn primary" disabled={prefs.aiEnabled && aiConsentOk} onClick={enableAi}>Aktivera AI och godkänn AI-information</button><button className="btn" disabled={!prefs.aiEnabled && !aiConsentOk} onClick={disableAi}>Stäng av / återkalla AI-samtycke</button></div><p className="hint">Nuvarande AI-samtycke: {aiConsentOk ? 'Godkänt' : 'Saknas eller återkallat'} · version {legalDocumentConfig.aiInfoVersion}</p></Card><Card><h3>Vad AI såg</h3>{normalized.aiContextLog?.length ? <div className="stack">{[...(normalized.aiContextLog || [])].reverse().map(entry => <details key={entry.id}><summary aria-controls={entry.id} aria-expanded="false">{new Date(entry.createdAt).toLocaleString('sv-SE')} · {entry.purpose} · {entry.destinationLabel} · {entry.outcome}</summary><div id={entry.id} className="stack"><p>Kategorier: {entry.dataCategories.join(', ')}</p><pre className="copy-box">{JSON.stringify(entry.summaryFields, null, 2)}</pre><p>Varningar/counts: {entry.warningsIncluded.join(', ') || 'Inga'}</p><p>Råa importerade transaktionsrader ingick inte.</p>{entry.failureReason && <p>Orsak: {entry.failureReason}</p>}</div></details>)}</div> : <p>Ingen AI-förfrågan har skickats ännu.</p>}<button className="btn danger" disabled={!normalized.aiContextLog?.length} onClick={() => window.confirm('Rensa AI-transparenshistorik? Budgetdata påverkas inte.') && setState({ ...normalized, aiContextLog: [] })}>Rensa AI-transparenshistorik</button></Card></details>
    <details><summary><b>Samtycken</b></summary><Card><h3>Samtycken</h3><p>Villkor och integritetspolicy kan visas och versionsspåras utan att skapa en blockerande demo-vägg. Optional analytics/marketing används inte.</p><div className="list-line"><span>AI-funktioner</span><b>{aiConsentOk ? 'Godkänt' : 'Inte godkänt'}</b></div><div className="list-line"><span>Analys</span><b>Används inte</b></div><div className="list-line"><span>Marknadsföring</span><b>Används inte</b></div><pre className="copy-box">{JSON.stringify(normalized.consentRecords || [], null, 2)}</pre></Card></details>
    <details><summary><b>Exportera data</b></summary><Card><h3>Exportera alla mina data</h3><p className="hint">JSON-exporten skapas lokalt och innehåller lokalt tillgänglig Budgetdata, importerade transaktioner, Budget Buddy-historik, samtycken och AI-transparenslogg. Den hämtar inte cloud-only-data från tredje part.</p><div className="grid grid-3 compact-grid"><MetricCard label="Workspaces" value={String(exportData.manifest.workspaceCount)} /><MetricCard label="Transaktioner" value={String(exportData.manifest.transactionCount)} /><MetricCard label="AI-loggar" value={String(exportData.manifest.aiLogCount)} /></div><button className="btn primary" onClick={exportAll}>Exportera alla mina data</button></Card></details>
    <details><summary><b>Radera data och konto</b></summary><Card><h3>Vad vill du radera?</h3><select className="select" value={deleteKind} onChange={e => setDeleteKind(e.target.value as any)}><option value="budget">Rensa aktiv Budget</option><option value="local">Radera all lokal data</option><option value="cloud">Radera molndata</option><option value="user">Radera användarkonto</option></select><p className="hint">Förhandsgranskning: {deleteKind === 'budget' ? 'Rensar lokal Budget i aktiv demo-workspace. Samtycken bevaras.' : deleteKind === 'local' ? 'Rensar localStorage för Klirr i denna webbläsare. Molndata påverkas inte.' : 'Inte tillgängligt i denna demo; ingen simulerad framgång visas.'}</p><button className="btn" onClick={exportAll}>Exportera mina data först</button><label>Skriv RADERA för lokal Budget-rensning<input className="input" value={confirmText} onChange={e => setConfirmText(e.target.value)} /></label><button className="btn danger" onClick={runDeletion}>Kör vald radering</button>{result && <p role="status">{result}</p>}</Card></details>
    <details><summary><b>Juridiska dokument</b></summary><Card><h3>Juridiska dokument (utkast)</h3>{legalDocs.map(([name, version, date]) => <details key={name}><summary>{name} · version {version} · {date}</summary><article><h4>{name}</h4><p>Status: Utkast, konfigurerbart och kräver slutlig juridisk granskning före produktion.</p><p>Organisation: {legalDocumentConfig.organizationName}. Organisationsnummer: {legalDocumentConfig.organizationNumber}. Kontakt: {legalDocumentConfig.privacyEmail}.</p><p>{name === 'Cookie- och spårningsinformation' ? 'Klirr använder för närvarande inga icke-nödvändiga analys- eller marknadsföringscookies i denna demo.' : 'Texten beskriver Klirrs demoarkitektur, lokalt sparad Budgetdata, valfri molnsynk där den är konfigurerad, AI med sammanfattad kontext, import, export, radering och placeholders för rättslig grund, processorer, regioner och retention.'}</p></article></details>)}</Card></details>
    <details><summary><b>Tredjepart och licenser</b></summary><Card><h3>Tredjepart</h3><div className="list-line"><span>Supabase</span><b>Auth/molnsnapshot om miljö är konfigurerad</b></div><div className="list-line"><span>AI endpoint</span><b>/api/budget-buddy när AI är aktiverat</b></div><div className="list-line"><span>Analys/marknadsföring</span><b>Inte aktivt</b></div><h3>Öppen källkod och licenser</h3><p className="hint">Direkta paket hämtas från package.json; runtime kräver ingen nätverksfråga.</p><div className="stack">{licenseArtifact.packages.map(pkg => <div className="list-line" key={pkg.name}><span>{pkg.name}<br/><small>{String(pkg.repository)}</small></span><b>{pkg.version} / {pkg.license}</b></div>)}</div></Card></details>

  </>;
}

function SettingsView({ state, setState, onReset, loadDemo, restartOnboarding, openOnboarding }: { state: AppState; setState: (s: AppState) => void; onReset: () => void; loadDemo: () => void; restartOnboarding: () => void; openOnboarding: () => void }) {
  const [importText, setImportText] = useState('');
  const exportText = JSON.stringify({ exportedAt: new Date().toISOString(), version: '1.0', state }, null, 2);
  function copyExport() { navigator.clipboard?.writeText(exportText).catch(() => undefined); }
  function importState() {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.state?.accounts && parsed.state?.transactions) setState(ensureWorkspaceState({ ...parsed.state, subscriptionPlan: state.subscriptionPlan, subscriptionStatus: state.subscriptionStatus, entitlements: getEntitlements(state.subscriptionPlan, state.subscriptionStatus) }));
      else if (parsed.accounts && parsed.transactions) setState(ensureWorkspaceState({ ...parsed, subscriptionPlan: state.subscriptionPlan, subscriptionStatus: state.subscriptionStatus, entitlements: getEntitlements(state.subscriptionPlan, state.subscriptionStatus) }));
      setImportText('');
    } catch {
      alert('Kunde inte läsa JSON. Kontrollera att du klistrat in en Klirr-export.');
    }
  }
  return <><PageTitle title="Inställningar" subtitle="Demo, integritet, export och återställning." />
    <AuthSyncPanel state={state} setState={setState} />
    <div className="grid grid-2">
      <Card><h3>Demo-läge</h3><p>Ladda om den fiktiva demo-Budgeten när du vill visa appen för andra.</p><button className="btn primary" onClick={loadDemo}>✨ Ladda demo-data</button></Card>
      <Card><h3>Kom igång igen</h3><p>Detta startar bara guiden igen. Din Budget och importerade data finns kvar.</p><div className="row"><button className="btn primary" onClick={() => { setState({ ...state, onboardingCompleted: false, onboarding: { ...normalizeOnboardingState(state.onboarding), status: normalizeOnboardingState(state.onboarding).path === 'import' ? 'IMPORT_PATH' : 'MANUAL_PATH', started: true } }); openOnboarding(); }}>Fortsätt onboarding</button><button className="btn" onClick={restartOnboarding}>Starta onboarding igen</button></div></Card>
      <Card><h3>Radera lokal data</h3><p>Raderar Klirrs lokala data i denna webbläsare. Detta påverkar inte GitHub/Vercel.</p><button className="btn danger" onClick={onReset}>Radera och återställ</button></Card>
    </div>
    <Card><h3>Exportera hela lokala Klirr-datan</h3><p className="hint">Använd detta vid tester: kopiera JSON och skicka till utvecklare om något ser fel ut. Undvik riktig privatdata i delade buggrapporter.</p><textarea className="textarea copy-box" readOnly value={exportText} /><div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={copyExport}>Kopiera JSON</button></div></Card>
    <Card><h3>Importera Klirr-export</h3><p className="hint">Klistra in en tidigare export för att återskapa ett testläge.</p><textarea className="textarea" rows={7} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Klistra in JSON-export här…" /><div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={importState}>Importera JSON</button></div></Card>
    <Card><h3>Integritet</h3><p>Klirr v1.0 är förberedd för inloggning, molnsparning och riktig AI, men fungerar fortfarande lokalt utan nycklar. När Supabase/OpenAI är aktiverat ska användaren tydligt informeras om vad som sparas och vad som skickas till AI. Radera/exportera data finns här under Inställningar.</p></Card>
  </>;
}
