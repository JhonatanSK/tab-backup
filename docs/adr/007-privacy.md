# Local metadata only

Status: accepted, 2026-10-02.

## Context

Session recovery requires sensitive browsing metadata but no site content or server.

## Decision

Never use sync/backend/analytics, render strings as text, redact recognizable URL credentials, document plaintext exports.

## Consequences

Arbitrary URL/title secrets may remain. User controls exported copies; uninstall removes internal records.
