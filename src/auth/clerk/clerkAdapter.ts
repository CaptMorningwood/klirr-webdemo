import type { AuthenticatedIdentity, AuthService } from '../contracts';

type ClerkUserResource = {
  id: string;
  primaryEmailAddress?: {
    emailAddress: string;
    verification?: { status?: string | null } | null;
  } | null;
  fullName?: string | null;
  firstName?: string | null;
  imageUrl?: string | null;
};

type ClerkAdapterDependencies = {
  user: ClerkUserResource;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

export function toAuthenticatedIdentity(user: ClerkUserResource): AuthenticatedIdentity {
  const primaryEmail = user.primaryEmailAddress;

  return {
    provider: 'clerk',
    subject: user.id,
    email: primaryEmail?.emailAddress,
    emailVerified: primaryEmail?.verification?.status === 'verified',
    displayName: user.fullName || user.firstName || undefined,
    avatarUrl: user.imageUrl || undefined,
  };
}

export function createClerkAuthService({ user, getToken, signOut }: ClerkAdapterDependencies): AuthService {
  const identity = toAuthenticatedIdentity(user);

  return {
    async getIdentity() {
      return identity;
    },
    getToken,
    signOut,
  };
}
