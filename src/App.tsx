import { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, AppState, ChatMessage, CostType, DetectionResult, Frequency, Income, ManualExpense, RecurringDecision, Rule, TabId, Transaction, TransferDecision, VariablePlanItem } from './types';
import { buildDemoData } from './data/demoData';
import { calculateBudget } from './lib/budgetCalculator';
import { buddySuggestions, initialBuddyMessage, makeBuddyReply } from './lib/budgetBuddy';
import { BANK_FORMATS, type BankKey, detectBank, parseCsvToRows, rowsToTransactions } from './lib/csvParsers';
import { exportBudgetReport, exportTransactionsCsv } from './lib/exporters';
import { fmt, fmtSigned, pct, todayIso, uid } from './lib/format';
import { categorize } from './lib/rulesEngine';
import { detectRecurring } from './lib/recurrenceEngine';
import { clearState, loadState, saveState } from './lib/storage';
import { Card, Empty, MetricCard, PageTitle } from './components/UI';

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
        {tab === 'variablePlan' && <VariablePlanView variablePlan={state.variablePlan} setVariablePlan={(variablePlan) => setPartial({ variablePlan })} />}
        {tab === 'recurring' && <RecurringView detection={detection} decisions={state.recurringDecisions} setDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} addRule={(rule) => setPartial({ rules: [...state.rules, rule] })} />}
        {tab === 'review' && <ReviewView detection={detection} recurringDecisions={state.recurringDecisions} setRecurringDecisions={(recurringDecisions) => setPartial({ recurringDecisions })} />}
        {tab === 'scenarios' && <ScenariosView summary={summary} scenarioSummary={scenarioSummary} state={state} setState={setState} />}
        {tab === 'transfers' && <TransfersView detection={detection} transactions={state.transactions} accounts={state.accounts} decisions={state.transferDecisions} setDecisions={(transferDecisions) => setPartial({ transferDecisions })} />}
        {tab === 'income' && <IncomeView incomes={state.incomes} setIncomes={(incomes) => setPartial({ incomes })} />}
        {tab === 'transactions' && <TransactionsView transactions={state.transactions} accounts={state.accounts} rules={state.rules} onExport={() => exportTransactionsCsv(state.transactions, state.accounts)} />}
        {tab === 'rules' && <RulesView rules={state.rules} setRules={(rules) => setPartial({ rules })} />}
        {tab === 'import' && <ImportView accounts={state.accounts} setAccounts={(accounts) => setPartial({ accounts })} setTransactions={(transactions) => setPartial({ transactions })} transactions={state.transactions} loadDemo={loadDemo} />}
        {tab === 'settings' && <SettingsView onReset={() => { clearState(); setState(initialState); selectTab('dashboard'); }} />}
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [state.chatMessages]);
  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { id: uid('msg'), role: 'user', content: trimmed, createdAt: todayIso() };
    const reply = makeBuddyReply(trimmed, { summary, detection, rules: state.rules });
    setState({ ...state, chatMessages: [...state.chatMessages, userMsg, reply] });
    setDraft('');
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
      <form className="chat-input" onSubmit={e => { e.preventDefault(); send(draft); }}><textarea className="textarea" rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Fråga Budget Buddy… t.ex. vad ska jag göra först?" /><button className="btn primary" type="submit">Skicka</button></form>
    </div>
  </Card>;
}

function MustsView({ summary, state, setState }: { summary: ReturnType<typeof calculateBudget>; state: AppState; setState: (s: AppState) => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('Fast kostnad');
  const manualMusts = state.manualExpenses.filter(m => m.costType === 'fixed');
  function add() {
    if (!label || !amount) return;
    const mx: ManualExpense = { id: uid('mx'), label, amount: Number(amount), category, costType: 'fixed', active: true };
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
    <Card><h3>Redigera manuella måsten</h3><p className="hint">Här lägger du in fasta kostnader som inte syns i kontoutdraget, till exempel kontantbetalningar, delad hyra eller avtal du vill räkna med manuellt.</p><div className="stack">{manualMusts.map(m => <div className="edit-row" key={m.id}><label className="toggle-label"><input type="checkbox" checked={m.active} onChange={e => updateManual(m.id, { active: e.target.checked })} /> På</label><input className="input" value={m.label} onChange={e => updateManual(m.id, { label: e.target.value })} /><input className="input money-input" type="number" value={m.amount} onChange={e => updateManual(m.id, { amount: Number(e.target.value) })} /><input className="input category-input" value={m.category} onChange={e => updateManual(m.id, { category: e.target.value })} /><button className="btn small danger" onClick={() => removeManual(m.id)}>Ta bort</button></div>)}{!manualMusts.length && <Empty>Inga manuella måsten ännu.</Empty>}</div></Card>
    <Card><h3>Lägg till fast kostnad manuellt</h3><div className="row"><input className="input" placeholder="Namn" value={label} onChange={e => setLabel(e.target.value)} /><input className="input money-input" type="number" placeholder="kr/mån" value={amount} onChange={e => setAmount(e.target.value)} /><input className="input category-input" placeholder="Kategori" value={category} onChange={e => setCategory(e.target.value)} /><button className="btn primary" onClick={add}>Lägg till</button></div></Card>
  </>;
}

function VariablePlanView({ variablePlan, setVariablePlan }: { variablePlan: VariablePlanItem[]; setVariablePlan: (p: VariablePlanItem[]) => void }) {
  const total = variablePlan.filter(v => v.include).reduce((s, v) => s + v.amount, 0);
  function update(id: string, patch: Partial<VariablePlanItem>) { setVariablePlan(variablePlan.map(v => v.id === id ? { ...v, ...patch } : v)); }
  function add() { setVariablePlan([...variablePlan, { id: uid('vp'), label: 'Ny rörlig post', amount: 0, category: 'Rörligt', include: true }]); }
  return <><PageTitle title="Rörlig plan" subtitle="Förslag för pengar du kan styra: mat, nöje, sparande och övrigt." /><MetricCard label="Rörlig plan totalt" value={fmt(total)} />
    <Card><div className="stack">{variablePlan.map(v => <div className="row" key={v.id}><input type="checkbox" checked={v.include} onChange={e => update(v.id, { include: e.target.checked })} /><input className="input" value={v.label} onChange={e => update(v.id, { label: e.target.value })} /><input className="input" style={{ maxWidth: 130 }} type="number" value={v.amount} onChange={e => update(v.id, { amount: Number(e.target.value) })} /><input className="input" style={{ maxWidth: 150 }} value={v.category} onChange={e => update(v.id, { category: e.target.value })} /><button className="btn small danger" onClick={() => setVariablePlan(variablePlan.filter(x => x.id !== v.id))}>Ta bort</button></div>)}</div><button className="btn" style={{ marginTop: 12 }} onClick={add}>Lägg till rad</button></Card>
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
  const [pending, setPending] = useState<{ fileName: string; raw: string; rows: ReturnType<typeof parseCsvToRows>; bankKey: BankKey; accountName: string; isOwn: boolean } | null>(null);
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

  function prepareImport(raw: string, sourceName = 'inklippt-csv.csv') {
    if (!raw.trim()) return;
    const bankKey = detectBank(raw);
    const rows = parseCsvToRows(raw, bankKey);
    setPending({
      fileName: sourceName,
      raw,
      rows,
      bankKey,
      accountName: sourceName.replace(/\.[^.]+$/, '') || 'Nytt konto',
      isOwn: true,
    });
  }

  function handleFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => prepareImport(String(e.target?.result || ''), file.name);
    reader.readAsText(file);
  }

  function reparse(bankKey: BankKey) {
    if (!pending) return;
    setPending({ ...pending, bankKey, rows: parseCsvToRows(pending.raw, bankKey) });
  }

  function confirm() {
    if (!pending || !pending.rows.length) return;
    const account: Account = { id: uid('acc'), name: pending.accountName || 'Nytt konto', isOwn: pending.isOwn, bankLabel: pending.bankKey };
    setAccounts([...accounts, account]);
    setTransactions([...transactions, ...rowsToTransactions(pending.rows, account.id)]);
    setCsvText('');
    setPending(null);
  }

  return <><PageTitle title="Importera" subtitle="Ladda upp en CSV-fil eller klistra in kontoutdrag som text. Allt tolkas lokalt i webbläsaren." />
    <div className="grid grid-2">
      <Card><h3>Snabbstart</h3><div className="stack"><p style={{ color: 'var(--muted)' }}>Använd fiktiv demo-data om du bara vill visa Klirr utan riktiga kontoutdrag.</p><button className="btn primary" onClick={loadDemo}>✨ Ladda demo-data</button></div></Card>
      <Card><h3>Importera fil</h3><div className="stack"><p style={{ color: 'var(--muted)' }}>Välj CSV/TXT från dator eller mobil. Testa gärna ett anonymiserat utdrag först.</p><button className="btn primary" onClick={() => fileRef.current?.click()}>Välj CSV-fil</button><input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e => handleFile(e.target.files?.[0])} /></div></Card>
    </div>

    <Card><h3>Klistra in CSV</h3><p style={{ color: 'var(--muted)' }}>Fallback om filväljaren strular. Formatet kan vara med semikolon eller komma, till exempel Datum;Beskrivning;Belopp.</p><textarea className="textarea" rows={9} placeholder={sampleCsv} value={csvText} onChange={e => setCsvText(e.target.value)} /><div className="row" style={{ marginTop: 12 }}><button className="btn primary" onClick={() => prepareImport(csvText, 'inklippt-kontoutdrag.csv')}>Analysera inklistrad CSV</button><button className="btn" onClick={() => setCsvText(sampleCsv)}>Fyll med exempel</button><button className="btn ghost" onClick={() => { setCsvText(''); setPending(null); }}>Rensa</button></div></Card>

    {pending && <Card><h3>Förhandsgranska import</h3><p>Hittade <b>{pending.rows.length}</b> importerbara rader i <span className="kbd">{pending.fileName}</span>.</p><div className="row"><select className="select" style={{ maxWidth: 240 }} value={pending.bankKey} onChange={e => reparse(e.target.value as BankKey)}>{BANK_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select><input className="input" value={pending.accountName} onChange={e => setPending({ ...pending, accountName: e.target.value })} /><label className="row" style={{ gap: 6 }}><input type="checkbox" checked={pending.isOwn} onChange={e => setPending({ ...pending, isOwn: e.target.checked })} /> Eget konto</label><button className="btn primary" disabled={!pending.rows.length} onClick={confirm}>Lägg till konto</button></div>{!pending.rows.length && <p style={{ color: 'var(--danger)' }}>Klirr kunde inte läsa några rader. Kontrollera att CSV:n innehåller datum, beskrivning och belopp.</p>}{!!pending.rows.length && <div className="table-wrap" style={{ marginTop: 14 }}><table><thead><tr><th>Datum</th><th>Beskrivning</th><th>Belopp</th></tr></thead><tbody>{pending.rows.slice(0, 8).map((r, i) => <tr key={`${r.date}-${i}`}><td>{r.date}</td><td>{r.description}</td><td className="mono">{fmtSigned(r.amount)}</td></tr>)}</tbody></table></div>}</Card>}

    <Card><h3>Importerade konton</h3>{accounts.map(a => <div className="list-line" key={a.id}><span>{a.name}<br/><small style={{ color: 'var(--muted)' }}>{a.bankLabel || 'okänt format'}</small></span><span>{a.isOwn ? 'Eget konto' : 'Externt'}</span></div>)}{!accounts.length && <Empty>Inga konton importerade.</Empty>}<p style={{ color: 'var(--muted)' }}>Importerade transaktioner just nu: <b>{transactions.length}</b>.</p></Card>
  </>;
}

function SettingsView({ onReset }: { onReset: () => void }) {
  return <><PageTitle title="Inställningar" subtitle="Den här MVP:n sparar data lokalt i webbläsaren." />
    <Card><h3>Radera lokal data</h3><p>Detta raderar Klirrs lokala data i denna webbläsare.</p><button className="btn danger" onClick={onReset}>Radera och återställ</button></Card>
    <Card><h3>Integritet</h3><p>Budget Buddy i denna version är lokal/mockad. Ingen data skickas till en AI-tjänst eller server.</p></Card>
  </>;
}
