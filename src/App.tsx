import { Fragment, useEffect, useRef, useState } from "react";
import {
  API_BASE,
  WALLET,
  explorer,
  integer,
  percentage,
  units,
  utc,
} from "./api";
import type { Bucket, Range } from "./api";
import { Icon, Wheel } from "./Icons";
import { useDashboard } from "./useDashboard";
import type { Resource } from "./useDashboard";

function CopyButton({
  value,
  label = "Copy address",
}: {
  value: string;
  label?: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("Copied");
    } catch {
      setFeedback("Select and copy the text above.");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 5000);
  }
  return (
    <div className="copy-control">
      <button className="text-button" onClick={() => void copy()}>
        <Icon name={feedback === "Copied" ? "check" : "copy"} />
        {label}
      </button>
      <span className="copy-feedback" role="status">
        {feedback}
      </span>
    </div>
  );
}

function SourceStamp<T extends { generatedAt: string }>({
  resource,
  now,
  label,
}: {
  resource: Resource<T>;
  now: number;
  label: string;
}) {
  if (!resource.data)
    return (
      <span className="source-stamp">
        {label}: {resource.loading ? "connecting to API" : "unavailable"}
      </span>
    );
  const stale = now - Date.parse(resource.data.generatedAt) > 180000;
  return (
    <span
      className={`source-stamp ${resource.error || stale ? "warning-text" : ""}`}
    >
      {resource.error ? "Saved reading · " : stale ? "Older reading · " : ""}
      <time dateTime={resource.data.generatedAt}>
        {label} · {utc(resource.data.generatedAt)} UTC
      </time>
    </span>
  );
}

function Metric({
  title,
  icon,
  value,
  unit,
  description,
  state,
}: {
  title: string;
  icon: "block" | "work" | "distance" | "supply";
  value: string | null;
  unit?: string;
  description: string;
  state: "loading" | "error" | "saved" | "ready";
}) {
  return (
    <div className="metric">
      <div className="metric-heading">
        <span>{title}</span>
        <Icon name={icon} />
      </div>
      <div
        className={`metric-value ${value === null ? "metric-placeholder" : ""}`}
      >
        {value === null
          ? state === "loading"
            ? "Loading"
            : "Unavailable"
          : value}
        {value !== null && unit && <span className="metric-unit">{unit}</span>}
      </div>
      <div className="metric-description">
        {description}
        {state === "saved" && (
          <span className="warning-text"> · Saved reading</span>
        )}
      </div>
    </div>
  );
}

function ActivityChart({
  buckets: sourceBuckets,
  range,
}: {
  buckets: Bucket[];
  range: Range;
}) {
  // Keep every returned bucket, combined into at most eight consecutive intervals.
  // This gives each bar a real touch target even at 320 CSS pixels.
  const buckets: Bucket[] = [];
  const groupSize = Math.max(1, Math.ceil(sourceBuckets.length / 8));
  for (let i = 0; i < sourceBuckets.length; i += groupSize) {
    const group = sourceBuckets.slice(i, i + groupSize);
    buckets.push({
      startAt: group[0].startAt,
      endAt: group.at(-1)!.endAt,
      work: group
        .reduce((sum, bucket) => sum + BigInt(bucket.work), 0n)
        .toString(),
      count: group
        .reduce((sum, bucket) => sum + BigInt(bucket.count), 0n)
        .toString(),
    });
  }
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    setSelected(null);
  }, [range]);
  const max = buckets.reduce(
    (acc, b) => (BigInt(b.work) > acc ? BigInt(b.work) : acc),
    0n,
  );
  const current = selected !== null ? buckets[selected] : null;
  return (
    <>
      <div className="chart-summary">
        <span className="chart-key">
          <i />
          Work added
        </span>
        <span className="muted">
          {max > 0n
            ? `${integer(max.toString())} peak`
            : "No work in this window"}
        </span>
      </div>
      <div
        className="chart"
        role="group"
        aria-label="Work added by time bucket. Select a bar for its exact value."
      >
        {buckets.map((bucket, index) => {
          const work = BigInt(bucket.work);
          const height = max > 0n ? Number((work * 10000n) / max) / 100 : 0;
          return (
            <button
              key={bucket.startAt}
              className={`chart-bar ${selected === index ? "selected" : ""}`}
              onClick={() => setSelected(index)}
              aria-label={`${utc(bucket.startAt)} to ${utc(bucket.endAt)} UTC: ${integer(bucket.work)} work units, ${integer(bucket.count)} settlements`}
              aria-pressed={selected === index}
              style={{ "--bar-height": `${height}%` } as React.CSSProperties}
            >
              <span className={work === 0n ? "zero-bar" : ""} />
            </button>
          );
        })}
      </div>
      <div className="chart-axis">
        <span>{buckets[0] ? `${utc(buckets[0].startAt)} UTC` : "Start"}</span>
        <span>
          {buckets.at(-1) ? `${utc(buckets.at(-1)!.endAt)} UTC` : "End"}
        </span>
      </div>
      <div className="chart-selection" role="status">
        {current ? (
          <>
            <span>{utc(current.startAt)} UTC</span>
            <strong>{integer(current.work)} work units</strong>
            <span>{integer(current.count)} settlements</span>
          </>
        ) : (
          <span>Select a bar to inspect its time interval.</span>
        )}
      </div>
    </>
  );
}

export function App() {
  const [range, setRange] = useState<Range>("24h");
  const [expanded, setExpanded] = useState<string | null>(null);
  const d = useDashboard(range);
  const n = d.network.data;
  const e = d.economy.data;
  const s = d.settlements.data?.range === range ? d.settlements.data : null;
  const telemetryAge = n?.observedAt
    ? (d.now - Date.parse(n.observedAt)) / 1000
    : Infinity;
  const networkOld = n
    ? d.now - Date.parse(n.generatedAt) > n.staleAfterSeconds * 1000
    : true;
  const economyOld = e ? d.now - Date.parse(e.generatedAt) > 180000 : true;
  const statusOld = Boolean(
    d.network.error ||
      networkOld ||
      telemetryAge > (n?.staleAfterSeconds ?? 120),
  );
  const online = n?.freshness === "online" && !statusOld;
  const networkStatus = !n
    ? d.network.loading
      ? "Connecting"
      : "Status unavailable"
    : statusOld
      ? "Telemetry stale"
      : n.freshness === "online"
        ? "Telemetry online"
        : n.freshness === "offline"
          ? "Telemetry offline"
          : "Telemetry unavailable";
  const capPercent = percentage(e?.liveSupply, e?.cap);
  const errors = [d.network, d.economy, d.settlements].filter(
    (resource) => resource.error,
  ).length;
  const staleSources = [
    n && statusOld,
    e && (economyOld || d.economy.error),
    s &&
      (d.now - Date.parse(s.generatedAt) > 180000 ||
        (s.source !== null && s.source !== "live")),
  ].filter(Boolean).length;
  const state = <T,>(
    resource: Resource<T>,
  ): "loading" | "error" | "saved" | "ready" =>
    resource.data
      ? resource.error
        ? "saved"
        : "ready"
      : resource.loading
        ? "loading"
        : "error";
  const next = Math.min(
    60,
    Math.max(0, 60 - Math.floor((d.now - d.lastAttempt) / 1000)),
  );
  const chainName =
    e?.target === "sepolia"
      ? "Sepolia testnet"
      : e?.target === "mainnet"
        ? "Ethereum mainnet"
        : e?.target
          ? `${e.target} network`
          : "Network unverified";
  useEffect(() => {
    setExpanded(null);
  }, [range]);

  return (
    <>
      <a className="skip-link" href="#overview">
        Skip to dashboard
      </a>
      <header className="site-header">
        <a className="brand" href="#overview" aria-label="Wheelwatch dashboard">
          <img src="./favicon.svg" alt="" width="36" height="36" />
          <span>
            Wheelwatch<span className="brand-divider">/</span>
            <span className="brand-network">Squeekchain</span>
          </span>
        </a>
        <a
          className="header-link"
          href="https://squeekchain.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Official site
          <Icon name="external" size={15} />
        </a>
      </header>

      <main id="overview" className="page-shell" tabIndex={-1}>
        <section className="overview-heading" aria-labelledby="overview-title">
          <div>
            <h1 id="overview-title">
              Network overview<span className="title-dot">.</span>
            </h1>
            <p>A community window into the hamster-powered chain.</p>
          </div>
          <div
            className={`network-label ${e?.target === "sepolia" ? "" : "neutral-label"}`}
          >
            <span className="network-diamond" aria-hidden="true" />
            {chainName}
          </div>
        </section>

        <div className="refresh-toolbar">
          <div className="connection-summary">
            <span
              className={`status-dot ${online ? "is-online" : d.network.loading && !n ? "is-loading" : "is-warning"}`}
            />
            <span>{networkStatus}</span>
            <span className="toolbar-separator" />
            <span className="update-countdown">
              {d.refreshing
                ? "Fetching data"
                : d.automatic
                  ? `Next update in ${next}s`
                  : "Auto-refresh paused"}
            </span>
          </div>
          <div className="refresh-controls">
            <button
              className="auto-button"
              aria-pressed={d.automatic}
              onClick={() => d.setAutomatic(!d.automatic)}
              title={
                d.automatic
                  ? "Pause automatic updates"
                  : "Resume automatic updates"
              }
            >
              <Icon name={d.automatic ? "pause" : "play"} size={16} />
              <span>{d.automatic ? "Pause" : "Resume"}</span>
            </button>
            <button
              className="primary-button"
              onClick={() => void d.refresh()}
              disabled={d.refreshing}
            >
              <Icon name="refresh" className={d.refreshing ? "spinning" : ""} />
              <span>{d.refreshing ? "Refreshing" : "Refresh data"}</span>
            </button>
          </div>
        </div>
        <p className="sr-only" role="status">
          {d.announcement}
        </p>
        {(errors > 0 || staleSources > 0) && (
          <div className="data-notice" role="note">
            <Icon name="info" />
            <div>
              <strong>
                {errors > 0
                  ? `${errors} public ${errors === 1 ? "source is" : "sources are"} unavailable.`
                  : "Some readings are older."}
              </strong>{" "}
              {errors > 0
                ? n || e || s
                  ? "Available readings remain visible. Refresh data to retry."
                  : "Check your connection, then refresh data to retry."
                : "Check source timestamps before using these readings."}{" "}
              <a href="#data-sources">View source details</a>
            </div>
          </div>
        )}

        <section className="metrics-grid" aria-label="Live network metrics">
          <Metric
            title="Block height"
            icon="block"
            value={n?.blockHeight != null ? integer(n.blockHeight) : null}
            description="Confirmed Squeekchain blocks"
            state={state(d.network)}
          />
          <Metric
            title="Cumulative work"
            icon="work"
            value={n?.cumulativeWork != null ? integer(n.cumulativeWork) : null}
            unit="units"
            description="Total confirmed physical work"
            state={state(d.network)}
          />
          <Metric
            title="Distance"
            icon="distance"
            value={n?.distanceMm != null ? units(n.distanceMm, 6, 3) : null}
            unit="km"
            description="Latest wheel measurement"
            state={state(d.network)}
          />
          <Metric
            title="Live SQK supply"
            icon="supply"
            value={
              e?.liveSupply != null ? units(e.liveSupply, e.decimals) : null
            }
            description={
              capPercent !== null
                ? `${capPercent.toFixed(2)}% of the supply cap`
                : "Live minted supply, less burns"
            }
            state={state(d.economy)}
          />
        </section>
        <div className="metric-sources">
          <SourceStamp resource={d.network} now={d.now} label="Network" />
          <SourceStamp resource={d.economy} now={d.now} label="Supply" />
        </div>

        <div className="activity-layout">
          <section className="activity-panel" aria-labelledby="activity-title">
            <div className="panel-heading">
              <div>
                <h2 id="activity-title">Settlement activity</h2>
                <p>Physical work, recorded onchain.</p>
              </div>
              <div
                className="range-control"
                role="group"
                aria-label="Settlement time range"
              >
                <button
                  aria-pressed={range === "24h"}
                  onClick={() => setRange("24h")}
                >
                  24 hours
                </button>
                <button
                  aria-pressed={range === "7d"}
                  onClick={() => setRange("7d")}
                >
                  7 days
                </button>
              </div>
            </div>
            <div className="activity-totals">
              <div>
                <strong>
                  {s?.work != null
                    ? integer(s.work)
                    : d.settlements.loading
                      ? "Loading"
                      : "Unavailable"}
                </strong>
                <span>work units</span>
              </div>
              <div>
                <strong>
                  {s?.count != null
                    ? integer(s.count)
                    : d.settlements.loading
                      ? "…"
                      : "n/a"}
                </strong>
                <span>settlements</span>
              </div>
              <div>
                <strong>
                  {s?.blocks != null
                    ? integer(s.blocks)
                    : d.settlements.loading
                      ? "…"
                      : "n/a"}
                </strong>
                <span>blocks completed</span>
              </div>
            </div>
            {s?.buckets.length ? (
              <ActivityChart buckets={s.buckets} range={range} />
            ) : (
              <div className="chart-empty">
                <Icon name="work" size={28} />
                <strong>
                  {d.settlements.loading
                    ? "Loading activity"
                    : s?.available
                      ? "No activity in this window"
                      : "Activity unavailable"}
                </strong>
                <p>
                  {d.settlements.loading
                    ? "Reading the public settlements API."
                    : s?.available
                      ? "Try another time range or refresh for new settlements."
                      : "Check your connection and refresh data to retry."}
                </p>
              </div>
            )}
            <div className="panel-footnote">
              <SourceStamp
                resource={{ ...d.settlements, data: s }}
                now={d.now}
                label="Activity"
              />
              <span
                className={
                  s?.source && s.source !== "live" ? "warning-text" : "muted"
                }
              >
                {s?.source && s.source !== "live"
                  ? `Provider feed: ${s.source}`
                  : "UTC"}
              </span>
            </div>
          </section>

          <section className="health-panel" aria-labelledby="health-title">
            <div className="health-heading">
              <h2 id="health-title">Behind the blocks</h2>
              <span className="muted">Network health</span>
            </div>
            <div className={`wheel-scene ${online ? "" : "wheel-muted"}`}>
              <Wheel />
              <div className="wheel-caption">
                <span
                  className={`status-dot ${online ? "is-online" : "is-warning"}`}
                />
                <span>
                  {n?.coreStatus === "IDLE"
                    ? "Wheel at rest"
                    : n?.coreStatus
                      ? n.coreStatus.toLowerCase().replaceAll("_", " ")
                      : "Awaiting wheel data"}
                </span>
              </div>
            </div>
            <dl className="health-list">
              <div>
                <dt>Telemetry</dt>
                <dd className={online ? "success-text" : "warning-text"}>
                  {!n
                    ? "Unknown"
                    : online
                      ? "Online"
                      : statusOld
                        ? "Stale"
                        : n.freshness === "offline"
                          ? "Offline"
                          : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt>Oracle</dt>
                <dd>
                  {statusOld
                    ? "Unverified"
                    : n?.oracleState
                      ? n.oracleState.charAt(0).toUpperCase() +
                        n.oracleState.slice(1)
                      : "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Settlement queue</dt>
                <dd>
                  {!n
                    ? "Unknown"
                    : statusOld
                      ? "Unverified"
                      : n.incidentOpen
                        ? "Incident reported"
                        : n.queueState
                          ? n.queueState.charAt(0).toUpperCase() +
                            n.queueState.slice(1)
                          : "Unknown"}
                </dd>
              </div>
            </dl>
            <p className="health-note">
              A resting wheel can still have an online telemetry feed.
            </p>
          </section>
        </div>

        <section
          className="settlements-section"
          aria-labelledby="settlements-title"
          aria-busy={d.settlements.loading}
        >
          <div className="section-heading">
            <div>
              <h2 id="settlements-title">Recent settlements</h2>
              <p>
                {s
                  ? `Latest ${s.recent.length} entries returned by the API`
                  : "Confirmed work from the public ledger"}
                <span className="inline-divider">·</span>
                {range === "24h" ? "24-hour window" : "7-day window"}
              </p>
            </div>
            <a
              className="text-link"
              href={`${API_BASE}/v1/settlements?range=${range}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View public data
              <Icon name="external" size={15} />
            </a>
          </div>
          {s?.recent.length ? (
            <table className="settlements-table">
              <caption className="sr-only">
                Recent Squeekchain settlements for the selected{" "}
                {range === "24h" ? "24 hours" : "7 days"}. Times are in UTC.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  <th scope="col">Settled at (UTC)</th>
                  <th scope="col" className="numeric">
                    Work added
                  </th>
                  <th scope="col" className="numeric">
                    Blocks
                  </th>
                  <th scope="col">Confirmation</th>
                  <th scope="col">
                    <span className="sr-only">Transaction details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.recent.map((row) => {
                  const key = `${row.hash}-${row.logIndex}`;
                  const open = expanded === key;
                  const link = explorer(s.chainId, row.hash);
                  return (
                    <Fragment key={key}>
                      <tr className={open ? "expanded-row" : ""}>
                        <td className="round-cell" data-label="Round">
                          #{integer(row.round)}
                        </td>
                        <td data-label="Settled at (UTC)">
                          <time dateTime={row.timestamp}>
                            {utc(row.timestamp)}
                          </time>
                        </td>
                        <td data-label="Work added" className="numeric">
                          +{integer(row.work)}
                        </td>
                        <td data-label="Blocks" className="numeric">
                          {integer(row.blocks)}
                        </td>
                        <td data-label="Confirmation">
                          <span
                            className={`confirmation ${row.confirmation === "safe" ? "is-safe" : ""}`}
                          >
                            {row.confirmation === "safe" && (
                              <Icon name="check" size={13} />
                            )}
                            {row.confirmation.charAt(0).toUpperCase() +
                              row.confirmation.slice(1)}
                          </span>
                        </td>
                        <td className="row-control">
                          <button
                            className="detail-button"
                            onClick={() => setExpanded(open ? null : key)}
                            aria-expanded={open}
                            aria-controls={`detail-${key}`}
                            aria-label={`${open ? "Hide" : "Show"} transaction for round ${row.round}`}
                          >
                            <span>Details</span>
                            <Icon name="chevron" size={16} />
                          </button>
                        </td>
                      </tr>
                      <tr
                        id={`detail-${key}`}
                        hidden={!open}
                        className="transaction-row"
                      >
                        <td colSpan={6}>
                          <div className="transaction-content">
                            <span className="muted">Transaction hash</span>
                            <code>{row.hash}</code>
                            <div className="transaction-actions">
                              <span>
                                Resulting block height: {integer(row.height)}
                              </span>
                              {link && (
                                <a
                                  className="text-link"
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Open in Etherscan
                                  <Icon name="external" size={15} />
                                </a>
                              )}
                              <CopyButton value={row.hash} label="Copy hash" />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="table-empty">
              <Icon name="block" size={28} />
              <h3>
                {d.settlements.loading
                  ? "Loading settlements"
                  : s?.available
                    ? "No settlements in this window"
                    : "Settlements unavailable"}
              </h3>
              <p>
                {d.settlements.loading
                  ? "Reading the public ledger."
                  : s?.available
                    ? "Select a different time range above or refresh for new entries."
                    : "Check your connection, then use Refresh data to try again."}
              </p>
            </div>
          )}
          {s && (
            <div className="table-footnote">
              <span>
                The API may return fewer entries than the window’s total.
              </span>
              <SourceStamp
                resource={{ ...d.settlements, data: s }}
                now={d.now}
                label="Settlement list"
              />
            </div>
          )}
        </section>

        <details id="data-sources" className="sources-details">
          <summary>
            <span>
              <Icon name="info" />
              Data sources &amp; definitions
            </span>
            <Icon name="chevron" size={18} />
          </summary>
          <div className="sources-content">
            <p>
              Read directly from Squeekchain’s public APIs about every 60
              seconds. Pausing keeps the current readings on this page; manual
              refresh remains available. Failed requests retain the last
              successful reading, marked as saved.
            </p>
            <div className="source-list">
              {[
                {
                  name: "Network & wheel",
                  path: "/v1/status",
                  resource: d.network,
                },
                {
                  name: "SQK economy",
                  path: "/v1/economy/state",
                  resource: d.economy,
                },
                {
                  name: "Settlements",
                  path: `/v1/settlements?range=${range}`,
                  resource: d.settlements,
                },
              ].map((source) => (
                <div className="source-item" key={source.name}>
                  <strong>{source.name}</strong>
                  <a
                    href={`${API_BASE}${source.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {API_BASE}
                    {source.path}
                    <Icon name="external" size={14} />
                  </a>
                  <span
                    className={source.resource.error ? "warning-text" : "muted"}
                  >
                    {source.resource.error ??
                      (source.resource.loading
                        ? "Fetching data"
                        : source.resource.data
                          ? "API response received"
                          : "No reading")}
                  </span>
                  {source.resource.data && (
                    <span className="muted">
                      Generated at {source.resource.data.generatedAt}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <dl className="definitions">
              <div>
                <dt>Block height &amp; work</dt>
                <dd>
                  Confirmed builder anchor values, not optimistic projections or
                  Ethereum block height.
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>
                  The latest measurement’s distanceMm divided by 1,000,000,
                  shown in km. This is a wheel measurement, not lifetime
                  distance. A zero reading means the API reported zero.
                </dd>
              </div>
              <div>
                <dt>Live SQK supply</dt>
                <dd>
                  liveSupplyBaseUnits with the API’s token decimals. Displayed
                  to two decimals, truncated. Supply cap:{" "}
                  {e?.cap != null
                    ? `${units(e.cap, e.decimals, 0)} SQK`
                    : "unavailable"}
                  .
                </dd>
              </div>
              <div>
                <dt>Activity chart</dt>
                <dd>
                  Consecutive API buckets are combined into up to eight time
                  intervals. All returned buckets are included; select a bar to
                  read its work and settlement totals.
                </dd>
              </div>
              <div>
                <dt>Network health</dt>
                <dd>
                  Telemetry freshness is checked against the API’s stale
                  threshold. Older readings do not establish current network
                  health. The environment is reported by the economy API.
                </dd>
              </div>
            </dl>
          </div>
        </details>

        <section
          className="community-section"
          aria-labelledby="community-title"
        >
          <div className="community-mark">
            <Icon name="block" size={25} />
          </div>
          <div className="community-copy">
            <h2 id="community-title">Built for the Squeekchain community.</h2>
            <p>
              An independent Genesis project for The Buildooooor badge. Awarding
              the badge requires Squeekchain team approval.
            </p>
            <div className="contributor">
              <span className="muted">Contributor wallet</span>
              <code>{WALLET}</code>
              <CopyButton value={WALLET} />
            </div>
          </div>
          <a
            className="secondary-button"
            href="https://squeekchain.com/genesis/code"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore The Buildooooor
            <Icon name="arrow" />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <span>
          <span className="footer-mark">Wheelwatch</span> · A community project
        </span>
        <span>Public data. A little wheel power.</span>
        <a
          href="https://squeekchain.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Squeekchain
          <Icon name="external" size={14} />
        </a>
      </footer>
    </>
  );
}
