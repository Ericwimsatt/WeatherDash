import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyBundle, type Weather } from "../shared/model.ts";
import { pst, HOUR, midnight } from "../shared/time.ts";
import {
  rainfallDates,
  rainfallTotal,
  runoffExplanation,
  regionWeatherClass,
  runoffSummary,
  runoffTotals,
  uvWindowLabel,
} from "../src/data/selectors.ts";
function rainRow(
  start: number,
  amount: number,
  kind: "forecast" | "observation",
): Weather {
  return {
    latitude_e6: 37781100,
    longitude_e6: -122463500,
    hour_pst: pst(start),
    data_kind: kind,
    source_id: kind === "observation" ? "nws:KSFO" : "om:forecast:1:2",
    source_retrieved_at_pst: "2026-11-19T12:30:00-08:00",
    rainfall_in: amount,
    rainfall_start_pst: pst(start),
    rainfall_end_pst: pst(start + HOUR),
  };
}
test("daily total combines measured past hours with future forecasts, not archived predictions", () => {
  const bundle = emptyBundle(),
    start = Date.parse(midnight("2026-11-19"));
  for (let i = 0; i < 24; i++)
    bundle.hourly_weather.push(
      rainRow(start + i * HOUR, i < 12 ? 100 : 0.02, "forecast"),
    );
  for (let i = 0; i < 12; i++)
    bundle.hourly_weather.push(rainRow(start + i * HOUR, 0.1, "observation"));
  const now = start + 12.5 * HOUR;
  const total = rainfallTotal(bundle, pst(start), pst(start + 24 * HOUR), now);
  assert.equal(total.total, 1.44);
  assert.equal(total.hours, 24);
  assert.equal(total.complete, true);
  bundle.hourly_weather = bundle.hourly_weather.filter(
    (r) => r.hour_pst !== pst(start + 18 * HOUR),
  );
  const partial = rainfallTotal(
    bundle,
    pst(start),
    pst(start + 24 * HOUR),
    now,
  );
  assert.equal(partial.total, 1.42);
  assert.equal(partial.complete, false);
});
test("rain timeline spans yesterday through three future days", () => {
  assert.deepEqual(rainfallDates("2026-11-19"), [
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
});
test("runoff explanation states the measured totals and their accumulation windows", () => {
  const local = emptyBundle(),
    inland = emptyBundle();
  local.hourly_weather = [
    rainRow(Date.parse("2026-11-18T10:00:00-08:00"), 0.32, "observation"),
  ];
  inland.hourly_weather = [
    rainRow(Date.parse("2026-11-17T10:00:00-08:00"), 1.46, "observation"),
  ];
  assert.equal(
    runoffExplanation(local, inland, "2026-11-19"),
    "0.32″ rain locally in last 2 days and 1.46″ inland in last 4 days",
  );
  assert.equal(
    runoffExplanation(emptyBundle(), emptyBundle(), "2026-11-19"),
    "",
  );
});
test("rain over 0.3 inches takes precedence over a sunny weather code", () => {
  assert.equal(regionWeatherClass(0, 0.31), "rainy");
  assert.equal(regionWeatherClass(0, 0.3), "sunny");
  assert.equal(regionWeatherClass(null, 0.8), "rainy");
  assert.equal(regionWeatherClass(null, null), "");
});
test("UV windows omit the early-morning and late-night endpoints", () => {
  const start = Date.parse("2026-11-19T05:00:00-08:00");
  const hours = Array.from({ length: 17 }, (_, i) => ({
    hour: pst(start + i * HOUR),
    uv_index: i >= 6 && i < 9 ? 3 : 1,
  }));
  assert.equal(uvWindowLabel(hours), "Before 10a · After 2p");
  assert.equal(
    uvWindowLabel(hours.map((r) => ({ ...r, uv_index: 0 }))),
    "All day",
  );
  assert.equal(
    uvWindowLabel(hours.map((r) => ({ ...r, uv_index: null }))),
    "—",
  );
});

test("inland warning uses the last four days and the one-inch cutoff", () => {
  const inland = emptyBundle();
  inland.hourly_weather = [
    rainRow(Date.parse("2026-11-18T10:00:00-08:00"), 0.8, "observation"),
  ];
  assert.equal(
    runoffSummary(emptyBundle(), inland, "2026-11-19").warning,
    false,
  );
  inland.hourly_weather.push(
    rainRow(Date.parse("2026-11-15T10:00:00-08:00"), 0.3, "observation"),
  );
  assert.equal(
    runoffSummary(emptyBundle(), inland, "2026-11-19").warning,
    true,
  );
  assert.equal(
    runoffExplanation(emptyBundle(), inland, "2026-11-19"),
    "1.10″ rain inland in last 4 days",
  );
});

test("runoff chart totals use 3 local days and 4 inland days", () => {
  const local = emptyBundle(), inland = emptyBundle();
  const today = "2026-11-22", tomorrow = "2026-11-23";
  const start = Date.parse(midnight(today));
  const now = start + 12 * HOUR;
  local.hourly_weather = [
    rainRow(Date.parse("2026-11-19T10:00:00-08:00"), 0.18, "observation"),
    rainRow(Date.parse("2026-11-20T10:00:00-08:00"), 0.32, "observation"),
    rainRow(start + 6 * HOUR, 0, "observation"),
    rainRow(start + 14 * HOUR, 0.05, "forecast"),
  ];
  inland.hourly_weather = [
    rainRow(Date.parse("2026-11-18T10:00:00-08:00"), 1.07, "observation"),
    rainRow(Date.parse("2026-11-21T10:00:00-08:00"), 0.39, "observation"),
  ];
  const warning = runoffSummary(local, inland, today);
  const dates = [today, tomorrow];
  const localLine = runoffTotals(local, dates, 3, now);
  const inlandLine = runoffTotals(inland, dates, 4, now);
  assert.equal(warning.warning, true);
  assert.equal(warning.local.total, 0.32);
  assert.equal(localLine[0].total, 0.5);
  assert.deepEqual(inlandLine[0], warning.inland);
  assert.equal(localLine[1].total, 0.37);
  assert.equal(inlandLine[1].total, 0.39);
});
