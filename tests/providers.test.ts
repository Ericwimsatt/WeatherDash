import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeForecast,
  normalizeObservations,
  normalizeNoaa,
} from "../src/data/providers.ts";
import { LOCATIONS } from "../src/config.ts";
import { uvDay, extrema, weatherAt } from "../src/data/selectors.ts";
const location = LOCATIONS[0],
  retrieved = "2026-11-19T09:00:00-08:00";
const forecast = {
  latitude: 37.78,
  longitude: -122.46,
  hourly_units: {
    temperature_2m: "°F",
    rain: "inch",
    showers: "inch",
    wind_speed_10m: "mp/h",
  },
  hourly: {
    time: ["2026-11-19T08:00", "2026-11-19T09:00", "2026-11-19T10:00"],
    temperature_2m: [58, 59, 60],
    uv_index: [0, 1, 2],
    rain: [0.4, 0.2, 0],
    showers: [0, 0.1, 0],
    wind_speed_10m: [2, 3, 4],
    wind_direction_10m: [360, 0, 90],
  },
  daily: {
    time: ["2026-11-19"],
    sunrise: ["2026-11-19T06:50"],
    sunset: ["2026-11-19T16:57"],
  },
};
test("forecast aligns hourly values and retains only modeled UV for completed hours", () => {
  const bundle = normalizeForecast(
    forecast,
    location,
    retrieved,
    Date.parse("2026-11-19T08:30:00-08:00"),
  );
  assert.equal(bundle.hourly_weather[0].rainfall_in, 0.3);
  assert.equal(
    bundle.hourly_weather[0].rainfall_start_pst,
    "2026-11-19T08:00:00-08:00",
  );
  assert.equal(bundle.hourly_weather[0].wind_direction_deg, 0);
  const later = normalizeForecast(
    forecast,
    location,
    retrieved,
    Date.parse("2026-11-19T09:30:00-08:00"),
  );
  assert.equal(later.hourly_weather[0].hour_pst, "2026-11-19T08:00:00-08:00");
  assert.equal(later.hourly_weather[0].uv_index, 1);
  assert.equal(later.hourly_weather[0].temperature_f, undefined);
  assert.equal(later.hourly_weather[0].rainfall_in, undefined);
  assert.equal(
    later.hourly_weather.find(
      (r) => r.hour_pst === "2026-11-19T09:00:00-08:00",
    )!.temperature_f,
    59,
  );
  assert.throws(
    () =>
      normalizeForecast(
        { ...forecast, hourly_units: { rain: "mm" } },
        location,
        retrieved,
      ),
    /units/,
  );
});
test("station observations preserve exact rain intervals, convert units and keep unknown rain missing", () => {
  const features = [
    {
      properties: {
        timestamp: "2026-11-19T16:56:00Z",
        temperature: { value: 10, unitCode: "wmoUnit:degC" },
        windSpeed: { value: 16.09344, unitCode: "wmoUnit:km_h-1" },
        precipitationLastHour: { value: 2.54, unitCode: "wmoUnit:mm" },
      },
    },
    {
      properties: {
        timestamp: "2026-11-19T17:56:00Z",
        temperature: { value: 11, unitCode: "wmoUnit:degC" },
        precipitationLastHour: { value: null, unitCode: "wmoUnit:mm" },
      },
    },
  ];
  const b = normalizeObservations(
    features,
    location,
    retrieved,
    Date.parse("2026-11-19T18:00:00Z"),
  );
  const rain = b.hourly_weather.find((r) => r.rainfall_in != null)!;
  assert.equal(rain.rainfall_in, 0.1);
  assert.equal(rain.rainfall_start_pst, "2026-11-19T07:56:00-08:00");
  assert.equal(rain.rainfall_end_pst, "2026-11-19T08:56:00-08:00");
  assert.equal(
    b.hourly_weather.find((r) => r.hour_pst === "2026-11-19T08:00:00-08:00")!
      .temperature_f,
    50,
  );
  assert.equal(
    b.hourly_weather.find((r) => r.hour_pst === "2026-11-19T09:00:00-08:00")!
      .rainfall_in,
    undefined,
  );
});
test("NOAA keeps measured and predicted tides distinct and does not round six-minute samples into hourly measurements", () => {
  const data = {
    data: [
      { t: "2026-11-19 08:00", v: "-0.4" },
      { t: "2026-11-19 08:06", v: "0.1" },
    ],
  };
  const b = normalizeNoaa(
    data,
    location,
    "water_level",
    retrieved,
    Date.parse("2026-11-19T10:00:00-08:00"),
  );
  assert.equal(b.hourly_tides.length, 1);
  assert.equal(b.hourly_tides[0].data_kind, "observation");
  assert.equal(b.hourly_tides[0].height_ft, -0.4);
});

test("UV keeps the full-day peak after sunset without using modeled rainfall as observations", () => {
  const early = normalizeForecast(
    forecast,
    location,
    retrieved,
    Date.parse("2026-11-19T07:00:00-08:00"),
  );
  const late = normalizeForecast(
    forecast,
    location,
    retrieved,
    Date.parse("2026-11-19T19:00:00-08:00"),
  );
  assert.equal(
    extrema(uvDay(early, "2026-11-19").map((r) => r.uv_index))!.max,
    2,
  );
  assert.equal(
    extrema(uvDay(late, "2026-11-19").map((r) => r.uv_index))!.max,
    2,
  );
  assert(
    late.hourly_weather.every(
      (r) =>
        r.data_kind === "forecast" &&
        r.rainfall_in === undefined &&
        r.temperature_f === undefined,
    ),
  );
  assert.equal(
    weatherAt(
      late,
      "2026-11-19T08:00:00-08:00",
      Date.parse("2026-11-19T19:00:00-08:00"),
    ).uv_index,
    undefined,
  );
  late.hourly_weather.push({
    ...late.hourly_weather[0],
    data_kind: "observation",
    source_id: "nws:KSFO",
    uv_index: 0,
  });
  assert.equal(
    uvDay(late, "2026-11-19").find(
      (r) => r.hour === "2026-11-19T08:00:00-08:00",
    )!.uv_index,
    0,
  );
});
