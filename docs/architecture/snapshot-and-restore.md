# Capture and restore

Chrome events → scheduler → builder → semantic deduplication → transactional repository → retention. Restore plans are independent of runtime IDs.

Tab creation/removal/move/attach/detach/replacement, URL/pin/group changes, window creation/removal/bounds changes and group events schedule capture. No title-only writes, page-content reads, polling loop or DOM observation. High-frequency events share queued scheduler work. A 3-second debounce is bounded to 15 seconds during continuous changes. Store pending deadline before relying on the timer. A one-shot alarm at >=30 seconds covers worker disposal; a recurring 15-minute deduplicated check covers interrupted alarm creation/missing events. Alarms are recreated on worker entry and startup; Chrome can delay them. The manifest minimum 120 corresponds to this alarm baseline.

A capture queries populated normal windows and group metadata. There is no Chrome transaction across these APIs. A generation counter detects concurrent events, and missing group metadata causes retry instead of saving a known mixed state. It remains a best-effort point-in-time capture. No runtime IDs persist; groups have per-window snapshot-local references. Capture ignores extension UI, private windows, disallowed URL schemes and unreasonably long URLs. Empty captures never replace previous history.

Semantic comparison ignores timestamps, runtime references, focus and title-only changes. It preserves URLs, window separation, tab order/pinned status, window state, and group title/color/collapse. Manual backups deduplicate too; UI reports no change rather than inventing a new recovery point.

Restore creates normal windows with a temporary about:blank tab, adds saved tabs in order, restores pinned state, creates groups, then applies group metadata/window state. It only removes placeholders it created, never preexisting tabs. It keeps the user's current focus; saved focus is metadata. Geometry, active-tab selection and split-view layout are not promised. HTTP(S) and about:blank restore; internal/extension/file pages are counted as skipped. Dangerous schemes are excluded at capture/import.

Per-tab API failures, window failures, group/state/verification warnings and interrupted operations are reported separately. Verification checks URL or pending URL, relative index, pin/group membership and group/window metadata. A redirect or concurrent user edit can cause a warning; page content and successful HTTP loading are not verified. Browsing policies or sites may prevent navigation even after a create call succeeds.

Restore progress is persisted after each tab/group. On worker restart a running journal becomes interrupted; it is never automatically replayed, because a crash between Chrome's mutation and journal commit cannot prove whether a tab already exists. UI shows confirmed counts and asks the user to inspect created windows before another restore. Browser requests keep ordinary short work active, but extremely large/slow restores may hit worker lifecycle limits. A resumable exactly-once restore would require further work; this MVP favors honest interruption reporting over duplicate windows.

Closing/crashing before the debounce completes can lose the latest changes. Existing committed snapshots remain the recovery source. No guaranteed recovery claim is made.
