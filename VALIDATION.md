# Implementation validation

Worker-side checks, 2026-11-02. These results are not independent network certification.

## Scope and assumptions

Built Wheelwatch, one public React/TypeScript/Vite page, for the Squeekchain community and contributor wallet `0x9a2ecf2e6af1ce1072f100e3328094016989f5b5`. Static export: `dist/`. Import label: `mingzhe-squeek`.

The main domain's example `/v1/` paths returned website HTML. Squeekchain's public frontend identified `https://api.squeekchain.com` as its API host. Direct HTTP requests and unmocked browser fetches confirmed JSON responses and cross-origin access for status, economy and both settlement ranges. No reverse proxy or backend is used.

The economy API reported `target: sepolia` and chain ID `11155111`. The site displays that environment from the response. Block height/work use the confirmed builder anchor. Distance is explicitly the latest `measurement.distanceMm / 1,000,000`, not an inferred lifetime total. Supply uses `liveSupplyBaseUnits` and the reported token decimals. All displayed API figures are live or visibly retained readings; no fixtures are imported into production.

## Brief coverage

| Requirement | Result | Implementation |
| --- | --- | --- |
| Public community website for The Buildooooor | Met | Independent project copy, exact contributor wallet and official Genesis code link |
| Live block height | Met | `builder.anchor.blockHeight` |
| Cumulative work | Met | `builder.anchor.cumulativeWork` |
| Distance in km | Met | Latest wheel measurement; scope is disclosed beside the value and in definitions |
| Network status | Met | Telemetry freshness, wheel state, oracle/queue states; explicit stale/unavailable states |
| Live SQK supply | Met | Economy live base units; BigInt formatting; cap percentage |
| Recent settlements table | Met | Live API entries; range selection, UTC timestamps, confirmation and expandable complete hashes |
| About 60-second automatic updates | Met | Visible-tab interval, pause/resume, manual refresh and visibility catch-up |
| Dark theme, English, responsive | Met | Checked at 320/390/768/912/1440 px; 200% text sizing and long values |
| No wallet connection, keys, token or contracts | Met | Read-only public fetches; supplied wallet is attribution text |
| Static IPFS/ENS-compatible export | Met for build | Relative assets, single page, gateway-subpath validation; publication occurs after review |
| Title, favicon, description, og:title, og:image | Met | Local SVG icon and actual 1200 × 630 PNG share card |
| README, source, lockfile, DESIGN.md | Met | Repository-root documentation and complete source/export; generated dependencies excluded |
| Badge awarded / Genesis submission | After team review | Not claimed or performed; official submission destination is linked |

Visual idea: a quiet dark instrument panel, with one golden wheel tying confirmed network data to physical work.

## Better Interface review

The pinned workflow and core principles in all six domains were read during implementation. The supporting keyboard, contrast, responsive-layout and documentation guidance informed the implementation. Attribution and supplied licenses are retained in `NOTICE.md` and `licenses/design-guidance.txt`.

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native links/buttons/table/disclosure; one main and h1; skip link; focus outline; polite status updates; exact control names; statuses have text. Keyboard refresh and disclosure paths exercised. Axe: 27 rules passed, 0 violations and 0 incomplete rules at each of 390/1440 px with disclosures open. No screen-reader or physical-device session. |
| Layout | Checked | Actual production export at 320/390/768/912/1440 px; no page overflow with long integer values and expanded hashes. Phone/desktop screenshots inspected. 200% root text sizing and RTL-mirror reflow passed; native browser zoom unperformed. |
| Writing | Checked | Short task heading, verb action labels, one terminology set, UTC labels, honest testnet/source status, empty/error recovery text, independent project/team-approval disclosure. No claim of lifetime distance or mainnet data. |
| Typography | Checked | Self-hosted Inter loaded in browser; two families, weights 400/600; six defined size tokens. Probe observed five sizes at each phone/desktop width. Tabular numbers, complete hashes and wrapping long values checked. |
| Colors | Checked | Probe passed measured rendered text contrast. Solid pairs independently computed from the actual token values: muted/panel 7.26:1, main/page 16.21:1, action text/fill 11.12:1. Status meaning also has text. Native forced-colors visual inspection unperformed. |
| UI | Checked | Refresh pending/disabled/success/failure; manual retry; range cancellation; empty history; stale and archived data; transaction disclosure; clipboard success/denial; reduced-motion probe. No entrance or wheel animation, no shadow-plus-border panels. Safari/WebKit unavailable. |

Theme switching, forms, authentication, dialogs, transactions and additional locales are not applicable to this read-only English dashboard.

## Findings and fixes

| Severity / domain | Final source | Observation | Correction and recheck |
| --- | --- | --- | --- |
| Medium / Accessibility | `src/App.tsx:123`, `src/styles.css:518` | Original 24 chart bars measured 10 × 111 px at 390, crowding adjacent controls. | Combine every returned bucket into at most eight consecutive intervals using BigInt sums. Bar-selection test verifies exact totals; minimum width ≥24 px at 320. Final target probe passes. |
| Low / Writing | `src/App.tsx:54` | Repeated identical timestamps did not identify their sources well on mobile; the first probe flagged four repeated lines. | Source-specific Network, Supply, Activity and Settlement list labels. Final repetition probe passes. |
| Medium / Layout | `src/styles.css:1361` | At 200% text size, measured scroll width 401 px in a 320 px viewport; header links, totals and the project link exceeded the available width. | Wrap header/controls/totals; constrain secondary controls; use an em-based total basis and wrapping cell/metric text. Final 200% and RTL checks pass at 320/390/1440. |
| Low / UI | `src/App.tsx:264` | A captured first screen showed a 61-second countdown because the initial render time preceded the request timestamp. | Clamp the countdown to 0–60. Rebuilt export and subsequent screenshots show the bounded value. |
| Medium / Writing/data trust | `src/App.tsx:515` | A provider archive can carry a recent response timestamp, so a timestamp alone does not identify its provenance. | Show the provider feed when it is not live, with a notice. Controlled archive-response validation passes. |

No known unresolved implementation finding remains from these checks. External service availability and untested platforms are limits below.

## Commands and actual results

- `npm install --cache /tmp/imd-squeek-npm-cache --no-audit --no-fund`: succeeded; lockfile produced. The initial default cache was read-only; retry used a disposable cache. No cache is included in the submission.
- `npm run typecheck`: exit 0, TypeScript no-emit check passed.
- `npm run build`: exit 0, production Vite export produced at the repository root. It contains the local Inter font, icon, actual share PNG, CSS/JS and dependency notices.
- `IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright IMD_AXE=/tmp/imd-squeek-audit/node_modules/axe-core/axe.min.js npm run check:browser`: exit 0; **28 validation groups passed**. The script owns its bounded foreground preview/browser lifecycle. The accessibility module was installed only in disposable check storage, outside the submission.
- `IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`: exit 0; **16/16 checks passed**. Measured 320, 390 and 1440 px plus reduced motion; no local asset/script failure, horizontal scroll, detected text overlap or clipping. All 29 measured controls satisfy minimum target/spacing requirements; 13 are below the optional 44 px comfort size. First-screen prose: 7 words at 390 and 25 at 1440.

Browser interactions cover initial loading; exact confirmed numbers above Number.MAX_SAFE_INTEGER; distance/supply conversion; visible first-screen product/action; chart aggregation and selection; 7-day selection and rapid range cancellation; expanded full hashes and correct explorer links; copying the actual contributor address/hash; source disclosure; partial failures retaining marked readings; stale telemetry; archived provider feeds; unavailable economy; HTML/unsupported JSON responses; empty history; large values; keyboard/focus; 60-second polling; pause/resume; hidden-tab catch-up; 12-second request timeout and recovery; local metadata/font assets; clipboard denial; 200% text sizing; RTL reflow; initially offline recovery; unmocked 24-hour and 7-day API reads; and accessibility scans.

The script serves the actual export under `/ipfs/test-cid/`, rather than a dev server root. Test fixtures are confined to `checks/dashboard.mjs` and are never shipped into the runtime bundle.

## Rendered evidence

Generated during checks (disposable `test/scratch/` paths):

- `test/scratch/validation/live-390.png` and `live-390-full.png`: actual live phone export, product and main action inspected.
- `test/scratch/validation/live-1440.png` and `live-1440-full.png`: actual live desktop export and full page inspected.
- `test/scratch/validation/keyboard-focus-390.png`: the visible focus perimeter around the primary action, inspected.
- `test/scratch/validation/offline-390.png`: unavailable sources, recovery action and absent numeric stand-ins, inspected.
- `test/scratch/taste/taste.json` and `test/scratch/taste/shots/`: pinned probe output and rendered screenshots.
- `public/social-card.png`: actual locally rendered 1200 × 630 PNG, visually inspected; exported unchanged.

Screenshots/test runs do not constitute screen-reader, physical-device or independent-verifier evidence. Scratch evidence is intentionally outside the submitted bundle; the check script regenerates its own screenshots.

## Submission integrity and path budget

The final file enumeration includes 32 source/export/documentation files, totaling about **0.64 MiB**, below the **8 MiB (8,388,608-byte)** cap. The production export is **390,027 bytes** and `public/` is **68,473 bytes**. Source, configuration, docs and lockfile remain below the 1 MiB allowance in `.gitignore`; public assets are below its 1 MiB allowance and `dist/` below its 2 MiB allowance. Generated dependencies and scratch checks have a zero-byte submission budget.

The final check confirmed all required files are included by the ignore rules, every relative HTML/CSS runtime asset resolves, the exported PNG is a real 1200 × 630 image matching its source, and no dependency directory, cache, source map or archive is included. Validation notes live at repository-root `VALIDATION.md` so they travel with the source despite the existing artifact-directory exclusions. The export contains no nested repository or submodule.

## Limitations and completion

- WebKit launch failed because its browser runtime was absent. No Safari compatibility claim is made. Physical devices, screen readers, native 200% browser zoom, native forced-colors rendering and slow-motion animation-panel inspection were not performed. Chromium rendered and interaction checks were performed through local Playwright because the separate browser connector returned `Transport closed`.
- Public API uptime, response schema and CORS are external dependencies. The site handles timeouts, unsupported responses and partial failures, but needs a network connection for new readings.
- The current API reports a testnet. Distance is a latest-sample value. Settlement summaries can count more records than the API's recent list; the interface discloses that distinction.
- Clipboard permission can be denied; manual selection/copy remains available. Retained readings are in memory only, not an offline database.
- IPFS/ENS publication and the team's badge decision occur after delivery. Neither is implied by a successful build.

**Complete for the stated implementation scope**, with the platform/service limitations above. See `DESIGN.md` for the implemented tokens, component states and responsive behavior. Source, export, lockfile and documentation are prepared for the network's submission process; no repository metadata was modified.
