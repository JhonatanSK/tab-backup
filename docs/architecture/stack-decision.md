# Stack decision

2026-10-02. Choose Vite + TypeScript + native DOM UI. There are two small extension pages, no content scripts, no routing framework and no backend. Zero production npm dependencies. Vitest covers domain and mocked integration; Playwright loads the real built MV3 extension in a disposable Chromium profile.

| Option        | Current activity evidence                                               | MV3 / TypeScript / packaging                      | Test and abstraction tradeoff                                              |
| ------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Vite 8.3.2    | current stable registry + official docs                                 | explicit manifest, worker entry, multi-page build | direct tests, low lock-in; implement manifest/build ourselves              |
| WXT 0.21.4    | registry modified 2026-08-11; [official docs](https://wxt.dev/)         | first-class extension framework                   | useful auto-entrypoints and portability, extra lifecycle/build abstraction |
| Plasmo 0.90.5 | registry modified 2025-05-17; [official docs](https://docs.plasmo.com/) | batteries included, TS/MV3                        | broader React-oriented framework, more dependencies than needed            |
| CRXJS 3.0.0   | registry modified 2026-09-24; [official docs](https://crxjs.dev/)       | Vite integration, MV3 manifest tooling            | good HMR but another integration layer for two pages                       |

Registry modification dates are activity signals, not proof of maintenance quality. React is unnecessary for this scope. UI strings live in Chrome _locales catalogs. TypeScript 6.0.3 is the latest compatible stable with the current lint parser (TS7 unsupported). pnpm exact versions plus committed lockfile and frozen CI install. Build watch is used for development, so no dev server or remote endpoint ships in the extension.
