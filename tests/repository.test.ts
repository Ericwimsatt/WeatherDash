import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCATIONS } from "../src/config.ts";
import { emptyBundle } from "../shared/model.ts";
import { pst, pstDate, shiftDate } from "../shared/time.ts";
import {
  loadLocation,
  publishChanges,
  type WeatherResult,
} from "../src/data/repository.ts";
const range = () => ({
  from: shiftDate(pstDate(), -5),
  to: shiftDate(pstDate(), 2),
});
const sourceData = () => ({
  latitude: 37.78,
  longitude: -122.46,
  hourly_units: {
    temperature_2m: "°F",
    rain: "inch",
    showers: "inch",
    wind_speed_10m: "mp/h",
  },
  hourly: {
    time: [`${shiftDate(pstDate(), 1)}T08:00`],
    temperature_2m: [65],
    uv_index: [2],
    rain: [0],
    showers: [0],
    wind_speed_10m: [2],
    wind_direction_10m: [90],
  },
  daily: {
    time: [pstDate()],
    sunrise: [`${pstDate()}T06:50`],
    sunset: [`${pstDate()}T16:57`],
  },
});
test("a late database response cannot overwrite source data and failed writes preserve loaded data", async () => {
  const saved = emptyBundle();
  saved.hourly_weather = [
    {
      latitude_e6: 37781100,
      longitude_e6: -122463500,
      hour_pst: `${shiftDate(pstDate(), 1)}T08:00:00-08:00`,
      data_kind: "forecast",
      source_id: "om:forecast:37.78:-122.46",
      source_retrieved_at_pst: pst(),
      temperature_f: 20,
    },
  ];
  let writes = 0;
  const progress: WeatherResult[] = [];
  const fetcher: any = async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      writes++;
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
    if (url.startsWith("/api/weather")) {
      await new Promise((r) => setTimeout(r, 30));
      return Response.json(saved);
    }
    if (url.includes("api.open-meteo.com")) return Response.json(sourceData());
    return Response.json({ features: [] });
  };
  const result = await loadLocation(LOCATIONS[0], range(), {
    fetcher,
    onData: (d) => progress.push(d),
  });
  assert.equal(result.bundle.hourly_weather[0].temperature_f, 65);
  assert(
    progress.every((p) => p.bundle.hourly_weather[0]?.temperature_f !== 20),
  );
  await new Promise((r) => setTimeout(r, 10));
  assert(writes > 0);
  assert.equal(progress.at(-1)!.writeFailed, true);
});
test("database is used when every primary source fails", async () => {
  const saved = emptyBundle();
  saved.daily_sun_times = [
    {
      latitude_e6: 37781100,
      longitude_e6: -122463500,
      date_pst: pstDate(),
      source_id: "saved",
      source_retrieved_at_pst: pst(),
      sunrise_pst: `${pstDate()}T06:50:00-08:00`,
      sunset_pst: null,
    },
  ];
  const fetcher: any = async (url: string) => {
    if (url.startsWith("/api/weather")) return Response.json(saved);
    throw new Error("offline source");
  };
  const result = await loadLocation(LOCATIONS[0], range(), { fetcher });
  assert.equal(result.bundle.daily_sun_times.length, 1);
  assert.equal(result.failedSources.length, 2);
  assert.equal(result.databaseAvailable, true);
});
test("value-identical rows do not generate a write request", async () => {
  const saved = emptyBundle();
  let requests = 0;
  const fetcher: any = async () => {
    requests++;
    return Response.json({});
  };
  await publishChanges(LOCATIONS[0], saved, saved, fetcher);
  assert.equal(requests, 0);
});
