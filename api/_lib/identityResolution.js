export class IdentityResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IdentityResolutionError';
    this.code = code;
  }
}

export function normalizeEmail(email) {
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

export async function resolveIdentity(identity, repository) {
  if (!identity || !['clerk', 'entra_external_id'].includes(identity.provider)) {
    throw new IdentityResolutionError('invalid_provider', 'Unsupported identity provider.');
  }
  if (typeof identity.subject !== 'string' || !identity.subject.trim()) {
    throw new IdentityResolutionError('invalid_subject', 'The verified identity has no subject.');
  }

  return repository.resolve({
    provider: identity.provider,
    subject: identity.subject.trim(),
    email: normalizeEmail(identity.email),
    emailVerified: identity.emailVerified === true,
  });
}

export function createInMemoryIdentityRepository({ eligibleEmails = [] } = {}) {
  const users = new Map();
  const identities = new Map();
  const contacts = eligibleEmails.map(contact => ({
    appUserId: contact.appUserId,
    email: normalizeEmail(contact.email),
    linkEligible: contact.linkEligible === true,
  }));
  let nextId = 1;
  let queue = Promise.resolve();

  const repository = {
    resolve(identity) {
      const operation = queue.then(() => {
        const key = `${identity.provider}:${identity.subject}`;
        const existing = identities.get(key);
        if (existing) return existing;

        const candidates = identity.emailVerified && identity.email
          ? contacts.filter(contact => contact.linkEligible && contact.email === identity.email)
          : [];
        if (candidates.length > 1) {
          throw new IdentityResolutionError(
            'ambiguous_verified_email',
            'The verified email matches more than one eligible Klirr account.',
          );
        }

        const appUserId = candidates[0]?.appUserId || `app-user-${nextId++}`;
        users.set(appUserId, { id: appUserId });
        identities.set(key, appUserId);
        return appUserId;
      });
      queue = operation.catch(() => undefined);
      return operation;
    },
    inspect() {
      return { users: [...users.values()], identities: [...identities.entries()] };
    },
  };
  return repository;
}
