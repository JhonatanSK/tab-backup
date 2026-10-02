# Minimal TypeScript and Vite

Status: accepted, 2026-10-02.

## Context

Two small extension pages do not require React or an extension framework.

## Decision

Vite multi-entry build, native DOM, no production dependencies. Exact compatible versions and pnpm lockfile.

## Consequences

Less framework coupling; own manifest and worker wiring must be tested. See ../architecture/stack-decision.md.
