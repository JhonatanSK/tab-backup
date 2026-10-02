# Bounded coalescing with durable alarm fallback

Status: accepted, 2026-10-02.

## Context

Raw browser events are bursty and MV3 timers can disappear.

## Decision

Three-second debounce bounded to 15 seconds, persisted pending state, one-shot >=30-second recovery alarm and 15-minute deduplicated safety check.

## Consequences

No guarantee for unsaved changes immediately before crash; empty capture preserves history.
