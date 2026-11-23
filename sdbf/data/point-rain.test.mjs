import assert from "node:assert/strict";
import test from "node:test";
import sites from "./sites.json" with {type:"json"};
import {hour,pointIds,pointLocations,pointTotal,withPointRain} from "./point-rain.mjs";

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


test("all beaches have their own rain point about three miles east", () => {
  const points = pointLocations(sites);
  assert.equal(new Set(points.map(point => point.id)).size,2*sites.length);
  for (const site of sites) {
    const point = points.find(item => item.id===pointIds(site)[1]);
    const east = point.lon-site.lon;
    const halfAngle = east*Math.PI/360;
    const miles = 2*3958.76*Math.asin(Math.cos(site.lat*Math.PI/180)*Math.sin(halfAngle));
    assert.equal(point.lat,site.lat);
    assert.ok(miles>=2.99 && miles<=3.01, site.name);
  }
});

test("inland rainfall tapers with distance and errs toward the higher nearby reading", () => {
  const now=Date.parse("2026-11-22T20:30:00Z");
  const start=Math.floor(now/hour)*hour-97*hour;
  const [moonlight,cardiff] = sites.filter(site => /Moonlight|Cardiff/.test(site.name));
  const inlandPoint = (site,rain) => {
    const point = pointLocations([site])[1];
    const values = Array(104).fill(0);
    values[30] = rain;
    return {...point,start,values,verifiedAt:new Date(now).toISOString()};
  };
  const moonlightPoint = inlandPoint(moonlight,1.87);
  const cardiffPoint = inlandPoint(cardiff,.02);
  const far = inlandPoint(sites[0],4);
  const points = {[moonlightPoint.id]:moonlightPoint,[cardiffPoint.id]:cardiffPoint,[far.id]:far};
  const cardiffEstimate = withPointRain(cardiff,points,now);
  // Cardiff sits ~3 mi from Moonlight, so it inherits most of Moonlight's 1.87″.
  assert.ok(cardiffEstimate.inlandRain.total > 1.7 && cardiffEstimate.inlandRain.total < 1.87);
  // Moonlight keeps its own reading and is only nudged up by the farther 4″ point.
  assert.ok(withPointRain(moonlight,points,now).inlandRain.total > 1.87 && withPointRain(moonlight,points,now).inlandRain.total < 4);
  // The far point's own reading stays intact.
  assert.equal(withPointRain(sites[0],points,now).inlandRain.total,4);
  assert.equal(pointTotal(cardiffEstimate.inlandPoint,now-96*hour,now).total,cardiffEstimate.inlandRain.total);
  assert.equal(cardiffPoint.values[30],.02);
});

test("heavy inland rain reaches La Jolla Shores and Oceanside with a gradient", () => {
  const now=Date.parse("2026-11-22T20:30:00Z");
  const start=Math.floor(now/hour)*hour-97*hour;
  const [moonlight,laJolla,oceanside] = ["Moonlight Beach","La Jolla Shores","Oceanside Pier"]
    .map(name => sites.find(site => site.name === name));
  const inlandPoint = (site,rain) => {
    const point = pointLocations([site])[1];
    const values = Array(104).fill(0);
    values[30] = rain;
    return {...point,start,values,verifiedAt:new Date(now).toISOString()};
  };
  const moonlightPoint = inlandPoint(moonlight,1.4);
  const laJollaPoint = inlandPoint(laJolla,0);
  const oceansidePoint = inlandPoint(oceanside,0);
  const points = {[moonlightPoint.id]:moonlightPoint,[laJollaPoint.id]:laJollaPoint,[oceansidePoint.id]:oceansidePoint};
  const laJollaRain = withPointRain(laJolla,points,now).inlandRain.total;
  const oceansideRain = withPointRain(oceanside,points,now).inlandRain.total;
  // Moonlight's own reading is untouched.
  assert.equal(withPointRain(moonlight,points,now).inlandRain.total,1.4);
  // Both distant beaches see the rain, and the closer one (Oceanside) gets more.
  assert.ok(laJollaRain > .5 && laJollaRain < .6);
  assert.ok(oceansideRain > .7 && oceansideRain < .8);
  assert.ok(oceansideRain > laJollaRain);
});

test("nearby rainfall can fill a missing inland hour but cannot use an elapsed forecast", () => {
  const now=Date.parse("2026-11-22T20:30:00Z");
  const start=Math.floor(now/hour)*hour-97*hour;
  const [moonlight,cardiff] = sites.filter(site => /Moonlight|Cardiff/.test(site.name));
  const [moonPoint,cardPoint] = pointLocations([moonlight,cardiff]).filter(point => point.id.startsWith("inland"));
  const moonValues = Array(104).fill(0);
  moonValues[30] = .5;
  moonValues[97] = 9;
  moonValues[98] = .1;
  const cardValues = Array(104).fill(0);
  cardValues[30] = null;
  const input = {
    [moonPoint.id]:{...moonPoint,start,values:moonValues,verifiedAt:new Date(now-hour).toISOString()},
    [cardPoint.id]:{...cardPoint,start,values:cardValues,verifiedAt:new Date(now).toISOString()},
  };
  const {inlandPoint,inlandRain} = withPointRain(cardiff,input,now);
  assert.equal(inlandRain.total,.5);
  assert.equal(inlandPoint.values[97],0);
  assert.ok(inlandPoint.values[98] > 0);
});
