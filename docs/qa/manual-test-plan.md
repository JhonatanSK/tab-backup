# QA plan and evidence

Date: 2026-10-02. Automated browser: Playwright 1.63.0, Chrome for Testing 153.0.8010.12, macOS arm64, headless, disposable profiles. Installed stable Chrome 154.0.8037.95 was identified; its graphical Load unpacked flow reached the native folder chooser, but installation could not be completed through the available automation. No PASS is claimed for it. The latest stable patch announced during research was 154.0.8037.97/.98. Do not describe these as the same browser.

Status labels: **AUTO PASS** means the named executable test ran; **NOT RUN** means no manual pass is claimed. This document does not certify all acceptance criteria on all supported Chrome/OS versions.

## Executed automated coverage

| Scenario                                  | Evidence / expected result                                                                                                                 | Status                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Clean profile, actual extension loading   | Persistent Chromium context with built MV3 extension; options page and registered worker run without JS page errors                        | AUTO PASS                                                     |
| Manual/automatic backup and dedup         | Real tabs/groups trigger capture; unchanged manual capture does not increase count                                                         | AUTO PASS                                                     |
| One/multiple windows, pinned tabs, groups | Real Chrome APIs; restore recreates windows/groups/pins, verified counts equal created tabs                                                | AUTO PASS                                                     |
| 100+ tabs                                 | 100 test tabs plus blank/session records; capture and restore of 102 tabs                                                                  | AUTO PASS                                                     |
| Free retention                            | Import more than 20 snapshots, preview retention removals, verify 20 remain                                                                | AUTO PASS                                                     |
| Current session kept                      | Existing pinned tab remains available after full restore                                                                                   | AUTO PASS                                                     |
| Partial failure and unsupported URL       | API integration tests inject a denied tab/window; exact failed/skipped counts; only own placeholder removed                                | AUTO PASS (mock integration)                                  |
| Export and valid import                   | Actual Blob download, save file, select it using chooser, preview duplicate handling and confirm                                           | AUTO PASS                                                     |
| Invalid import                            | Actual chooser with corrupt/future envelope rejected; domain tests cover schema/hash/limits/unsafe URLs                                    | AUTO PASS                                                     |
| Conflicting IDs/stale preview             | Unit transactions preserve original IDs, rename conflict, abort changed-library import                                                     | AUTO PASS (unit/integration)                                  |
| Browser restart                           | Close/relaunch test browser with same temporary profile; prior snapshot IDs remain                                                         | AUTO PASS                                                     |
| Worker termination                        | CDP stops worker; new event wakes it; separate test disposes worker with pending capture and waits for durable alarm without tab mutations | AUTO PASS                                                     |
| Local version update                      | Copy extension to fixed temporary path, change manifest 1.0.0 → 1.0.1, relaunch same profile/ID; snapshots remain                          | AUTO PASS                                                     |
| Migration failure                         | Store unsupported future record; listing/mutation fail while original records remain                                                       | AUTO PASS (IndexedDB integration)                             |
| Storage failure                           | Deliberately tiny repository budget aborts commit; previously saved data remains                                                           | AUTO PASS (IndexedDB integration)                             |
| Light/dark                                | Capture both actual UI variants and inspect resulting 1280×800 images                                                                      | AUTO PASS (rendering); visual review recorded separately      |
| Keyboard/dialogs                          | Search input, Tab to button, confirmation dialog and Cancel path                                                                           | AUTO PASS (basic only)                                        |
| Imported HTML-looking title               | Render literal title in expanded detail, assert no injected image element                                                                  | AUTO PASS                                                     |
| CSP                                       | A deliberate network fetch from the extension page is blocked                                                                              | AUTO PASS                                                     |
| Incognito                                 | Manifest not_allowed; builder integration excludes private windows/tabs                                                                    | AUTO PASS (manifest/integration; no manual incognito session) |
| Renderer crash and restore                | Crash one disposable renderer via CDP Page.crash, restore committed snapshot and verify new tabs                                           | AUTO PASS                                                     |
| Interrupted restore                       | Persist running journal, stop worker, verify next worker marks it interrupted with confirmed counts                                        | AUTO PASS                                                     |

## Manual release matrix — NOT RUN

Execute against a disposable stable-Chrome profile. Never use a personal working profile for fault injection. Record date, exact Chrome/OS version, observed result and evidence for every row. Do not turn these unchecked items into PASS without executing them.

- [ ] Stable Chrome GUI: chrome://extensions → Developer mode → Load unpacked → dist/chrome. Check manifest/worker errors, action popup and all three onboarding screens.
- [ ] One normal window: create, navigate, reorder, pin/unpin, close tabs; confirm one coherent backup after a burst, and manual dedup feedback.
- [ ] Several windows: mixed groups/colors/collapse; move tabs across windows, rename groups, close a window, restore an earlier snapshot.
- [ ] Close the last normal window and reopen Chrome; previous nonempty history must remain. Repeat using Chrome background-app mode on/off.
- [ ] Restart stable Chrome normally; compare history and settings. Install an actual signed store update when available; current local-version test is not a signed-store delivery test.
- [ ] Let worker suspend naturally without DevTools attached, then open/close tabs and verify delayed capture. Test sleep/wake and delayed alarms.
- [ ] 100+ real pages under ordinary browsing load. Optionally 500/1,000; monitor memory, CPU, latency and UI responsiveness.
- [ ] Windows/macOS/Linux behavior: minimized/maximized/fullscreen, tab ordering, group collapse and focus after restore.
- [ ] Export all and individual snapshots; choose file destination, cancel download, copy between profiles, preview merge/retention, cancel import and confirm it.
- [ ] Invalid files: malformed JSON, unsupported schema, bad checksum, huge/deep data, bad URL, repeated ID, unknown group reference, timestamps ahead of local clock. Originals must remain.
- [ ] Real quota/disk pressure in a disposable environment only. Confirm useful error and export still works; do not fill or corrupt the user's actual disk/profile.
- [ ] Dark/light at 100% and 200% zoom, narrow window, high-contrast settings, keyboard-only operation and screen reader (VoiceOver/NVDA). Check focus after actions/dialog close and reduced motion.
- [ ] Portuguese and English browser UI, dates, labels and long group names/URLs. Confirm locale fallback.
- [ ] Verify Chrome does not offer incognito access for this extension. Private sessions must never enter snapshots or exports.
- [ ] Special pages: chrome://settings, other extensions, file URLs, policy-blocked HTTP(S), redirected sites. Skips/failures/warnings must be honest; current session unchanged.
- [ ] Disconnect network and exercise backup/export/import; restore may open unavailable sites but must not claim their content loaded.
- [ ] Review privacy-policy URL, publisher contact, listing assets and disclosure answers before submission.

## Crash recovery safety

Executed crash coverage is a renderer crash in an isolated test profile, plus abrupt worker termination. It does not intentionally corrupt any profile files. It does not simulate operating-system power loss or kill the entire browser during an IndexedDB write. Full-browser crash recovery and OS restart behavior remain NOT RUN manually. For manual recovery testing, first export synthetic data, use a disposable profile, and compare restored state with the last committed snapshot; changes after that snapshot are outside the guarantee. Never edit/corrupt the profile's database files to manufacture a failure.

## Evidence locations

Test sources: tests/domain.test.ts, repository.test.ts, background.test.ts, chrome.test.ts, performance.test.ts and tests/e2e/extension.spec.ts. Playwright output is generated in playwright-report/ and test-results/ (ignored by source control). These directories can contain sensitive data if tests are adapted to real pages. Store screenshots contain synthetic sample records only. See docs/qa/release-verification.md for the final command results and artifact checksum.
