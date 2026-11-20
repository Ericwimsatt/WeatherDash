import { coordKey, type Location } from "../config.ts";
import {
  emptyBundle,
  mergeBundles,
  changedRows,
  tables,
  type Bundle,
  type Row,
} from "../../shared/model.ts";
import {
  getJson,
  cleanBundle,
  fetchForecast,
  fetchObservations,
  fetchMarine,
  fetchNoaa,
  type Fetcher,
  type Range,
} from "./providers.ts";
import { pstDate } from "../../shared/time.ts";
export type Resource = "weather" | "swim";
export type WeatherResult = {
  bundle: Bundle;
  pending: boolean;
  failedSources: string[];
  databaseAvailable: boolean;
  writeFailed: boolean;
};
export type LoadOptions = {
  signal?: AbortSignal;
  onData?: (data: WeatherResult) => void;
  fetcher?: Fetcher;
  resource?: Resource;
};
export function databaseUrl(l: Location, range: Range) {
  return `/api/weather?${new URLSearchParams({ lat_e6: String(Math.round(l.lat * 1e6)), lon_e6: String(Math.round(l.lon * 1e6)), from: range.from, to: range.to })}`;
}
export function locationQueryKey(
  l: Location,
  range: Range,
  resource: Resource,
) {
  return ["location", coordKey(l), range.from, range.to, resource];
}
export async function publishChanges(
  location: Location,
  fresh: Bundle,
  saved: Bundle,
  fetcher: Fetcher = fetch,
): Promise<void> {
  for (const table of tables) {
    const changed = changedRows(table, fresh[table] as Row[], saved[table]);
    for (let i = 0; i < changed.length; i += 25) {
      const rows = changed.slice(i, i + 25);
      const ids = new Set(rows.map((r) => r.source_id));
      const sources = fresh.sources.filter((s) => ids.has(s.id));
      const response = await fetcher("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: {
            latitude_e6: Math.round(location.lat * 1e6),
            longitude_e6: Math.round(location.lon * 1e6),
          },
          table,
          rows,
          sources,
        }),
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) throw new Error("Weather changes could not be saved");
    }
  }
}
// A failed database read/write never turns a successful provider read into failure.
// Each primary source can complete independently. DB replies are always merged
// underneath successful provider rows, irrespective of response order.
export async function loadLocation(
  location: Location,
  range: Range,
  options: LoadOptions = {},
): Promise<WeatherResult> {
  const { signal, onData, fetcher = fetch, resource = "weather" } = options;
  let saved = emptyBundle(),
    fresh = emptyBundle(),
    databaseAvailable = false;
  const failedSources: string[] = [];
  const result = (pending: boolean, writeFailed = false): WeatherResult => ({
    bundle: mergeBundles(saved, fresh),
    pending,
    failedSources: [...failedSources],
    databaseAvailable,
    writeFailed,
  });
  const emit = () => {
    if (!signal?.aborted) onData?.(result(true));
  };
  const today = pstDate();
  const forecastRange = { from: today, to: range.to };
  const dbRead = getJson(databaseUrl(location, range), signal, fetcher)
    .then((data) => {
      saved = cleanBundle(data);
      databaseAvailable = true;
      emit();
    })
    .catch(() => {});
  const tasks: [string, () => Promise<Bundle>][] = [
    [
      "Open-Meteo forecast",
      () => fetchForecast(location, range, signal, fetcher),
    ],
    [
      "NWS observations",
      () =>
        fetchObservations(
          location,
          { from: range.from, to: today },
          signal,
          fetcher,
        ),
    ],
  ];
  if (resource === "swim")
    tasks.push(
      [
        "Marine forecast",
        () => fetchMarine(location, forecastRange, signal, fetcher),
      ],
      [
        "NOAA tide predictions",
        () =>
          fetchNoaa(location, forecastRange, "predictions", signal, fetcher),
      ],
      [
        "NOAA measured tides",
        () =>
          fetchNoaa(
            location,
            { from: range.from, to: today },
            "water_level",
            signal,
            fetcher,
          ),
      ],
      [
        "NOAA water temperature",
        () =>
          fetchNoaa(
            location,
            { from: range.from, to: today },
            "water_temperature",
            signal,
            fetcher,
          ),
      ],
    );
  const primary = tasks.map(async ([name, run]) => {
    try {
      const bundle = await run();
      if (signal?.aborted) return;
      fresh = mergeBundles(fresh, bundle);
      emit();
    } catch {
      failedSources.push(name);
      emit();
    }
  });
  await Promise.all([dbRead, ...primary]);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const final = result(false);
  // Do not await persistence before returning weather to the user.
  publishChanges(location, fresh, saved, fetcher).catch(() => {
    if (!signal?.aborted) onData?.({ ...final, writeFailed: true });
  });
  return final;
}
