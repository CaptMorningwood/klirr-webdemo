# Rollback and recovery

- **Status:** Decided operational guidance
- **Owners:** Alex (`@CaptMorningwood`), with Kim as infrastructure/DevOps advisor
- **Last reviewed:** 2026-07-27

Every release identifies trigger, decision owner, last known-good application revision, database compatibility, verification, communications, and monitoring. Alex authorizes production release/rollback; an incident may require immediate containment through authorized operators.

Prefer reverting/redeploying the application to a verified compatible revision. Applied database migrations are immutable and forward-only by default: never edit or casually reverse an applied migration. Use expand-and-contract so old and new application versions overlap safely; otherwise deploy a reviewed forward repair. Restore from backup only under an approved incident plan with data-loss and recovery-point assessment.

Issue #70 configures no automated rollback or live provider setting. Provider-specific commands, access, backups, monitoring, and runbooks remain deferred until environments exist.
