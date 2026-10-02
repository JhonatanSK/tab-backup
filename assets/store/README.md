# Store assets

Original tab/shield/check geometry is authored in scripts/assets.mjs; it generates assets/icon.svg and rasterizes it using sharp. Brand colors come from src/shared/theme.css: indigo identity, neutral dark surfaces, and a green protection check. No competitor, Chrome or third-party logo is used. Code-native vector geometry was chosen for legibility and deterministic small-size icons; no generated photograph is needed.

- icon-128.png: 128×128 PNG, square artwork within a 96×96 area and transparent 16px margins.
- promo-440x280.png: required 440×280 small promotional tile, opaque PNG.
- screenshot-library-1280x800.png: actual extension library with synthetic imported records and real test-created backup records.
- screenshot-dark-1280x800.png: same extension in system dark theme.
- screenshot-settings-1280x800.png: actual Settings/privacy interface.

Screenshots are full-bleed 1280×800 PNGs made by real Chrome for Testing E2E. They contain synthetic example URLs/titles, not the developer's browsing data. Current captures are Brazilian Portuguese because the host Chrome locale selects pt_BR. Upload them under the Portuguese store localization; for the English listing, run the same screenshot test on an English browser installation. No UI has been composited or features invented. The optional 1400×560 marquee is intentionally not supplied.

The release ZIP includes only extension icons; upload store assets separately. Review final listing and asset language before submission. Official size source: https://developer.chrome.com/docs/webstore/images (checked 2026-10-02).
