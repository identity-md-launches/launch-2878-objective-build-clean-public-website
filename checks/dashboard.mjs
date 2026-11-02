import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";

const moduleName = process.env.IMD_PLAYWRIGHT;
const { chromium, webkit } = await import(
  moduleName ? pathToFileURL(moduleName).href : "playwright"
);
const dist = resolve("dist");
const output = resolve("test/scratch/validation");
await mkdir(output, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://preview.invalid").pathname;
  if (!path.startsWith("/ipfs/test-cid/")) return res.writeHead(404).end();
  const file = resolve(
    dist,
    path.slice("/ipfs/test-cid/".length) || "index.html",
  );
  if (!file.startsWith(dist + sep)) return res.writeHead(403).end();
  try {
    res.setHeader(
      "content-type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/ipfs/test-cid/`;
const results = [];
async function check(name, run) {
  await run();
  results.push(name);
  console.log(`PASS ${name}`);
}
const base = Date.now();
const iso = (offset) => new Date(base + offset).toISOString();
const hash = "0x" + "a1".repeat(32);
const hash2 = "0x" + "b2".repeat(32);
const networkFixture = () => ({
  generatedAt: iso(0),
  measurement: {
    freshness: "online",
    observedAt: iso(0),
    staleAfterSeconds: 120,
    coreStatus: "IDLE",
    distanceMm: 1234567,
  },
  builder: {
    status: "available",
    anchor: {
      blockHeight: "12345",
      cumulativeWork: "9007199254740993",
      blockProgress: "123000000",
    },
  },
  oracle: { state: "accepted" },
  settlementQueue: { state: "submitted", incidentOpen: false },
});
const economyFixture = () => ({
  generatedAt: iso(0),
  status: "available",
  chain: { target: "sepolia", chainId: "11155111" },
  asset: { decimals: 18 },
  supply: {
    liveSupplyBaseUnits: "27092772850111401970492030",
    capBaseUnits: "2100000000000000000000000000",
  },
  lifecycle: { paused: false },
});
const settlementFixture = (range) => ({
  generatedAt: iso(0),
  status: "available",
  range,
  chain: { chainId: "11155111" },
  summary: {
    settlementCount: range === "24h" ? "24" : "168",
    workAdded: range === "24h" ? "300" : "900000",
    completedBlockCount: "21",
  },
  recentSettlements: [
    {
      transactionHash: hash,
      logIndex: "7",
      settledThroughRound: "966",
      blockTimestamp: iso(-3600000),
      workAdded: "298",
      completedBlockCount: "29",
      blockHeight: "6808",
      confirmationStatus: "safe",
    },
    {
      transactionHash: hash2,
      logIndex: "8",
      settledThroughRound: "965",
      blockTimestamp: iso(-7200000),
      workAdded: "261",
      completedBlockCount: "25",
      blockHeight: "6779",
      confirmationStatus: "pending",
    },
  ],
  buckets: Array.from({ length: 24 }, (_, i) => ({
    startAt: iso((i - 24) * 3600000),
    endAt: iso((i - 23) * 3600000),
    workAdded: String(i + 1),
    settlementCount: "1",
  })),
});
let mode = "ok";
let calls = [];
let lastNetwork = networkFixture();
function reset() {
  mode = "ok";
  calls = [];
  lastNetwork = networkFixture();
}
async function mocks(page) {
  await page.route("https://api.squeekchain.com/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    calls.push(requestUrl.pathname + requestUrl.search);
    if (mode === "offline") return route.abort("internetdisconnected");
    if (mode === "timeout") return;
    if (mode === "loading") await new Promise((done) => setTimeout(done, 350));
    const economy = requestUrl.pathname.includes("/economy/");
    const history = requestUrl.pathname === "/v1/settlements";
    if (mode === "partial" && economy)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    if (mode === "html")
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>Not an API</title>",
      });
    if (mode === "malformed")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"unexpected":true}',
      });
    const range = requestUrl.searchParams.get("range");
    if (mode === "race" && range === "7d")
      await new Promise((done) => setTimeout(done, 350));
    let data = history
      ? settlementFixture(range)
      : economy
        ? economyFixture()
        : structuredClone(lastNetwork);
    if (mode === "empty" && history)
      data = {
        ...data,
        recentSettlements: [],
        buckets: [],
        summary: {
          workAdded: "0",
          completedBlockCount: "0",
          settlementCount: "0",
        },
      };
    if (mode === "stale") {
      data.generatedAt = iso(-3600000);
      if (!history && !economy) data.measurement.observedAt = iso(-3600000);
    }
    if (mode === "paused-economy" && economy) data.lifecycle.paused = true;
    if (mode === "unavailable" && economy)
      data = { generatedAt: iso(0), status: "unavailable" };
    if (mode === "huge") {
      if (economy)
        data.supply.liveSupplyBaseUnits = "2100000000000000000000000000";
      if (!history && !economy) {
        data.builder.anchor.blockHeight = "18446744073709551615";
        data.builder.anchor.cumulativeWork = "18446744073709551615";
      }
      if (history) data.recentSettlements[0].workAdded = "18446744073709551615";
    }
    await route.fulfill({
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "X-Squeek-Settlement-Source": mode === "fallback" ? "archive" : "live",
        "access-control-expose-headers": "X-Squeek-Settlement-Source",
      },
      body: JSON.stringify(data),
    });
  });
}
async function settled(page) {
  await page
    .getByRole("button", { name: "Refresh data", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: "Refresh data", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    !document.querySelector(".primary-button")?.disabled &&
    document.querySelector(".settlements-section")?.getAttribute("aria-busy") === "false" &&
    !document.querySelector(".activity-totals")?.textContent.includes("Loading")
  );
}
async function refresh(page) {
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await settled(page);
}
async function noOverflow(page, widths = [320, 390, 768, 912, 1440]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      view: innerWidth,
    }));
    if (sizes.scroll > sizes.view + 1) {
      await page.screenshot({
        path: `${output}/overflow-${width}.png`,
        fullPage: true,
      });
      console.log(
        "REFLOW",
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width && (r.right > innerWidth + 1 || r.left < -1);
            })
            .slice(0, 16)
            .map((e) => ({
              tag: e.tagName,
              class: e.className,
              text: e.textContent.slice(0, 100),
              rect: {
                x: e.getBoundingClientRect().x,
                width: e.getBoundingClientRect().width,
              },
            })),
        ),
      );
    }
    assert.ok(
      sizes.scroll <= sizes.view + 1,
      `Overflow at ${width}: ${JSON.stringify(sizes)}`,
    );
  }
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const scriptErrors = [];
  const localFailures = [];
  page.on("pageerror", (error) => scriptErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(url) && response.status() >= 400)
      localFailures.push(response.url());
  });
  await mocks(page);
  mode = "loading";
  await check(
    "Loading state disables only the active refresh; data does not start at zero",
    async () => {
      await page.goto(url);
      await page
        .getByRole("button", { name: "Refreshing", exact: true })
        .waitFor();
      assert.ok(
        await page
          .getByRole("button", { name: "Refreshing", exact: true })
          .isDisabled(),
      );
      assert.ok(
        (await page.locator(".metric-value").allTextContents()).every(
          (value) => value === "Loading",
        ),
      );
      await settled(page);
    },
  );
  mode = "ok";
  await check(
    "Confirmed metrics preserve integer precision and convert distance and SQK units",
    async () => {
      assert.match(await page.locator(".metrics-grid").innerText(), /12,345/);
      assert.match(
        await page.locator(".metrics-grid").innerText(),
        /9,007,199,254,740,993/,
      );
      assert.match(await page.locator(".metrics-grid").innerText(), /1\.234/);
      assert.match(
        await page.locator(".metrics-grid").innerText(),
        /27,092,772\.85/,
      );
      assert.match(
        await page.locator(".network-label").innerText(),
        /Sepolia testnet/,
      );
      assert.match(
        await page.locator(".connection-summary").innerText(),
        /Telemetry online/,
      );
    },
  );
  await check(
    "Product and manual refresh appear in the first 390px-wide screen",
    async () => {
      const controls = await page
        .locator(".primary-button, .metrics-grid, .brand-network")
        .evaluateAll((items) =>
          items.map((e) => ({
            y: e.getBoundingClientRect().top,
            bottom: e.getBoundingClientRect().bottom,
            text: e.textContent,
          })),
        );
      assert.ok(
        controls.every((control) => control.y >= 0 && control.bottom <= 844),
        JSON.stringify(controls),
      );
    },
  );
  await check(
    "Chart includes all buckets in eight selectable intervals with usable targets",
    async () => {
      assert.equal(await page.locator(".chart-bar").count(), 8);
      const bar = page.locator(".chart-bar").first();
      assert.match(
        await bar.getAttribute("aria-label"),
        /6 work units, 3 settlements/,
      );
      assert.ok((await bar.boundingBox()).width >= 24);
      await bar.click();
      assert.match(
        await page.locator(".chart-selection").innerText(),
        /6 work units/,
      );
    },
  );
  await check("7-day range requests and displays its own totals", async () => {
    await page.getByRole("button", { name: "7 days", exact: true }).click();
    await settled(page);
    assert.ok(calls.includes("/v1/settlements?range=7d"));
    assert.match(await page.locator(".activity-totals").innerText(), /900,000/);
    assert.equal(
      await page
        .getByRole("button", { name: "7 days", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
  });
  await check(
    "Rapid range changes cancel stale requests without showing the wrong range",
    async () => {
      await page.getByRole("button", { name: "24 hours", exact: true }).click();
      await settled(page);
      mode = "race";
      await page.getByRole("button", { name: "7 days", exact: true }).click();
      await page.getByRole("button", { name: "24 hours", exact: true }).click();
      await settled(page);
      await page.waitForTimeout(450);
      assert.match(await page.locator(".activity-totals").innerText(), /300/);
      assert.doesNotMatch(
        await page.locator(".activity-totals").innerText(),
        /900,000/,
      );
      mode = "ok";
    },
  );
  await check(
    "Settlement disclosure reveals the complete hash, correct explorer and copy action",
    async () => {
      const detail = page.getByRole("button", {
        name: "Show transaction for round 966",
      });
      await detail.click();
      assert.equal(
        await page.locator(".transaction-row:not([hidden]) code").innerText(),
        hash,
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Open in Etherscan" })
          .getAttribute("href"),
        `https://sepolia.etherscan.io/tx/${hash}`,
      );
      await page
        .getByRole("button", { name: "Copy hash", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        hash,
      );
      await page
        .getByRole("button", { name: "Hide transaction for round 966" })
        .click();
      assert.equal(
        await page.locator(".transaction-row:not([hidden])").count(),
        0,
      );
    },
  );
  await check(
    "Contributor address is exact and can be copied without connecting a wallet",
    async () => {
      await page
        .getByRole("button", { name: "Copy address", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        "0x9a2ecf2e6af1ce1072f100e3328094016989f5b5",
      );
      assert.equal(
        await page.getByRole("button", { name: /connect wallet/i }).count(),
        0,
      );
    },
  );
  await check(
    "Source definitions disclose the metric basis and API endpoints",
    async () => {
      await page.locator(".sources-details summary").click();
      assert.match(
        await page.locator(".sources-content").innerText(),
        /not lifetime distance/,
      );
      assert.match(
        await page.locator(".sources-content").innerText(),
        /api.squeekchain.com\/v1\/status/,
      );
      await noOverflow(page);
      await page.locator(".sources-details summary").click();
    },
  );
  await check(
    "A partial API failure retains and marks the last successful supply, then recovers",
    async () => {
      mode = "partial";
      await refresh(page);
      assert.match(
        await page.locator(".data-notice").innerText(),
        /1 public source is unavailable/,
      );
      assert.match(
        await page.locator(".metric").last().innerText(),
        /27,092,772\.85/,
      );
      assert.match(
        await page.locator(".metric").last().innerText(),
        /Saved reading/,
      );
      mode = "ok";
      lastNetwork.builder.anchor.blockHeight = "12346";
      await refresh(page);
      assert.equal(await page.locator(".data-notice").count(), 0);
      assert.match(await page.locator(".metric").first().innerText(), /12,346/);
    },
  );
  await check(
    "Stale telemetry is identified and does not establish current oracle or queue health",
    async () => {
      mode = "stale";
      await refresh(page);
      assert.match(
        await page.locator(".connection-summary").innerText(),
        /Telemetry stale/,
      );
      assert.match(
        await page.locator(".health-list").innerText(),
        /Unverified/,
      );
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "Archived provider feeds are labeled instead of appearing to be a live settlement feed",
    async () => {
      mode = "fallback";
      await refresh(page);
      assert.match(await page.locator(".data-notice").innerText(), /older/);
      assert.match(
        await page.locator(".panel-footnote").innerText(),
        /Provider feed: archive/,
      );
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "A declared-unavailable economy response clears its supply instead of inventing a zero",
    async () => {
      mode = "unavailable";
      await refresh(page);
      assert.match(
        await page.locator(".metric").last().innerText(),
        /Unavailable/,
      );
      assert.doesNotMatch(
        await page.locator(".metric").last().innerText(),
        /27,092,772/,
      );
      assert.match(
        await page.locator(".network-label").innerText(),
        /unverified/,
      );
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "HTML and unsupported JSON responses display a recoverable source error",
    async () => {
      for (const errorMode of ["html", "malformed"]) {
        mode = errorMode;
        await refresh(page);
        assert.match(
          await page.locator(".data-notice").innerText(),
          /3 public sources are unavailable/,
        );
        await page.locator(".sources-details summary").click();
        assert.match(
          await page.locator(".source-list").innerText(),
          errorMode === "html" ? /instead of JSON/ : /API/,
        );
        await page.locator(".sources-details summary").click();
      }
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "Empty settlements are reported as empty with a recovery path",
    async () => {
      mode = "empty";
      await refresh(page);
      assert.match(
        await page.locator(".table-empty").innerText(),
        /No settlements in this window/,
      );
      assert.match(
        await page.locator(".table-empty").innerText(),
        /different time range/,
      );
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "Long real-world-sized values and expanded transactions reflow without page overflow",
    async () => {
      mode = "huge";
      await refresh(page);
      await page
        .getByRole("button", { name: "Show transaction for round 966" })
        .click();
      await noOverflow(page);
      await page
        .getByRole("button", { name: "Hide transaction for round 966" })
        .click();
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "Keyboard path reaches refresh and details with a visible focus outline",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await settled(page);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator(":focus").innerText(),
        "Skip to dashboard",
      );
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").innerText(), "Pause");
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(":focus").innerText(), "Refresh data");
      const focus = await page
        .locator(":focus")
        .evaluate((e) => ({
          width: getComputedStyle(e).outlineWidth,
          style: getComputedStyle(e).outlineStyle,
        }));
      assert.equal(focus.width, "2px");
      assert.equal(focus.style, "solid");
      await page.screenshot({ path: `${output}/keyboard-focus-390.png` });
      await page.keyboard.press("Enter");
      await settled(page);
    },
  );
  await check(
    "Timers refresh after 60 seconds; pause stops polling and keeps manual refresh usable",
    async () => {
      await page.clock.install({ time: base });
      await page.goto(url);
      await settled(page);
      const before = calls.length;
      await page.clock.fastForward(60001);
      await settled(page);
      assert.equal(calls.length, before + 3);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const paused = calls.length;
      await page.clock.fastForward(61000);
      assert.equal(calls.length, paused);
      assert.match(
        await page.locator(".update-countdown").innerText(),
        /paused/,
      );
      await refresh(page);
      assert.equal(calls.length, paused + 3);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      const resumed = calls.length;
      await page.clock.fastForward(60001);
      await settled(page);
      assert.equal(calls.length, resumed + 3);
    },
  );
  await check(
    "Hidden tabs skip polling and catch up when visible again",
    async () => {
      await page.evaluate(() => {
        window.__hiddenForTest = true;
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => window.__hiddenForTest,
        });
      });
      const before = calls.length;
      await page.clock.fastForward(60001);
      assert.equal(calls.length, before);
      await page.evaluate(() => {
        window.__hiddenForTest = false;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await settled(page);
      assert.equal(calls.length, before + 3);
    },
  );
  await check(
    "A stalled API request times out after 12 seconds and refresh recovers",
    async () => {
      mode = "timeout";
      await page
        .getByRole("button", { name: "Refresh data", exact: true })
        .click();
      await page.clock.fastForward(12001);
      await settled(page);
      assert.match(
        await page.locator(".data-notice").innerText(),
        /3 public sources are unavailable/,
      );
      await page.locator(".sources-details summary").click();
      assert.match(
        await page.locator(".source-list").innerText(),
        /within 12 seconds/,
      );
      await page.locator(".sources-details summary").click();
      mode = "ok";
      await refresh(page);
    },
  );
  await check(
    "Local share card, favicon and font are present under an IPFS-like subpath",
    async () => {
      const statuses = await page.evaluate(async () => {
        const paths = [
          document.querySelector('meta[property="og:image"]').content,
          document.querySelector('link[rel="icon"]').getAttribute("href"),
        ];
        return Promise.all(
          paths.map(
            async (path) => (await fetch(new URL(path, location.href))).status,
          ),
        );
      });
      assert.deepEqual(statuses, [200, 200]);
      assert.ok(
        await page.evaluate(() => document.fonts.check("600 18px Inter")),
      );
    },
  );
  await check("Clipboard denial offers a manual copy path", async () => {
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("Permission denied for validation");
      };
    });
    await page
      .getByRole("button", { name: "Copy address", exact: true })
      .click();
    assert.match(
      await page.locator(".contributor .copy-feedback").innerText(),
      /Select and copy/,
    );
  });
  await check(
    "200% text sizing and an RTL mirror preserve reflow",
    async () => {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await noOverflow(page, [320, 390, 1440]);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
        document.documentElement.dir = "rtl";
      });
      await noOverflow(page, [320, 390, 1440]);
      await page.evaluate(() => {
        document.documentElement.dir = "ltr";
      });
    },
  );
  await check(
    "Production app has no uncaught JavaScript errors or missing local resources",
    async () => {
      assert.deepEqual(scriptErrors, []);
      assert.deepEqual(localFailures, []);
    },
  );
  await context.close();

  const offlineContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const offlinePage = await offlineContext.newPage();
  await mocks(offlinePage);
  mode = "offline";
  await check(
    "Initial offline state shows unavailable metrics rather than invented zeros",
    async () => {
      await offlinePage.goto(url);
      await settled(offlinePage);
      const metricValues = await offlinePage
        .locator(".metric-value")
        .allTextContents();
      assert.deepEqual(metricValues, [
        "Unavailable",
        "Unavailable",
        "Unavailable",
        "Unavailable",
      ]);
      assert.match(
        await offlinePage.locator(".connection-summary").innerText(),
        /Status unavailable/,
      );
      await offlinePage.screenshot({ path: `${output}/offline-390.png` });
      mode = "ok";
      await refresh(offlinePage);
      assert.match(
        await offlinePage.locator(".metric").first().innerText(),
        /12,346/,
      );
    },
  );
  await offlineContext.close();

  const liveContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const livePage = await liveContext.newPage();
  await check(
    "Unmocked public APIs populate the production export and settlements",
    async () => {
      await livePage.goto(url);
      await settled(livePage);
      assert.doesNotMatch(
        await livePage.locator(".metrics-grid").innerText(),
        /Unavailable|Loading/,
      );
      assert.ok((await livePage.locator(".settlements-table").count()) > 0);
      for (const width of [390, 1440]) {
        await livePage.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        await livePage.screenshot({ path: `${output}/live-${width}.png` });
        await livePage.screenshot({
          path: `${output}/live-${width}-full.png`,
          fullPage: true,
        });
      }
      await noOverflow(livePage);
    },
  );
  await check(
    "Unmocked 7-day history loads and returns to the 24-hour view",
    async () => {
      await livePage
        .getByRole("button", { name: "7 days", exact: true })
        .click();
      await settled(livePage);
      assert.doesNotMatch(
        await livePage.locator(".activity-totals").innerText(),
        /Unavailable|Loading/,
      );
      assert.ok((await livePage.locator(".chart-bar").count()) > 0);
      assert.ok((await livePage.locator(".chart-bar").count()) <= 8);
      await livePage
        .getByRole("button", { name: "24 hours", exact: true })
        .click();
      await settled(livePage);
    },
  );
  if (process.env.IMD_AXE) {
    await check("Axe WCAG 2.2 AA scan on the loaded export", async () => {
      await livePage.addScriptTag({ path: process.env.IMD_AXE });
      for (const width of [390, 1440]) {
        await livePage.setViewportSize({ width, height: 900 });
        if (width === 390) {
          await livePage.locator(".sources-details summary").click();
          await livePage.locator(".detail-button").first().click();
        }
        const audit = await livePage.evaluate(async () =>
          window.axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          }),
        );
        console.log(
          `AXE ${width}px: ${audit.passes.length} rules passed; ${audit.violations.length} violations; ${audit.incomplete.length} rules require manual review`,
        );
        assert.deepEqual(
          audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
        );
      }
    });
  }
  await liveContext.close();
  let safari;
  try {
    safari = await webkit.launch({ headless: true });
  } catch (error) {
    console.log(
      `LIMITATION WebKit did not launch: ${error.message.split("\n")[0]}`,
    );
  }
  if (safari) {
    try {
      const p = await safari.newPage({ viewport: { width: 390, height: 844 } });
      reset();
      await mocks(p);
      await check(
        "WebKit mobile refresh, range and transaction disclosure",
        async () => {
          await p.goto(url);
          await settled(p);
          await refresh(p);
          await p.getByRole("button", { name: "7 days", exact: true }).click();
          await settled(p);
          assert.match(
            await p.locator(".activity-totals").innerText(),
            /900,000/,
          );
          await p
            .getByRole("button", { name: "Show transaction for round 966" })
            .click();
          assert.equal(
            await p.locator(".transaction-row:not([hidden]) code").innerText(),
            hash,
          );
          await noOverflow(p, [320, 390, 1440]);
        },
      );
    } finally {
      await safari.close();
    }
  }
  console.log(`COMPLETE ${results.length} validation groups passed.`);
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
