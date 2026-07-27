# Sign-in behavior

- **Status:** Approved foundation
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-28

Klirr requires sign-in before showing Budget views. Users can continue with
Google or request a one-time code by email. Klirr does not offer a username or
password in this release.

While the session is being checked, Klirr shows a loading state and does not
briefly reveal Budget data. An expired or invalid session returns a safe error
or signed-out state. Signing out returns to the sign-in entry.

Clerk manages the sign-in identity and session. Klirr assigns a separate,
permanent account ID that owns Budget data. Changing identity provider later
does not require changing ownership of the user's Budget.

Older shared browser demo data is not opened automatically after sign-in. The
signed-in user may explicitly adopt it from account settings. This prevents a
different person using the same browser from seeing it accidentally.
