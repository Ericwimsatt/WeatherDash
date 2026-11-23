import test from "node:test";
import assert from "node:assert/strict";
import { assess, assessCoast, sampleEvidence, scoreLabel, scoreColors } from "./rating.mjs";
const now = Date.parse("2026-11-22T20:00:00Z");
const before = hours => new Date(now-hours*3600000).toISOString();
const regionalRain = { advisory:"clear", verifiedAt:before(1) };
const low = { parameter:"Enterococcus", method:"ddPCR", units:"Copies/100ml", qualifier:"=", value:100, collectedAt:before(24) };
const base = { id:1, posting:{status:"open",verifiedAt:before(1)}, sample:low, regionalRain,
  rain:{complete:true,lowerBound:0,verifiedAt:before(1)},
  inlandRain:{complete:true,total:0,verifiedAt:before(1)},
};
const score = changes => assess({...base,...changes},now).score;

test("lowest score requires verified low results and full local and inland rain evidence", () => {
  assert.equal(score({}),1);
  assert.equal(score({rain:{complete:false},coastal:{complete:true,total:0,verifiedAt:before(1)}}),2);
  assert.equal(score({sample:{...low,collectedAt:before(72)}}),5);
  assert.equal(score({sample:null,inlandRain:null}),6);
});

test("County and confirmed runoff hazards impose a floor even with low bacteria", () => {
  assert.equal(score({posting:{status:"closure",verifiedAt:before(48)}}),10);
  assert.equal(score({posting:{status:"advisory",verifiedAt:before(1)}}),9);
  assert.equal(score({runoff:{hazard:"Verified spill"}}),10);
});

test("qualifying rain affects all sites and an official hold persists until a confirmed lift", () => {
  const sites=[base,{...base,id:2,rain:{...base.rain,qualifying:true,endedAt:before(72),lowerBound:.2}}];
  assert.deepEqual(assessCoast(sites,{regionalRain},now).results.map(x => x.water.score),[9,9]);
  assert.equal(assessCoast([base],{regionalRain:{advisory:"active",estimatedLiftAt:before(24)}},now).results[0].water.score,9);
  const estimate={...base,id:3,coastal:{qualifying:true,endedAt:before(4),total:.3,verifiedAt:before(1)}};
  assert.deepEqual(assessCoast([base,estimate],{regionalRain},now).results.map(x=>x.water.score),[8,8]);
});

test("bacteria, inland rain, and sample age matter without an advisory", () => {
  assert.equal(score({sample:{...low,value:1500}}),9);
  assert.equal(score({sample:{...low,value:3000}}),10);
  assert.equal(score({sample:{...low,value:1500,collectedAt:before(110)}}),7);
  assert.equal(score({inlandRain:{complete:true,total:1.3,verifiedAt:before(1)}}),8);
  assert.equal(score({posting:{...base.posting,lastHazardEnded:before(3)}}),5);
});

test("unit-specific thresholds, censored results, and ten distinct colors", () => {
  assert.equal(sampleEvidence({...low,units:"MPN/100ml"}),null);
  assert.equal(sampleEvidence({...low,qualifier:"<",value:1413}).below,true);
  assert.equal(sampleEvidence({...low,qualifier:"<",value:1500}).below,false);
  assert.equal(new Set(scoreColors).size,10);
  assert.match(scoreLabel(5),/Sensitive/);
  assert.match(scoreLabel(10),/Dangerous/);
});

test("score explanation carries the exact rain amount and distinguishes the model from a gauge", () => {
  const result=assess({...base,inlandRain:{complete:true,total:2.24,verifiedAt:before(1)}},now);
  assert.equal(result.score,8);
  assert.equal(result.signals[0].amount,2.24);
  assert.equal(result.signals[0].modeled,true);
  const gauge=assess({...base,inlandGaugeRain:{complete:false,lowerBound:.85,verifiedAt:before(1)}},now);
  assert.equal(gauge.signals[0].amount,.85);
  assert.equal(gauge.signals[0].modeled,false);
});
