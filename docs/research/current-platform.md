# Current platform research

Research gate completed before implementation on 2026-10-02 (America/Sao_Paulo).

## Platform and sources

Official [Chrome releases](https://chromereleases.googleblog.com/2026/10/?amp=1) report desktop stable 154.0.8037.97 (Linux), 154.0.8037.97/.98 (Windows/macOS), announced October 1. Early stable 155 is not the general stable baseline. Installed/test browser versions will be recorded separately; a bundled test Chromium is not proof of QA on stable Chrome.

Official sources reviewed:

- [Extensions / MV3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3): MV3 service worker, packaged code; no persistent background page.
- [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs): tabs permission exposes URL, pendingUrl, title and favicon URL. Do not use deprecated selected/getSelected APIs. No site content access needed. Split view (new APIs in 155) is out of scope.
- [windows](https://developer.chrome.com/docs/extensions/reference/api/windows): populated normal windows; create new windows on restore, no windows permission.
- [tabGroups](https://developer.chrome.com/docs/extensions/reference/api/tabGroups): Chrome 89+, group metadata and events; group IDs are session-local.
- [storage](https://developer.chrome.com/docs/extensions/reference/api/storage): local quota 10 MB (5 MB before 114); local data removed at uninstall; never use sync. Restrict settings to TRUSTED_CONTEXTS.
- [Storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies): IndexedDB shared by extension contexts, available in worker, quota/eviction apply without unlimitedStorage. Estimate storage and request persistence where available; export remains essential.
- [alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): 30-second minimum from Chrome 120, may fire late; recreate missing alarms whenever worker starts. Promise create from 111. Do not depend on newer persistAcrossSessions option.
- [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads): reviewed; unnecessary because a user-triggered Blob download in the extension page is sufficient.
- [Worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): typically stopped after 30 seconds idle, five-minute operation limits; global memory is not durable. Register listeners synchronously and persist pending work.
- [Permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) and [warning list](https://developer.chrome.com/docs/extensions/reference/permissions-list): tabs and tabGroups show warnings. storage and alarms have no listed warning. downloads/unlimitedStorage/host permissions omitted.
- [Incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito): use not_allowed, filter private windows/tabs defensively. No private backups.
- [CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy): self scripts only, no eval; additionally deny connections and frames.
- [Remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code): no downloaded executable code, CDN, dynamic external imports.
- [Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies): one narrow purpose, minimum permissions, honest functionality/claims, no browsing-data monetization.
- [User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq): local-only data handling still requires disclosure and a privacy policy. URLs are browsing activity. Describe actual local handling in dashboard; do not claim no data is handled.
- [Publication](https://developer.chrome.com/docs/webstore/publish) and [listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing): developer account, dashboard disclosures, hosted policy, assets and human submission needed.
- [Description](https://developer.chrome.com/docs/extensions/reference/manifest/description): 132 characters maximum.
- [Images](https://developer.chrome.com/docs/webstore/images): 128×128 PNG icon (96×96 square artwork with 16px padding); screenshots 1280×800 preferred or 640×400, full bleed; small promotional image 440×280 required, optional marquee 1400×560. This URL failed in the search reader; the current official HTML was retrieved successfully with curl and inspected.

## Tool versions discovered

Queried npm registry stable dist-tags and peer/engine constraints during the gate, not remembered versions:

| Tool                  | Latest observed  | Selected             |
| --------------------- | ---------------- | -------------------- |
| Vite                  | 8.3.2            | 8.3.2                |
| TypeScript            | 7.0.2            | 6.0.3                |
| typescript-eslint     | 8.71.0           | 8.71.0               |
| ESLint / @eslint/js   | 10.11.0 / 10.0.1 | same                 |
| Vitest                | 5.0.3            | 5.0.3                |
| Prettier              | 3.9.9            | 3.9.9                |
| Playwright            | 1.63.0           | 1.63.0               |
| pnpm                  | 12.8.1           | 12.8.1 via npx       |
| @types/chrome         | 0.3.4            | 0.3.4                |
| @types/node (24 line) | 24.19.1          | 24.19.1              |
| sharp                 | 0.35.5           | 0.35.5 (assets only) |
| fake-indexeddb        | 6.2.5            | 6.2.5 (tests only)   |

Node installed: 24.12.0, compatible with selected tools. TypeScript 7 is newer but current typescript-eslint peer range is >=4.8.4 <6.1.0. Select latest compatible stable 6.0.3; this is intentional, not a stale version assumption.

Official tool docs: [Vite](https://vite.dev/guide/), [TypeScript](https://www.typescriptlang.org/download/), [typescript-eslint support](https://typescript-eslint.io/users/dependency-versions/), [ESLint](https://eslint.org/docs/latest/use/getting-started), [Prettier](https://prettier.io/docs/install), [Vitest](https://vitest.dev/guide/), [Playwright extensions](https://playwright.dev/docs/chrome-extensions), [pnpm](https://pnpm.io/installation), [sharp](https://sharp.pixelplumbing.com/), [fakeIndexedDB](https://github.com/dumbmatter/fakeIndexedDB).

## Decisions and risks

minimum_chrome_version = 120: relied-on 30-second alarm floor, Promise APIs, storage access restriction supported by this baseline. This is a compatibility minimum, not a security recommendation to use outdated Chrome. All current stable versions exceed it.

IndexedDB transactions provide atomic snapshot + retention commits. chrome.storage.local holds small scheduler/settings/error records. A 32 MiB application budget and Free count limit 20 bound data. No unlimitedStorage; actual quota may still fail, and transactions must preserve originals. Request persistence in the full page; show whether granted. No automatic external backup. Exported files are plaintext and may be sensitive.

Three-second debounce in a live worker plus durable alarm fallback, bounded coalescing, 15-minute safety check with dedup. Browser shutdown cannot guarantee a last snapshot; preserve earlier history, skip empty captures. Restore only safe HTTP(S) and about:blank URLs; other schemes remain visible as skipped metadata. Browser navigation may contact the restored sites: local-first means no upload by TabBackup, not an offline browser.

The prompt's absolute exclusion of tokens cannot be guaranteed while retaining arbitrary URLs: credentials and recognizable authentication parameters will be redacted, but arbitrary sensitive URL paths/query values cannot be classified reliably. Explain this limitation instead of claiming exports cannot contain secrets.

## Follow-up checks during implementation

[Chrome locale message format](https://developer.chrome.com/docs/extensions/reference/api/i18n): message keys must use ASCII letters, digits or underscore. Catalog key validation is part of the artifact gate. Both shipped catalogs have identical key sets.

Official GitHub releases API checked on 2026-10-02: [checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0), [upload-artifact v7.0.1](https://github.com/actions/upload-artifact/releases/tag/v7.0.1). Workflow pins corresponding full commit SHAs. CI has read-only repository permissions and no publishing job.

Installed stable Chrome: 154.0.8037.95 (slightly behind the latest announced patch). Playwright 1.63.0 downloads Chrome for Testing 153.0.8010.12. Record these actual tested versions, never label the test bundle current stable.
