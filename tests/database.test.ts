import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { upsertStatement } from "../shared/database.ts";
import {
  changedRows,
  emptyBundle,
  mergeBundles,
  type Weather,
  weatherSchema,
} from "../shared/model.ts";
import {
  pst,
  validPst,
  pstDate,
  midnight,
  shiftDate,
  HOUR,
} from "../shared/time.ts";
import {
  weatherAt,
  observedRain,
  runoffSummary,
  lowUvWindows,
} from "../src/data/selectors.ts";
export const fixture = (extra: Partial<Weather> = {}): Weather => ({
  latitude_e6: 37781100,
  longitude_e6: -122463500,
  hour_pst: "2026-11-19T08:00:00-08:00",
  data_kind: "forecast",
  source_id: "om:forecast:1:2",
  temperature_f: 58,
  source_retrieved_at_pst: "2026-11-19T09:00:00-08:00",
  ...extra,
});
function db() {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys=ON");
  d.exec(
    readFileSync(
      new URL("../migrations/0001_weather.sql", import.meta.url),
      "utf8",
    ),
  );
  d.exec(
    "INSERT INTO locations VALUES(37781100,-122463500,'Inner Richmond','San Francisco'); INSERT INTO data_sources(id,provider,dataset) VALUES('om:forecast:1:2','open_meteo','forecast'),('nws:KSFO','nws','station_observations');",
  );
  return d;
}
const put = (d: DatabaseSync, row: Weather) => {
  const { sql, values } = upsertStatement("hourly_weather", row, pst());
  return d.prepare(sql).run(...(values as any[]));
};
test("PST is fixed UTC-8 in summer and winter and validates actual calendar dates", () => {
  assert.equal(pst("2026-07-01T12:00:00Z"), "2026-07-01T04:00:00-08:00");
  assert.equal(pstDate("2026-11-19T03:00:00Z"), "2026-11-18");
  assert.equal(validPst("2026-02-30T00:00:00-08:00"), false);
});
test("upserts update changed fields, preserve absent fields and avoid identical writes", () => {
  const d = db();
  assert.equal(put(d, fixture({ uv_index: 3 })).changes, 1);
  assert.equal(
    put(
      d,
      fixture({
        uv_index: 3,
        source_retrieved_at_pst: "2026-11-19T10:00:00-08:00",
      }),
    ).changes,
    0,
  );
  assert.equal(
    put(
      d,
      fixture({
        temperature_f: 60,
        source_retrieved_at_pst: "2026-11-19T10:00:00-08:00",
      }),
    ).changes,
    1,
  );
  const row = d.prepare("SELECT * FROM hourly_weather").get()!;
  assert.equal(row.uv_index, 3);
  assert.equal(row.temperature_f, 60);
  d.close();
});
test("older provider revisions and older requests cannot replace newer values", () => {
  const d = db();
  put(d, fixture({ source_issued_at_pst: "2026-11-19T08:00:00-08:00" }));
  assert.equal(
    put(
      d,
      fixture({
        temperature_f: 30,
        source_issued_at_pst: "2026-11-19T07:00:00-08:00",
        source_retrieved_at_pst: "2026-11-19T10:00:00-08:00",
      }),
    ).changes,
    0,
  );
  assert.equal(
    put(
      d,
      fixture({
        temperature_f: 30,
        source_retrieved_at_pst: "2026-11-19T07:00:00-08:00",
      }),
    ).changes,
    0,
  );
  d.close();
});
test("forecast and observation coexist, coordinates and source FKs are enforced", () => {
  const d = db();
  put(d, fixture());
  put(
    d,
    fixture({
      source_id: "nws:KSFO",
      data_kind: "observation",
      temperature_f: 57,
    }),
  );
  assert.equal(
    d.prepare("SELECT count(*) as n FROM hourly_weather").get()!.n,
    2,
  );
  assert.throws(() => put(d, fixture({ latitude_e6: 0 })), /FOREIGN KEY/);
  d.close();
});
test("diff ignores timestamps and merging always gives fresh source fields priority", () => {
  const row = fixture();
  assert.deepEqual(
    changedRows(
      "hourly_weather",
      [{ ...row, source_retrieved_at_pst: "2026-11-19T10:00:00-08:00" }],
      [row],
    ),
    [],
  );
  const saved = emptyBundle(),
    fresh = emptyBundle();
  saved.hourly_weather = [row];
  fresh.hourly_weather = [{ ...row, temperature_f: 65 }];
  assert.equal(mergeBundles(saved, fresh).hourly_weather[0].temperature_f, 65);
});
test("past hours require measurements per field; forecasts remain available for future", () => {
  const bundle = emptyBundle();
  bundle.hourly_weather = [
    fixture({ uv_index: 5 }),
    fixture({
      data_kind: "observation",
      source_id: "nws:KSFO",
      temperature_f: 55,
    }),
  ];
  assert.equal(
    weatherAt(
      bundle,
      fixture().hour_pst,
      Date.parse("2026-11-19T10:00:00-08:00"),
    ).temperature_f,
    55,
  );
  assert.equal(
    weatherAt(
      bundle,
      fixture().hour_pst,
      Date.parse("2026-11-19T10:00:00-08:00"),
    ).uv_index,
    undefined,
  );
  assert.equal(
    weatherAt(
      bundle,
      fixture().hour_pst,
      Date.parse("2026-11-19T07:00:00-08:00"),
    ).temperature_f,
    58,
  );
});
test("rainfall totals exclude forecasts, preserve zero, and report missing coverage", () => {
  const bundle = emptyBundle();
  const start = Date.parse("2026-11-19T00:00:00-08:00");
  bundle.hourly_weather = [
    fixture({ hour_pst: pst(start), rainfall_in: 99 }),
    ...Array.from({ length: 2 }, (_, i) =>
      fixture({
        hour_pst: pst(start + i * HOUR),
        data_kind: "observation",
        source_id: "nws:KSFO",
        rainfall_in: i * 0.1,
        rainfall_start_pst: pst(start + i * HOUR),
        rainfall_end_pst: pst(start + (i + 1) * HOUR),
      }),
    ),
  ];
  assert.deepEqual(observedRain(bundle, pst(start), pst(start + 2 * HOUR)), {
    total: 0.1,
    complete: true,
    hours: 2,
    expectedHours: 2,
    sourceId: "nws:KSFO",
  });
  assert.equal(
    observedRain(bundle, pst(start), pst(start + 3 * HOUR)).complete,
    false,
  );
  assert.equal(
    runoffSummary(emptyBundle(), emptyBundle(), "2026-11-19").complete,
    false,
  );
});
test("overlapping station rainfall is not double-counted and gaps do not become zero", () => {
  const bundle = emptyBundle();
  const start = Date.parse("2026-11-19T00:00:00-08:00");
  bundle.hourly_weather = [0, 30].map((minutes) =>
    fixture({
      data_kind: "observation",
      source_id: "nws:KSFO",
      rainfall_in: 0.1,
      rainfall_start_pst: pst(start + minutes * 60000),
      rainfall_end_pst: pst(start + minutes * 60000 + HOUR),
    }),
  );
  const rain = observedRain(bundle, pst(start), pst(start + 2 * HOUR));
  assert.equal(rain.total, 0.1);
  assert.equal(rain.complete, false);
});
test("rain validation requires explicit one-hour bounds and UV windows split around high or missing UV", () => {
  assert.equal(
    weatherSchema.safeParse(fixture({ rainfall_in: 0.2 })).success,
    false,
  );
  const rows = [1, 1, 3, null, 1].map((uv_index, i) => ({
    hour: pst(Date.parse("2026-11-19T06:00:00-08:00") + i * HOUR),
    uv_index,
  }));
  assert.equal(lowUvWindows(rows).length, 2);
  assert.equal(lowUvWindows(rows)[0].to, "2026-11-19T07:00:00-08:00");
});

test("runoff curves use trailing windows without inventing missing rain", async () => {
  const { runoffTotals } = await import("../src/data/selectors.ts");
  const bundle = emptyBundle();
  const start = Date.parse("2026-11-15T00:00:00-08:00");
  bundle.hourly_weather = Array.from({ length: 4 * 24 }, (_, i) =>
    fixture({
      hour_pst: pst(start + i * HOUR),
      data_kind: "observation",
      source_id: "nws:KSFO",
      rainfall_in: 0.01,
      rainfall_start_pst: pst(start + i * HOUR),
      rainfall_end_pst: pst(start + (i + 1) * HOUR),
    }),
  );
  const dates = ["2026-11-15", "2026-11-17", "2026-11-19"];
  const now = Date.parse("2026-11-19T12:00:00-08:00");
  const local = runoffTotals(bundle, dates, 2, now),
    inland = runoffTotals(bundle, dates, 4, now);
  assert.equal(local[0].total, null);
  assert.equal(local[1].total, 0.48);
  assert.equal(local[1].complete, true);
  assert.equal(inland[1].total, 0.48);
  assert.equal(inland[1].complete, false);
  assert.equal(inland[2].total, 0.96);
  assert.equal(inland[2].complete, true);
  const warning = runoffSummary(bundle, bundle, dates[2]);
  assert.deepEqual(local[2], warning.local);
  assert.deepEqual(inland[2], warning.inland);
});
