# TabBackup — Automatic Tab Backup & Restore

Your tabs, automatically backed up.

TabBackup is a Manifest V3 Chrome extension that saves local snapshots of open tabs, windows and groups and restores them into new windows. Free keeps the latest 20 distinct snapshots. No account, backend, cloud upload, page-content access or remote analytics. English and Brazilian Portuguese; system light/dark themes.

## Setup

Use Node 24.12+ and pnpm 12.8.1. Exact compatible tool versions and current official platform research are in [current-platform.md](docs/research/current-platform.md).

```sh
npx --yes pnpm@12.8.1 install --frozen-lockfile
npx --yes pnpm@12.8.1 build
```

In `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `dist/chrome`. The local onboarding page opens on first installation. Pin the action if desired. Open ordinary website tabs, then choose **Backup now**. The library supports restore, details, file export, import preview and deletion.

`pnpm dev` runs a build watcher. Reload the unpacked extension after a rebuild. It does not require a remote development server. This is Chrome-only; the minimum API baseline is Chrome 120, and users should keep Chrome updated.

## Commands

```sh
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm perf
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
pnpm audit
pnpm package
pnpm release
```

If pnpm is not globally at the pinned version, prefix commands with `npx --yes pnpm@12.8.1`. Python 3 is required only for deterministic ZIP packaging. The release command runs lint/typecheck/unit+integration tests and packaging; run E2E separately before submission. The CI workflow also runs real extension E2E. Tests use synthetic records, mocks only for unit/integration, and disposable browser profiles for real E2E. They do not touch your normal Chrome profile or corrupt profiles.

Outputs: `dist/chrome/` (unpacked extension), `dist/releases/tabbackup-1.0.0-chrome.zip` and `.zip.sha256`. The ZIP has manifest.json at root, fixed timestamps/permissions and sorted contents. Production has no source maps, secrets, dev endpoints, test fixtures or runtime npm dependencies. Reproducibility means the same source, lockfile, environment and toolchain produce the same artifact; compare the checksum after two builds. Do not commit or distribute test traces from real browsing data.

## Architecture

Chrome events → durable scheduler → snapshot builder → semantic deduplication → local transactional repository → retention → user-requested restore.

- `src/domain/`: versioned model, validation, URL policy, serialization, dedup, retention, entitlements.
- `src/background/`: top-level MV3 listeners, capture and bounded debounce with alarm recovery.
- `src/storage/`: IndexedDB transactions, migrations, small Chrome-local control state.
- `src/restore/`: safe restore plans, browser operations, verification and progress checkpoints.
- `src/popup/`, `src/options/`, `src/shared/`: accessible native DOM UI; localized strings in `public/_locales/`.
- `tests/`: domain/integration/performance tests and real extension E2E.
- `scripts/`: original icon/promo generation, artifact inspection and deterministic release ZIP.
- `assets/store/`: store PNGs and actual extension screenshots using synthetic sample data.
- `docs/`: research, architecture, ADRs, privacy/security, QA and store submission material.

See [stack decision](docs/architecture/stack-decision.md), [storage](docs/architecture/storage.md), [capture/restore design](docs/architecture/snapshot-and-restore.md), [permissions](docs/security/permissions.md), and [threat model](docs/security/threat-model.md).

## Privacy and limitations

[Privacy policy](PRIVACY.md). Internal snapshots are removed on uninstall and are not an external backup. Export important files; JSON is plaintext, and URLs/titles may be sensitive. Recognizable URL credentials are redacted, but arbitrary secrets embedded in URLs cannot be reliably classified. Never send real backup files in bug reports.

Automatic captures normally coalesce for three seconds, with bounded batching, a worker-restart alarm fallback and a 15-minute safety check. Browser alarms may be delayed. A crash before capture can lose recent changes. Empty sessions do not erase the previous history. Unchanged manual/automatic captures do not create duplicates. Quota failures preserve previously committed snapshots.

Restore creates new windows and reports restored/skipped/failed/verified counts and metadata warnings. Only HTTP(S) and about:blank are reopened. Internal Chrome, extension and file URLs are skipped. It restores tab ordering, pinned status and supported group metadata, but cannot restore unsaved forms, arbitrary JavaScript/SPA state, scroll/video state, authentication loss, window geometry or split views. It keeps the current session/focus. Opening saved sites causes ordinary site network traffic. Incognito is unsupported and disabled.

Restore progress is persisted. If interrupted, TabBackup reports confirmed progress and does not blindly replay browser mutations; inspect newly created windows before retrying. No guarantee of recovery or exactly-once restore is claimed.

Local entitlement is an interface for future licensing, not secure DRM. No payments or Pro-only feature implementation: [monetization](docs/product/monetization.md).

## Release

[Submission checklist](docs/store/submission-checklist.md), [manual QA matrix](docs/qa/manual-test-plan.md), [performance evidence](docs/performance.md). Store publication is deliberately manual. Supply a real publisher/support contact, host the provided privacy policy, complete remaining stable-browser/platform QA, review the dashboard declarations and upload the reviewed ZIP. No command uploads to the Chrome Web Store.

This repository began as an empty local directory; no remote repository or commit was created. The GitHub Actions workflow is ready if the project is hosted there.

Visual identity and shared color tokens: [theme documentation](docs/architecture/visual-identity.md).
