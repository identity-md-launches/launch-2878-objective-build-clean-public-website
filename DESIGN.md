# Wheelwatch design system

## Overview

Wheelwatch is an independent Squeekchain community dashboard. Its visual idea is a quiet instrument panel: confirmed numbers first, with a golden wheel connecting the interface to physical work. The dark theme is intentional and has no theme switch. A restrained amber action, open table rows, two flat data panels and a static wheel establish hierarchy without a marketing hero.

The implementation lives in `src/styles.css`, `src/App.tsx` and `src/Icons.tsx`. The browser renders the product name, manual refresh and all four metric values on the first screen at 390 × 844. Network environment, telemetry freshness and source timestamps are visible facts, not decorative badges.

## Colors

`src/styles.css` defines a primitive palette and semantic aliases. Components use the semantic tokens.

| Role / semantic token | Primitive | Value |
| --- | --- | --- |
| Page / `--color-page` | `--neutral-950` | `#111311` |
| Panel / `--color-surface` | `--neutral-900` | `#181b18` |
| Hover or selected control / `--color-hover` | `--neutral-850` | `#1e221e` |
| Structural divider / `--color-border` | `--neutral-800` | `#282e28` |
| Control boundary / `--color-control-border` | `--neutral-700` | `#394239` |
| Secondary text / `--color-muted` | `--neutral-400` | `#a1aaa0` |
| Main text / `--color-text` | `--neutral-100` | `#edf0e9` |
| Main action, chart work and wheel / `--color-accent` | `--amber-400` | `#efc16a` |
| Action hover / `--color-accent-hover` | `--amber-300` | `#f5d18f` |
| Action label / `--color-on-accent` | `--neutral-950` | `#111311` |
| Confirmed/online / `--color-success` | `--green-400` | `#a2cfa6` |
| Stale, unavailable or testnet / `--color-warning` | `--amber-200` | `#e8cb93` |
| Focus perimeter / `--color-focus` | `--amber-300` | `#f5d18f` |

Amber on the main action is a filled emphasis. Amber in the chart and wheel represents physical work; those elements have their own interaction affordances or explanatory labels. Green accompanies explicit Online/Safe text or a check icon. Warning colors also carry text. Neither color nor movement is the sole status cue.

Measured solid pairs: main text/page **16.21:1**; muted/page **7.80:1**; muted/panel **7.26:1**; action text/action fill **11.12:1**; success/panel **9.94:1**; warning/panel **11.08:1**; focus/page **12.80:1**. The rendered probe also passed its text contrast check. This is not a full accessibility certification.

## Typography

Inter is self-hosted from the Latin variable WOFF2 provided by `@fontsource-variable/inter`; Vite copies the 48,256-byte file into `dist/assets/`. `font-display: swap` provides a system sans fallback. Used weights are **400** and **600**, both supplied by the variable font. Addresses and hashes use `ui-monospace`, with SFMono-Regular/Consolas/monospace fallbacks. Prose remains sans serif.

The six tokens in `src/styles.css` use the 16 px root:

| Token | Size | Use |
| --- | --- | --- |
| `--text-small` | 0.8125 rem / 13 px | Labels, metadata, table, controls, code |
| `--text-body` | 0.9375 rem / 15 px | Body, desktop subtitle, contributor heading |
| `--text-base` | 1 rem / 16 px | Mobile brand |
| `--text-heading` | 1.125 rem / 18 px | Section headings, mobile metric values |
| `--text-value` | 1.75 rem / 28 px | Desktop metric values, mobile page title |
| `--text-title` | 2.5 rem / 40 px | Desktop page title |

Body line height is 1.6; headings use 1.25; metric values use 1.3. Headings balance their wrapping. Body text uses natural tracking, with tighter tracking confined to headings and numeric values. Changing values and times use tabular numerals. Full wallet addresses and transaction hashes wrap without truncation. Prose in the community area is limited to 60 characters of measure; definitions and descriptions also have bounded measures.

## Layout

The page shell is at most **1328 px**, including 48 px inline padding. The header is at most 1440 px with 56 px inline padding. The desktop metric group uses four columns (`1fr 1fr 1fr 1.25fr`); activity and network health use `2.15fr 1fr` with a 24 px gap. Main spacing is generally in 4 px steps: 16, 20, 24, 28, 32, 36, 44, 48 and 56 px. Small 7–11 px gaps optically align icons, status dots and labels.

Implemented breakpoints, measured against the default 16 px browser size:

- **70 rem / 1120 px:** 32 px shell/header margins, tighter panel and table spacing.
- **57 rem / 912 px:** two metric columns, one activity column, health content in a horizontal arrangement, one-column API source list.
- **40 rem / 640 px:** 20 px page margins, stacked heading and refresh toolbar, two-line brand, vertical health panel, and settlement rows arranged in a two-column grid with visible field labels. The semantic table and header remain available to accessibility tools. Source definitions become one column.
- **23 rem / 368 px:** 16 px margins, wrapping countdown, reduced metric inset and icon decoration, and metric units may move below values.

Controls wrap when text grows. Activity totals have an em-based flex basis so enlarged text can take more rows. Large values, descriptions and table cells wrap instead of widening the page. The 200% text-sizing check passed at 320, 390 and 1440 px. Regular layouts were checked at 320, 390, 768, 912 and 1440 px, including long values and expanded hashes. An RTL mirror was checked for reflow; the product copy is English. Native browser zoom and physical devices were not checked.

## Elevation & Depth

The system is flat: no box shadows, blurred overlays, gradient text or floating chrome. A slightly lighter panel background groups related data. One-pixel borders communicate table rows, control boundaries and panel structure. Native disclosure content remains in document flow. Focus outlines have a 2 px perimeter with 4 px offset and switch to the system Highlight color in forced-colors mode.

## Shapes

Data panels and the metric group use **8 px** corners. Buttons and range-control boundaries use **6 px**; the range buttons inside use **3 px**. Status dots are 7 px circles. The environment mark is a small outlined diamond. The wheel and favicon are original SVG geometry; the wheel is static and makes no claim that the hardware is moving.

## Components

| Pattern | Source | Behavior and states |
| --- | --- | --- |
| `Metric` | `src/App.tsx` | Title, decorative icon, numeric value, optional unit and definition. Loading and unavailable are text; saved readings are labeled. Numeric values preserve all integer digits. |
| `SourceStamp` | `src/App.tsx` | Source-specific UTC time; distinct connecting, unavailable, saved and older-reading states. |
| `ActivityChart` | `src/App.tsx` | Combines every API bucket into at most eight consecutive intervals with BigInt sums. Native bar buttons expose exact interval, work and settlement count. Selection is visible and announced. |
| Refresh toolbar | `src/App.tsx`, `src/useDashboard.ts` | One filled `Refresh data` action, disabled while pending; neutral Pause/Resume with `aria-pressed`; 60-second polling and hidden-tab catch-up. An independent polite status region announces completion/errors. |
| Range control | `src/App.tsx` | Native 24 hours/7 days buttons with `aria-pressed`; switching cancels old requests and only displays data for the selected range. |
| Network health | `src/App.tsx`, `src/Icons.tsx` | Wheel state, telemetry freshness, oracle and settlement queue. Stale/error telemetry makes current oracle/queue health unverified. |
| Settlement table | `src/App.tsx` | UTC timestamps, round, added work, blocks and textual confirmation. The Details button controls a row containing the complete transaction hash, copy action and supported-chain explorer link. |
| `CopyButton` | `src/App.tsx` | Copies the exact address/hash, announces success, and tells readers to select and copy manually if permission fails. |
| Source disclosure | `src/App.tsx` | Native `details`/`summary`; endpoints, timestamps, field definitions and per-source errors. Enter/Space use native behavior. |
| `Icon`, `Wheel` | `src/Icons.tsx` | Decorative SVGs with `aria-hidden`; icons use currentColor and 1.6 px strokes. Labels carry meaning. |

Primary controls have at least 44 px height. Range controls and some secondary links are smaller but meet the probe's minimum target/spacing check. Chart targets are at least 24 px wide at the tested 320 px layout. Hover styles apply only to hover-capable pointers. The only endless animation is the pending refresh icon, enabled exclusively when reduced motion is not requested. Button press scaling is 0.96 in that same preference mode; there are no entrance animations.

## Do's and Don'ts

- Reuse the shell, text tokens, semantic colors and button classes for additional views.
- Keep current public readings and their definitions above project attribution.
- Keep only one filled action per view; use neutral borders/text for secondary controls.
- Show exact source semantics and timestamps. Distinguish telemetry freshness from a confirmed network outage.
- Preserve complete addresses, base-unit precision and accessible labels. Keep raw API strings as React text.
- Keep assets local and navigation compatible with static gateway paths.
- Avoid hero sections, chart motion that implies hardware movement, decorative statistic changes, sample values presented as live, or ownership/signing controls.

For another dashboard section, start with the existing panel and heading patterns, reuse one of the six type roles, add an explicit loading/error/empty state, and verify it at 320 and 390 px. Review evidence and the guide attribution are in `VALIDATION.md` and `NOTICE.md`.
