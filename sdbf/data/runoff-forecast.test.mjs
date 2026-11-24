import test from "node:test";
import assert from "node:assert/strict";
import { hour, pointIds, withPointRain } from "./point-rain.mjs";
import { runoffHorizon } from "./runoff-forecast.mjs";

test("current graph totals match the displayed point summaries after observations replace forecasts", () => {
  const now = Date.parse("2026-11-22T20:30:00Z");
  const start = Math.floor(now/hour)*hour - 120*hour;
  const site = { id:1, name:"Beach", lat:33, lon:-117 };
  const [local,inland] = pointIds(site);
  const point = (lat,lon) => ({ lat,lon,start,values:Array(400).fill(.01),verifiedAt:new Date(now).toISOString() });
  const observations = [
    { latitude_e6:33000000, longitude_e6:-117000000, data_kind:"observation", rainfall_start_pst:new Date(now-1.5*hour).toISOString(), rainfall_end_pst:new Date(now-.5*hour).toISOString(), hour_pst:new Date(now-1.5*hour).toISOString(), rainfall_in:.5 },
  ];
  const enriched = withPointRain(site,{[local]:point(33,-117),[inland]:point(33,-116.95)},now,observations);
  const horizon = runoffHorizon(enriched,now);
  assert.equal(horizon.localCurrent,enriched.coastal.total);
  assert.equal(horizon.inlandCurrent,enriched.inlandRain.total);
  assert.equal(horizon.localCurrent,.5);
});
