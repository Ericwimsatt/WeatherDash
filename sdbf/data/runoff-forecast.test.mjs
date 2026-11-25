import test from "node:test";
import assert from "node:assert/strict";
import { hour, pointIds, withPointRain } from "./point-rain.mjs";
import { regionalRainEstimate } from "./rating.mjs";
import { runoffHorizon, safeEstimate } from "./runoff-forecast.mjs";

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
  assert.equal(horizon.regionalCurrent,regionalRainEstimate(enriched,[enriched],now).total);
  assert.equal(horizon.localCurrent,1.21);
});


test("regional curve averages the coastal maximum and inland rain with matching current values", () => {
  const now = Date.parse("2026-11-22T20:00:00Z");
  const start = now - 120*hour;
  const point = {start, values:Array(400).fill(0), verifiedAt:new Date(now).toISOString()};
  const site = {area:"North", localPoint:point, inlandPoint:point, inlandRain:{total:0,verifiedAt:point.verifiedAt}, coastal:{total:0,verifiedAt:point.verifiedAt}};
  const neighbor = {...site, rain:{lowerBound:.6,verifiedAt:point.verifiedAt}};
  const other = {...site, area:"South", rain:{lowerBound:2,verifiedAt:point.verifiedAt}};
  const horizon = runoffHorizon(site,now,[site,neighbor,other]);
  assert.equal(horizon.regionalCurrent,.3);
  const future = horizon.ends.findIndex(end=>end>now+24*hour);
  assert.ok(Math.abs(horizon.regional[future] - .3*(1-(horizon.ends[future]-now)/(72*hour))) < 1e-9);
  assert.equal(horizon.regional.at(-1),0);
});


test("below-limit bacteria caution does not promise a rain-based safe date", () => {
  const site = {rating:{score:3,signals:[{field:"bacteria",score:3}]}};
  assert.equal(safeEstimate(site,Date.now(),{}),"Safety at this beach will be reassessed when bacteria levels are re-tested.");
});


test("higher below-limit bacteria warns sensitive groups without predicting a safe date", () => {
  const site = {rating:{score:5,signals:[{field:"bacteria",score:5}]}};
  assert.equal(safeEstimate(site,Date.now(),{}),"Safety at this beach will be reassessed when bacteria levels are re-tested.");
});

const outlookNow = Date.parse("2026-11-22T20:00:00Z");
function outlookSite(localRate=0, inlandRate=0) {
  const point = rate => ({start:outlookNow-168*hour, values:Array(600).fill(rate), verifiedAt:new Date(outlookNow).toISOString()});
  return {area:"North", localPoint:point(localRate), inlandPoint:point(inlandRate),
    coastal:{total:72*localRate,verifiedAt:new Date(outlookNow).toISOString()},
    rating:{score:4, signals:[{field:"local",score:4}]}};
}

test("rain outlook uses the revised low-risk bands rather than the runoff limits", () => {
  assert.match(safeEstimate(outlookSite(.001),outlookNow,{}),/risk forecast to be low by/);
  assert.match(safeEstimate(outlookSite(0,.008),outlookNow,{}),/Expect rain-related risk to continue/);
  const site = outlookSite(.0005);
  const neighbor = outlookSite(.01);
  assert.match(safeEstimate(site,outlookNow,{},[site,neighbor]),/Expect rain-related risk to continue/);
  assert.match(safeEstimate(site,outlookNow,{},[site,{...neighbor,area:"South"}]),/risk forecast to be low by/);
});

test("dry forecasts cannot clear spills, bacteria, or missing County evidence", () => {
  for (const field of ["runoff","bacteria","evidence","county"]) {
    const site = {...outlookSite(),rating:{score:6,signals:[{field,score:6}]}};
    assert.equal(safeEstimate(site,outlookNow,{}),null);
  }
  assert.equal(safeEstimate({...outlookSite(),rating:{score:2,signals:[]}},outlookNow,{}),null);
});

test("a County lift estimate is described as an advisory estimate", () => {
  const site = {...outlookSite(),rating:{score:7,signals:[{field:"regional",score:7,reason:"Countywide rain advisory"}]}};
  assert.match(safeEstimate(site,outlookNow,{regionalRain:{advisory:"active",estimatedLiftAt:new Date(outlookNow+24*hour).toISOString()}}),/advisory estimated to lift/);
  assert.match(safeEstimate(site,outlookNow,{}),/county rain advisory is lifted/);
});

test("current local chart marker includes the gauge amount used by the rating", () => {
  const site = {...outlookSite(),rain:{lowerBound:.4,verifiedAt:new Date(outlookNow).toISOString()}};
  assert.equal(runoffHorizon(site,outlookNow).localCurrent,.4);
});
