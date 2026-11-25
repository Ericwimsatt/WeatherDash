import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyBundle } from "../shared/model.ts";
import { timeMarkers, uvCrossingMarkers, visibleMaximum, visibleTemperatureRange } from "../src/data/chart-axis.ts";
import { hourlyChartX } from "../src/data/forecast-timeline.ts";

const provenance = { latitude_e6: 37781100, longitude_e6: -122463500, source_id: "test", source_retrieved_at_pst: "2026-11-24T00:00:00-08:00" };

test("sun markers keep the exact minute and match the calendar position", () => {
  const bundle = emptyBundle();
  bundle.daily_sun_times.push({ ...provenance, date_pst: "2026-11-24", sunrise_pst: "2026-11-24T06:58:00-08:00", sunset_pst: "2026-11-24T16:53:00-08:00" });
  const markers = timeMarkers(bundle, "2026-11-24");
  assert.deepEqual(markers.map(({ kind, label }) => ({ kind, label })), [{ kind: "sunrise", label: "6:58a" }, { kind: "sunset", label: "4:53p" }]);
  assert(Math.abs(markers[1].x - (16 + 53 / 60) / 24) < 1e-12);
  assert.deepEqual(timeMarkers(undefined, "2026-11-24"), []);
});

test("tide extrema include midnight and do not bridge missing hours", () => {
  const bundle = emptyBundle();
  bundle.hourly_tides.push(...[
    ["2099-01-01T23:00:00-08:00", 2], ["2099-01-02T00:00:00-08:00", 3],
    ["2099-01-02T01:00:00-08:00", 2], ["2099-01-02T02:00:00-08:00", 1],
    ["2099-01-02T03:00:00-08:00", 2], ["2099-01-02T05:00:00-08:00", 5],
    ["2099-01-02T06:00:00-08:00", 4],
  ].map(([hour, height]) => ({ ...provenance, hour_pst: String(hour), height_ft: Number(height), datum: "MLLW" as const, data_kind: "forecast" as const })));
  assert.deepEqual(timeMarkers(bundle, "2099-01-02", true).map(({ kind, label, x }) => ({ kind, label, x })), [
    { kind: "high", label: "12:00a", x: 0 }, { kind: "low", label: "2:00a", x: 2 / 24 },
  ]);
});

test("runoff scale has a two-inch floor and excludes offscreen highs", () => {
  const samples = [{ x: .5 }, { x: 1.5 }, { x: 2.5 }];
  const datasets = [{ type: "bar", data: [.2, .1, 9] }];
  assert.equal(visibleMaximum(samples, datasets, 0, 1), 2);
  assert.equal(visibleMaximum(samples, datasets, hourlyChartX(2), .44), 10);
});

test("visible runoff scaling accounts for crossing curves and gaps", () => {
  const samples = [{ x: .5 }, { x: 1.5 }];
  const start = hourlyChartX(0), span = hourlyChartX(1) - start;
  assert.equal(visibleMaximum(samples, [{ data: [8, 0], atDayStart: true }], start, span), 9);
  assert.equal(visibleMaximum(samples, [{ data: [null, 8], atDayStart: true }], 0, .3), 2);
  const middle = (hourlyChartX(.5) + hourlyChartX(1.5)) / 2;
  assert.equal(visibleMaximum(samples, [{ data: [8, 0] }], middle, .01), 4.5);
});


test("wind follows visible readings with a 20 mph minimum ceiling", () => {
  const samples = [{ x: .5 }, { x: 1.5 }, { x: 2.5 }];
  const data = [{ type: "bar", data: [8, 24, 90] }];
  assert.equal(visibleMaximum(samples, data, 0, .88, 20, 5), 20);
  assert.equal(visibleMaximum(samples, data, hourlyChartX(1), .44, 20, 5), 30);
  assert.equal(visibleMaximum(samples, data, hourlyChartX(2), .44, 20, 5), 100);
});

test("temperature bounds follow visible values, including freezing and constant temperatures", () => {
  const samples = [{ x: .5 }, { x: 1.5 }, { x: 2.5 }];
  const data = [{ type: "bar", data: [52, 63, 100] }];
  assert.deepEqual(visibleTemperatureRange(samples, data, 0, .88), { min: 50, max: 55 });
  assert.deepEqual(visibleTemperatureRange(samples, data, 0, 1.32), { min: 50, max: 65 });
  assert.deepEqual(visibleTemperatureRange([{x:.5}], [{data:[-12]}], 0, 1), {min:-15,max:-10});
  assert.deepEqual(visibleTemperatureRange(samples, [{data:[null,null,null]}], 0, 1), {min:40,max:80});
});


test("UV threshold labels interpolate both directions and keep exact endpoints once", () => {
  const markers = uvCrossingMarkers([
    {x:8/24,uv_index:1}, {x:9/24,uv_index:3},
    {x:10/24,uv_index:2}, {x:11/24,uv_index:1},
  ], "2026-11-24");
  assert.deepEqual(markers.map(({kind,label}) => ({kind,label})), [
    {kind:"uv-rising",label:"8:30a"}, {kind:"uv-falling",label:"10:00a"},
  ]);
  assert(Math.abs(markers[0].x - 8.5/24) < 1e-12);
});

test("UV crossings never bridge missing readings or larger time gaps", () => {
  assert.deepEqual(uvCrossingMarkers([
    {x:8/24,uv_index:0}, {x:9/24,uv_index:null}, {x:10/24,uv_index:4},
    {x:12/24,uv_index:0}, {x:13/24,uv_index:2}, {x:14/24,uv_index:0},
  ], "2026-11-24"), []);
});
