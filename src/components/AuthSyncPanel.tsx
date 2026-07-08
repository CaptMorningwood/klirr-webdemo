import { useEffect, useState } from 'react';
import type { AppState } from '../types';
import { Card } from './UI';
import { deleteCloudData, getCurrentUser, loadLatestCloudSnapshot, saveCloudSnapshot, signInWithPassword, signOut, signUpWithPassword, supabase, supabaseConfigured } from '../services/supabaseClient';
import type { User } from '@supabase/supabase-js';

type Props = {
  state: AppState;
  setState: (state: AppState) => void;
};

export function AuthSyncPanel({ state, setState }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => undefined);
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus(`${label}…`);
    try {
      await fn();
      setStatus(`${label} klart.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Något gick fel.');
    } finally {
      setBusy(false);
    }
  }

  if (!supabaseConfigured) {
    return <Card className="soft"><h3>Inloggning och molnsparning</h3><p className="hint">Klirr är förberedd för Supabase, men kör just nu i lokalt demo-läge. Lägg in <span className="kbd">VITE_SUPABASE_URL</span> och <span className="kbd">VITE_SUPABASE_ANON_KEY</span> i Vercel för att aktivera inloggning.</p><div className="env-list"><code>VITE_SUPABASE_URL=https://xxxxx.supabase.co</code><code>VITE_SUPABASE_ANON_KEY=...</code></div></Card>;
  }

  return <Card className="soft"><h3>Inloggning och molnsparning</h3>{user ? <div className="stack"><p>Inloggad som <b>{user.email}</b>.</p><div className="row"><button className="btn primary" disabled={busy} onClick={() => run('Sparar till molnet', async () => saveCloudSnapshot(state))}>Spara till molnet</button><button className="btn" disabled={busy} onClick={() => run('Hämtar senaste molnversion', async () => { const latest = await loadLatestCloudSnapshot(); if (latest) setState(latest); else setStatus('Ingen molndata hittades.'); })}>Hämta från molnet</button><button className="btn danger" disabled={busy} onClick={() => run('Raderar molndata', deleteCloudData)}>Radera molndata</button><button className="btn" disabled={busy} onClick={() => run('Loggar ut', async () => { await signOut(); setUser(null); })}>Logga ut</button></div>{status && <p className="hint">{status}</p>}</div> : <div className="stack"><p className="hint">Skapa konto eller logga in. I beta-läget sparas hela Klirr-läget som en Supabase-rad per användare via Row Level Security.</p><div className="grid grid-2 compact-grid"><input className="input" type="email" placeholder="E-post" value={email} onChange={e => setEmail(e.target.value)} /><input className="input" type="password" placeholder="Lösenord" value={password} onChange={e => setPassword(e.target.value)} /></div><div className="row"><button className="btn primary" disabled={busy || !email || !password} onClick={() => run('Skapar konto', async () => { const { error } = await signUpWithPassword(email, password); if (error) throw error; const next = await getCurrentUser(); setUser(next); })}>Skapa konto</button><button className="btn" disabled={busy || !email || !password} onClick={() => run('Loggar in', async () => { const { error } = await signInWithPassword(email, password); if (error) throw error; const next = await getCurrentUser(); setUser(next); })}>Logga in</button></div>{status && <p className="hint">{status}</p>}</div>}</Card>;
}
