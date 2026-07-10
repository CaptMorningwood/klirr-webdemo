import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppState } from '../types';
import { Card } from './UI';
import {
  deleteCloudData,
  getCurrentUser,
  getLinkedIdentities,
  loadLatestCloudSnapshot,
  saveCloudSnapshot,
  signInWithMagicLink,
  signInWithOAuthProvider,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabase,
  supabaseConfigured,
  type LinkedIdentity,
  type OAuthProvider,
} from '../services/supabaseClient';

type Props = {
  state: AppState;
  setState: (state: AppState) => void;
};

const socialProviderSetupMessage = 'Den här inloggningen är inte aktiverad i Supabase ännu. Aktivera Google/Apple under Authentication → Providers i Supabase Dashboard och lägg in Client ID/Secret.';

function isProviderNotEnabledError(err: unknown) {
  if (!err || typeof err !== 'object') return false;

  const error = err as { message?: unknown; msg?: unknown; error_description?: unknown; error_code?: unknown };
  const searchable = [error.message, error.msg, error.error_description, error.error_code]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return searchable.includes('provider is not enabled');
}

function getFriendlyErrorMessage(err: unknown) {
  if (isProviderNotEnabledError(err)) return socialProviderSetupMessage;
  return err instanceof Error ? `${err.message} Ingen data ändrades om inte Klirr uttryckligen säger att åtgärden blev klar.` : 'Något gick fel. Ingen data ändrades.';
}

function providerLabel(provider?: string) {
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  if (provider === 'email') return 'E-post';
  return provider || 'Konto';
}

export function AuthSyncPanel({ state, setState }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => undefined);
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIdentities([]);
      return;
    }

    getLinkedIdentities().then(setIdentities).catch(() => setIdentities([]));
  }, [user]);

  async function run(label: string, fn: () => Promise<void>, successMessage?: string) {
    setBusy(true);
    setStatus(`${label}…`);
    try {
      await fn();
      setStatus(successMessage || `${label} klart.`);
    } catch (err) {
      console.error(`${label} misslyckades`, err);
      setStatus(`${getFriendlyErrorMessage(err)} Försök igen eller fortsätt lokalt — din lokala Budget finns kvar.`);
    } finally {
      setBusy(false);
    }
  }

  async function startOAuth(provider: OAuthProvider) {
    await run(
      provider === 'google' ? 'Öppnar Google-inloggning' : 'Öppnar Apple-inloggning',
      async () => {
        const { error } = await signInWithOAuthProvider(provider);
        if (error) throw error;
      },
      'Du skickas vidare för trygg inloggning. Kom tillbaka hit efteråt så hämtar Klirr kontot.',
    );
  }

  if (!supabaseConfigured) {
    return <Card className="soft"><h3>Mitt Klirr-konto</h3><p className="hint">Klirr är förberedd för Supabase, men kör just nu i lokalt demo-läge. Din budget finns kvar i den här webbläsaren. Lägg in <span className="kbd">VITE_SUPABASE_URL</span> och <span className="kbd">VITE_SUPABASE_ANON_KEY</span> i Vercel för att aktivera konto, inloggning och molnsynk.</p><div className="env-list"><code>VITE_SUPABASE_URL=https://xxxxx.supabase.co</code><code>VITE_SUPABASE_ANON_KEY=...</code></div></Card>;
  }

  return <Card className="soft"><h3>Mitt Klirr-konto</h3>{user ? <div className="stack"><p>Inloggad som <b>{user.email}</b>.</p><p className="hint">Dina Klirr-data kan sparas till molnet och hämtas på andra enheter. Du bestämmer när du sparar, hämtar och raderar molndatan.</p>{identities.length > 0 && <div className="row"><span className="hint">Kopplade inloggningar:</span>{identities.map(identity => <span className="pill green" key={String(identity.id || identity.provider)}>{providerLabel(identity.provider)}</span>)}</div>}<div className="row"><button className="btn primary" disabled={busy} onClick={() => run('Sparar till molnet', async () => saveCloudSnapshot(state), 'Klirr är sparat till molnet. Du kan hämta samma budget på en annan enhet när du är inloggad.')}>Spara till molnet</button><button className="btn" disabled={busy} onClick={() => run('Hämtar senaste molnversion', async () => { const latest = await loadLatestCloudSnapshot(); if (latest) setState(latest); else throw new Error('Ingen molndata hittades för ditt konto ännu.'); }, 'Senaste molnversionen är hämtad till den här enheten.')}>Hämta från molnet</button><button className="btn danger" disabled={busy} onClick={() => { if (!window.confirm('Vill du radera all Klirr-molndata för ditt konto? Din lokala data i den här webbläsaren påverkas inte.')) return; run('Raderar molndata', deleteCloudData, 'Din Klirr-molndata är raderad. Lokal data på den här enheten finns kvar.'); }}>Radera molndata</button><button className="btn" disabled={busy} onClick={() => run('Loggar ut', async () => { await signOut(); setUser(null); }, 'Du är utloggad. Klirr fungerar fortsatt lokalt på den här enheten.')}>Logga ut</button></div>{status && <p className={`status-note ${status.includes('misslyckades') || status.includes('gick fel') || status.includes('inte') ? 'error' : status.includes('klart') || status.includes('sparat') || status.includes('hämtad') || status.includes('skickad') ? 'success' : ''}`} role="status" aria-live="polite">{status}</p>}</div> : <div className="stack"><p className="hint">Logga in för att spara Klirr tryggt och använda samma budget på flera enheter.</p><div className="row"><button className="btn primary" disabled={busy} onClick={() => startOAuth('google')}>Fortsätt med Google</button><button className="btn primary" disabled={busy} onClick={() => startOAuth('apple')}>Fortsätt med Apple</button></div><p className="hint">Obs: Google och Apple måste aktiveras i Supabase Dashboard innan knapparna fungerar.</p><div className="grid grid-2 compact-grid"><input className="input" type="email" placeholder="E-post för magisk länk" value={magicEmail} onChange={e => setMagicEmail(e.target.value)} /><button className="btn" disabled={busy || !magicEmail} onClick={() => run('Skickar inloggningslänk', async () => { const { error } = await signInWithMagicLink(magicEmail); if (error) throw error; }, 'Inloggningslänken är skickad. Öppna mejlet på den enhet där du vill använda Klirr.')}>Skicka inloggningslänk</button></div><div className="stack"><p className="hint">Vill du hellre använda lösenord? Det fungerar som tidigare och sparar Klirr via samma trygga Supabase-konto.</p><div className="grid grid-2 compact-grid"><input className="input" type="email" placeholder="E-post" value={email} onChange={e => setEmail(e.target.value)} /><input className="input" type="password" placeholder="Lösenord" value={password} onChange={e => setPassword(e.target.value)} /></div><div className="row"><button className="btn" disabled={busy || !email || !password} onClick={() => run('Skapar konto', async () => { const { error } = await signUpWithPassword(email, password); if (error) throw error; const next = await getCurrentUser(); setUser(next); }, 'Kontot är skapat. Om Supabase kräver e-postbekräftelse: öppna länken i mejlet för att logga in.')}>Skapa konto</button><button className="btn" disabled={busy || !email || !password} onClick={() => run('Loggar in', async () => { const { error } = await signInWithPassword(email, password); if (error) throw error; const next = await getCurrentUser(); setUser(next); }, 'Du är inloggad. Nu kan Klirr sparas till molnet när du vill.')}>Logga in</button></div></div>{status && <p className={`status-note ${status.includes('misslyckades') || status.includes('gick fel') || status.includes('inte') ? 'error' : status.includes('klart') || status.includes('sparat') || status.includes('hämtad') || status.includes('skickad') ? 'success' : ''}`} role="status" aria-live="polite">{status}</p>}</div>}</Card>;
}
