import {
  type Bundle,
  type Weather,
  type Tide,
  type Water,
} from "../../shared/model.ts";
import {
  HOUR,
  pst,
  displayHour,
  hoursBetween,
  pstDate,
  midnight,
  shiftDate,
} from "../../shared/time.ts";
export function weatherAt(
  bundle: Bundle,
  hour: string,
  now = Date.now(),
): Partial<Weather> {
  const kind = Date.parse(hour) + HOUR <= now ? "observation" : "forecast";
  const rows = bundle.hourly_weather
    .filter((r) => r.hour_pst === hour && r.data_kind === kind)
    .sort((a, b) =>
      a.source_retrieved_at_pst.localeCompare(b.source_retrieved_at_pst),
    );
  const result: Record<string, unknown> = {};
  for (const row of rows)
    for (const [k, v] of Object.entries(row))
      if (v !== null && v !== undefined) result[k] = v;
  return result as Partial<Weather>;
}
export function weatherDay(bundle: Bundle, date: string, now = Date.now()) {
  return hoursBetween(midnight(date), midnight(shiftDate(date, 1))).map(
    (hour) => ({ hour, ...weatherAt(bundle, hour, now) }),
  );
}
export function uvDay(bundle: Bundle, date: string) {
  // UV's modeled full-day forecast is useful after the hour has passed.
  // Prefer a recorded UV reading if one is available, including a real zero.
  const rows = [...bundle.hourly_weather].sort((a, b) =>
    b.source_retrieved_at_pst.localeCompare(a.source_retrieved_at_pst),
  );
  return hoursBetween(midnight(date), midnight(shiftDate(date, 1))).map(
    (hour) => {
      const candidates = rows.filter(
        (r) => r.hour_pst === hour && r.uv_index != null,
      );
      const reading =
        candidates.find((r) => r.data_kind === "observation") ??
        candidates.find((r) => r.data_kind === "forecast");
      return { hour, uv_index: reading?.uv_index ?? null };
    },
  );
}
export function tidesForDay(
  bundle: Bundle,
  date: string,
  now = Date.now(),
): Tide[] {
  const chosen = new Map<string, Tide>();
  for (const row of bundle.hourly_tides) {
    if (row.hour_pst.slice(0, 10) !== date || row.datum !== "MLLW") continue;
    const kind =
      Date.parse(row.hour_pst) + HOUR <= now ? "observation" : "forecast";
    if (row.data_kind !== kind) continue;
    const current = chosen.get(row.hour_pst);
    if (
      !current ||
      row.source_retrieved_at_pst > current.source_retrieved_at_pst
    )
      chosen.set(row.hour_pst, row);
  }
  return [...chosen.values()].sort((a, b) =>
    a.hour_pst.localeCompare(b.hour_pst),
  );
}
export function waterForDay(
  bundle: Bundle,
  date: string,
  now = Date.now(),
): Water | undefined {
  const rows = bundle.daily_water_temperature.filter(
    (r) => r.date_pst === date,
  );
  const observed = rows
    .filter((r) => r.data_kind === "observation")
    .sort((a, b) =>
      b.source_retrieved_at_pst.localeCompare(a.source_retrieved_at_pst),
    );
  if (date <= pstDate(now) && observed.length) return observed[0];
  if (date < pstDate(now)) return;
  return rows
    .filter((r) => r.data_kind === "forecast")
    .sort((a, b) =>
      b.source_retrieved_at_pst.localeCompare(a.source_retrieved_at_pst),
    )[0];
}
export function sunForDay(bundle: Bundle, date: string) {
  return bundle.daily_sun_times
    .filter((r) => r.date_pst === date)
    .sort((a, b) =>
      b.source_retrieved_at_pst.localeCompare(a.source_retrieved_at_pst),
    )[0];
}
export function extrema(values: (number | null | undefined)[]) {
  const clean = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  return clean.length
    ? { min: Math.min(...clean), max: Math.max(...clean) }
    : null;
}
export function tideExtrema(rows: Tide[]) {
  return rows
    .filter((row, i) => {
      const before = rows[i - 1],
        after = rows[i + 1];
      return (
        before &&
        after &&
        Date.parse(row.hour_pst) - Date.parse(before.hour_pst) === HOUR &&
        Date.parse(after.hour_pst) - Date.parse(row.hour_pst) === HOUR &&
        ((row.height_ft > before.height_ft &&
          row.height_ft >= after.height_ft) ||
          (row.height_ft < before.height_ft &&
            row.height_ft <= after.height_ft))
      );
    })
    .map((row) => ({
      ...row,
      type:
        row.height_ft >= rows[rows.indexOf(row) - 1].height_ft ? "High" : "Low",
    }));
}
export type RainSummary = {
  total: number | null;
  complete: boolean;
  hours: number;
  expectedHours: number;
  sourceId: string | null;
};
// Pick ONE station for the whole window. Never mix overlapping rain intervals
// or silently sum several stations. Exact reported bounds determine coverage.
export function observedRain(
  bundle: Bundle,
  from: string,
  to: string,
): RainSummary {
  const start = Date.parse(from),
    end = Date.parse(to),
    expectedHours = (end - start) / HOUR;
  const bySource = new Map<string, Weather[]>();
  for (const row of bundle.hourly_weather) {
    if (
      row.data_kind !== "observation" ||
      row.rainfall_in == null ||
      !row.rainfall_start_pst ||
      !row.rainfall_end_pst
    )
      continue;
    const a = Date.parse(row.rainfall_start_pst),
      b = Date.parse(row.rainfall_end_pst);
    if (a < start || b > end) continue;
    bySource.set(row.source_id, [...(bySource.get(row.source_id) || []), row]);
  }
  const ranked = [...bySource].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  if (!ranked.length)
    return {
      total: null,
      complete: false,
      hours: 0,
      expectedHours,
      sourceId: null,
    };
  const [sourceId, rows] = ranked[0];
  rows.sort((a, b) =>
    a.rainfall_start_pst!.localeCompare(b.rainfall_start_pst!),
  );
  let cursor = start,
    total = 0,
    covered = 0,
    gap = false;
  for (const row of rows) {
    const a = Date.parse(row.rainfall_start_pst!),
      b = Date.parse(row.rainfall_end_pst!);
    if (a < cursor) continue;
    if (a > cursor) gap = true;
    total += row.rainfall_in!;
    covered += b - a;
    cursor = b;
  }
  return {
    total: covered ? Number(total.toFixed(4)) : null,
    complete: covered > 0 && !gap && cursor === end,
    hours: covered / HOUR,
    expectedHours,
    sourceId,
  };
}
export const RUNOFF_LIMITS = {
  local: 0.25,
  inland: 1,
} as const;
export function rainfallTotal(
  bundle: Bundle,
  from: string,
  to: string,
  now = Date.now(),
): RainSummary {
  const start = Date.parse(from),
    end = Date.parse(to);
  const cutoff = Math.floor(now / HOUR) * HOUR;
  const observedEnd = Math.min(end, cutoff);
  const recorded =
    observedEnd > start
      ? observedRain(bundle, from, pst(observedEnd))
      : { total: null, hours: 0, complete: true, sourceId: null };
  const forecastFrom = Math.max(start, cutoff);
  const future =
    forecastFrom < end
      ? hoursBetween(pst(forecastFrom), to).map(
          (hour) => weatherAt(bundle, hour, now).rainfall_in,
        )
      : [];
  const values = future.filter((v): v is number => v != null);
  return {
    total:
      recorded.total == null && !values.length
        ? null
        : Number(
            ((recorded.total ?? 0) + values.reduce((a, b) => a + b, 0)).toFixed(
              4,
            ),
          ),
    hours: recorded.hours + values.length,
    expectedHours: (end - start) / HOUR,
    complete: recorded.complete && values.length === future.length,
    sourceId: recorded.sourceId,
  };
}
export function rainfallDates(today = pstDate()) {
  return [-1, 0, 1, 2, 3].map((offset) => shiftDate(today, offset));
}
export function runoffTotals(
  bundle: Bundle,
  dates: string[],
  days: number,
  lagDays = 0,
  now = Date.now(),
) {
  return dates.map((date) =>
    rainfallTotal(
      bundle,
      midnight(shiftDate(date, 1 - days - lagDays)),
      midnight(shiftDate(date, 1 - lagDays)),
      now,
    ),
  );
}
export function runoffExplanation(
  local: Bundle,
  inland: Bundle,
  today = pstDate(),
) {
  const summary = runoffSummary(local, inland, today);
  const details: string[] = [];
  const describe = (
    bundle: Bundle,
    total: number,
    label: string,
    offsets: number[],
  ) => {
    const latest = offsets.find(
      (ago) =>
        (observedRain(
          bundle,
          midnight(shiftDate(today, -ago)),
          midnight(shiftDate(today, 1 - ago)),
        ).total ?? 0) > 0,
    );
    return `${total.toFixed(2)}″ ${label} ${latest ? `${latest} day${latest === 1 ? "" : "s"} ago` : `in the past ${offsets.length} days`}`;
  };
  if ((summary.local.total ?? 0) >= RUNOFF_LIMITS.local)
    details.push(describe(local, summary.local.total!, "local", [1, 2]));
  if ((summary.inland.total ?? 0) >= RUNOFF_LIMITS.inland)
    details.push(
      describe(inland, summary.inland.total!, "inland", [1, 2, 3, 4]),
    );
  return details.join(" and ");
}
export function regionWeatherClass(
  code: number | null | undefined,
  rainfall: number | null,
) {
  if (rainfall != null && rainfall > 0.3) return "rainy";
  if (code == null) return "";
  if (code === 0) return "sunny";
  if (code < 3) return "partly-cloudy";
  if (code < 50) return "cloudy";
  if (code < 70 || (code >= 80 && code < 85)) return "rainy";
  if (code < 90) return "snowy";
  return "thunder";
}
export function runoffSummary(
  local: Bundle,
  inland: Bundle,
  today = pstDate(),
) {
  const localRain = observedRain(
    local,
    midnight(shiftDate(today, -2)),
    midnight(today),
  );
  const inlandRain = observedRain(
    inland,
    midnight(shiftDate(today, -4)),
    midnight(today),
  );
  const warning =
    (localRain.total ?? 0) >= RUNOFF_LIMITS.local ||
    (inlandRain.total ?? 0) >= RUNOFF_LIMITS.inland;
  return {
    local: localRain,
    inland: inlandRain,
    warning,
    complete: localRain.complete && inlandRain.complete,
  };
}
export function lowUvWindows(
  hours: { hour: string; uv_index?: number | null }[],
): { from: string; to: string }[] {
  const ranges: { from: string; to: string }[] = [];
  let open: { from: string; to: string } | undefined;
  for (const row of hours) {
    if (row.uv_index != null && row.uv_index < 2) {
      if (open && Date.parse(row.hour) - Date.parse(open.to) === HOUR)
        open.to = row.hour;
      else {
        open = { from: row.hour, to: row.hour };
        ranges.push(open);
      }
    } else open = undefined;
  }
  return ranges;
}

export function uvWindowLabel(
  hours: { hour: string; uv_index?: number | null }[],
) {
  const ranges = lowUvWindows(hours);
  if (!ranges.length) return "—";
  return ranges
    .map((range) => {
      const early = range.from === hours[0]?.hour;
      const late = range.to === hours.at(-1)?.hour;
      if (early && late) return "All day";
      if (early) return `Before ${displayHour(range.to)}`;
      if (late) return `After ${displayHour(range.from)}`;
      return `${displayHour(range.from)}–${displayHour(range.to)}`;
    })
    .join(" · ");
}
