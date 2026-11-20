import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { onRequestGet, onRequestPost } from "../functions/api/weather.ts";
import { pst, pstDate, pstHour } from "../shared/time.ts";
// Exercise the actual handler and prepared SQL against SQLite, not a canned DB response.
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0001_weather.sql", import.meta.url),
      "utf8",
    ),
  );
  function prepare(sql: string) {
    let values: any[] = [];
    const statement: any = {
      bind(...v: any[]) {
        values = v;
        return statement;
      },
      all: async () => execute(),
      run: async () => execute(),
    };
    function execute() {
      const s = sqlite.prepare(sql);
      if (/^\s*SELECT/i.test(sql))
        return {
          results: s.all(...values),
          meta: { changes: 0 },
          success: true,
        };
      const result = s.run(...values);
      return {
        results: [],
        meta: { changes: Number(result.changes) },
        success: true,
      };
    }
    statement.execute = execute;
    return statement;
  }
  const db: any = {
    prepare,
    batch: async (statements: any[]) => {
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((s) => s.execute());
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { sqlite, env: { DB: db } };
}
const base = () => ({
  location: { latitude_e6: 37781100, longitude_e6: -122463500 },
  table: "hourly_weather",
  sources: [
    {
      id: "nws:KSFO",
      provider: "nws",
      dataset: "station_observations",
      station_id: "KSFO",
    },
  ],
  rows: [
    {
      latitude_e6: 37781100,
      longitude_e6: -122463500,
      hour_pst: pstHour(),
      data_kind: "observation",
      source_id: "nws:KSFO",
      temperature_f: 58,
      source_retrieved_at_pst: pst(),
    },
  ],
});
async function post(env: any, body: any, headers: Record<string, string> = {}) {
  return onRequestPost({
    env,
    request: new Request("https://weatherdash.pages.dev/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  } as any);
}
test("API persists a batch, GET round trips normalized values and repeat uploads are no-ops", async () => {
  const { sqlite, env } = setup();
  const input = base();
  const response = await post(env, input);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(((await response.json()) as any).changed, 1);
  assert.equal(((await (await post(env, input)).json()) as any).changed, 0);
  const read = await onRequestGet({
    env,
    request: new Request(
      `https://weatherdash.pages.dev/api/weather?lat_e6=37781100&lon_e6=-122463500&from=${pstDate()}&to=${pstDate()}`,
    ),
  } as any);
  assert.equal(read.status, 200);
  const body: any = await read.json();
  assert.equal(body.hourly_weather[0].temperature_f, 58);
  assert.equal(body.sources[0].id, "nws:KSFO");
  sqlite.close();
});
test("API rejects cross-origin writes, invented stations, unknown coordinates and invalid fields", async () => {
  const { sqlite, env } = setup();
  assert.equal(
    (await post(env, base(), { Origin: "https://other.example" })).status,
    403,
  );
  const station = base();
  station.sources[0].station_id = "FAKE";
  assert.equal((await post(env, station)).status, 400);
  const location = base();
  location.location.latitude_e6 = 0;
  assert.equal((await post(env, location)).status, 400);
  const extra = base();
  (extra.rows[0] as any).arbitrary_sql = "DROP TABLE locations";
  assert.equal((await post(env, extra)).status, 400);
  assert.equal(
    sqlite.prepare("SELECT count(*) as n FROM hourly_weather").get()!.n,
    0,
  );
  sqlite.close();
});
test("API exposes a missing binding as recoverable 503 and rejects oversized bodies", async () => {
  assert.equal((await post({}, base())).status, 503);
  const { sqlite, env } = setup();
  const response = await onRequestPost({
    env,
    request: new Request("https://weatherdash.pages.dev/api/weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: " ".repeat(65537),
    }),
  } as any);
  assert.equal(response.status, 413);
  sqlite.close();
});
