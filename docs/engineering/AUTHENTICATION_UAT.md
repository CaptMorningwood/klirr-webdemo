# Authentication UAT checklist

- **Status:** Required for issue #72
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-28

Record tester, date, commit, deployment URL, Clerk instance type, database
environment, result, and evidence location without copying secrets or personal
data into the repository.

- [ ] New Google user signs in and receives one stable Klirr account.
- [ ] Returning Google user reaches the same account and data.
- [ ] New email OTP user signs in successfully.
- [ ] Invalid and expired OTP states are clear and reveal no secrets.
- [ ] Sign-out returns to the signed-out entry.
- [ ] Refresh preserves a valid Clerk-managed session.
- [ ] Signed-out users cannot render protected Klirr data.
- [ ] A second synthetic user cannot see the first user's browser or cloud data.
- [ ] Repeated/concurrent callbacks create no duplicate users or links.
- [ ] Password and all unapproved providers are absent.
- [ ] Cloud reads, writes, and deletes ignore client owner identifiers.
- [ ] Browser storage contains no manually persisted Clerk token.
- [ ] Browser bundle, logs, PR, and documentation contain no secret.
- [ ] Legacy shared local data remains hidden until explicit adoption.
- [ ] Disabled application users fail closed.

Live Clerk, Google, and Supabase checks belong only in UAT. Automated tests mock
or model external services and make no live calls.
