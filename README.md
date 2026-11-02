# Wheelwatch

A community dashboard for Squeekchain, built as a Genesis project for **The Buildooooor** badge. Contributor wallet: `0x9a2ecf2e6af1ce1072f100e3328094016989f5b5`. The badge requires Squeekchain team approval.

Live block height, confirmed cumulative work, wheel distance in km, telemetry status, SQK supply, and recent settlements come directly from [Squeekchain's public API](https://api.squeekchain.com/v1/status). Refresh runs about every 60 seconds while the tab is visible, with pause/resume and manual refresh. The dashboard includes 24-hour/7-day activity, transaction details, source timestamps and recoverable error states.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

## Build and preview

```sh
npm run typecheck
npm run build
npm run preview
```

The complete static website is in **`dist/`**. Source, `package-lock.json`, configuration and the export are included. Vite uses `base: './'`; assets are local and paths are relative. The single page works at an IPFS gateway subpath without server rewrites. The requested import label is **`mingzhe-squeek`**. The network handles IPFS/ENS publication after review.

## Data and limitations

The official frontend uses `https://api.squeekchain.com`, rather than the main domain's `/v1/` paths, which returned HTML when checked. The dashboard reads `/v1/status`, `/v1/economy/state` and `/v1/settlements?range=24h` or `7d`. These APIs permitted cross-origin browser reads and reported **Sepolia testnet** during validation; the displayed environment comes from the response.

Distance is the **latest wheel measurement**, not lifetime distance. Block height and cumulative work use the confirmed builder anchor. SQK base units are formatted with integer arithmetic and truncated to two decimals. Each source has a timestamp; unavailable data is never replaced with sample numbers. Failed refreshes retain clearly marked prior readings in memory. API availability and CORS remain external dependencies; clipboard copying needs browser permission and offers a manual fallback.

## Validation

Production build and TypeScript check passed. The export passed **28 browser validation groups**, including both live API time ranges, timer behavior, failures/recovery, full transaction hashes, copying, long values, 200% text sizing and responsive reflow. The pinned design probe passed **16/16** checks. Axe found **0 violations** in its checked WCAG rules at 390 and 1440 px. WebKit could not launch; Safari, physical devices, screen readers and native browser zoom were not tested.

`npm run check:browser` runs the included production-export checks using an existing Playwright installation. Set `IMD_PLAYWRIGHT` to its `index.mjs` if necessary, and `IMD_AXE` to an existing `axe.min.js` to include the optional accessibility scan. The script manages its own temporary preview, closes it on completion, and writes disposable evidence only to `test/scratch/`.

See [DESIGN.md](DESIGN.md) for the implemented design system and [VALIDATION.md](VALIDATION.md) for review coverage, commands, findings and limitations. Design guidance and dependency credits are in [NOTICE.md](NOTICE.md).
