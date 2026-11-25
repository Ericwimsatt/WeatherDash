import type { Bundle } from "../../shared/model.ts";
import { DAY, displayTime, midnight, pst, shiftDate } from "../../shared/time.ts";
import { FORECAST_DAYS, HISTORY_DAYS, hourlyChartX } from "./forecast-timeline.ts";
import { sunForDay, tideExtrema, tidesForDay } from "./selectors.ts";

export type TimeMarker = { x: number; label: string; kind: "sunrise" | "sunset" | "high" | "low" | "uv-rising" | "uv-falling" };

export function timeMarkers(bundle: Bundle | undefined, today: string, tides = false): TimeMarker[] {
  if (!bundle) return [];
  const origin = Date.parse(midnight(today));
  const markers: TimeMarker[] = [];
  const rows = [];
  for (let day = -HISTORY_DAYS; day <= FORECAST_DAYS; day++) {
    const date = shiftDate(today, day);
    const sun = sunForDay(bundle, date);
    for (const [kind, time] of [["sunrise", sun?.sunrise_pst], ["sunset", sun?.sunset_pst]] as const) {
      if (time) markers.push({ x: (Date.parse(time) - origin) / DAY, label: displayTime(time), kind });
    }
    if (tides) rows.push(...tidesForDay(bundle, date));
  }
  // Detect across midnight as well as within a day. Times reflect the hourly
  // tide samples available from our provider, rather than invented precision.
  for (const tide of tideExtrema(rows)) markers.push({
    x: (Date.parse(tide.hour_pst) - origin) / DAY,
    label: displayTime(tide.hour_pst),
    kind: tide.type === "High" ? "high" : "low",
  });
  return markers.sort((a, b) => a.x - b.x);
}

// Compute only when hourly data changes, never during panning. Crossing times
// are estimates between the hourly samples, rounded to the nearest minute.
export function uvCrossingMarkers(samples: { x: number; uv_index: number | null }[], today: string, threshold = 2): TimeMarker[] {
  const origin = Date.parse(midnight(today));
  const markers: TimeMarker[] = [];
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1], after = samples[i];
    const a = before.uv_index, b = after.uv_index;
    if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (after.x <= before.x || after.x - before.x > 1 / 24 + 1e-9) continue;
    if ((a <= threshold) === (b <= threshold)) continue;
    const x = before.x + (after.x - before.x) * (threshold - a) / (b - a);
    const time = pst(Math.round((origin + x * DAY) / 60000) * 60000);
    markers.push({ x, label: displayTime(time), kind: b > a ? "uv-rising" : "uv-falling" });
  }
  return markers;
}

type AxisDataset = { data: (number | null)[]; atDayStart?: boolean; type?: string };

export function visibleRange(samples: { x: number }[], datasets: AxisDataset[], start: number, span: number) {
  const end = start + span;
  let min = Infinity, max = -Infinity;
  const include = (value: number) => { min = Math.min(min, value); max = Math.max(max, value); };
  for (const dataset of datasets) {
    const points = samples.map((sample, i) => ({ x: hourlyChartX(sample.x - (dataset.atDayStart ? .5 : 0)), y: dataset.data[i] }));
    points.forEach((point, i) => {
      if (point.y == null || !Number.isFinite(point.y)) return;
      if (point.x >= start && point.x <= end) include(point.y);
      const next = points[i + 1];
      if (dataset.type === "bar" || !next || next.y == null || !Number.isFinite(next.y)) return;
      for (const edge of [start, end]) {
        if (point.x < edge && next.x > edge) include(point.y + (next.y - point.y) * (edge - point.x) / (next.x - point.x));
      }
    });
  }
  return min === Infinity ? undefined : { min, max };
}

export function visibleMaximum(samples: { x: number }[], datasets: AxisDataset[], start: number, span: number, floor = 2, step = .5) {
  const range = visibleRange(samples, datasets, start, span);
  return Math.max(floor, Math.ceil((range?.max ?? 0) * 1.1 / step) * step);
}

export function visibleTemperatureRange(samples: { x: number }[], datasets: AxisDataset[], start: number, span: number) {
  const range = visibleRange(samples, datasets, start, span);
  if (!range) return { min: 40, max: 80 };
  const padding = Math.max(2, (range.max - range.min) * .1);
  return { min: Math.floor((range.min - padding) / 5) * 5, max: Math.ceil((range.max + padding) / 5) * 5 };
}
