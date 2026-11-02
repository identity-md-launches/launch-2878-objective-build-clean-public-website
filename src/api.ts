export const API_BASE = "https://api.squeekchain.com";
export const WALLET = "0x9a2ecf2e6af1ce1072f100e3328094016989f5b5";
export type Range = "24h" | "7d";
export type JsonRecord = Record<string, unknown>;

export interface NetworkData {
  generatedAt: string;
  observedAt: string | null;
  freshness: string;
  staleAfterSeconds: number;
  coreStatus: string | null;
  distanceMm: string | null;
  blockHeight: string | null;
  cumulativeWork: string | null;
  blockProgress: string | null;
  oracleState: string | null;
  queueState: string | null;
  incidentOpen: boolean;
}
export interface EconomyData {
  generatedAt: string;
  available: boolean;
  chainId: string | null;
  target: string | null;
  decimals: number;
  liveSupply: string | null;
  cap: string | null;
  paused: boolean | null;
}
export interface Settlement {
  hash: string;
  logIndex: string;
  round: string;
  timestamp: string;
  work: string;
  blocks: string;
  height: string;
  confirmation: string;
}
export interface Bucket {
  startAt: string;
  endAt: string;
  work: string;
  count: string;
}
export interface SettlementData {
  generatedAt: string;
  available: boolean;
  range: Range;
  chainId: string | null;
  count: string | null;
  work: string | null;
  blocks: string | null;
  recent: Settlement[];
  buckets: Bucket[];
  source: string | null;
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
export function uint(value: unknown): string | null {
  if (
    typeof value === "string" &&
    /^(0|[1-9][0-9]*)$/.test(value) &&
    value.length <= 100
  )
    return value;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : null;
}
function date(value: unknown): string | null {
  const s = text(value);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
}
function generated(value: JsonRecord): string {
  const timestamp = date(value.generatedAt);
  if (!timestamp)
    throw new Error("The API response has no valid data timestamp.");
  return timestamp;
}

export function parseNetwork(raw: unknown): NetworkData {
  const r = record(raw);
  const m = record(r.measurement);
  const builder = record(r.builder);
  const a = builder.status === "available" ? record(builder.anchor) : {};
  if (!r.measurement || !r.builder)
    throw new Error("The status API returned an unsupported response.");
  const oracle = record(r.oracle);
  const queue = record(r.settlementQueue);
  return {
    generatedAt: generated(r),
    observedAt: date(m.observedAt),
    freshness: text(m.freshness) ?? "unknown",
    staleAfterSeconds:
      Number.isFinite(m.staleAfterSeconds) && Number(m.staleAfterSeconds) > 0
        ? Number(m.staleAfterSeconds)
        : 120,
    coreStatus: text(m.coreStatus),
    distanceMm: uint(m.distanceMm),
    blockHeight: uint(a.blockHeight),
    cumulativeWork: uint(a.cumulativeWork),
    blockProgress: uint(a.blockProgress),
    oracleState: text(oracle.state),
    queueState: text(queue.state),
    incidentOpen: queue.incidentOpen === true,
  };
}
export function parseEconomy(raw: unknown): EconomyData {
  const r = record(raw);
  if (
    r.status !== "available" &&
    r.status !== "unavailable" &&
    r.status !== "not_yet_safe"
  )
    throw new Error("The economy API returned an unsupported response.");
  const asset = record(r.asset);
  const supply = record(r.supply);
  const chain = record(r.chain);
  const decimals = asset.decimals;
  const available = r.status === "available";
  if (
    available &&
    (!Number.isInteger(decimals) ||
      Number(decimals) < 0 ||
      Number(decimals) > 36 ||
      !uint(supply.liveSupplyBaseUnits) ||
      !uint(supply.capBaseUnits))
  ) {
    throw new Error("The economy API returned invalid supply units.");
  }
  return {
    generatedAt: generated(r),
    available,
    chainId: uint(chain.chainId),
    target: text(chain.target),
    decimals: available ? Number(decimals) : 18,
    liveSupply: available ? uint(supply.liveSupplyBaseUnits) : null,
    cap: available ? uint(supply.capBaseUnits) : null,
    paused:
      typeof record(r.lifecycle).paused === "boolean"
        ? (record(r.lifecycle).paused as boolean)
        : null,
  };
}
export function parseSettlements(
  raw: unknown,
  range: Range,
  source: string | null,
): SettlementData {
  const r = record(raw);
  if (
    r.status !== "available" &&
    r.status !== "unavailable" &&
    r.status !== "not_yet_safe"
  )
    throw new Error("The settlements API returned an unsupported response.");
  if (
    r.status === "available" &&
    (!Array.isArray(r.recentSettlements) ||
      !Array.isArray(r.buckets) ||
      r.range !== range)
  ) {
    throw new Error(
      "The settlements API returned an unsupported history format.",
    );
  }
  const recent = (Array.isArray(r.recentSettlements) ? r.recentSettlements : [])
    .map((value): Settlement => {
      const s = record(value);
      if (
        typeof s.transactionHash !== "string" ||
        !/^0x[a-fA-F0-9]{64}$/.test(s.transactionHash) ||
        !date(s.blockTimestamp) ||
        !uint(s.settledThroughRound) ||
        !uint(s.workAdded) ||
        !uint(s.completedBlockCount) ||
        !uint(s.blockHeight) ||
        !uint(s.logIndex)
      ) {
        throw new Error("The settlements API returned an invalid settlement.");
      }
      return {
        hash: s.transactionHash,
        logIndex: uint(s.logIndex)!,
        round: uint(s.settledThroughRound)!,
        timestamp: date(s.blockTimestamp)!,
        work: uint(s.workAdded)!,
        blocks: uint(s.completedBlockCount)!,
        height: uint(s.blockHeight)!,
        confirmation: text(s.confirmationStatus) ?? "unknown",
      };
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const buckets = (Array.isArray(r.buckets) ? r.buckets : [])
    .map((value): Bucket => {
      const b = record(value);
      if (
        !date(b.startAt) ||
        !date(b.endAt) ||
        !uint(b.workAdded) ||
        !uint(b.settlementCount)
      )
        throw new Error(
          "The settlements API returned an invalid activity bucket.",
        );
      return {
        startAt: date(b.startAt)!,
        endAt: date(b.endAt)!,
        work: uint(b.workAdded)!,
        count: uint(b.settlementCount)!,
      };
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const summary = record(r.summary);
  return {
    generatedAt: generated(r),
    available: r.status === "available",
    range,
    chainId: uint(record(r.chain).chainId),
    count: uint(summary.settlementCount),
    work: uint(summary.workAdded),
    blocks: uint(summary.completedBlockCount),
    recent,
    buckets,
    source,
  };
}

export async function request<T>(
  path: string,
  parse: (data: unknown, response: Response) => T,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal,
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`The public API returned HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("The public API returned a page instead of JSON.");
  return parse(await response.json(), response);
}

const integerFormat = new Intl.NumberFormat("en-US");
export function integer(value: string | null | undefined): string {
  return value != null ? integerFormat.format(BigInt(value)) : "Unavailable";
}
// Format base-unit values with integer arithmetic: 18-decimal supplies never pass through a floating point number.
export function units(
  value: string | null | undefined,
  decimals: number,
  places = 2,
): string {
  if (value == null) return "Unavailable";
  const n = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = n / scale;
  const fraction = (n % scale)
    .toString()
    .padStart(decimals, "0")
    .slice(0, places)
    .padEnd(places, "0");
  return `${integerFormat.format(whole)}${places > 0 ? `.${fraction}` : ""}`;
}
export function percentage(
  value: string | null | undefined,
  cap: string | null | undefined,
): number | null {
  return value != null && cap != null && BigInt(cap) > 0n
    ? Number((BigInt(value) * 10000n) / BigInt(cap)) / 100
    : null;
}
export function utc(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function explorer(chainId: string | null, hash: string): string | null {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return null;
  if (chainId === "11155111") return `https://sepolia.etherscan.io/tx/${hash}`;
  if (chainId === "1") return `https://etherscan.io/tx/${hash}`;
  return null;
}
