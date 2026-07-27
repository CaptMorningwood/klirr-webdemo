import { createClerkClient } from '@clerk/backend';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Server authentication is not configured: ${name} is missing.`);
  return value;
}

function authorizedParties() {
  const parties = requiredEnvironment('CLERK_AUTHORIZED_PARTIES')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!parties.length) throw new Error('Server authentication has no authorized parties.');
  return parties;
}

function toWebRequest(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
    else if (typeof value === 'string') headers.set(name, value);
  }
  return new Request(`${protocol}://${host}${req.url || '/'}`, {
    method: req.method,
    headers,
  });
}

function getClerkClient() {
  return createClerkClient({
    secretKey: requiredEnvironment('CLERK_SECRET_KEY'),
    publishableKey: requiredEnvironment('CLERK_PUBLISHABLE_KEY'),
  });
}

export async function verifyClerkRequest(req) {
  const client = getClerkClient();
  const requestState = await client.authenticateRequest(toWebRequest(req), {
    acceptsToken: 'session_token',
    authorizedParties: authorizedParties(),
  });
  if (!requestState.isAuthenticated) return null;

  const auth = requestState.toAuth();
  if (!auth.userId) return null;

  const user = await client.users.getUser(auth.userId);
  const primaryEmail = user.emailAddresses.find(address => address.id === user.primaryEmailAddressId);

  return {
    provider: 'clerk',
    subject: user.id,
    email: primaryEmail?.emailAddress,
    emailVerified: primaryEmail?.verification?.status === 'verified',
    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    avatarUrl: user.imageUrl || undefined,
  };
}
