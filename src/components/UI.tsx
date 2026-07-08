import type { ReactNode } from 'react';

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="page-title"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function MetricCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return <Card><div className="metric-label">{label}</div><div className="metric-value mono" style={{ color: tone === 'good' ? 'var(--accent-text)' : tone === 'bad' ? '#7a3327' : undefined }}>{value}</div></Card>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
