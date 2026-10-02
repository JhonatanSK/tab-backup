# Free latest twenty, explicit quota failure

Status: accepted, 2026-10-02.

## Context

An unbounded history increases storage cost and sensitive data exposure.

## Decision

Central entitlement provider, keep latest 20 distinct snapshots. Reject writes over 32 MiB app budget. Preview import retention loss.

## Consequences

Old records expire at count boundary; byte-limit failure leaves committed records intact. No paid license implementation.
