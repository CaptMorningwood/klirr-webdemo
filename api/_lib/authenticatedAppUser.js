import { verifyClerkRequest } from './clerkAuth.js';
import { resolveApplicationUser } from './identityRepository.js';

export async function getAuthenticatedAppUser(req) {
  const identity = await verifyClerkRequest(req);
  if (!identity) return null;
  const appUserId = await resolveApplicationUser(identity);
  return { appUserId, identity };
}

export function publicIdentity(identity) {
  return {
    provider: identity.provider,
    email: identity.email,
    emailVerified: identity.emailVerified,
    displayName: identity.displayName,
    avatarUrl: identity.avatarUrl,
  };
}
