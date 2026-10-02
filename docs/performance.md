# Performance evidence

Executed 2026-10-02, Node 24.12.0, macOS arm64, Vitest 5.0.3. Command: `pnpm perf` (verbose reporter used for the values below). Synthetic URLs/titles; no real browsing data.

| Tabs  | Normalize (ms) | JSON + SHA-256 + validation round trip (ms) | Repository save/read (ms) | Export bytes |
| ----- | -------------: | ------------------------------------------: | ------------------------: | -----------: |
| 10    |           0.08 |                                        2.75 |                      3.44 |        1,109 |
| 100   |           0.03 |                                        0.50 |                      1.02 |        8,039 |
| 500   |           0.09 |                                        1.54 |                      4.24 |       40,039 |
| 1,000 |           0.30 |                                        4.06 |                      8.40 |       80,039 |

Single-run observations, not statistical benchmarks or promises. Initial cryptography/module startup affects the first row. Repository timings use fake-indexeddb in memory, so they do not measure disk latency or Chrome quota behavior. A separate round-trip test covers a complete history with 26,000 tabs. Real Playwright E2E opens 100 additional tabs, captures 102 records across two windows, restores them through actual Chrome APIs and verifies their structure; website load time is not a restore success criterion.

Event batches share scheduler work. Snapshot writes happen after debounce; unchanged captures perform no snapshot writes. New commits add only new immutable records and delete expired IDs in one transaction. A unit integration test sends 100 events and verifies coalescing, bounded metadata writes and recovery after discarding all worker module state. No aggressive polling or DOM observer exists in production. The 15-minute safety alarm compares state before saving; the UI itself does not poll in a loop.

Snapshot limit 20; serialized snapshot budget 32 MiB. Typical 1,000-tab snapshots are small, but long URLs/titles dominate real size. Import caps: 64 MiB file, 100 snapshots, 100 windows/snapshot, 5,000 tabs/snapshot, 100,000 total tabs and bounded URL/title lengths. Export is compact JSON so supported local histories can be imported again. Large files can transiently use several times their size during parsing/validation/hash calculation.

Storage.local holds only small settings/scheduler/progress records; current Chrome quota is 10 MB. IndexedDB has browser-managed quota/eviction risk. The storage UI reports serialized snapshot usage versus the application budget, not total allocated browser bytes. Browser persistence can be requested by the user. Real low-disk/eviction testing, 500/1,000 real-tab restore latency, sustained multi-hour usage and minimum-Chrome-120 testing remain manual release QA.
