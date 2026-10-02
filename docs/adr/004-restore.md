# New windows and honest partial results

Status: accepted, 2026-10-02.

## Context

Replacing the current session risks user data loss; browser mutation is not transactional.

## Decision

Create new normal windows, preserve current session, allowlist restorable URLs, verify structure, persist progress and mark interrupted jobs.

## Consequences

No automatic replay after ambiguous interruption. User can inspect partial windows before retry.
