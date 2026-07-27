import type { AppState } from '../types';

async function request<T>(
  getToken: () => Promise<string | null>,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Din session har gått ut. Logga in igen.');

  const response = await fetch('/api/account/snapshots', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || 'Klirr kunde inte slutföra molnåtgärden.');
  return payload;
}

export async function saveCloudSnapshot(getToken: () => Promise<string | null>, state: AppState) {
  await request<{ saved: true }>(getToken, 'POST', { state, version: '1.0' });
}

export async function loadLatestCloudSnapshot(getToken: () => Promise<string | null>): Promise<AppState | null> {
  const result = await request<{ state: AppState | null }>(getToken, 'GET');
  return result.state;
}

export async function deleteCloudData(getToken: () => Promise<string | null>) {
  await request<{ deleted: true }>(getToken, 'DELETE');
}
