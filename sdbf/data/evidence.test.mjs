import test from "node:test";
import assert from "node:assert/strict";
import { assess, assessCoast } from "./rating.mjs";
import { bacteriaExplanation, contributionClass, evidenceLimitations, mapCauses, rainDrivesScore, sampleSummary } from "../src/evidence.js";

const now = Date.parse("2026-11-24T20:00:00Z");
const verifiedAt = new Date(now).toISOString();
const sample = { parameter:"Enterococcus", method:"ddPCR", units:"Copies/100ml", qualifier:"=", value:100, collectedAt:verifiedAt };
const base = { id:1, area:"North County", sample, history:[], posting:{status:"open", verifiedAt},
  regionalEstimate:{total:0,verifiedAt}, coastal:{total:0, verifiedAt}, inlandRain:{total:0, verifiedAt} };
function assessed(changes = {}, regionalChanges = {}) {
  const site = {...base, ...changes};
  const result = assessCoast([site], {regionalRain:{advisory:"clear", verifiedAt, ...regionalChanges}}, now).results[0];
  site.regionalEstimate = result.regionalEstimate;
  site.rating = result.water;
  return site;
}

test("factor colors use contributed points at the two- and four-point boundaries", () => {
  assert.deepEqual([0,1,2,3,4,9].map(contributionClass),
    [undefined,undefined,"factor-caution","factor-caution","hazard","hazard"]);
  const site={...base,regionalRain:{advisory:"clear",verifiedAt},regionalEstimate:{total:.75,verifiedAt}};
  const rating=assess(site,now);
  const factor=mapCauses({...site,rating},now).find(factor => factor.field === "regional");
  assert.equal(rating.score,4);
  assert.equal(factor.score,4);
  assert.equal(factor.contribution,3);
  assert.equal(contributionClass(factor.contribution),"factor-caution");
});

test("contributions honor caps and competing base and County factors", () => {
  const regionalRain={advisory:"clear",verifiedAt};
  const rated=changes => assess({...base,regionalRain,regionalEstimate:{total:.75},...changes},now);
  const wet={coastal:{total:.35,verifiedAt}};
  assert.equal(rated(wet).signals.find(signal => signal.field === "regional").contribution,0);
  const capped=rated({...wet,posting:{status:"closure",verifiedAt}});
  assert.equal(capped.score,10);
  assert.equal(capped.signals.find(signal => signal.field === "regional").contribution,0);
  assert.equal(capped.signals.find(signal => signal.field === "local").contribution,0);
  assert.equal(capped.signals.find(signal => signal.field === "county").contribution,4);
  const overlapping=assess({...base,regionalRain,posting:{status:"warning",verifiedAt},
    nearbyAdvisory:{penalty:6,reason:"Nearby notice"}},now);
  assert.equal(overlapping.signals.find(signal => signal.field === "county").contribution,2);
  assert.equal(overlapping.signals.find(signal => signal.field === "nearbyCounty").contribution,0);
  const spill=assess({...base,regionalRain,runoff:{hazard:"Verified spill"}},now);
  assert.equal(spill.signals[0].contribution,9);
});

test("rain moves ahead of evidence only when it reaches the displayed score", () => {
  assert.equal(rainDrivesScore(assessed()), false);
  assert.equal(rainDrivesScore(assessed({coastal:{total:.35, verifiedAt}})), true);
  assert.equal(rainDrivesScore(assessed({inlandRain:{total:1, verifiedAt}})), true);
  assert.equal(rainDrivesScore(assessed({coastal:{total:.12, verifiedAt}, sample:{...sample, value:1100}})), false);
  assert.equal(rainDrivesScore(assessed({coastal:{total:.5, verifiedAt}, posting:{status:"advisory", verifiedAt}})), false);
  assert.equal(rainDrivesScore(assessed({runoff:{hazard:"Verified spill"}, coastal:{total:.5, verifiedAt}})), false);
  assert.equal(rainDrivesScore(assessed({}, {advisory:"active"})), true);
  assert.equal(rainDrivesScore(assessed({coastal:{total:.12, verifiedAt}}, {advisory:"active"})), true);
  assert.equal(rainDrivesScore(assessed({posting:{status:"rain advisory", verifiedAt}})), true);
});

test("sample summaries respect test method and reported bounds", () => {
  assert.equal(sampleSummary(sample), "Below Safe Levels");
  assert.equal(sampleSummary({...sample, value:1413}), "Above Safe Levels");
  assert.equal(sampleSummary({...sample, value:195, qualifier:"<", method:"MF", units:"CFU/100ml"}), "Safe Level Unknown");
  assert.equal(sampleSummary(null), "Unavailable");
});

test("limitations omit old sample explanations and retain unavailable rain", () => {
  assert.deepEqual(evidenceLimitations(base, now), []);
  assert.deepEqual(evidenceLimitations({...base, sample:{...sample, collectedAt:"2026-10-19T20:00:00Z"}, coastal:null, inlandRain:null,regionalEstimate:null}, now),
    ["Recent local and regional rain data are unavailable."]);
  assert.deepEqual(mapCauses(assessed(), now), []);
});

test("bacteria warning explains the historical result that caused it, not a newer low test", () => {
  const older = {...sample, value:2826, collectedAt:"2026-11-23T20:00:00Z"};
  const site = assessed({history:[older]});
  const factor = mapCauses(site,now).find(factor => factor.field === "bacteria");
  assert.match(factor.why,/2,826\/100ml/);
  assert.match(factor.why,/Nov 23, 12:00 PM Pacific \(1 day ago\)/);
  assert.match(factor.why,/Safe limit is 1,413\/100ml/);
});

test("bacteria explainers use method-specific thresholds and preserve reported bounds", () => {
  const culture = {...sample, method:"MF", units:"CFU/100ml", value:195, qualifier:"<"};
  assert.match(bacteriaExplanation(culture,now),/<195\/100ml/);
  assert.match(bacteriaExplanation(culture,now),/Safe limit is 104\/100ml/);
  assert.equal(sampleSummary(culture),"Safe Level Unknown");
  assert.equal(bacteriaExplanation({...sample,value:400},now,false),"Enterococcus: 400/100ml. Safe limit is 1,413/100ml.");
  assert.match(bacteriaExplanation({...sample,method:"unknown"},now),/Safe limit unavailable/);
  assert.match(bacteriaExplanation(null,now),/Bacteria reading unavailable/);
});

test("duplicate uncertainty messages collapse without hiding a known spill", () => {
  const site = assessed({posting:{status:"unknown"}, runoff:{hazard:"Verified spill"}}, {advisory:"unknown"});
  const factors = mapCauses(site, now);
  assert.equal(factors.filter(factor => factor.text === "Current water conditions could not be confirmed.").length, 1);
  assert.ok(factors.some(factor => factor.text === "Verified spill"));
});
