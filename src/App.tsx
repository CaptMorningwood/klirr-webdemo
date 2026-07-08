import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, AppState, BuddyAction, ChatMessage, CostType, DetectionResult, Frequency, Income, ManualExpense, RecurringDecision, Rule, TabId, Transaction, TransferDecision, VariablePlanItem } from './types';
import { buildDemoData } from './data/demoData';
import { calculateBudget } from './lib/budgetCalculator';
import { buddySuggestions, initialBuddyMessage, makeBuddyReply } from './lib/budgetBuddy';
import { BANK_FORMATS, type BankKey, detectBank, guessMapping, parseCsvToRows, parseRowsWithMapping, readCsvTable, rowsToTransactions, transactionFingerprint } from './lib/csvParsers';
import { exportBudgetReport, exportTransactionsCsv } from './lib/exporters';
import { fmt, fmtSigned, pct, todayIso, uid } from './lib/format';
import { categorize } from './lib/rulesEngine';
import { detectRecurring } from './lib/recurrenceEngine';
import { clearState, loadState, saveState } from './lib/storage';
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
};

const nav: Array<{ id: TabId; label: string; shortLabel: string; icon: string }> = [
  { id: 'dashboard', label: 'Översikt', shortLabel: 'Hem', icon: '⌁' },
  { id: 'musts', label: 'Måsten', shortLabel: 'Måsten', icon: '📌' },
  { id: 'import', label: 'Importera', shortLabel: 'Import', icon: '⬆' },
  { id: 'variablePlan', label: 'Rörlig plan', shortLabel: 'Plan', icon: '🧮' },
  { id: 'buddy', label: 'Budget Buddy', shortLabel: 'Buddy', icon: '✨' },
  { id: 'recurring', label: 'Återkommande', shortLabel: 'Återkom.', icon: '🔁' },
  { id: 'review', label: 'Oklara poster', shortLabel: 'Oklart', icon: '⚠️' },
  { id: 'scenarios', label: 'Scenarier', shortLabel: 'Scenario', icon: '🎛️' },
  { id: 'transfers', label: 'Överföringar', shortLabel: 'Flytt', icon: '↔' },
  { id: 'income', label: 'Inkomst', shortLabel: 'Inkomst', icon: '＋' },
  { id: 'accounts', label: 'Konton', shortLabel: 'Konton', icon: '🏦' },
  { id: 'transactions', label: 'Transaktioner', shortLabel: 'Trans.', icon: '≡' },
  { id: 'rules', label: 'Regler', shortLabel: 'Regler', icon: '⚙' },
  { id: 'settings', label: 'Inställningar', shortLabel: 'Mer', icon: '⋯' },
];

const primaryMobileTabs: TabId[] = ['dashboard', 'musts', 'import', 'variablePlan', 'buddy'];
const primaryMobileNav = nav.filter(item => primaryMobileTabs.includes(item.id));
const drawerNav = nav.filter(item => !primaryMobileTabs.includes(item.id));

function getTabLabel(id: TabId) {
  return nav.find(item => item.id === id)?.label || 'Klirr';
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState() || initialState);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setLoaded(true); }, []);
  useEffect(() => { if (loaded) saveState(state); }, [state, loaded]);

  const detection = useMemo(() => detectRecurring(state.transactions, state.accounts, state.rules, state.transferDecisions), [state.transactions, state.accounts, state.rules, state.transferDecisions]);
  const summary = useMemo(() => calculateBudget({ detection, recurringDecisions: state.recurringDecisions, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan }), [detection, state.recurringDecisions, state.incomes, state.manualExpenses, state.variablePlan]);
  const scenarioSummary = useMemo(() => calculateBudget({ detection, recurringDecisions: state.recurringDecisions, incomes: state.incomes, manualExpenses: state.manualExpenses, variablePlan: state.variablePlan, scenarioOff: state.scenarioOff }), [detection, state.recurringDecisions, state.incomes, state.manualExpenses, state.variablePlan, state.scenarioOff]);

  const setPartial = (patch: Partial<AppState>) => setState(prev => ({ ...prev, ...patch }));
  const badges: Partial<Record<TabId, number>> = {
    review: detection.reviewItems.length,
    transfers: detection.transfers.filter(t => !state.transferDecisions[t.id]?.status || state.transferDecisions[t.id].status === 'pending').length,
    recurring: detection.recurring.filter(r => r.confidence >= 50 && !state.recurringDecisions[r.id]?.status).length,
  };

  function selectTab(nextTab: TabId) {
    setTab(nextTab);
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
        {tab === 'dashboard' && <DashboardView summary={summary} detection={detection} loadDemo={loadDemo} setTab={selectTab} hasData={state.transactions.length > 0} onExport={() => exportBudgetReport(summary, detection)} />}
        {tab === 'buddy' && <BudgetBuddyView state={state} setState={setState} summary={summary} detection={detection} setTab={selectTab} setScenarioOff={(ids) => setPartial({ scenarioOff: ids })} />}
        {tab === 'musts' && <MustsView summary={summary} state={state} setState={setState} />}
        {tab === 'variablePlan' && <VariablePlanView variablePlan={state.variablePlan} setVariablePlan={(variablePlan) => setPartial({ variablePlan })} summary={summary} />}
        {tab === 'recurring' && <RecurringView detection={detection} decisions={state.recurringDecisions} setDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} addRule={(rule) => setPartial({ rules: [...state.rules, rule] })} />}
        {tab === 'review' && <ReviewView detection={detection} recurringDecisions={state.recurringDecisions} setRecurringDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} />}
        {tab === 'scenarios' && <ScenariosView summary={summary} scenarioSummary={scenarioSummary} state={state} setState={setState} />}
        {tab === 'transfers' && <TransfersView detection={detection} transactions={state.transactions} accounts={state.accounts} decisions={state.transferDecisions} setDecisions={(transferDecisions) => setPartial({ transferDecisions })} />}
        {tab === 'income' && <IncomeView incomes={state.incomes} setIncomes={(incomes) => setPartial({ incomes })} />}
        {tab === 'accounts' && <AccountsView accounts={state.accounts} transactions={state.transactions} setAccounts={(accounts) => setPartial({ accounts })} />}
        {tab === 'transactions' && <TransactionsView transactions={state.transactions} accounts={state.accounts} rules={state.rules} onExport={() => exportTransactionsCsv(state.transactions, state.accounts)} />}
        {tab === 'rules' && <RulesView rules={state.rules} setRules={(rules) => setPartial({ rules })} />}
        {tab === 'import' && <ImportView accounts={state.accounts} setAccounts={(accounts) => setPartial({ accounts })} setTransactions={(transactions) => setPartial({ transactions })} transactions={state.transactions} loadDemo={loadDemo} />}
        {tab === 'settings' && <SettingsView state={state} setState={setState} loadDemo={loadDemo} onReset={() => { clearState(); setState(initialState); selectTab('dashboard'); }} />}
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

function DashboardView({ summary, detection, loadDemo, setTab, hasData, onExport }: { summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; loadDemo: () => void; setTab: (t: TabId) => void; hasData: boolean; onExport: () => void }) {
  if (!hasData) {
    return <><PageTitle title="Välkommen till Klirr" subtitle="Importera bankdata eller ladda demo för att se vad livet kostar varje månad." />
      <Card><div className="stack"><p>Klirr hjälper dig hitta återkommande kostnader, separera interna överföringar och bygga en framåtblickande månadsplan.</p><div className="row"><button className="btn primary" onClick={loadDemo}>✨ Ladda demo</button><button className="btn" onClick={() => setTab('import')}>Importera CSV</button></div></div></Card></>;
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

function BudgetBuddyView({ state, setState, summary, detection, setTab, setScenarioOff }: { state: AppState; setState: (s: AppState) => void; summary: ReturnType<typeof calculateBudget>; detection: DetectionResult; setTab: (t: TabId) => void; setScenarioOff: (ids: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [buddyBusy, setBuddyBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [state.chatMessages]);
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || buddyBusy) return;
    const userMsg: ChatMessage = { id: uid('msg'), role: 'user', content: trimmed, createdAt: todayIso() };
    const afterUser = [...state.chatMessages, userMsg];
    setState({ ...state, chatMessages: afterUser });
    setDraft('');
    setBuddyBusy(true);
    try {
      const context = { summary, reviewCount: detection.reviewItems.length, recurringCount: detection.recurring.length, transferCount: detection.transfers.length, rules: state.rules };
      const response = await fetch('/api/budget-buddy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: trimmed, context }) });
      const data = await response.json();
      const reply: ChatMessage = { id: uid('msg'), role: 'assistant', content: data.message || 'Jag kunde inte skapa ett svar just nu.', createdAt: todayIso(), actions: Array.isArray(data.actions) ? data.actions as BuddyAction[] : undefined };
      setState({ ...state, chatMessages: [...afterUser, reply] });
    } catch {
      const reply = makeBuddyReply(trimmed, { summary, detection, rules: state.rules });
      setState({ ...state, chatMessages: [...afterUser, { ...reply, content: `${reply.content}

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
  return <Card className="chat-shell">
    <div className="chat-header"><h2 style={{ margin: 0 }}>Budget Buddy ✨</h2><p style={{ margin: '5px 0 0', color: 'var(--muted)' }}>Din ekonomiska rådgivar-kompis i Klirr. Den kan förklara siffrorna och hjälpa dig hitta rätt vy.</p></div>
    <div className="chat-messages" ref={scrollRef}>
      {state.chatMessages.map(m => <div key={m.id} className={`message ${m.role}`}><div>{m.content}</div>{m.actions && <div className="message-actions">{m.actions.map((a, i) => <button className="btn small" key={i} onClick={() => runAction(a)}>{a.label}</button>)}</div>}</div>)}
    </div>
    <div>
      <div className="row" style={{ marginBottom: 10 }}>{buddySuggestions.map(s => <button key={s} className="btn small" onClick={() => send(s)}>{s}</button>)}</div>
      <form className="chat-input" onSubmit={e => { e.preventDefault(); send(draft); }}><textarea className="textarea" rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Fråga Budget Buddy… t.ex. vad ska jag göra först?" /><button className="btn primary" type="submit" disabled={buddyBusy}>{buddyBusy ? 'Tänker…' : 'Skicka'}</button></form>
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
    <Card><h3>Alla aktiva måsten</h3><div className="stack">{summary.fixedItems.map(i => <div className="list-line" key={i.id}><span><b>{i.label}</b><br/><small style={{ color: 'var(--muted)' }}>{i.category} · {i.source}</small></span><span className="mono"><b>{fmt(i.amount)}</b></span></div>)}{!summary.fixedItems.length && <Empty>Inga fasta kostnader bekräftade än.</Empty>}</div></Card>
    <Card><h3>Redigera manuella måsten</h3><p className="hint">Här lägger du in fasta kostnader som inte syns i kontoutdraget, till exempel kontantbetalningar, delad hyra eller avtal du vill räkna med manuellt.</p><div className="stack">{manualMusts.map(m => <div className="edit-row" key={m.id}><label className="toggle-label"><input type="checkbox" checked={m.active} onChange={e => updateManual(m.id, { active: e.target.checked })} /> På</label><input className="input" value={m.label} onChange={e => updateManual(m.id, { label: e.target.value })} /><input className="input money-input" type="number" value={m.amount} onChange={e => updateManual(m.id, { amount: Number(e.target.value) })} /><input className="input category-input" value={m.category} onChange={e => updateManual(m.id, { category: e.target.value })} /><select className="select frequency-input" value={m.frequency || 'monthly'} onChange={e => updateManual(m.id, { frequency: e.target.value as Frequency })}><option value="monthly">Månad</option><option value="quarterly">Kvartal</option><option value="yearly">År</option><option value="irregular">Tillfällig</option></select><button className="btn small danger" onClick={() => removeManual(m.id)}>Ta bort</button></div>)}{!manualMusts.length && <Empty>Inga manuella måsten ännu.</Empty>}</div></Card>
    <Card><h3>Lägg till fast kostnad manuellt</h3><div className="row"><input className="input" placeholder="Namn" value={label} onChange={e => setLabel(e.target.value)} /><input className="input money-input" type="number" placeholder="kr/mån" value={amount} onChange={e => setAmount(e.target.value)} /><input className="input category-input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><button className="btn primary" onClick={add}>Lägg till</button></div></Card>
  </>;
}

type BudgetSuggestionMode = 'safe' | 'balanced' | 'boost';

function suggestVariableBudget(remainingAfterFixed: number, mode: BudgetSuggestionMode): { items: VariablePlanItem[]; buffer: number; note: string } {
  const available = Math.max(0, Math.round(remainingAfterFixed));
  if (available <= 0) {
    return {
      buffer: 0,
      note: 'Klirr hittar inget utrymme efter fasta kostnader. Börja med att granska Måsten innan du sätter en rörlig plan.',
      items: [
        { id: 'vp_ai_food', label: 'Mat och hushåll', amount: 0, category: 'Vardag', include: true },
        { id: 'vp_ai_transport', label: 'Transport rörligt', amount: 0, category: 'Transport', include: true },
        { id: 'vp_ai_fun', label: 'Nöje', amount: 0, category: 'Valfritt', include: true },
        { id: 'vp_ai_household', label: 'Övrigt hushåll', amount: 0, category: 'Vardag', include: true },
        { id: 'vp_ai_savings', label: 'Buffert/sparande', amount: 0, category: 'Sparande', include: true },
      ],
    };
  }

  const settings: Record<BudgetSuggestionMode, { reservePct: number; minReserve: number; weights: number[]; note: string }> = {
    safe: {
      reservePct: 0.16,
      minReserve: 1500,
      weights: [0.58, 0.16, 0.06, 0.10, 0.10],
      note: 'Tryggt förslag: mer luft, lägre nöje och mer buffert. Bra när månaden känns känslig.',
    },
    balanced: {
      reservePct: 0.10,
      minReserve: 1000,
      weights: [0.52, 0.17, 0.11, 0.10, 0.10],
      note: 'Balanserat förslag: vardag, nöje och sparande får plats utan att hela marginalen äts upp.',
    },
    boost: {
      reservePct: 0.06,
      minReserve: 700,
      weights: [0.48, 0.15, 0.17, 0.10, 0.10],
      note: 'Lite friare förslag: mer utrymme till nöje, men mindre buffert kvar. Använd när läget är stabilt.',
    },
  };
  const cfg = settings[mode];
  const buffer = Math.min(available, Math.max(cfg.minReserve, Math.round(available * cfg.reservePct)));
  const spendable = Math.max(0, available - buffer);
  const labels = [
    ['Mat och hushåll', 'Vardag'],
    ['Transport rörligt', 'Transport'],
    ['Nöje', 'Valfritt'],
    ['Övrigt hushåll', 'Vardag'],
    ['Buffert/sparande', 'Sparande'],
  ] as const;
  const raw = cfg.weights.map(w => Math.round((spendable * w) / 100) * 100);
  const diff = spendable - raw.reduce((s, n) => s + n, 0);
  raw[0] += diff;
  return {
    buffer,
    note: cfg.note,
    items: labels.map(([label, category], idx) => ({ id: `vp_ai_${mode}_${idx}_${Date.now()}`, label, amount: Math.max(0, raw[idx]), category, include: true })),
  };
}

function VariablePlanView({ variablePlan, setVariablePlan, summary }: { variablePlan: VariablePlanItem[]; setVariablePlan: (p: VariablePlanItem[]) => void; summary: ReturnType<typeof calculateBudget> }) {
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
      const response = await fetch('/api/suggest-budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary, mode: nextMode }) });
      const data = await response.json();
      if (Array.isArray(data.items)) {
        setSuggestion({
          buffer: Number(data.buffer || 0),
          note: data.explanation || 'Budget Buddy skapade ett förslag baserat på kvar efter måsten.',
          items: data.items.map((item: any, idx: number) => ({ id: `vp_ai_api_${Date.now()}_${idx}`, label: String(item.label || 'Rörlig post'), amount: Number(item.amount || 0), category: String(item.category || 'Rörligt'), include: true })),
        });
      } else {
        setSuggestion(suggestVariableBudget(remainingAfterFixed, nextMode));
      }
    } catch {
      setSuggestion(suggestVariableBudget(remainingAfterFixed, nextMode));
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
    <Card className="soft"><div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h3>✨ Föreslå budget</h3><p className="hint">Budget Buddy räknar på vad du har kvar efter fasta kostnader och föreslår en rörlig månadsplan. Förslaget ändrar inget förrän du trycker på "Använd förslaget".</p></div><span className="pill green">AI-ready / lokal fallback</span></div><div className="row" style={{ marginTop: 12 }}><select className="select" style={{ maxWidth: 230 }} value={mode} onChange={e => { const next = e.target.value as BudgetSuggestionMode; setMode(next); makeSuggestion(next); }}><option value="safe">Trygg budget</option><option value="balanced">Balanserad budget</option><option value="boost">Lite friare budget</option></select><button className="btn primary" disabled={suggestBusy} onClick={() => makeSuggestion()}>{suggestBusy ? 'Tar fram förslag…' : 'Föreslå budget'}</button>{suggestion && <button className="btn" onClick={applySuggestion}>Använd förslaget</button>}</div>{suggestion && <div className="suggestion-box"><p><b>Budget Buddys förslag:</b> {suggestion.note}</p><p className="hint">Lämnar cirka <b>{fmt(suggestion.buffer)}</b> som extra marginal efter den rörliga planen.</p><div className="stack">{suggestion.items.map(item => <div className="list-line" key={item.id}><span>{item.label}<br/><small style={{ color: 'var(--muted)' }}>{item.category}</small></span><b className="mono">{fmt(item.amount)}</b></div>)}</div></div>}</Card>
    <Card><h3>Redigera rörlig plan</h3><div className="stack">{variablePlan.map(v => <div className="edit-row variable-edit-row" key={v.id}><label className="toggle-label"><input type="checkbox" checked={v.include} onChange={e => update(v.id, { include: e.target.checked })} /> På</label><input className="input" value={v.label} onChange={e => update(v.id, { label: e.target.value })} /><input className="input money-input" type="number" value={v.amount} onChange={e => update(v.id, { amount: Number(e.target.value) })} /><input className="input category-input" value={v.category} onChange={e => update(v.id, { category: e.target.value })} /><button className="btn small danger" onClick={() => setVariablePlan(variablePlan.filter(x => x.id !== v.id))}>Ta bort</button></div>)}</div><button className="btn" style={{ marginTop: 12 }} onClick={add}>Lägg till rad</button></Card>
  </>;
}

function RecurringView({ detection, decisions, setDecisions, addRule }: { detection: DetectionResult; decisions: Record<string, RecurringDecision>; setDecisions: (d: Record<string, RecurringDecision>) => void; addRule: (r: Rule) => void }) {
  const items = detection.recurring.filter(r => r.confidence >= 50);
  function patch(id: string, p: Partial<RecurringDecision>) { const current: RecurringDecision = decisions[id] || { status: 'pending' }; setDecisions({ ...decisions, [id]: { ...current, ...p } }); }
  return <><PageTitle title="Återkommande utgifter" subtitle="Bekräfta det Klirr ska räkna med framåt." />
    <div className="stack">{items.map(r => { const d = decisions[r.id]; const status = d?.status || 'pending'; return <Card key={r.id}><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{r.label}</b><br/><small style={{ color: 'var(--muted)' }}>{r.category} · {r.frequency} · {r.occurrences} förekomster · {r.confidence}% · {r.reason}</small></div><b className="mono">{fmt(d?.monthlyAmountOverride ?? r.monthlyAmount)}/mån</b></div><div className="row" style={{ marginTop: 12 }}><select className="select" style={{ maxWidth: 160 }} value={d?.costType || r.costTypeDefault} onChange={e => patch(r.id, { costType: e.target.value as 'fixed' | 'variable' })}><option value="fixed">Fast</option><option value="variable">Rörlig</option></select><input className="input" style={{ maxWidth: 130 }} type="number" value={d?.monthlyAmountOverride ?? Math.round(r.monthlyAmount)} onChange={e => patch(r.id, { monthlyAmountOverride: Number(e.target.value) })} /><button className="btn small primary" onClick={() => patch(r.id, { status: 'confirmed' })}>Bekräfta</button><button className="btn small" onClick={() => patch(r.id, { status: 'rejected' })}>Engång</button><button className="btn small" onClick={() => addRule({ id: uid('rule'), matchText: r.normName.split(' ')[0], category: r.category, costType: d?.costType || r.costTypeDefault })}>Spara regel</button><span className={`pill ${status === 'confirmed' ? 'green' : status === 'rejected' ? 'danger' : 'warn'}`}>{status}</span></div></Card>; })}{!items.length && <Empty>Inga säkra återkommande kandidater hittade än.</Empty>}</div></>;
}

function ReviewView({ detection, recurringDecisions, setRecurringDecisions }: { detection: DetectionResult; recurringDecisions: Record<string, RecurringDecision>; setRecurringDecisions: (d: Record<string, RecurringDecision>) => void }) {
  function confirm(id?: string) { if (!id) return; setRecurringDecisions({ ...recurringDecisions, [id]: { ...recurringDecisions[id], status: 'confirmed' } }); }
  function reject(id?: string) { if (!id) return; setRecurringDecisions({ ...recurringDecisions, [id]: { ...recurringDecisions[id], status: 'rejected' } }); }
  return <><PageTitle title="Oklara poster" subtitle="Saker som Klirr inte vill räkna in utan att du kontrollerar dem." />
    <div className="stack">{detection.reviewItems.map(it => <Card className="warn" key={it.id}><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{it.description}</b><br/><small>{it.date} · {it.type}</small><p>{it.note}</p></div><b className="mono">{fmt(Math.abs(it.amount))}</b></div>{it.recurringId && <div className="row"><button className="btn small primary" onClick={() => confirm(it.recurringId)}>Räkna med</button><button className="btn small" onClick={() => reject(it.recurringId)}>Räkna bort</button></div>}</Card>)}{!detection.reviewItems.length && <Empty>Inga oklara poster just nu.</Empty>}</div></>;
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
    <div className="stack">{detection.transfers.map(t => { const d = tx.get(t.debitTxId)!; const c = tx.get(t.creditTxId)!; const status = decisions[t.id]?.status || 'pending'; return <Card key={t.id}><div className="row" style={{ justifyContent: 'space-between' }}><div><b>{acc.get(d.accountId)} → {acc.get(c.accountId)}</b><br/><small>{d.date} / {c.date} · {t.reason} · {t.confidence}%</small></div><b>{fmt(Math.abs(d.amount))}</b></div><div className="row" style={{ marginTop: 10 }}><button className="btn small primary" onClick={() => patch(t.id, 'confirmed')}>Bekräfta</button><button className="btn small" onClick={() => patch(t.id, 'rejected')}>Inte intern</button><span className="pill warn">{status}</span></div></Card>; })}{!detection.transfers.length && <Empty>Inga interna överföringar hittades.</Empty>}</div></>;
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
    <Card>{rules.map(r => <div className="list-line" key={r.id}><span><b>{r.matchText}</b> → {r.category} <span className="pill">{r.costType}</span></span><button className="btn small danger" onClick={() => setRules(rules.filter(x => x.id !== r.id))}>Ta bort</button></div>)}<div className="row" style={{ marginTop: 14 }}><input className="input" placeholder="Text att matcha" value={matchText} onChange={e => setMatchText(e.target.value)} /><input className="input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><select className="select" style={{ maxWidth: 160 }} value={costType} onChange={e => setCostType(e.target.value as CostType)}><option value="fixed">Fast</option><option value="variable">Rörlig</option><option value="transfer">Intern överföring</option><option value="income">Inkomst</option></select><button className="btn primary" onClick={add}>Lägg till</button></div></Card>
  </>;
}

function ImportView({ accounts, setAccounts, transactions, setTransactions, loadDemo }: { accounts: Account[]; setAccounts: (a: Account[]) => void; transactions: Transaction[]; setTransactions: (t: Transaction[]) => void; loadDemo: () => void }) {
  const [pending, setPending] = useState<{ fileName: string; raw: string; bankKey: BankKey; accountName: string; isOwn: boolean; useExistingAccountId: string; rows: ReturnType<typeof parseCsvToRows>; mapping: { date: string; description: string; amount: string }; duplicateCount: number; skipDuplicates: boolean } | null>(null);
  const [csvText, setCsvText] = useState('');
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
    setCsvText('');
    setPending(null);
  }

  const headers = pending ? readCsvTable(pending.raw).headers : [];

  return <><PageTitle title="Importera" subtitle="Ladda upp CSV, klistra in text eller mappa kolumner manuellt. Allt tolkas lokalt i webbläsaren." />
    <Card className="privacy-card"><b>Trygg demo:</b> Klirr skickar inte kontoutdrag till server eller AI. All import sker i din webbläsare och sparas lokalt.</Card>
    <div className="grid grid-2">
      <Card><h3>Snabbstart</h3><div className="stack"><p style={{ color: 'var(--muted)' }}>Använd fiktiv demo-data om du bara vill visa Klirr utan riktiga kontoutdrag.</p><button className="btn primary" onClick={loadDemo}>✨ Ladda demo-data</button></div></Card>
      <Card><h3>Importera fil</h3><div className="stack"><p style={{ color: 'var(--muted)' }}>Välj CSV/TXT från dator eller mobil. Testa gärna ett anonymiserat utdrag först.</p><button className="btn primary" onClick={() => fileRef.current?.click()}>Välj CSV-fil</button><input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e => handleFile(e.target.files?.[0])} /></div></Card>
    </div>

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

function SettingsView({ state, setState, onReset, loadDemo }: { state: AppState; setState: (s: AppState) => void; onReset: () => void; loadDemo: () => void }) {
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
      <Card><h3>Radera lokal data</h3><p>Raderar Klirrs lokala data i denna webbläsare. Detta påverkar inte GitHub/Vercel.</p><button className="btn danger" onClick={onReset}>Radera och återställ</button></Card>
    </div>
    <Card><h3>Exportera hela lokala Klirr-datan</h3><p className="hint">Använd detta vid tester: kopiera JSON och skicka till utvecklare om något ser fel ut. Undvik riktig privatdata i delade buggrapporter.</p><textarea className="textarea copy-box" readOnly value={exportText} /><div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={copyExport}>Kopiera JSON</button></div></Card>
    <Card><h3>Importera Klirr-export</h3><p className="hint">Klistra in en tidigare export för att återskapa ett testläge.</p><textarea className="textarea" rows={7} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Klistra in JSON-export här…" /><div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={importState}>Importera JSON</button></div></Card>
    <Card><h3>Integritet</h3><p>Klirr v1.0 är förberedd för inloggning, molnsparning och riktig AI, men fungerar fortfarande lokalt utan nycklar. När Supabase/OpenAI är aktiverat ska användaren tydligt informeras om vad som sparas och vad som skickas till AI. Radera/exportera data finns här under Inställningar.</p></Card>
  </>;
}
