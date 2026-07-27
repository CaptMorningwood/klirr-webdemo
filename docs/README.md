# Klirr documentation

- **Status:** Current
- **Owners:** Alex (`@CaptMorningwood`)
- **Last reviewed:** 2026-07-27

This index is the entry point for repository documentation. New internal documentation is English Markdown with required metadata.

## Structure

- [Product](product/README.md): product overview, source inventory, and backlog.
- [Architecture decisions](architecture/adr/README.md): durable technical decisions and their consequences.
- [Engineering](engineering/DEVELOPMENT_WORKFLOW.md): development, branching, review, testing, release, and documentation practices.
- [Infrastructure](infrastructure/ENVIRONMENTS.md): current facts, decided targets, and deferred configuration.
- `public/`: reserved for reviewed, publishable material; it is not automatically public or deployed.

## Existing-document inventory and migration

Useful root-level and `docs/*.md` files are preserved in place. Their classification is maintained in the [product documentation inventory](product/README.md). Migration is link-first: identify an authoritative destination, review content with its owner, add redirects or update inbound links, and only then consider moving or deprecating the source. No existing document was deleted or relocated in issue #70.

Repository operational documents (`README.md`, `DEVELOPER_BRIEF.md`, `DEPLOY_STEG_FOR_STEG.md`, and `BACKLOG.md`) need owner review before consolidation. Product documents remain discoverable through the product inventory.
