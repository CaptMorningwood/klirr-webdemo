export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function fmt(n: number) {
  return `${Math.round(n).toLocaleString('sv-SE')} kr`;
}

export function fmtSigned(n: number) {
  return `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('sv-SE')} kr`;
}

export function pct(n: number) {
  return `${Math.round(n)}%`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
