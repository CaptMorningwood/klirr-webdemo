import { getAuthenticatedAppUser, publicIdentity } from '../_lib/authenticatedAppUser.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authenticated = await getAuthenticatedAppUser(req);
    if (!authenticated) return res.status(401).json({ error: 'Inloggningen är ogiltig eller har gått ut.' });

    return res.status(200).json({
      appUserId: authenticated.appUserId,
      identity: publicIdentity(authenticated.identity),
    });
  } catch (error) {
    const safeMessage = error?.code === 'ambiguous_verified_email'
      ? error.message
      : 'Klirr kunde inte verifiera kontokopplingen.';
    return res.status(error?.code === 'ambiguous_verified_email' ? 409 : 503).json({ error: safeMessage });
  }
}
