import { createClient } from '@supabase/supabase-js';
import { IdentityResolutionError, resolveIdentity } from './identityResolution.js';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Identity persistence is not configured: ${name} is missing.`);
  return value;
}

function createIdentityRepository() {
  const supabase = createClient(
    requiredEnvironment('SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return {
    async resolve(identity) {
      const { data, error } = await supabase.rpc('resolve_external_identity', {
        p_provider: identity.provider,
        p_provider_subject: identity.subject,
        p_email: identity.email,
        p_email_verified: identity.emailVerified,
      });
      if (error) {
        if (error.message?.includes('ambiguous_verified_email')) {
          throw new IdentityResolutionError(
            'ambiguous_verified_email',
            'Kontot kunde inte länkas säkert automatiskt. Kontakta support.',
          );
        }
        throw error;
      }
      if (typeof data !== 'string' || !data) throw new Error('Identity resolution returned no Klirr user ID.');
      return data;
    },
  };
}

export async function resolveApplicationUser(identity) {
  return resolveIdentity(identity, createIdentityRepository());
}

export function createSupabaseAdmin() {
  return createClient(
    requiredEnvironment('SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
