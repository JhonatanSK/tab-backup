# Transactional IndexedDB

Status: accepted, 2026-10-02.

## Context

Snapshots and retention need all-or-nothing commits across worker disposal.

## Decision

IndexedDB snapshots with one strict transaction; chrome.storage.local for small settings/control state.

## Consequences

No partially referenced index. Browser quota and eviction remain possible. See ../architecture/storage.md.
