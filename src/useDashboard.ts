import { useCallback, useEffect, useRef, useState } from "react";
import { parseNetwork, parseEconomy, parseSettlements, request } from "./api";
import type { EconomyData, NetworkData, Range, SettlementData } from "./api";

export interface Resource<T> {
  data: T | null;
  error: string | null;
  fetchedAt: number | null;
  loading: boolean;
}
const initial = <T>(): Resource<T> => ({
  data: null,
  error: null,
  fetchedAt: null,
  loading: true,
});

export function useDashboard(range: Range) {
  const [network, setNetwork] = useState<Resource<NetworkData>>(initial);
  const [economy, setEconomy] = useState<Resource<EconomyData>>(initial);
  const [settlements, setSettlements] =
    useState<Resource<SettlementData>>(initial);
  const [automatic, setAutomatic] = useState(true);
  const [refreshing, setRefreshing] = useState(true);
  const [lastAttempt, setLastAttempt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [announcement, setAnnouncement] = useState("");
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setRefreshing(true);
    setLastAttempt(Date.now());
    const timeout = window.setTimeout(() => controller.abort("timeout"), 12000);
    let failures = 0;
    const load = async <T>(
      path: string,
      parse: (data: unknown, response: Response) => T,
      set: React.Dispatch<React.SetStateAction<Resource<T>>>,
    ) => {
      set((previous) => ({ ...previous, loading: true }));
      try {
        const data = await request(path, parse, controller.signal);
        if (mounted.current && active.current === controller)
          set({ data, error: null, fetchedAt: Date.now(), loading: false });
      } catch (e) {
        failures++;
        if (mounted.current && active.current === controller)
          set((previous) => ({
            ...previous,
            loading: false,
            error: controller.signal.aborted
              ? "The public API did not respond within 12 seconds."
              : e instanceof Error
                ? e.message
                : "Unable to reach the public API. Check your connection.",
          }));
      }
    };
    await Promise.all([
      load("/v1/status", parseNetwork, setNetwork),
      load("/v1/economy/state", parseEconomy, setEconomy),
      load(
        `/v1/settlements?range=${range}`,
        (data, response) =>
          parseSettlements(
            data,
            range,
            response.headers.get("X-Squeek-Settlement-Source"),
          ),
        setSettlements,
      ),
    ]);
    clearTimeout(timeout);
    if (mounted.current && active.current === controller) {
      setRefreshing(false);
      setAnnouncement(
        failures
          ? `${failures} public data ${failures === 1 ? "source is" : "sources are"} unavailable. Use Refresh data to retry.`
          : "Public network data refreshed.",
      );
    }
  }, [range]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!automatic) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    const resume = () => {
      if (!document.hidden && Date.now() - lastAttempt >= 60000) void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    resume();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [automatic, refresh, lastAttempt]);

  return {
    network,
    economy,
    settlements,
    automatic,
    setAutomatic,
    refreshing,
    refresh,
    now,
    lastAttempt,
    announcement,
  };
}
