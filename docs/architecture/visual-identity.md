# TabBackup visual identity

Adopted 2026-10-02. This migration changes presentation only: layouts, copy, backup/restore behavior and system light/dark preference remain unchanged.

## Single source of color

`src/shared/theme.css` owns the palette and semantic CSS variables. `styles.css` consumes these variables without color literals. `scripts/assets.mjs` reads the same `--brand-*` literals to generate the SVG, extension PNG icons, store icon and promotional tile. Edit the tokens, then run `pnpm build`; do not recolor generated files by hand.

| Brand role | Color     | Use                                                                  |
| ---------- | --------- | -------------------------------------------------------------------- |
| Text       | `#F7F7F8` | Dark-theme main text and light-theme background                      |
| Background | `#0B0D12` | Dark page background and promotional tile                            |
| Primary    | `#6366F1` | CTA fills, focus rings, checkbox accent, storage meter and selection |
| Secondary  | `#181B25` | Dark cards/sidebar/dialogs and light-theme main text                 |
| Success    | `#22C55E` | Protected state, completed backup and shield check                   |

Links, selected navigation and badges use accessible indigo text variants: darker in light mode, lighter in dark mode. Hover surfaces, dividers, backdrops and shadows are neutral. Red denotes errors/destructive actions; amber denotes warnings, paused protection and partial restore results. General notices use neutral surfaces; only confirmed success receives green text. Light mode uses a darker semantic success foreground for legibility while retaining the canonical success token.

Saved Chrome tab-group colors remain mapped to their original named color, including green. Those markers represent user metadata, not the brand or the success of a backup. Their theme-dependent colors are also centralized in `theme.css`.

## Contrast verification

Computed from the actual token values using sRGB relative luminance on 2026-10-02. All 82 evaluated foreground/background pairs passed: normal text at least 4.5:1 and focus/control/group markers at least 3:1. This is a color contrast check, not a claim of complete accessibility certification. Criteria: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

| Pair                             |   Light |    Dark |
| -------------------------------- | ------: | ------: |
| Main text / page                 | 16.05:1 | 18.15:1 |
| Muted text / hover surface       |  5.76:1 |  6.97:1 |
| Success text / notice surface    |  6.25:1 |  6.34:1 |
| Warning text / notice surface    |  5.16:1 |  8.66:1 |
| Selected text / selected surface |  5.55:1 |  6.79:1 |
| CTA text / exact primary         |  4.59:1 |  4.59:1 |

The exact primary with white text reaches only 4.47:1; with brand off-white it reaches 4.17:1. CTAs therefore use a near-black `--on-primary` foreground, preserving the requested primary fill and passing normal-text contrast. Indigo hover is lighter with the same foreground. Disabled controls retain their existing opacity and cursor and no longer receive hover fill changes. Existing focus geometry, keyboard navigation and reduced-motion rules remain intact.

Borders that identify inputs/buttons use a stronger neutral control token; decorative card dividers use a quieter neutral token. Storage usage retains its native meter semantics, with an indigo fill rather than the browser's default green.

## Sharing with the landing page

Use this palette and semantic mapping in the LP repository as well. The token file is the source for this extension repository; this change does not automatically synchronize a separate landing-page repository. Keep primary versus success roles and the accessible foreground choices consistent across both products.
