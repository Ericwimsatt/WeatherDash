import assert from "node:assert/strict";
import test from "node:test";
import sites from "../data/sites.json" with { type:"json" };
import { normalizeCounty, pacificTime } from "./county.mjs";
import { summarizeRain, checkedRain } from "./water.mjs";
import { assemble } from "./index.mjs";

const now = "2026-11-23T04:00:00Z";
const regional = {advisory:"active",issuedAt:"2026-11-20T01:00:00Z",estimatedLiftAt:"2026-11-23T01:00:00Z"};
const county = {pins:sites.map(site => [site.countyId,1]), observedAt:"2026-11-22T23:00:00Z", advisoryCount:60, notices:[]};

test("County hold survives an elapsed estimate and incomplete notices", () => {
  assert.equal(normalizeCounty(county,{regionalRain:regional},now).regionalRain.advisory,"active");
  assert.equal(normalizeCounty({...county,advisoryCount:0},{regionalRain:regional},now).regionalRain.advisory,"clear");
  assert.throws(() => normalizeCounty({...county,pins:county.pins.slice(1)},{},now));
  assert.throws(() => normalizeCounty({...county,observedAt:"2026-11-01T00:00:00Z"},{postings:{one:{observedAt:county.observedAt}}},now));
});

test("County estimated lift and samples are interpreted as Pacific time", () => {
  const notice = {description:"GENERAL RAIN ADVISORY. The anticipated lift date, subject to change: November 22, 2026 ~ 5:00 PM.",issuedAt:regional.issuedAt};
  assert.equal(normalizeCounty({...county,notices:[notice]},{},now).regionalRain.estimatedLiftAt,"2026-11-23T01:00:00.000Z");
  assert.equal(pacificTime("2026-07-15","08:30"),"2026-07-15T15:30:00.000Z");
});

test("overlapping measured rain counts once and missing intervals stay unknown", () => {
  const timestamp = "2026-11-23T03:00:00Z";
  const rain = checkedRain([{properties:{timestamp,
    precipitationLastHour:{unitCode:"wmoUnit:mm",value:5.08,qualityControl:"C"},
    precipitationLast3Hours:{unitCode:"wmoUnit:mm",value:5.08,qualityControl:"C"},
    precipitationLast6Hours:{unitCode:"wmoUnit:mm",value:null,qualityControl:"Z"},
  }}],Date.parse(now));
  const summary = summarizeRain(rain,now,Date.parse(now));
  assert.equal(summary.lowerBound,.2);
  assert.equal(summary.qualifying,true);
  assert.equal(summary.complete,false);
});

test("a failed gauge does not inherit another gauge’s verification time", () => {
  const sampleSite = {...sites[0],history:[],rain:{complete:false}};
  const records = {
    bootstrap:{at:now,value:{sites:[sampleSite],rainSeries:{},generatedAt:now}},
    rain:{at:now,value:{[sampleSite.rainGauge]:{intervals:[],verifiedAt:"2026-11-22T22:00:00Z"}}},
  };
  assert.equal(assemble(records,Date.parse(now)).sites[0].rain.verifiedAt,"2026-11-22T22:00:00Z");
});
