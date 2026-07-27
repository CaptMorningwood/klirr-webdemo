import { describe, expect, it } from 'vitest';
import {
  IdentityResolutionError,
  createInMemoryIdentityRepository,
  resolveIdentity,
} from '../../../api/_lib/identityResolution.js';

const clerkIdentity = {
  provider: 'clerk',
  subject: 'clerk-user-1',
  email: 'USER@example.com',
  emailVerified: true,
};

describe('provider-neutral identity resolution', () => {
  it('resolves an exact Clerk subject to the same app user', async () => {
    const repository = createInMemoryIdentityRepository();
    const first = await resolveIdentity(clerkIdentity, repository);
    const returning = await resolveIdentity(clerkIdentity, repository);
    expect(returning).toBe(first);
    expect(repository.inspect()).toMatchObject({
      users: [{ id: first }],
      identities: [['clerk:clerk-user-1', first]],
    });
  });

  it('creates one app user and one identity link on first login', async () => {
    const repository = createInMemoryIdentityRepository();
    const appUserId = await resolveIdentity(clerkIdentity, repository);
    expect(appUserId).toBe('app-user-1');
    expect(repository.inspect().users).toHaveLength(1);
    expect(repository.inspect().identities).toHaveLength(1);
  });

  it('makes concurrent callback retries idempotent', async () => {
    const repository = createInMemoryIdentityRepository();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => resolveIdentity(clerkIdentity, repository)),
    );
    expect(new Set(results)).toEqual(new Set(['app-user-1']));
    expect(repository.inspect().users).toHaveLength(1);
    expect(repository.inspect().identities).toHaveLength(1);
  });

  it('never links an unverified email candidate', async () => {
    const repository = createInMemoryIdentityRepository({
      eligibleEmails: [{ appUserId: 'legacy-user', email: 'user@example.com', linkEligible: true }],
    });
    const appUserId = await resolveIdentity({ ...clerkIdentity, emailVerified: false }, repository);
    expect(appUserId).toBe('app-user-1');
  });

  it('links one explicitly eligible verified-email candidate', async () => {
    const repository = createInMemoryIdentityRepository({
      eligibleEmails: [{ appUserId: 'legacy-user', email: 'user@example.com', linkEligible: true }],
    });
    await expect(resolveIdentity(clerkIdentity, repository)).resolves.toBe('legacy-user');
  });

  it('fails safely when a verified email has ambiguous eligible candidates', async () => {
    const repository = createInMemoryIdentityRepository({
      eligibleEmails: [
        { appUserId: 'legacy-user-1', email: 'user@example.com', linkEligible: true },
        { appUserId: 'legacy-user-2', email: 'user@example.com', linkEligible: true },
      ],
    });
    await expect(resolveIdentity(clerkIdentity, repository)).rejects.toMatchObject({
      name: 'IdentityResolutionError',
      code: 'ambiguous_verified_email',
    });
    expect(IdentityResolutionError).toBeTypeOf('function');
  });
});
