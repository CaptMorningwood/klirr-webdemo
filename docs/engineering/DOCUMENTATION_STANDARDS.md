# Documentation standards

- **Status:** Current
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

All new internal documents are English Markdown and begin immediately after the title with `Status`, `Owners`, and ISO-date `Last reviewed` metadata. Prefer concise, factual language; distinguish current facts, approved targets, proposals, and deferred work. Link repository paths relatively, name accountable owners, avoid duplicating an authoritative source, and never include secrets, project references, personal/production data, or sensitive logs.

Update documentation in the same PR when behavior, architecture, migrations, operations, privacy, or workflows change. PRs explicitly state “no documentation impact” when applicable. Review stale metadata during related work. Deprecation requires a replacement link and owner approval; preserve history and inbound links. Public material requires explicit product/privacy review and placement under `docs/public/` does not publish it.
