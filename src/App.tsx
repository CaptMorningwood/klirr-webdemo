import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, AppState, BuddyAction, BuddyProposedAction, ChatMessage, CostType, DetectionResult, FoodAmbition, Frequency, HouseholdProfile, Income, ManualExpense, RecurringDecision, Rule, TabId, Transaction, TransferDecision, TransportNeed, VariablePlanItem } from './types';
import { buildDemoData } from './data/demoData';
import { calculateBudget } from './lib/budgetCalculator';
import { defaultHouseholdProfile, householdUnits, normalizeHouseholdProfile, suggestVariableBudget, type BudgetSuggestionMode } from './lib/budgetSuggestionEngine';
import { buddySuggestions, initialBuddyMessage, makeBuddyReply } from './lib/budgetBuddy';
import { BANK_FORMATS, type BankKey, detectBank, guessMapping, parseCsvToRows, parseRowsWithMapping, readCsvTable, rowsToTransactions, transactionFingerprint } from './lib/csvParsers';
import { exportBudgetReport, exportTransactionsCsv } from './lib/exporters';
import { fmt, fmtSigned, pct, todayIso, uid } from './lib/format';
import { categorize } from './lib/rulesEngine';
import { actionableCandidateReason, detectRecurring, getActionableRecurringCandidates } from './lib/recurrenceEngine';
import { getEntitlements } from './lib/entitlements';
import { clearState, loadState, saveState } from './lib/storage';
import { appendBuddyActionHistory, applyBuddyActionWithResult, findPendingBuddyAction } from './lib/buddyActions';
import { detectBuddyActionIntent } from './lib/buddyActionIntents';
import { estimateSwedishNetSalary } from './lib/taxEstimate';
import { planBuddyAction } from './lib/buddyActionPlanner';
import { Card, Empty, MetricCard, PageTitle } from './components/UI';
import { AuthSyncPanel } from './components/AuthSyncPanel';

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
  scenarioOff: [],
  chatMessages: [initialBuddyMessage()],
  buddyActionHistory: [],
  onboardingCompleted: false,
  householdProfile: { ...defaultHouseholdProfile, householdType: 'single' },
  subscriptionPlan: 'pro',
  subscriptionStatus: 'active',
  entitlements: getEntitlements('pro'),
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
type MoreSection = 'rules' | 'settings';

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
  if (source === 'variablePlan') return 'Rörlig plan';
  return source || '';
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
  const [state, setState] = useState<AppState>(() => ({ ...initialState, ...(loadState() || {}), buddyActionHistory: (loadState() as AppState | null)?.buddyActionHistory || [] }));
  const [tab, setTab] = useState<TabId>('dashboard');
  const [planSection, setPlanSection] = useState<PlanSection>('musts');
  const [importReviewSection, setImportReviewSection] = useState<ImportReviewSection>('import');
  const [householdSection, setHouseholdSection] = useState<HouseholdSection>('profile');
  const [moreSection, setMoreSection] = useState<MoreSection>('settings');
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveState(state); }, [state, loaded]);

  const detection = useMemo(() => detectRecurring(state.transactions, state.accounts, state.rules, state.transferDecisions), [state.transactions, state.accounts, state.rules, state.transferDecisions]);
  const summary = useMemo(() => calculateBudget({ detection, recurringDecisions: state.recurringDecisions, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan }), [detection, state.recurringDecisions, state.incomes, state.manualExpenses, state.variablePlan]);
  const scenarioSummary = useMemo(() => calculateBudget({ detection, recurringDecisions: state.recurringDecisions, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan, scenarioOff: state.scenarioOff }), [detection, state.recurringDecisions, state.incomes, state.manualExpenses, state.variablePlan, state.scenarioOff]);
  const hasAnyBudgetData =
    state.transactions.length > 0 ||
    state.incomes.length > 0 ||
    state.manualExpenses.length > 0 ||
    state.variablePlan.some(item => item.amount > 0 && item.include) ||
    Object.keys(state.recurringDecisions).length > 0;

  const setPartial = (patch: Partial<AppState>) => setState(prev => ({ ...prev, ...patch }));
  const badges: Partial<Record<TabId, number>> = {
    importReview: detection.reviewItems.length + detection.transfers.filter(t => !state.transferDecisions[t.id]?.status || state.transferDecisions[t.id].status === 'pending').length + getActionableRecurringCandidates(detection.recurring).filter(r => !state.recurringDecisions[r.id]?.status).length,
  };

  function selectTab(nextTab: TabId) {
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
    });
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
        {!state.onboardingCompleted && <OnboardingView initialState={initialState} state={state} setState={setState} loadDemo={loadDemo} setTab={selectTab} />}
        {state.onboardingCompleted && tab === 'dashboard' && <DashboardView summary={summary} detection={detection} loadDemo={loadDemo} setTab={selectTab} hasData={hasAnyBudgetData} onExport={() => exportBudgetReport(summary, detection)} />}
        {state.onboardingCompleted && tab === 'plan' && <PlanView active={planSection} setActive={setPlanSection} summary={summary} scenarioSummary={scenarioSummary} state={state} setState={setState} setVariablePlan={(variablePlan) => setPartial({ variablePlan })} />}
        {state.onboardingCompleted && tab === 'importReview' && <ImportReviewView active={importReviewSection} setActive={setImportReviewSection} detection={detection} state={state} setPartial={setPartial} loadDemo={loadDemo} />}
        {state.onboardingCompleted && tab === 'household' && <HouseholdView active={householdSection} setActive={setHouseholdSection} householdProfile={state.householdProfile} setHouseholdProfile={(householdProfile) => setPartial({ householdProfile })} incomes={state.incomes} setIncomes={(incomes) => setPartial({ incomes })} />}
        {state.onboardingCompleted && tab === 'buddy' && <BudgetBuddyView state={state} setState={setState} summary={summary} detection={detection} setTab={selectTab} setScenarioOff={(ids) => setPartial({ scenarioOff: ids })} />}
        {state.onboardingCompleted && tab === 'more' && <MoreView active={moreSection} setActive={setMoreSection} state={state} setState={setState} loadDemo={loadDemo} onReset={() => { clearState(); setState({ ...initialState, onboardingCompleted: false }); selectTab('dashboard'); }} />}
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


function OnboardingView({ initialState, state, setState, loadDemo, setTab }: { initialState: AppState; state: AppState; setState: (s: AppState) => void; loadDemo: () => void; setTab: (t: TabId) => void }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<HouseholdProfile>(normalizeHouseholdProfile(state.householdProfile));
  const [netIncome, setNetIncome] = useState(state.incomes[0]?.amount ? String(state.incomes[0].amount) : '');
  const [grossIncome, setGrossIncome] = useState('');
  const grossIncomeNumber = Number(grossIncome);
  const estimatedNet = Number.isFinite(grossIncomeNumber) && grossIncomeNumber > 0 ? estimateSwedishNetSalary({ grossMonthly: grossIncomeNumber }).netMonthly : 0;
  const [musts, setMusts] = useState<Array<{ label: string; amount: string; category: string }>>([
    { label: 'Hyra/boende', amount: '', category: 'Boende' },
    { label: 'Lån/skulder', amount: '', category: 'Skulder' },
    { label: 'El', amount: '', category: 'El' },
    { label: 'Försäkringar', amount: '', category: 'Försäkring' },
    { label: 'Mobil/bredband', amount: '', category: 'Kommunikation' },
    { label: 'Övriga fasta kostnader', amount: '', category: 'Fast kostnad' },
  ]);
  const [mode, setMode] = useState<BudgetSuggestionMode>('balanced');
  const incomeAmount = Number(netIncome) || estimatedNet || 0;
  const fixedTotal = musts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const suggestion = suggestVariableBudget({ available: incomeAmount - fixedTotal, mode, householdProfile: profile });
  function finish(nextTab: TabId) {
    const incomes: Income[] = incomeAmount > 0 ? [{ id: uid('inc_onboarding'), label: 'Lön efter skatt', amount: Math.round(incomeAmount), frequency: 'monthly' }] : [];
    const manualExpenses: ManualExpense[] = musts.filter(item => Number(item.amount) > 0).map(item => ({ id: uid('mx_onboarding'), label: item.label, amount: Math.round(Number(item.amount)), category: item.category, costType: 'fixed', active: true, frequency: 'monthly' }));
    setState({ ...initialState, ...state, householdProfile: profile, incomes, manualExpenses, variablePlan: suggestion.items.map(item => ({ ...item, id: uid('vp_onboarding') })), onboardingCompleted: true });
    setTab(nextTab);
  }
  function skip() { setState({ ...state, onboardingCompleted: true }); setTab('dashboard'); }
  const buddyCopy = [
    "Hej! Jag är Budget Buddy ✨ Vi bygger din första Klirr-budget tillsammans. Det behöver inte bli perfekt direkt — vi ska bara få en bra start 💸",
    "Först: vilka ska budgeten räcka till? En ensam person och en barnfamilj behöver ju inte samma matbudget 🍝",
    "Nu tar vi pengarna in. Lägg in ungefär vad som landar på kontot varje månad. Vet du bara bruttolönen kan jag hjälpa dig uppskatta efter skatt 🧾",
    "Nu fångar vi sånt som måste betalas. Hyra, lån, försäkringar, el — allt det där som kommer innan vardagsbudgeten 📌",
    "Nu gör vi vardagsplanen. Jag kan föreslå en trygg, balanserad eller lite friare budget utifrån hushållet och pengarna som finns kvar 💡",
    "Så! Nu har Klirr något att jobba med 🎉 Du kan alltid ändra senare — budgeten ska hjälpa dig, inte låsa dig."
  ];
  return <><PageTitle title="Kom igång med Klirr" subtitle="Budget Buddy guidar dig till en första månadsbudget på några minuter." />
    <Card className="soft"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><b>Budget Buddy ✨ · Steg {step + 1} av 6</b><p className="hint" style={{ marginBottom: 0 }}>{buddyCopy[step]}</p></div><button className="btn small" onClick={skip}>Hoppa över</button></div></Card>
    {step === 0 && <Card><h3>Hur vill du börja? 🙌</h3><div className="row"><button className="btn primary" onClick={() => setStep(1)}>Börja manuellt</button><button className="btn" onClick={() => { skip(); setTab('import'); }}>Importera kontoutdrag</button><button className="btn" onClick={loadDemo}>Ladda demo</button></div></Card>}
    {step === 1 && <Card><h3>Hushåll 🏠</h3><div className="grid grid-3"><label>Vuxna<input className="input" type="number" min={1} value={profile.adults} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, adults: Number(e.target.value) }))} /></label><label>Barn<input className="input" type="number" min={0} value={profile.children} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, children: Number(e.target.value) }))} /></label><label>Tonåringar<input className="input" type="number" min={0} value={profile.teens} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, teens: Number(e.target.value) }))} /></label></div><div className="grid grid-2" style={{ marginTop: 12 }}><select className="select" value={profile.foodAmbition} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, foodAmbition: e.target.value as FoodAmbition }))}><option value="budget">Matnivå: budget</option><option value="normal">Matnivå: normal</option><option value="comfortable">Matnivå: bekväm</option></select><select className="select" value={profile.transportNeed} onChange={e => setProfile(normalizeHouseholdProfile({ ...profile, transportNeed: e.target.value as TransportNeed }))}><option value="low">Transport: lågt</option><option value="normal">Transport: normalt</option><option value="high">Transport: högt</option></select></div><button className="btn primary" onClick={() => setStep(2)}>Nästa</button></Card>}
    {step === 2 && <Card><h3>Inkomst 💸</h3><div className="grid grid-2"><input className="input" type="number" placeholder="Månadsinkomst efter skatt" value={netIncome} onChange={e => setNetIncome(e.target.value)} /><input className="input" type="number" placeholder="Eller bruttolön för uppskattning" value={grossIncome} onChange={e => setGrossIncome(e.target.value)} /></div>{estimatedNet > 0 && <p className="hint">Grovt uppskattat efter skatt: <b>{fmt(estimatedNet)}</b> med cirka 32% skatt.</p>}<button className="btn primary" onClick={() => setStep(3)}>Nästa</button></Card>}
    {step === 3 && <Card><h3>Måsten 📌</h3><div className="stack">{musts.map((item, i) => <div className="edit-row" key={item.label}><input className="input" value={item.label} onChange={e => setMusts(musts.map((m, idx) => idx === i ? { ...m, label: e.target.value } : m))} /><input className="input money-input" type="number" placeholder="kr/mån" value={item.amount} onChange={e => setMusts(musts.map((m, idx) => idx === i ? { ...m, amount: e.target.value } : m))} /></div>)}</div><button className="btn primary" onClick={() => setStep(4)}>Nästa</button></Card>}
    {step === 4 && <Card><h3>Rörlig budget 💡</h3><select className="select" value={mode} onChange={e => setMode(e.target.value as BudgetSuggestionMode)}><option value="safe">Trygg</option><option value="balanced">Balanserad</option><option value="boost">Lite friare</option></select><p className="hint">Kvar efter måsten: <b>{fmtSigned(incomeAmount - fixedTotal)}</b>. {suggestion.note}</p><div className="stack">{suggestion.items.map(item => <div className="list-line" key={item.id}><span>{item.label}</span><b className="mono">{fmt(item.amount)}</b></div>)}</div><button className="btn primary" onClick={() => setStep(5)}>Nästa</button></Card>}
    {step === 5 && <Card><h3>Klar ✅</h3><p>Första budgeten är redo: inkomst {fmt(incomeAmount)}, måsten {fmt(fixedTotal)} och rörlig plan {fmt(suggestion.items.reduce((sum, item) => sum + item.amount, 0))}.</p><div className="row"><button className="btn primary" onClick={() => finish('dashboard')}>Gå till Översikt</button><button className="btn" onClick={() => finish('buddy')}>Prata med Budget Buddy</button></div></Card>}
  </>;
}

function DashboardView({ summary, detection, loadDemo, setTab, hasData, onExport }: { summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; loadDemo: () => void; setTab: (t: TabId) => void; hasData: boolean; onExport: () => void }) {
  if (!hasData) {
    return <><PageTitle title="Välkommen till Klirr" subtitle="Importera bankdata, ladda demo eller börja manuellt med inkomster och måsten." />
      <Card><div className="stack"><p>Klirr hjälper dig förstå vad livet kostar varje månad. Du kan börja snabbt genom att lägga in inkomster och måsten manuellt, eller importera ett kontoutdrag för smartare analys.</p><div className="row"><button className="btn primary" onClick={loadDemo}>✨ Ladda demo</button><button className="btn" onClick={() => setTab('import')}>Importera CSV</button><button className="btn" onClick={() => setTab('income')}>Lägg in inkomst</button><button className="btn" onClick={() => setTab('musts')}>Lägg in måsten</button></div></div></Card></>;
  }
  const fixedPct = summary.totalIncome > 0 ? (summary.fixedTotal / summary.totalIncome) * 100 : 0;
  return <>
    <PageTitle title="Översikt" subtitle="Din månadskoll: inkomster, måsten, rörlig plan och vad som blir kvar." />
    <div className="grid grid-3">
      <MetricCard label="Inkomster" value={fmt(summary.totalIncome)} />
      <MetricCard label="Månadens måsten" value={fmt(summary.fixedTotal)} />
      <MetricCard label="Kvar efter plan" value={fmtSigned(summary.remainingAfterPlan)} tone={summary.remainingAfterPlan >= 0 ? 'good' : 'bad'} />
    </div>
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      <Card>
        <div className="metric-label">Andel av inkomsten som är fasta måsten</div>
        <div className="progress"><div style={{ width: `${Math.min(100, fixedPct)}%` }} /></div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}><span>{pct(fixedPct)}</span><span>{fmt(summary.fixedTotal)} av {fmt(summary.totalIncome)}</span></div>
      </Card>
      <Card>
        <div className="metric-label">Rörlig plan</div>
        <div className="metric-value mono">{fmt(summary.variablePlanTotal)}</div>
        <div className="row" style={{ marginTop: 10 }}><button className="btn small" onClick={() => setTab('variablePlan')}>Ändra rörlig plan</button><button className="btn small" onClick={() => setTab('scenarios')}>Testa scenario</button></div>
      </Card>
    </div>
    {summary.warnings.length > 0 && <Card className="warn" ><b>Att granska:</b><ul>{summary.warnings.map(w => <li key={w}>{w}</li>)}</ul></Card>}
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      <Card><h3>Största måsten</h3>{summary.fixedItems.slice(0, 6).map(i => <div className="list-line" key={i.id}><span>{i.label}</span><b className="mono">{fmt(i.amount)}</b></div>)}<button className="btn small" style={{ marginTop: 10 }} onClick={() => setTab('musts')}>Visa alla</button></Card>
      <Card><h3>Nästa steg</h3><div className="stack"><button className="btn" onClick={() => setTab('review')}>Granska oklara poster ({detection.reviewItems.length})</button><button className="btn" onClick={() => setTab('recurring')}>Bekräfta återkommande</button><button className="btn" onClick={onExport}>Exportera rapport</button></div></Card>
    </div>
  </>;
}


function SectionTabs<T extends string>({ items, active, onChange }: { items: Array<{ id: T; label: string; badge?: number }>; active: T; onChange: (id: T) => void }) {
  return <div className="section-tabs">{items.map(item => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>{item.label}{!!item.badge && <span className="badge">{item.badge}</span>}</button>)}</div>;
}

function PlanView({ active, setActive, summary, scenarioSummary, state, setState, setVariablePlan }: { active: PlanSection; setActive: (s: PlanSection) => void; summary: ReturnType<typeof calculateBudget>; scenarioSummary: ReturnType<typeof calculateBudget>; state: AppState; setState: (s: AppState) => void; setVariablePlan: (p: VariablePlanItem[]) => void }) {
  return <><PageTitle title="Plan" subtitle="Planera vad månaden ska kosta framåt: måsten, rörlig budget och scenarier." />
    <SectionTabs<PlanSection> active={active} onChange={setActive} items={[{ id: 'musts', label: 'Måsten' }, { id: 'variablePlan', label: 'Rörlig plan' }, { id: 'scenarios', label: 'Scenarier' }]} />
    {active === 'musts' && <MustsView summary={summary} state={state} setState={setState} />}
    {active === 'variablePlan' && <VariablePlanView variablePlan={state.variablePlan} setVariablePlan={setVariablePlan} summary={summary} householdProfile={state.householdProfile} />}
    {active === 'scenarios' && <ScenariosView summary={summary} scenarioSummary={scenarioSummary} state={state} setState={setState} />}
  </>;
}

function ImportReviewView({ active, setActive, detection, state, setPartial, loadDemo }: { active: ImportReviewSection; setActive: (s: ImportReviewSection) => void; detection: DetectionResult; state: AppState; setPartial: (patch: Partial<AppState>) => void; loadDemo: () => void }) {
  const transferCount = detection.transfers.filter(t => !state.transferDecisions[t.id]?.status || state.transferDecisions[t.id].status === 'pending').length;
  const actionableRecurring = getActionableRecurringCandidates(detection.recurring);
  const recurringCount = actionableRecurring.filter(r => !state.recurringDecisions[r.id]?.status).length;
  return <><PageTitle title="Import & granskning" subtitle="Importera kontoutdrag och granska hur Klirr tolkar transaktioner, överföringar och återkommande poster." />
    <SectionTabs<ImportReviewSection> active={active} onChange={setActive} items={[{ id: 'import', label: 'Importera' }, { id: 'accounts', label: 'Konton' }, { id: 'transactions', label: 'Transaktioner' }, { id: 'transfers', label: 'Överföringar', badge: transferCount }, { id: 'recurring', label: 'Återkommande', badge: recurringCount }, { id: 'review', label: 'Oklara poster', badge: detection.reviewItems.length }]} />
    {active === 'import' && <ImportView accounts={state.accounts} setAccounts={(accounts) => setPartial({ accounts })} setTransactions={(transactions) => setPartial({ transactions })} transactions={state.transactions} rules={state.rules} transferDecisions={state.transferDecisions} loadDemo={loadDemo} onImported={() => setActive('recurring')} />}
    {active === 'accounts' && <AccountsView accounts={state.accounts} transactions={state.transactions} setAccounts={(accounts) => setPartial({ accounts })} />}
    {active === 'transactions' && <TransactionsView transactions={state.transactions} accounts={state.accounts} rules={state.rules} onExport={() => exportTransactionsCsv(state.transactions, state.accounts)} />}
    {active === 'transfers' && <TransfersView detection={detection} transactions={state.transactions} accounts={state.accounts} decisions={state.transferDecisions} setDecisions={(transferDecisions) => setPartial({ transferDecisions })} />}
    {active === 'recurring' && <RecurringView detection={detection} decisions={state.recurringDecisions} setDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} addRule={(rule) => setPartial({ rules: [...state.rules, rule] })} />}
    {active === 'review' && <ReviewView detection={detection} recurringDecisions={state.recurringDecisions} setRecurringDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} />}
  </>;
}

function MoreView({ active, setActive, state, setState, onReset, loadDemo }: { active: MoreSection; setActive: (s: MoreSection) => void; state: AppState; setState: (s: AppState) => void; onReset: () => void; loadDemo: () => void }) {
  return <><PageTitle title="Mer / Inställningar" subtitle="Regler, export, sync, demo-data och inställningar." />
    <SectionTabs<MoreSection> active={active} onChange={setActive} items={[{ id: 'rules', label: 'Regler' }, { id: 'settings', label: 'Inställningar' }]} />
    {active === 'rules' && <RulesView rules={state.rules} setRules={(rules) => setState({ ...state, rules })} />}
    {active === 'settings' && <SettingsView state={state} setState={setState} loadDemo={loadDemo} onReset={onReset} restartOnboarding={() => setState({ ...state, onboardingCompleted: false })} />}
  </>;
}

function BudgetBuddyView({ state, setState, summary, detection, setTab, setScenarioOff }: { state: AppState; setState: (s: AppState) => void; summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; setTab: (t: TabId) => void; setScenarioOff: (ids: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [buddyBusy, setBuddyBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [state.chatMessages]);

  function updateActionStatus(actionId: string, status: BuddyProposedAction['status'], baseState = state) {
    return { ...baseState, chatMessages: baseState.chatMessages.map(m => m.proposedAction?.id === actionId ? { ...m, proposedAction: { ...m.proposedAction, status } as BuddyProposedAction } : m) };
  }
  function applyOrCancel(action: BuddyProposedAction, intent: 'confirm' | 'cancel', baseState = state) {
    const statusState = updateActionStatus(action.id, intent === 'confirm' ? 'applied' : 'cancelled', baseState);
    const logged = appendBuddyActionHistory(statusState, { actionId: action.id, actionType: action.type, type: intent === 'confirm' ? 'confirmed' : 'cancelled', message: intent === 'confirm' ? 'Användaren bekräftade Budget Buddy-action.' : 'Användaren avbröt Budget Buddy-action.' });
    const result = intent === 'confirm' ? applyBuddyActionWithResult(logged, action) : { state: logged, status: 'applied' as const, message: action.type === 'update_variable_plan' ? 'Ingen fara, jag behåller den rörliga planen som den är 👍' : 'Ingen fara, jag låter inkomsten vara som den är 👍' };
    const finalState = intent === 'confirm' ? appendBuddyActionHistory(result.state, { actionId: action.id, actionType: action.type, type: result.status === 'applied' ? 'applied' : result.status === 'needs_choice' ? 'needs_user_choice' : 'failed', reason: result.message }) : result.state;
    const msg: ChatMessage = { id: uid('msg'), role: 'assistant', createdAt: todayIso(), content: result.message };
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
    if (pending && intent) {
      applyOrCancel(pending, intent, afterUserState);
      return;
    }
    setState(afterUserState);
    setBuddyBusy(true);
    try {
      const currentDate = new Date().toISOString();
      const budgetSuggestion = suggestVariableBudget({ available: summary.remainingAfterFixed, mode: 'safe', householdProfile: state.householdProfile, currentVariablePlan: state.variablePlan });
      const actionableCandidates = getActionableRecurringCandidates(detection.recurring);
      const context = { summary, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan, householdProfile: normalizeHouseholdProfile(state.householdProfile), budgetSuggestion, pendingAction: pending, buddyActionHistory: state.buddyActionHistory, transactionCount: state.transactions.length, reviewCount: detection.reviewItems.length, transferCount: detection.transfers.length, recurringCandidateCount: actionableCandidates.length, actionableIncomeCandidateCount: actionableCandidates.filter(r => r.costTypeDefault === 'income').length, actionableExpenseCandidateCount: actionableCandidates.filter(r => r.costTypeDefault !== 'income').length, confirmedRecurringCount: detection.recurring.filter(r => state.recurringDecisions[r.id]?.status === 'confirmed').length, unconfirmedRecurringCount: actionableCandidates.filter(r => state.recurringDecisions[r.id]?.status !== 'confirmed' && state.recurringDecisions[r.id]?.status !== 'rejected').length, rules: state.rules, currentDate, currentMonth: new Date(currentDate).getMonth() + 1 };
      const localPlan = planBuddyAction({ message: trimmed, context, incomes: state.incomes, variablePlan: state.variablePlan, householdProfile: state.householdProfile, pendingAction: pending });
      const recentMessages = state.chatMessages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/budget-buddy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: trimmed, context, recentMessages, currentDate, currentMonth: new Date(currentDate).getMonth() + 1 }) });
      const data = await response.json();
      const proposedAction = data.proposedAction || localPlan.proposedAction;
      const reply: ChatMessage = { id: uid('msg'), role: 'assistant', content: data.message || localPlan.clarificationQuestion || 'Jag kunde inte skapa ett svar just nu.', createdAt: todayIso(), actions: Array.isArray(data.actions) ? data.actions as BuddyAction[] : undefined, proposedAction };
      let nextState: AppState = { ...state, chatMessages: [...afterUserState.chatMessages, reply] };
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

Obs: AI-endpointen kunde inte nås, så detta är lokalt fallback-svar.` }] });
    } finally {
      setBuddyBusy(false);
    }
  }
  function runAction(action: NonNullable<ChatMessage['actions']>[number]) {
    if (action.tab) setTab(action.tab);
    if (action.scenarioOffIds) setScenarioOff(action.scenarioOffIds);
    if (action.message) send(action.message);
  }
  function actionSummary(action: BuddyProposedAction) {
    if (action.type === 'update_income') return <div className="stack"><div className="list-line"><span>{action.description}</span><b className="mono">{fmt(action.payload.amount)}/mån</b></div>{action.payload.notes && <p className="hint">{action.payload.notes}</p>}</div>;
    if (action.type === 'choose_income_to_update') return <div className="stack">{action.payload.candidateIncomes.map(item => <div className="list-line" key={item.incomeId}><span>{item.label}</span><b className="mono">{fmt(item.amount)}/mån</b></div>)}<p className="hint">Skriv namnet på inkomsten du vill ändra. Jag skapar ingen dubblett automatiskt.</p>{action.payload.notes && <p className="hint">{action.payload.notes}</p>}</div>;
    return <div className="stack">{action.payload.items.map(item => <div className="list-line" key={item.id || item.label}><span>{item.label}<br/><small>{item.category}</small></span><b className="mono">{fmt(item.amount)}</b></div>)}{action.payload.notes && <p className="hint">{action.payload.notes}</p>}</div>;
  }
  return <Card className="chat-shell">
    <div className="chat-header"><h2 style={{ margin: 0 }}>Budget Buddy ✨</h2><p style={{ margin: '5px 0 0', color: 'var(--muted)' }}>Din ekonomiska rådgivar-kompis i Klirr. Ändringar visas alltid tydligt och kräver ditt ja.</p></div>
    <div className="chat-messages" ref={scrollRef}>
      {state.chatMessages.map(m => <div key={m.id} className={`message ${m.role}`}><div>{m.content}</div>{m.proposedAction && <div className="suggestion-box"><h3>{m.proposedAction.title}</h3><p>{m.proposedAction.description}</p>{actionSummary(m.proposedAction)}<div className="row"><button className="btn primary" disabled={m.proposedAction.status !== 'pending'} onClick={() => applyOrCancel(m.proposedAction!, 'confirm')}>{m.proposedAction.confirmLabel || 'Skriv vilken inkomst'} </button><button className="btn" disabled={m.proposedAction.status !== 'pending'} onClick={() => applyOrCancel(m.proposedAction!, 'cancel')}>{m.proposedAction.cancelLabel}</button><span className="pill">{m.proposedAction.status}</span></div></div>}{m.actions && <div className="message-actions">{m.actions.map((a, i) => <button className="btn small" key={i} onClick={() => runAction(a)}>{a.label}</button>)}</div>}</div>)}
    </div>
    <div>
      <div className="row" style={{ marginBottom: 10 }}>{buddySuggestions.map(s => <button key={s} className="btn small" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="chat-input" onSubmit={e => { e.preventDefault(); send(draft); }}><textarea className="textarea" rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Fråga Budget Buddy… t.ex. vad blir 50 000 brutto efter skatt?" /><button className="btn primary" type="submit" disabled={buddyBusy}>{buddyBusy ? 'Tänker…' : 'Skicka'}</button></form>
    </div>
  </Card>;
}

function MustsView({ summary, state, setState }: { summary: ReturnType<typeof calculateBudget>; state: AppState; setState: (s: AppState) => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('Fast kostnad');
  const manualMusts = state.manualExpenses.filter(m => m.costType === 'fixed');
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
  return <><PageTitle title="Månadens måsten" subtitle="Fasta kostnader som måste betalas varje månad. Lägg manuella måsten här, inte under inkomster." />
    <MetricCard label="Fasta kostnader totalt" value={fmt(summary.fixedTotal)} />
    <Card><h3>Alla aktiva måsten</h3><div className="stack">{summary.fixedItems.map(i => <div className="list-line" key={i.id}><span><b>{i.label}</b><br/><small style={{ color: 'var(--muted)' }}>{i.category} · {sourceLabel(i.source)}</small></span><span className="mono"><b>{fmt(i.amount)}</b></span></div>)}{!summary.fixedItems.length && <Empty>Inga fasta kostnader bekräftade än.</Empty>}</div></Card>
    <Card><h3>Redigera manuella måsten</h3><p className="hint">Här lägger du in fasta kostnader som inte syns i kontoutdraget, till exempel kontantbetalningar, delad hyra eller avtal du vill räkna med manuellt.</p><div className="stack">{manualMusts.map(m => <div className="edit-row" key={m.id}><label className="toggle-label"><input type="checkbox" checked={m.active} onChange={e => updateManual(m.id, { active: e.target.checked })} /> På</label><input className="input" value={m.label} onChange={e => updateManual(m.id, { label: e.target.value })} /><input className="input money-input" type="number" value={m.amount} onChange={e => updateManual(m.id, { amount: Number(e.target.value) })} /><input className="input category-input" value={m.category} onChange={e => updateManual(m.id, { category: e.target.value })} /><select className="select frequency-input" value={m.frequency || 'monthly'} onChange={e => updateManual(m.id, { frequency: e.target.value as Frequency })}><option value="monthly">Månad</option><option value="quarterly">Kvartal</option><option value="yearly">År</option><option value="irregular">Tillfällig</option></select><button className="btn small danger" onClick={() => removeManual(m.id)}>Ta bort</button></div>)}{!manualMusts.length && <Empty>Inga manuella måsten ännu.</Empty>}</div></Card>
    <Card><h3>Lägg till fast kostnad manuellt</h3><div className="row"><input className="input" placeholder="Namn" value={label} onChange={e => setLabel(e.target.value)} /><input className="input money-input" type="number" placeholder="kr/mån" value={amount} onChange={e => setAmount(e.target.value)} /><input className="input category-input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><button className="btn primary" onClick={add}>Lägg till</button></div></Card>
  </>;
}

function VariablePlanView({ variablePlan, setVariablePlan, summary, householdProfile }: { variablePlan: VariablePlanItem[]; setVariablePlan: (p: VariablePlanItem[]) => void; summary: ReturnType<typeof calculateBudget>; householdProfile?: HouseholdProfile }) {
  const [mode, setMode] = useState<BudgetSuggestionMode>('balanced');
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestVariableBudget> | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const total = variablePlan.filter(v => v.include).reduce((s, v) => s + v.amount, 0);
  const remainingAfterFixed = summary.remainingAfterFixed;
  function update(id: string, patch: Partial<VariablePlanItem>) { setVariablePlan(variablePlan.map(v => v.id === id ? { ...v, ...patch } : v)); }
  function add() { setVariablePlan([...variablePlan, { id: uid('vp'), label: 'Ny rörlig post', amount: 0, category: 'Rörligt', include: true }]); }
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
          note: data.explanation || 'Budget Buddy skapade ett förslag baserat på kvar efter måsten.',
          explanationNotes: Array.isArray(data.explanationNotes) ? data.explanationNotes : [data.explanation || 'Budget Buddy skapade ett förslag baserat på kvar efter måsten.'],
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
  return <><PageTitle title="Rörlig plan" subtitle="Pengarna du kan styra efter månadens måsten: mat, transport, nöje, sparande och övrigt." />
    <div className="grid grid-3"><MetricCard label="Kvar efter måsten" value={fmtSigned(remainingAfterFixed)} tone={remainingAfterFixed >= 0 ? 'good' : 'bad'} /><MetricCard label="Rörlig plan totalt" value={fmt(total)} /><MetricCard label="Kvar efter plan" value={fmtSigned(summary.remainingAfterPlan)} tone={summary.remainingAfterPlan >= 0 ? 'good' : 'bad'} /></div>
    <Card className="soft"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h3>✨ Föreslå budget</h3><p className="hint">Budget Buddy räknar på vad du har kvar efter fasta kostnader och föreslår en rörlig månadsplan. Förslaget ändrar inget förrän du trycker på "Använd förslaget".</p></div><span className="pill green">AI-ready / lokal fallback</span></div><div className="row" style={{ marginTop: 12 }}><select className="select" style={{ maxWidth: 230 }} value={mode} onChange={e => { const next = e.target.value as BudgetSuggestionMode; setMode(next); makeSuggestion(next); }}><option value="safe">Trygg budget</option><option value="balanced">Balanserad budget</option><option value="boost">Lite friare budget</option></select><button className="btn primary" disabled={suggestBusy} onClick={() => makeSuggestion()}>{suggestBusy ? 'Tar fram förslag…' : 'Föreslå budget'}</button>{suggestion && <button className="btn" onClick={applySuggestion}>Använd förslaget</button>}</div>{suggestion && <div className="suggestion-box"><p><b>Budget Buddys förslag:</b> {suggestion.note}</p><p className="hint">Lämnar cirka <b>{fmt(suggestion.marginLeft ?? suggestion.buffer)}</b> som extra marginal efter den rörliga planen. Total trygghetsdel: <b>{fmt(suggestion.safetyTotal)}</b>.</p>{suggestion.overflowToSafety > 0 && <p className="hint">Matbudgeten och andra vardagskategorier har rimlighetstak. Extra utrymme på <b>{fmt(suggestion.overflowToSafety)}</b> läggs hellre på buffert och marginal.</p>}<div className="stack">{suggestion.items.map(item => <div className="list-line" key={item.id}><span>{item.label}<br/><small style={{ color: 'var(--muted)' }}>{item.category}{suggestion.clampedCategories.includes(item.label) ? ' · begränsad till rimlig nivå' : ''}</small>{item.label === 'Mat och hushåll' && suggestion.guidelineComparison?.food && <><br/><small style={{ color: 'var(--muted)' }}>Jämfört med Konsumentverkets riktvärde: cirka {fmtSigned(suggestion.guidelineComparison.food.difference)}. {suggestion.guidelineComparison.food.note}</small></>}</span><b className="mono">{fmt(item.amount)}</b></div>)}</div></div>}</Card>
    <Card><h3>Redigera rörlig plan</h3><div className="stack">{variablePlan.map(v => <div className="edit-row variable-edit-row" key={v.id}><label className="toggle-label"><input type="checkbox" checked={v.include} onChange={e => update(v.id, { include: e.target.checked })} /> På</label><input className="input" value={v.label} onChange={e => update(v.id, { label: e.target.value })} /><input className="input money-input" type="number" value={v.amount} onChange={e => update(v.id, { amount: Number(e.target.value) })} /><input className="input category-input" value={v.category} onChange={e => update(v.id, { category: e.target.value })} /><button className="btn small danger" onClick={() => setVariablePlan(variablePlan.filter(x => x.id !== v.id))}>Ta bort</button></div>)}</div><button className="btn" style={{ marginTop: 12 }} onClick={add}>Lägg till rad</button></Card>
  </>;
}

function RecurringView({ detection, decisions, setDecisions, addRule }: { detection: DetectionResult; decisions: Record<string, RecurringDecision>; setDecisions: (d: Record<string, RecurringDecision>) => void; addRule: (r: Rule) => void }) {
  const items = getActionableRecurringCandidates(detection.recurring);
  const incomeItems = items.filter(r => r.costTypeDefault === 'income').length;
  const expenseItems = items.length - incomeItems;
  function patch(id: string, p: Partial<RecurringDecision>) { const current: RecurringDecision = decisions[id] || { status: 'pending' }; setDecisions({ ...decisions, [id]: { ...current, ...p } }); }
  return <><PageTitle title="Återkommande inkomster och utgifter" subtitle="Bekräfta vad Klirr ska räkna med framåt. Inkomster räknas inte in förrän du bekräftar dem." />
    <Card className="soft"><div className="row"><span className="pill green">{incomeItems} möjliga inkomster</span><span className="pill">{expenseItems} möjliga utgifter</span><span className="pill warn">Obekräftade poster behöver kollas</span></div></Card>
    <div className="stack">{items.map(r => { const d = decisions[r.id]; const status = d?.status || 'pending'; const currentCostType = d?.costType || r.costTypeDefault; const isIncome = currentCostType === 'income'; return <Card key={r.id}><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{r.label}</b><br/><small style={{ color: 'var(--muted)' }}>{r.category} · {costTypeLabel(currentCostType)} · {frequencyLabel(r.frequency)} · {r.occurrences} förekomster · {r.confidence}% · {actionableCandidateReason(r)} · {r.reason}</small></div><b className={`mono ${isIncome ? 'amount-pos' : ''}`}>{isIncome ? '+' : ''}{fmt(d?.monthlyAmountOverride ?? r.monthlyAmount)}/mån</b></div><div className="row" style={{ marginTop: 12 }}><select className="select" style={{ maxWidth: 180 }} value={currentCostType} onChange={e => patch(r.id, { costType: e.target.value as RecurringDecision['costType'] })}><option value="fixed">Fast utgift</option><option value="variable">Rörlig utgift</option><option value="income">Inkomst</option></select><input className="input" style={{ maxWidth: 130 }} type="number" value={d?.monthlyAmountOverride ?? Math.round(r.monthlyAmount)} onChange={e => patch(r.id, { monthlyAmountOverride: Number(e.target.value) })} /><button className="btn small primary" onClick={() => patch(r.id, { status: 'confirmed' })}>Bekräfta</button><button className="btn small" onClick={() => patch(r.id, { status: 'rejected' })}>Räkna bort</button><button className="btn small" onClick={() => addRule({ id: uid('rule'), matchText: r.normName.split(' ')[0], category: r.category, costType: currentCostType || r.costTypeDefault })}>Spara regel</button><span className={`pill ${statusTone(status)}`}>{statusLabel(status)}</span></div></Card>; })}{!items.length && <Empty>Inga återkommande kandidater att granska just nu.</Empty>}</div></>;
}

function ReviewView({ detection, recurringDecisions, setRecurringDecisions }: { detection: DetectionResult; recurringDecisions: Record<string, RecurringDecision>; setRecurringDecisions: (d: Record<string, RecurringDecision>) => void }) {
  function confirm(id?: string) { if (!id) return; setRecurringDecisions({ ...recurringDecisions, [id]: { ...recurringDecisions[id], status: 'confirmed' } }); }
  function reject(id?: string) { if (!id) return; setRecurringDecisions({ ...recurringDecisions, [id]: { ...recurringDecisions[id], status: 'rejected' } }); }
  return <><PageTitle title="Oklara poster" subtitle="Saker som Klirr inte vill räkna in utan att du kontrollerar dem." />
    <div className="stack">{detection.reviewItems.map(it => <Card className="warn" key={it.id}><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{it.description}</b><br/><small>{it.date} · {reviewTypeLabel(it.type)}</small><p>{it.note}</p></div><b className="mono">{fmt(Math.abs(it.amount))}</b></div>{it.recurringId && <div className="row"><button className="btn small primary" onClick={() => confirm(it.recurringId)}>Räkna med</button><button className="btn small" onClick={() => reject(it.recurringId)}>Räkna bort</button></div>}</Card>)}{!detection.reviewItems.length && <Empty>Inga oklara poster just nu.</Empty>}</div></>;
}

function ScenariosView({ summary, scenarioSummary, state, setState }: { summary: ReturnType<typeof calculateBudget>; scenarioSummary: ReturnType<typeof calculateBudget>; state: AppState; setState: (s: AppState) => void }) {
  const all = [...summary.fixedItems, ...summary.variableItems];
  const off = new Set(state.scenarioOff);
  function toggle(id: string) { setState({ ...state, scenarioOff: off.has(id) ? state.scenarioOff.filter(x => x !== id) : [...state.scenarioOff, id] }); }
  return <><PageTitle title="Scenarier" subtitle="Slå av kostnader och se hur marginalen ändras." />
    <div className="grid grid-3"><MetricCard label="Nuvarande kvar" value={fmtSigned(summary.remainingAfterPlan)} /><MetricCard label="Scenario kvar" value={fmtSigned(scenarioSummary.remainingAfterPlan)} tone={scenarioSummary.remainingAfterPlan >= summary.remainingAfterPlan ? 'good' : 'bad'} /><MetricCard label="Skillnad" value={fmtSigned(scenarioSummary.remainingAfterPlan - summary.remainingAfterPlan)} /></div>
    <Card><div className="stack">{all.map(i => <label className="list-line" key={i.id}><span><input type="checkbox" checked={!off.has(i.id)} onChange={() => toggle(i.id)} /> {i.label}</span><b className="mono">{fmt(i.amount)}</b></label>)}</div><button className="btn" style={{ marginTop: 12 }} onClick={() => setState({ ...state, scenarioOff: [] })}>Återställ</button></Card>
  </>;
}

function TransfersView({ detection, transactions, accounts, decisions, setDecisions }: { detection: DetectionResult; transactions: Transaction[]; accounts: Account[]; decisions: Record<string, TransferDecision>; setDecisions: (d: Record<string, TransferDecision>) => void }) {
  const tx = new Map(transactions.map(t => [t.id, t])); const acc = new Map(accounts.map(a => [a.id, a.name]));
  function patch(id: string, status: TransferDecision['status']) { setDecisions({ ...decisions, [id]: { status } }); }
  return <><PageTitle title="Interna överföringar" subtitle="Mellan egna konton. Räknas inte som inkomst eller utgift." />
    <div className="stack">{detection.transfers.map(t => { const d = tx.get(t.debitTxId)!; const c = tx.get(t.creditTxId)!; const status = decisions[t.id]?.status || 'pending'; return <Card key={t.id}><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{acc.get(d.accountId)} → {acc.get(c.accountId)}</b><br/><small>{d.date} / {c.date} · {t.reason} · {t.confidence}%</small></div><b>{fmt(Math.abs(d.amount))}</b></div><div className="row" style={{ marginTop: 10 }}><button className="btn small primary" onClick={() => patch(t.id, 'confirmed')}>Bekräfta</button><button className="btn small" onClick={() => patch(t.id, 'rejected')}>Inte intern</button><span className={`pill ${statusTone(status)}`}>{statusLabel(status)}</span></div></Card>; })}{!detection.transfers.length && <Empty>Inga interna överföringar hittades.</Empty>}</div></>;
}

function IncomeView({ incomes, setIncomes }: { incomes: Income[]; setIncomes: (i: Income[]) => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState('');
  const total = incomes.reduce((sum, i) => sum + (i.frequency === 'yearly' ? i.amount / 12 : i.frequency === 'quarterly' ? i.amount / 3 : i.amount), 0);
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
  return <><PageTitle title="Inkomster" subtitle="Lägg in och ändra pengar som kommer in. Kostnader hanteras under Måsten eller Rörlig plan." />
    <MetricCard label="Inkomst per månad" value={fmt(total)} />
    <Card><h3>Redigera inkomster</h3><p className="hint">Ändra namn, belopp och hur ofta inkomsten kommer. Klirr räknar om år/kvartal till månadsbelopp automatiskt.</p><div className="stack">{incomes.map(i => <div className="edit-row" key={i.id}><input className="input" value={i.label} onChange={e => updateIncome(i.id, { label: e.target.value })} /><input className="input money-input" type="number" value={i.amount} onChange={e => updateIncome(i.id, { amount: Number(e.target.value) })} /><select className="select frequency-input" value={i.frequency} onChange={e => updateIncome(i.id, { frequency: e.target.value as Frequency })}><option value="monthly">Varje månad</option><option value="quarterly">Varje kvartal</option><option value="yearly">Varje år</option><option value="irregular">Oregelbundet</option></select><button className="btn small danger" onClick={() => removeIncome(i.id)}>Ta bort</button></div>)}{!incomes.length && <Empty>Inga inkomster tillagda ännu.</Empty>}</div></Card>
    <Card><h3>Lägg till inkomst</h3><div className="row" style={{ marginTop: 12 }}><input className="input" placeholder="Lön, barnbidrag, frilansintäkt…" value={label} onChange={e => setLabel(e.target.value)} /><input className="input money-input" type="number" placeholder="kr" value={amount} onChange={e => setAmount(e.target.value)} /><button className="btn primary" onClick={addIncome}>Lägg till</button></div></Card>
  </>;
}

function TransactionsView({ transactions, accounts, rules, onExport }: { transactions: Transaction[]; accounts: Account[]; rules: Rule[]; onExport: () => void }) {
  const acc = new Map(accounts.map(a => [a.id, a.name]));
  const rows = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  return <><PageTitle title="Alla transaktioner" subtitle={`${transactions.length} transaktioner över ${accounts.length} konton.`} />
    <button className="btn" onClick={onExport}>Exportera CSV</button><div className="table-wrap" style={{ marginTop: 12 }}><table><thead><tr><th>Datum</th><th>Beskrivning</th><th>Konto</th><th>Kategori</th><th>Belopp</th></tr></thead><tbody>{rows.map(t => { const cat = categorize(t.description, rules); return <tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{acc.get(t.accountId)}</td><td>{cat.category}</td><td className={t.amount >= 0 ? 'amount-pos mono' : 'amount-neg mono'}>{fmtSigned(t.amount)}</td></tr>; })}</tbody></table></div></>;
}

function RulesView({ rules, setRules }: { rules: Rule[]; setRules: (r: Rule[]) => void }) {
  const [matchText, setMatchText] = useState(''); const [category, setCategory] = useState(''); const [costType, setCostType] = useState<CostType>('fixed');
  function add() { if (!matchText || !category) return; setRules([...rules, { id: uid('rule'), matchText, category, costType }]); setMatchText(''); setCategory(''); }
  return <><PageTitle title="Regler" subtitle="Regler går före Klirrs automatiska gissning." />
    <Card>{rules.map(r => <div className="list-line" key={r.id}><span><b>{r.matchText}</b> → {r.category} <span className="pill">{costTypeLabel(r.costType)}</span></span><button className="btn small danger" onClick={() => setRules(rules.filter(x => x.id !== r.id))}>Ta bort</button></div>)}<div className="row" style={{ marginTop: 14 }}><input className="input" placeholder="Text att matcha" value={matchText} onChange={e => setMatchText(e.target.value)} /><input className="input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><select className="select" style={{ maxWidth: 160 }} value={costType} onChange={e => setCostType(e.target.value as CostType)}><option value="fixed">Fast utgift</option><option value="variable">Rörlig utgift</option><option value="transfer">Intern överföring</option><option value="income">Inkomst</option><option value="excluded">Borträknad</option></select><button className="btn primary" onClick={add}>Lägg till</button></div></Card>
  </>;
}

function ImportView({ accounts, setAccounts, transactions, setTransactions, rules, transferDecisions, loadDemo, onImported }: { accounts: Account[]; setAccounts: (a: Account[]) => void; transactions: Transaction[]; setTransactions: (t: Transaction[]) => void; rules: Rule[]; transferDecisions: Record<string, TransferDecision>; loadDemo: () => void; onImported: () => void }) {
  const [pending, setPending] = useState<{ fileName: string; raw: string; bankKey: BankKey; accountName: string; isOwn: boolean; useExistingAccountId: string; rows: ReturnType<typeof parseCsvToRows>; mapping: { date: string; description: string; amount: string }; duplicateCount: number; skipDuplicates: boolean } | null>(null);
  const [csvText, setCsvText] = useState('');
  const [lastImportSummary, setLastImportSummary] = useState('');
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

  function handleFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => prepareImport(String(e.target?.result || ''), file.name);
    reader.readAsText(file);
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
    if (pending.skipDuplicates) imported = imported.filter(t => !existing.has(transactionFingerprint(t)));
    setAccounts(nextAccounts);
    setTransactions([...transactions, ...imported]);
    const previewDetection = detectRecurring([...transactions, ...imported], nextAccounts, rules, transferDecisions);
    const actionable = getActionableRecurringCandidates(previewDetection.recurring);
    setLastImportSummary(`Importerade ${imported.length} transaktioner. Klirr hittade ${actionable.filter(r => r.costTypeDefault === 'income').length} möjliga inkomster, ${actionable.filter(r => r.costTypeDefault !== 'income').length} möjliga måsten/återkommande utgifter, ${previewDetection.transfers.length} möjliga överföringar och ${previewDetection.reviewItems.length} oklara poster.`);
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

    {lastImportSummary && <Card className="soft"><h3>Importen är klar</h3><p>{lastImportSummary}</p><button className="btn primary" onClick={onImported}>Gå vidare och granska återkommande poster</button></Card>}

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

    <Card><h3>Importerade konton</h3>{accounts.map(a => <div className="list-line" key={a.id}><span>{a.name}<br/><small style={{ color: 'var(--muted)' }}>{a.bankLabel || 'okänt format'}</small></span><span>{a.isOwn ? 'Eget konto' : 'Externt'}</span></div>)}{!accounts.length && <Empty>Inga konton importerade.</Empty>}<p style={{ color: 'var(--muted)' }}>Importerade transaktioner just nu: <b>{transactions.length}</b>.</p></Card>
  </>;
}

function AccountsView({ accounts, transactions, setAccounts }: { accounts: Account[]; transactions: Transaction[]; setAccounts: (a: Account[]) => void }) {
  function patch(id: string, patch: Partial<Account>) { setAccounts(accounts.map(a => a.id === id ? { ...a, ...patch } : a)); }
  function remove(id: string) { if (transactions.some(t => t.accountId === id)) return; setAccounts(accounts.filter(a => a.id !== id)); }
  return <><PageTitle title="Konton" subtitle="Markera vilka konton som är dina egna. Det styr interna överföringar." />
    <Card><div className="stack">{accounts.map(a => <div className="edit-row" key={a.id}><label className="toggle-label"><input type="checkbox" checked={a.isOwn} onChange={e => patch(a.id, { isOwn: e.target.checked })} /> Eget</label><input className="input" value={a.name} onChange={e => patch(a.id, { name: e.target.value })} /><input className="input category-input" value={a.bankLabel || ''} onChange={e => patch(a.id, { bankLabel: e.target.value })} /><span className="pill">{transactions.filter(t => t.accountId === a.id).length} trans.</span><button className="btn small danger" disabled={transactions.some(t => t.accountId === a.id)} onClick={() => remove(a.id)}>Ta bort</button></div>)}{!accounts.length && <Empty>Inga konton ännu. Importera CSV först.</Empty>}</div></Card>
  </>;
}



function HouseholdView({ active, setActive, householdProfile, setHouseholdProfile, incomes, setIncomes }: { active: HouseholdSection; setActive: (s: HouseholdSection) => void; householdProfile?: HouseholdProfile; setHouseholdProfile: (p: HouseholdProfile) => void; incomes: Income[]; setIncomes: (i: Income[]) => void }) {
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
    {active === 'income' && <IncomeView incomes={incomes} setIncomes={setIncomes} />}
  </>;
}

function SettingsView({ state, setState, onReset, loadDemo, restartOnboarding }: { state: AppState; setState: (s: AppState) => void; onReset: () => void; loadDemo: () => void; restartOnboarding: () => void }) {
  const [importText, setImportText] = useState('');
  const exportText = JSON.stringify({ exportedAt: new Date().toISOString(), version: '1.0', state }, null, 2);
  function copyExport() { navigator.clipboard?.writeText(exportText).catch(() => undefined); }
  function importState() {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.state?.accounts && parsed.state?.transactions) setState(parsed.state);
      else if (parsed.accounts && parsed.transactions) setState(parsed);
      setImportText('');
    } catch {
      alert('Kunde inte läsa JSON. Kontrollera att du klistrat in en Klirr-export.');
    }
  }
  return <><PageTitle title="Inställningar" subtitle="Demo, integritet, export och återställning." />
    <AuthSyncPanel state={state} setState={setState} />
    <div className="grid grid-2">
      <Card><h3>Demo-läge</h3><p>Ladda om den fiktiva demoekonomin när du vill visa appen för andra.</p><button className="btn primary" onClick={loadDemo}>✨ Ladda demo-data</button></Card>
      <Card><h3>Onboarding</h3><p>Starta om guidningen för att bygga en första månadsbudget manuellt.</p><button className="btn" onClick={restartOnboarding}>Starta onboarding igen</button></Card>
      <Card><h3>Radera lokal data</h3><p>Raderar Klirrs lokala data i denna webbläsare. Detta påverkar inte GitHub/Vercel.</p><button className="btn danger" onClick={onReset}>Radera och återställ</button></Card>
    </div>
    <Card><h3>Exportera hela lokala Klirr-datan</h3><p className="hint">Använd detta vid tester: kopiera JSON och skicka till utvecklare om något ser fel ut. Undvik riktig privatdata i delade buggrapporter.</p><textarea className="textarea copy-box" readOnly value={exportText} /><div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={copyExport}>Kopiera JSON</button></div></Card>
    <Card><h3>Importera Klirr-export</h3><p className="hint">Klistra in en tidigare export för att återskapa ett testläge.</p><textarea className="textarea" rows={7} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Klistra in JSON-export här…" /><div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={importState}>Importera JSON</button></div></Card>
    <Card><h3>Integritet</h3><p>Klirr v1.0 är förberedd för inloggning, molnsparning och riktig AI, men fungerar fortfarande lokalt utan nycklar. När Supabase/OpenAI är aktiverat ska användaren tydligt informeras om vad som sparas och vad som skickas till AI. Radera/exportera data finns här under Inställningar.</p></Card>
  </>;
}
