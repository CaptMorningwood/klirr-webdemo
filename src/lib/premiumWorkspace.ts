import type { AppState, BudgetMetricSnapshot, BudgetWorkspaceData, BudgetWorkspaceMetadata, RestorableBudgetVersion } from '../types';
import { calculateBudget } from './budgetCalculator';
import { calculateBudgetHealth } from './budgetHealth';
import { detectRecurring } from './recurrenceEngine';
import { uid } from './format';

const workspaceKeys: Array<keyof BudgetWorkspaceData> = ['accounts','transactions','rules','incomes','manualExpenses','variablePlan','recurringDecisions','transferDecisions','reviewDecisions','scenarioOff','chatMessages','buddyActionHistory','buddySession','onboardingCompleted','onboarding','householdProfile','budgetMetricSnapshots','budgetGoals','reminders','automaticReview','dismissedInsightKeys'];

export function extractWorkspaceData(state: AppState): BudgetWorkspaceData {
  return {
    accounts: state.accounts || [], transactions: state.transactions || [], rules: state.rules || [], incomes: state.incomes || [], manualExpenses: state.manualExpenses || [], variablePlan: state.variablePlan || [], recurringDecisions: state.recurringDecisions || {}, transferDecisions: state.transferDecisions || {}, reviewDecisions: state.reviewDecisions || {}, scenarioOff: state.scenarioOff || [], chatMessages: state.chatMessages || [], buddyActionHistory: state.buddyActionHistory || [], buddySession: state.buddySession, onboardingCompleted: Boolean(state.onboardingCompleted), onboarding: state.onboarding, householdProfile: state.householdProfile, budgetMetricSnapshots: state.budgetMetricSnapshots || [], budgetGoals: state.budgetGoals || [], reminders: state.reminders || [], automaticReview: state.automaticReview || { enabled: false, runIntervalDays: 14 }, dismissedInsightKeys: state.dismissedInsightKeys || [],
  };
}

export function applyWorkspaceData(state: AppState, data: BudgetWorkspaceData): AppState {
  const next: AppState = { ...state };
  for (const key of workspaceKeys) (next as unknown as Record<string, unknown>)[key] = data[key];
  return next;
}

export function ensureWorkspaceState(state: AppState, now = new Date().toISOString()): AppState {
  const activeBudgetId = state.activeBudgetId || 'ws_default';
  const workspaces: BudgetWorkspaceMetadata[] = state.workspaces?.length ? state.workspaces : [{ id: activeBudgetId, name: 'Min Budget', createdAt: now, updatedAt: now, members: [{ id: 'member_owner', name: 'Du', role: 'owner', status: 'active' }] }];
  return { ...state, activeBudgetId, workspaces, workspaceData: { ...(state.workspaceData || {}), [activeBudgetId]: extractWorkspaceData(state) }, budgetMetricSnapshots: state.budgetMetricSnapshots || [], budgetGoals: state.budgetGoals || [], reminders: state.reminders || [], automaticReview: state.automaticReview || { enabled: false, runIntervalDays: 14 }, budgetVersions: state.budgetVersions || [], dismissedInsightKeys: state.dismissedInsightKeys || [] };
}

export function switchWorkspace(state: AppState, targetId: string, now = new Date().toISOString()): AppState {
  const prepared = ensureWorkspaceState(state, now);
  if (!prepared.workspaces?.some(ws => ws.id === targetId)) return prepared;
  const saved = { ...(prepared.workspaceData || {}), [prepared.activeBudgetId || targetId]: extractWorkspaceData(prepared) };
  return applyWorkspaceData({ ...prepared, activeBudgetId: targetId, workspaceData: saved }, saved[targetId] || extractWorkspaceData(prepared));
}

export function createWorkspace(state: AppState, name = 'Ny Budget', now = new Date().toISOString()): AppState {
  const prepared = ensureWorkspaceState(state, now);
  const id = uid('ws');
  const blank = extractWorkspaceData({ ...prepared, accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], recurringDecisions: {}, transferDecisions: {}, reviewDecisions: {}, scenarioOff: [], budgetMetricSnapshots: [], budgetGoals: [], reminders: [], budgetVersions: [] });
  return switchWorkspace({ ...prepared, workspaces: [...(prepared.workspaces || []), { id, name, createdAt: now, updatedAt: now, members: [{ id: uid('member'), name: 'Du', role: 'owner', status: 'active' }] }], workspaceData: { ...(prepared.workspaceData || {}), [id]: blank } }, id, now);
}

export function duplicateWorkspace(state: AppState, sourceId = state.activeBudgetId || '', name = 'Kopia av Budget', now = new Date().toISOString()): AppState {
  const prepared = ensureWorkspaceState(state, now);
  const id = uid('ws');
  const data = JSON.parse(JSON.stringify((prepared.workspaceData || {})[sourceId] || extractWorkspaceData(prepared))) as BudgetWorkspaceData;
  return { ...prepared, workspaces: [...(prepared.workspaces || []), { id, name, createdAt: now, updatedAt: now, members: [{ id: uid('member'), name: 'Du', role: 'owner', status: 'active' }] }], workspaceData: { ...(prepared.workspaceData || {}), [id]: data } };
}

export function deleteWorkspace(state: AppState, id: string, fallbackId?: string): AppState {
  const prepared = ensureWorkspaceState(state);
  const workspaces = (prepared.workspaces || []).filter(ws => ws.id !== id);
  if (workspaces.length === (prepared.workspaces || []).length || workspaces.length === 0) return prepared;
  const workspaceData = { ...(prepared.workspaceData || {}) }; delete workspaceData[id];
  const nextActive = prepared.activeBudgetId === id ? (fallbackId && workspaces.some(ws => ws.id === fallbackId) ? fallbackId : workspaces[0].id) : prepared.activeBudgetId;
  return switchWorkspace({ ...prepared, workspaces, workspaceData, activeBudgetId: nextActive }, nextActive || workspaces[0].id);
}

export function currentMetrics(state: AppState, reason = 'Nuläge'): BudgetMetricSnapshot {
  const detection = detectRecurring(state.transactions || [], state.accounts || [], state.rules || [], state.transferDecisions || {});
  const summary = calculateBudget({ detection, recurringDecisions: state.recurringDecisions || {}, incomes: state.incomes || [], manualExpenses: state.manualExpenses || [], variablePlan: state.variablePlan || [] });
  const health = calculateBudgetHealth({ summary, detection, state });
  return { id: uid('snap'), createdAt: new Date().toISOString(), reason, budgetHealthScore: health.score, totalIncome: summary.totalIncome, fixedTotal: summary.fixedTotal, variableTotal: summary.variablePlanTotal, margin: summary.remainingAfterPlan, lifeCost: summary.totalMonthlyPlan };
}

export function addMetricSnapshot(state: AppState, reason: string): AppState {
  const snap = currentMetrics(state, reason);
  const prev = (state.budgetMetricSnapshots || [])[0];
  if (prev && prev.totalIncome === snap.totalIncome && prev.fixedTotal === snap.fixedTotal && prev.variableTotal === snap.variableTotal && prev.margin === snap.margin && Date.parse(snap.createdAt) - Date.parse(prev.createdAt) < 60_000) return state;
  return { ...state, budgetMetricSnapshots: [snap, ...(state.budgetMetricSnapshots || [])] };
}

export function createVersion(state: AppState, reason: string): AppState {
  const version: RestorableBudgetVersion = { id: uid('ver'), workspaceId: state.activeBudgetId || 'ws_default', createdAt: new Date().toISOString(), reason, metrics: currentMetrics(state, reason), data: extractWorkspaceData(state) };
  return { ...state, budgetVersions: [version, ...(state.budgetVersions || [])] };
}

export function restoreVersion(state: AppState, versionId: string): AppState {
  const version = (state.budgetVersions || []).find(v => v.id === versionId);
  if (!version) return state;
  const safe = createVersion(state, 'Säkerhetskopia före återställning');
  return applyWorkspaceData({ ...safe, activeBudgetId: version.workspaceId }, version.data);
}
