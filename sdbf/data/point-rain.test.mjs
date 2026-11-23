import assert from "node:assert/strict";
import test from "node:test";
import sites from "./sites.json" with {type:"json"};
import {hour,pointIds,pointTotal,withPointRain} from "./point-rain.mjs";

test("coordinate accumulation uses preceding-hour values and preserves missing data", () => {
  const start=Date.parse("2026-11-21T00:00:00Z");
  const point={start,values:[.95,.11,null,.22,9]};
  assert.deepEqual(pointTotal(point,start,start+3*hour),{
    total:.33,complete:false,hours:2,endedAt:new Date(start+3*hour).toISOString(),
  });
  assert.equal(pointTotal(point,start+hour,start+1.5*hour).total,null);
});

test("recent totals use three coastal days and four inland days, excluding forecast", () => {
  const site=sites[0];
  const [coast, inland]=pointIds(site);
  const now=Date.parse("2026-11-22T20:30:00Z");
  const start=Math.floor(now/hour)*hour-100*hour;
  const values=Array(107).fill(0);
  values[10]=.7; values[89]=.24; values[101]=9;
  const point={start,values,verifiedAt:new Date(now).toISOString()};
  const data=withPointRain(site,{[coast]:point,[inland]:point},now);
  assert.equal(data.coastal.total,.24);
  assert.equal(data.coastal.qualifying,true);
  assert.equal(data.inlandRain.total,.94);
});

test("a stored forecast that has since elapsed stays outside the safety calculation", () => {
  const site=sites[0];
  const [coast]=pointIds(site);
  const now=Date.parse("2026-11-22T20:30:00Z");
  const start=Math.floor(now/hour)*hour-100*hour;
  const values=Array(107).fill(0);
  values[100]=8;
  const point={start,values,verifiedAt:new Date(now-2*hour).toISOString()};
  const data=withPointRain(site,{[coast]:point},now);
  assert.equal(data.coastal.total,0);
  assert.equal(data.coastal.complete,false);
  assert.equal(data.coastal.qualifying,undefined);
});
