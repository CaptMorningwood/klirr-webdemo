export type IdentityProvider = 'clerk' | 'entra_external_id';

export interface AuthenticatedIdentity {
  provider: IdentityProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
}

export interface AuthService {
  getIdentity(): Promise<AuthenticatedIdentity | null>;
  getToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

export interface AuthenticatedSession {
  appUserId: string;
  identity: AuthenticatedIdentity;
  auth: AuthService;
}
