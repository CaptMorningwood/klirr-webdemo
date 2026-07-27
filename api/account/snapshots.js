import { getAuthenticatedAppUser } from '../_lib/authenticatedAppUser.js';
import { createSupabaseAdmin } from '../_lib/identityRepository.js';

function isAppState(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authenticated = await getAuthenticatedAppUser(req);
    if (!authenticated) return res.status(401).json({ error: 'Inloggningen är ogiltig eller har gått ut.' });

    const supabase = createSupabaseAdmin();
    const appUserId = authenticated.appUserId;

    if (req.method === 'POST') {
      if (!isAppState(req.body?.state)) return res.status(400).json({ error: 'Ogiltig Budgetdata.' });
      const { error } = await supabase.from('app_snapshots').insert({
        app_user_id: appUserId,
        state: req.body.state,
        version: typeof req.body.version === 'string' ? req.body.version : '1.0',
      });
      if (error) throw error;
      return res.status(201).json({ saved: true });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('app_snapshots')
        .select('state')
        .eq('app_user_id', appUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ state: data?.state || null });
    }

    const { error } = await supabase.from('app_snapshots').delete().eq('app_user_id', appUserId);
    if (error) throw error;
    return res.status(200).json({ deleted: true });
  } catch {
    return res.status(503).json({ error: 'Molnlagringen är inte tillgänglig just nu.' });
  }
}
