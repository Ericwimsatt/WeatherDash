import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_LOCATIONS, selectMapLocations, nearestMapLocation, isInMap, projectMap, fieldScale, interpolateHigh, summarizeMapWeather } from "../src/data/regional-map.ts";
import { ALL_LOCATIONS, coordKey, SF_MAP_BEACHES } from "../src/config.ts";
import { emptyBundle } from "../shared/model.ts";

test("15 display readings remain distinct while the field retains 22 source locations", () => {
  assert.equal(MAP_LOCATIONS.length, 22);
  for (const user of MAP_LOCATIONS) {
    const chosen = selectMapLocations(user);
    assert.equal(chosen.length, 15);
    assert.equal(new Set(chosen.map(l => l.id)).size, 15);
    assert.equal(chosen[0].id, nearestMapLocation(user).id);
    assert(chosen.every(l => isInMap(l)));
  }
  assert.deepEqual(selectMapLocations({ lat: 40, lon: -74 }), selectMapLocations(null));
});
test("cropped map extends through the southern land edge and still contains all samples", () => {
  assert(projectMap({ lat: 37.707, lon: -122.44 }).y > 875);
  for (const l of MAP_LOCATIONS) { const p = projectMap(l); assert(p.x > 0 && p.x < 1000 && p.y > 0 && p.y < 875); }
});
test("interpolation uses unlabeled samples, handles absent data and preserves physical values", () => {
  const a = { lat: 37.78, lon: -122.49, high: 50 }, b = { lat: 37.78, lon: -122.40, high: 80 };
  const p = projectMap(a);
  assert.equal(interpolateHigh([], p.x, p.y), null);
  assert.equal(interpolateHigh([a], p.x, p.y), 50);
  const interpolated = interpolateHigh([a, b], p.x, p.y)!;
  assert(interpolated > 50 && interpolated < 80);
  assert.equal(fieldScale([{ ...a, high: 60 }]).max, 70);
});
test("summary reports full-day extrema, retains zeros and marks partial rain", () => {
  const bundle = emptyBundle();
  const provenance = { latitude_e6: 37780000, longitude_e6: -122490000, source_id: "test", source_retrieved_at_pst: "2099-01-01T00:00:00-08:00", data_kind: "forecast" as const };
  bundle.hourly_weather.push(...[0, 1].map((h) => ({ ...provenance, hour_pst: `2099-01-02T0${h}:00:00-08:00`, temperature_f: h ? 65 : 49, uv_index: h ? 4 : 0, wind_speed_mph: h ? 18 : 0, rainfall_in: 0 })));
  assert.deepEqual(summarizeMapWeather(bundle, "2099-01-02"), { high: 65, low: 49, uv: 4, wind: 18, rain: 0, partialRain: true });
  assert.equal(summarizeMapWeather(emptyBundle(), "2099-01-02").high, null);
});

test("all map forecast and beach coordinates are registered with the weather API", () => {
  const allowed = new Set(ALL_LOCATIONS.map(coordKey));
  for (const l of [...MAP_LOCATIONS, ...SF_MAP_BEACHES]) assert(allowed.has(coordKey(l)), l.name);
});
