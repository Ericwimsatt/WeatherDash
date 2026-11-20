import {
  type Location,
  stationFor,
  STATIONS,
  tideStation,
  NOAA_STATIONS,
} from "../config.ts";
import {
  emptyBundle,
  type Bundle,
  type Weather,
  type Source,
  rowSchemas,
  tables,
  type Row,
} from "../../shared/model.ts";
import {
  HOUR,
  pst,
  pstDate,
  pstHour,
  midnight,
  shiftDate,
} from "../../shared/time.ts";
export type Fetcher = typeof fetch;
export type Range = { from: string; to: string };
const coords = (l: Location) => ({
  latitude_e6: Math.round(l.lat * 1e6),
  longitude_e6: Math.round(l.lon * 1e6),
});
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const rounded = (v: number, digits = 3) => Number(v.toFixed(digits));
export async function getJson(
  url: string,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<any> {
  const timeout = AbortSignal.timeout(18000);
  const response = await fetcher(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const data: any = await response.json();
  if (data.error) throw new Error("Source data unavailable");
  return data;
}
// Multiple mounted location queries share a single Open-Meteo request per tick.
// Each subscriber can cancel without cancelling the other locations in the batch.
let forecastQueue: {
  location: Location;
  range: Range;
  signal?: AbortSignal;
  fetcher: Fetcher;
  resolve: (v: Bundle) => void;
  reject: (e: unknown) => void;
}[] = [];
let forecastTimer: ReturnType<typeof setTimeout> | undefined;
export function fetchForecast(
  location: Location,
  range: Range,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<Bundle> {
  return new Promise((resolve, reject) => {
    forecastQueue.push({ location, range, signal, fetcher, resolve, reject });
    if (!forecastTimer) forecastTimer = setTimeout(flushForecast, 0);
  });
}
async function flushForecast() {
  const queue = forecastQueue;
  forecastQueue = [];
  forecastTimer = undefined;
  const groups = new Map<string, typeof queue>();
  for (const item of queue) {
    if (item.signal?.aborted) {
      item.reject(new DOMException("Aborted", "AbortError"));
      continue;
    }
    const key = `${item.range.from}/${item.range.to}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  for (const requests of groups.values()) {
    const unique = [
      ...new Map(
        requests.map((r) => [
          `${r.location.lat},${r.location.lon}`,
          r.location,
        ]),
      ).values(),
    ];
    const p = new URLSearchParams({
      latitude: unique.map((l) => l.lat).join(","),
      longitude: unique.map((l) => l.lon).join(","),
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      precipitation_unit: "inch",
      timezone: "Etc/GMT+8",
      start_date: requests[0].range.from,
      end_date: shiftDate(requests[0].range.to, 1),
      hourly:
        "temperature_2m,uv_index,rain,showers,wind_speed_10m,wind_direction_10m,weather_code",
      daily: "sunrise,sunset",
    });
    try {
      const data = await getJson(
        `https://api.open-meteo.com/v1/forecast?${p}`,
        undefined,
        requests[0].fetcher,
      );
      const results = Array.isArray(data) ? data : [data];
      if (results.length !== unique.length)
        throw new Error("Incomplete forecast batch");
      const retrieved = pst();
      for (const request of requests) {
        if (request.signal?.aborted) {
          request.reject(new DOMException("Aborted", "AbortError"));
          continue;
        }
        try {
          const i = unique.findIndex(
            (l) =>
              l.lat === request.location.lat && l.lon === request.location.lon,
          );
          const bundle = normalizeForecast(
            results[i],
            request.location,
            retrieved,
          );
          bundle.hourly_weather = bundle.hourly_weather.filter(
            (r) => r.hour_pst.slice(0, 10) <= request.range.to,
          );
          bundle.daily_sun_times = bundle.daily_sun_times.filter(
            (r) => r.date_pst <= request.range.to,
          );
          request.resolve(bundle);
        } catch (e) {
          request.reject(e);
        }
      }
    } catch (error) {
      requests.forEach((r) => r.reject(error));
    }
  }
}
export function normalizeForecast(
  data: any,
  location: Location,
  retrieved: string,
  now = Date.now(),
): Bundle {
  if (
    !Array.isArray(data.hourly?.time) ||
    !data.hourly_units ||
    data.hourly_units.temperature_2m !== "°F" ||
    data.hourly_units.rain !== "inch" ||
    data.hourly_units.showers !== "inch" ||
    !["mp/h", "mph"].includes(data.hourly_units.wind_speed_10m)
  )
    throw new Error("Invalid forecast units or payload");
  const bundle = emptyBundle();
  const source: Source = {
    id: `om:forecast:${data.latitude}:${data.longitude}`,
    provider: "open_meteo",
    dataset: "forecast",
    model: "best_match",
    source_latitude_e6: Math.round(data.latitude * 1e6),
    source_longitude_e6: Math.round(data.longitude * 1e6),
  };
  bundle.sources = [source];
  data.hourly.time.forEach((time: string, i: number) => {
    const hour = `${time.slice(0, 13)}:00:00-08:00`;
    const row: any = {
      ...coords(location),
      hour_pst: hour,
      data_kind: "forecast",
      source_id: source.id,
      source_retrieved_at_pst: retrieved,
    };
    // Retain the full modeled UV curve so today's peak does not disappear
    // after noon. It remains a forecast, never a recorded measurement.
    const next = data.hourly.time[i + 1];
    const uv = data.hourly.uv_index?.[i + 1];
    if (next && finite(uv)) row.uv_index = rounded(uv);
    if (Date.parse(hour) + HOUR <= now) {
      const parsed = rowSchemas.hourly_weather.safeParse(row);
      if (parsed.success) bundle.hourly_weather.push(parsed.data);
      return;
    }
    const pairs = [
      ["temperature_2m", "temperature_f"],
      ["wind_speed_10m", "wind_speed_mph"],
      ["wind_direction_10m", "wind_direction_deg"],
      ["weather_code", "weather_code"],
    ];
    for (const [field, column] of pairs) {
      const v = data.hourly[field]?.[i];
      if (finite(v))
        row[column] = column === "wind_direction_deg" ? v % 360 : rounded(v);
    }
    // Open-Meteo rain timestamps end the preceding accumulation interval.
    // Put the next timestamp's amount into the current hour-start bucket.
    const largeScaleRain = data.hourly.rain?.[i + 1];
    const showers = data.hourly.showers?.[i + 1];
    const rain =
      finite(largeScaleRain) && finite(showers)
        ? largeScaleRain + showers
        : null;
    if (
      next &&
      finite(rain) &&
      Date.parse(`${next.slice(0, 16)}:00-08:00`) - Date.parse(hour) === HOUR
    ) {
      row.rainfall_in = rounded(rain, 4);
      row.rainfall_start_pst = hour;
      row.rainfall_end_pst = pst(Date.parse(hour) + HOUR);
    }
    const parsed = rowSchemas.hourly_weather.safeParse(row);
    if (parsed.success) bundle.hourly_weather.push(parsed.data);
  });
  data.daily?.time?.forEach((date: string, i: number) => {
    const row = {
      ...coords(location),
      date_pst: date,
      source_id: source.id,
      source_retrieved_at_pst: retrieved,
      sunrise_pst: data.daily.sunrise?.[i]
        ? `${data.daily.sunrise[i].slice(0, 16)}:00-08:00`
        : null,
      sunset_pst: data.daily.sunset?.[i]
        ? `${data.daily.sunset[i].slice(0, 16)}:00-08:00`
        : null,
    };
    bundle.daily_sun_times.push(rowSchemas.daily_sun_times.parse(row));
  });
  return bundle;
}
// Fetches are coalesced while in flight, not retained as a stale source cache.
const inFlight = new Map<string, Promise<any>>();
function sharedJson(url: string, fetcher: Fetcher) {
  let p = inFlight.get(url);
  if (!p) {
    p = getJson(url, undefined, fetcher);
    inFlight.set(url, p);
    p.finally(() => inFlight.delete(url)).catch(() => {});
  }
  return p;
}
function quantity(
  q: any,
  kind: "temperature" | "speed" | "rain" | "direction",
): number | undefined {
  if (!finite(q?.value) || ["X", "Q", "B", "Z"].includes(q.qualityControl))
    return;
  const unit = String(q.unitCode || "")
    .split(":")
    .at(-1);
  let v = q.value;
  if (kind === "temperature") {
    if (unit === "degC") v = (v * 9) / 5 + 32;
    else if (unit !== "degF") return;
  }
  if (kind === "speed") {
    if (unit === "km_h-1") v /= 1.609344;
    else if (unit === "m_s-1") v *= 2.2369362921;
    else if (unit !== "mi_h-1") return;
  }
  if (kind === "rain") {
    if (unit === "mm") v /= 25.4;
    else if (unit === "m") v *= 39.37007874;
    else if (unit !== "in") return;
  }
  return rounded(
    kind === "direction" ? ((v % 360) + 360) % 360 : v,
    kind === "rain" ? 4 : 3,
  );
}
export function normalizeObservations(
  features: any[],
  location: Location,
  retrieved: string,
  now = Date.now(),
): Bundle {
  const station = stationFor(location),
    meta = STATIONS[station],
    bundle = emptyBundle();
  const source: Source = {
    id: `nws:${station}`,
    provider: "nws",
    dataset: "station_observations",
    station_id: station,
    source_latitude_e6: Math.round(meta.lat * 1e6),
    source_longitude_e6: Math.round(meta.lon * 1e6),
  };
  bundle.sources = [source];
  const rows = new Map<string, Weather>();
  for (const feature of [...features].sort(
    (a, b) =>
      Date.parse(a.properties?.timestamp) - Date.parse(b.properties?.timestamp),
  )) {
    const p = feature.properties;
    if (
      !p?.timestamp ||
      !Number.isFinite(Date.parse(p.timestamp)) ||
      Date.parse(p.timestamp) > now
    )
      continue;
    const observed = pst(p.timestamp);
    const hour = pstHour(observed);
    const point: any = {
      ...coords(location),
      hour_pst: hour,
      data_kind: "observation",
      source_id: source.id,
      source_retrieved_at_pst: retrieved,
      observed_at_pst: observed,
    };
    for (const [field, column, kind] of [
      ["temperature", "temperature_f", "temperature"],
      ["windSpeed", "wind_speed_mph", "speed"],
      ["windDirection", "wind_direction_deg", "direction"],
    ] as const) {
      const v = quantity(p[field], kind);
      if (v !== undefined) point[column] = v;
    }
    if (
      ["temperature_f", "wind_speed_mph", "wind_direction_deg"].some(
        (f) => point[f] !== undefined,
      )
    ) {
      const combined = { ...rows.get(hour), ...point };
      const valid = rowSchemas.hourly_weather.safeParse(combined);
      if (valid.success) rows.set(hour, valid.data);
    }
    const rain = quantity(p.precipitationLastHour, "rain");
    if (rain !== undefined) {
      const start = pst(Date.parse(observed) - HOUR),
        bucket = pstHour(start);
      const row = {
        ...coords(location),
        ...rows.get(bucket),
        hour_pst: bucket,
        data_kind: "observation" as const,
        source_id: source.id,
        source_retrieved_at_pst: retrieved,
        rainfall_in: rain,
        rainfall_start_pst: start,
        rainfall_end_pst: observed,
      };
      const valid = rowSchemas.hourly_weather.safeParse(row);
      if (valid.success) rows.set(bucket, valid.data);
    }
  }
  bundle.hourly_weather = [...rows.values()];
  return bundle;
}
export async function fetchObservations(
  location: Location,
  range: Range,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<Bundle> {
  const station = stationFor(location);
  const end = new Date(
    Math.min(
      Date.parse(midnight(shiftDate(range.to, 1))),
      Math.floor(Date.now() / 60000) * 60000,
    ),
  ).toISOString();
  let url = `https://api.weather.gov/stations/${station}/observations?${new URLSearchParams({ start: new Date(midnight(range.from)).toISOString(), end, limit: "500" })}`;
  const features: any[] = [];
  let pages = 0;
  while (url && pages++ < 8) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const data = await sharedJson(url, fetcher);
    if (!Array.isArray(data.features))
      throw new Error("Invalid station observations");
    features.push(...data.features);
    const next = data.pagination?.next;
    if (
      next &&
      !String(next).startsWith(
        `https://api.weather.gov/stations/${station}/observations?`,
      )
    )
      throw new Error("Unexpected observation pagination");
    url = next || "";
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return normalizeObservations(features, location, pst());
}
export function normalizeNoaa(
  data: any,
  location: Location,
  product: "predictions" | "water_level" | "water_temperature",
  retrieved: string,
  now = Date.now(),
): Bundle {
  const bundle = emptyBundle(),
    station = tideStation(location),
    meta = NOAA_STATIONS[station];
  const source: Source = {
    id: `noaa:${station}:${product}`,
    provider: "noaa",
    dataset: product,
    station_id: station,
    source_latitude_e6: Math.round(meta.lat * 1e6),
    source_longitude_e6: Math.round(meta.lon * 1e6),
  };
  bundle.sources = [source];
  const values = product === "predictions" ? data.predictions : data.data;
  if (!Array.isArray(values)) throw new Error("Invalid NOAA data");
  const daily = new Map<string, Map<string, number>>();
  for (const item of values) {
    if (
      !/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(item.t) ||
      item.v === "" ||
      !finite(Number(item.v))
    )
      continue;
    const time = `${item.t.replace(" ", "T")}:00-08:00`,
      at = Date.parse(time),
      value = Number(item.v);
    if (!Number.isFinite(at) || (product !== "predictions" && at > now))
      continue;
    if (product === "water_temperature") {
      const date = pstDate(time);
      if (!daily.has(date)) daily.set(date, new Map());
      daily.get(date)!.set(time, value);
      continue;
    }
    // Only exact hourly station measurements; no interpolation into observations.
    if (time.slice(14, 16) !== "00") continue;
    if (product === "predictions" && at + HOUR <= now) continue;
    bundle.hourly_tides.push(
      rowSchemas.hourly_tides.parse({
        ...coords(location),
        hour_pst: time,
        data_kind: product === "predictions" ? "forecast" : "observation",
        source_id: source.id,
        source_retrieved_at_pst: retrieved,
        datum: "MLLW",
        height_ft: rounded(value),
      }),
    );
  }
  for (const [date, samples] of daily) {
    const hourly = new Map(
      [...samples].filter(([time]) => time.slice(14, 16) === "00"),
    );
    const values = [...hourly.values()];
    if (!values.length) continue;
    bundle.daily_water_temperature.push(
      rowSchemas.daily_water_temperature.parse({
        ...coords(location),
        date_pst: date,
        data_kind: "observation",
        source_id: source.id,
        source_retrieved_at_pst: retrieved,
        mean_temperature_f: rounded(
          values.reduce((a, b) => a + b, 0) / values.length,
        ),
        sample_count: values.length,
        is_complete: values.length === 24 && date < pstDate(now) ? 1 : 0,
      }),
    );
  }
  return bundle;
}
export async function fetchNoaa(
  location: Location,
  range: Range,
  product: "predictions" | "water_level" | "water_temperature",
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<Bundle> {
  const end =
    product === "predictions"
      ? range.to
      : range.to < pstDate()
        ? range.to
        : pstDate();
  if (range.from > end) return emptyBundle();
  const p = new URLSearchParams({
    station: tideStation(location),
    product,
    from: range.from.replaceAll("-", ""),
    to: end.replaceAll("-", ""),
  });
  const data = await getJson(`/api/tides?${p}`, signal, fetcher);
  return normalizeNoaa(data, location, product, pst());
}
export async function fetchMarine(
  location: Location,
  range: Range,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<Bundle> {
  const p = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    hourly: "sea_surface_temperature",
    temperature_unit: "fahrenheit",
    timezone: "Etc/GMT+8",
    start_date: range.from,
    end_date: range.to,
  });
  const data = await getJson(
    `https://marine-api.open-meteo.com/v1/marine?${p}`,
    signal,
    fetcher,
  );
  if (
    !Array.isArray(data.hourly?.time) ||
    data.hourly_units?.sea_surface_temperature !== "°F"
  )
    throw new Error("Invalid marine data");
  const source: Source = {
    id: `om:marine:${data.latitude}:${data.longitude}`,
    provider: "open_meteo_marine",
    dataset: "marine",
    model: "best_match",
    source_latitude_e6: Math.round(data.latitude * 1e6),
    source_longitude_e6: Math.round(data.longitude * 1e6),
  };
  const bundle = emptyBundle();
  bundle.sources = [source];
  const daily = new Map<string, Map<string, number>>();
  data.hourly.time.forEach((time: string, i: number) => {
    const value = data.hourly.sea_surface_temperature[i],
      date = time.slice(0, 10);
    if (!finite(value) || date < pstDate()) return;
    if (!daily.has(date)) daily.set(date, new Map());
    daily.get(date)!.set(time, value);
  });
  for (const [date, samples] of daily) {
    const values = [...samples.values()];
    bundle.daily_water_temperature.push(
      rowSchemas.daily_water_temperature.parse({
        ...coords(location),
        date_pst: date,
        data_kind: "forecast",
        source_id: source.id,
        source_retrieved_at_pst: pst(),
        mean_temperature_f: rounded(
          values.reduce((a, b) => a + b, 0) / values.length,
        ),
        sample_count: values.length,
        is_complete: values.length === 24 ? 1 : 0,
      }),
    );
  }
  return bundle;
}
export function cleanBundle(value: any): Bundle {
  const result = emptyBundle();
  if (!value || typeof value !== "object")
    throw new Error("Invalid DB response");
  for (const table of tables) {
    if (!Array.isArray(value[table])) throw new Error("Invalid DB rows");
    for (const raw of value[table]) {
      const { updated_at_pst, ...row } = raw;
      const parsed = rowSchemas[table].safeParse(row);
      if (parsed.success) (result[table] as Row[]).push(parsed.data);
    }
  }
  result.sources = Array.isArray(value.sources) ? value.sources : [];
  return result;
}
