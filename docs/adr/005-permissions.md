# Four narrow permissions

Status: accepted, 2026-10-02.

## Context

Automatic backup needs URLs, groups, durable scheduling and local settings.

## Decision

Request tabs, tabGroups, storage, alarms only. Export via Blob download; no host grants/unlimitedStorage.

## Consequences

Installation shows browsing-history and group warnings. Incognito disabled. See ../security/permissions.md.
