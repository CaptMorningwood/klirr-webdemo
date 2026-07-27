import { useState } from 'react';
import { useAuthSession } from '../auth/AuthContext';
import { adoptLegacyState, hasLegacyState } from '../lib/storage';
import {
  deleteCloudData,
  loadLatestCloudSnapshot,
  saveCloudSnapshot,
} from '../services/accountClient';
import type { AppState } from '../types';
import { Card } from './UI';

type Props = {
  state: AppState;
  setState: (state: AppState) => void;
};

function friendlyError(error: unknown) {
  return error instanceof Error
    ? `${error.message} Ingen data ändrades om Klirr inte uttryckligen bekräftar det — din lokala Budget finns kvar.`
    : 'Något gick fel. Ingen data ändrades — din lokala Budget finns kvar.';
}

export function AuthSyncPanel({ state, setState }: Props) {
  const { appUserId, identity, auth } = useAuthSession();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [legacyAvailable, setLegacyAvailable] = useState(() => hasLegacyState());

  async function run(label: string, action: () => Promise<void>, success: string) {
    setBusy(true);
    setStatus(`${label}…`);
    try {
      await action();
      setStatus(success);
    } catch (error) {
      setStatus(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  function importLegacyData() {
    if (!window.confirm('Flytta äldre lokal Klirr-data till det här inloggade kontot? Data tas bort från den gamla delade lagringsnyckeln.')) return;
    const adopted = adoptLegacyState(appUserId);
    if (!adopted) {
      setLegacyAvailable(false);
      setStatus('Ingen giltig äldre lokal data hittades.');
      return;
    }
    setState(adopted);
    setLegacyAvailable(false);
    setStatus('Äldre lokal data är nu kopplad till det här Klirr-kontot.');
  }

  return (
    <Card className="soft">
      <h3>Mitt Klirr-konto</h3>
      <p>Inloggad{identity.email ? <> som <b>{identity.email}</b></> : null}.</p>
      <p className="hint">
        Google och e-postkod hanteras av Clerk. Budgetdata ägs av ditt permanenta Klirr-konto,
        inte av Clerk-identiteten.
      </p>
      {legacyAvailable && (
        <div className="warn">
          <p>Äldre lokal demodata hittades. Den visas inte automatiskt för att undvika dataläckage mellan användare.</p>
          <button className="btn" disabled={busy} onClick={importLegacyData}>Koppla äldre lokal data till mitt konto</button>
        </div>
      )}
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={() => run(
          'Sparar till molnet',
          () => saveCloudSnapshot(auth.getToken, state),
          'Klirr är sparat till molnet.',
        )}>Spara till molnet</button>
        <button className="btn" disabled={busy} onClick={() => run(
          'Hämtar senaste molnversion',
          async () => {
            const latest = await loadLatestCloudSnapshot(auth.getToken);
            if (!latest) throw new Error('Ingen molndata hittades för kontot.');
            setState(latest);
          },
          'Senaste molnversionen är hämtad.',
        )}>Hämta från molnet</button>
        <button className="btn danger" disabled={busy} onClick={() => {
          if (!window.confirm('Radera all Klirr-molndata för kontot? Lokal data påverkas inte.')) return;
          void run('Raderar molndata', () => deleteCloudData(auth.getToken), 'Molndatan är raderad.');
        }}>Radera molndata</button>
        <button className="btn" disabled={busy} onClick={() => run(
          'Loggar ut',
          auth.signOut,
          'Du är utloggad.',
        )}>Logga ut</button>
      </div>
      {status && <p role="status" aria-live="polite">{status}</p>}
    </Card>
  );
}
