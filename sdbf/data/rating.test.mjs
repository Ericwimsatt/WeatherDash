import test from "node:test";
import assert from "node:assert/strict";
import { assess, assessCoast, sampleEvidence, scoreLabel, scoreColors } from "./rating.mjs";
const now = Date.parse("2026-11-22T20:00:00Z");
const before = hours => new Date(now-hours*3600000).toISOString();
const regionalRain = { advisory:"clear", verifiedAt:before(1) };
const low = { parameter:"Enterococcus", method:"ddPCR", units:"Copies/100ml", qualifier:"=", value:100, collectedAt:before(24) };
const base = { id:1, area:"North County", posting:{status:"open",verifiedAt:before(1)}, sample:low, regionalRain,
  rain:{complete:true,lowerBound:0,verifiedAt:before(1)},
  inlandRain:{complete:true,total:0,verifiedAt:before(1)},
};
const score = changes => assess({...base,...changes},now).score;

test("lowest score requires current County and rain evidence without active risk indicators", () => {
  assert.equal(score({}),1);
  assert.equal(score({rain:{complete:false},coastal:{complete:true,total:0,verifiedAt:before(1)}}),1);
  assert.equal(score({sample:{...low,collectedAt:before(72)}}),1);
  assert.equal(score({sample:null,inlandRain:null}),5);
});

test("County and confirmed runoff hazards impose a floor even with low bacteria", () => {
  assert.equal(score({posting:{status:"closure",verifiedAt:before(48)}}),10);
  assert.equal(score({posting:{status:"advisory",verifiedAt:before(1)}}),9);
  assert.equal(score({runoff:{hazard:"Verified spill"}}),10);
});

test("a local rain hold affects its region and an official advisory applies coastwide", () => {
  const central = {...base,id:2,area:"Central Coast"};
  const rain = {...base.rain,qualifying:true,endedAt:before(72),lowerBound:.2};
  const north = {...base,id:3,rain};
  const sites = [base,central,north];
  const regional = assessCoast(sites,{regionalRain},now);
  assert.equal(regional.coastRainHold,null);
  assert.deepEqual(regional.regionsOnRainHold,["North County"]);
  assert.deepEqual(regional.results.map(x=>x.water.score),[7,1,7]);
  const official = assessCoast(sites,{regionalRain:{advisory:"active",estimatedLiftAt:before(24)}},now);
  assert.equal(official.coastRainHold,"Countywide rain advisory");
  assert.deepEqual(official.results.map(x=>x.water.score),[7,7,7]);
  const modeled = {...central,coastal:{qualifying:true,endedAt:before(4),total:.3,verifiedAt:before(1)}};
  assert.deepEqual(assessCoast([base,modeled],{regionalRain},now).results.map(x=>x.water.score),[1,7]);
  const expired = {...north,rain:{...rain,endedAt:before(73),lowerBound:0}};
  assert.deepEqual(assessCoast([base,expired],{regionalRain},now).results.map(x=>x.water.score),[1,1]);
});

test("bacteria, inland rain, and sample age matter without an advisory", () => {
  assert.equal(score({sample:{...low,value:1500}}),9);
  assert.equal(score({sample:{...low,value:3000}}),10);
  assert.equal(score({sample:{...low,value:1500,collectedAt:before(110)}}),6);
  assert.equal(score({inlandRain:{complete:true,total:1.3,verifiedAt:before(1)}}),8);
  assert.equal(score({posting:{...base.posting,lastHazardEnded:before(3)}}),1);
});

test("unit-specific thresholds, censored results, and ten distinct colors", () => {
  assert.equal(sampleEvidence({...low,units:"MPN/100ml"}),null);
  assert.equal(sampleEvidence({...low,qualifier:"<",value:1413}).below,true);
  assert.equal(sampleEvidence({...low,qualifier:"<",value:1500}).below,false);
  assert.equal(new Set(scoreColors).size,10);
  assert.match(scoreLabel(5),/Sensitive/);
  assert.match(scoreLabel(10),/Dangerous/);
});

test("mapped outfall proximity never changes the score and inland rain affects every beach", () => {
  const inlandRain = {complete:true,total:2.24,verifiedAt:before(1)};
  const near = assess({...base,outfall:{meters:2},inlandRain},now);
  const far = assess({...base,outfall:{meters:980},inlandRain},now);
  const unmapped = assess({...base,inlandRain},now);
  assert.deepEqual(near,far);
  assert.deepEqual(near,unmapped);
  assert.equal(near.score,8);
  assert.equal(near.signals[0].amount,2.24);
  assert.equal(assess({...base,outfall:{meters:2}},now).score,1);
});

test("off-point inland gauges cannot override the three-mile rainfall", () => {
  assert.equal(assess({...base,inlandGaugeRain:{complete:true,lowerBound:4,verifiedAt:before(1)}},now).score,1);
});


test("lab history leaves an otherwise clear beach at 1, with a floor of 6 for a stale exceedance", () => {
  const oldExceedance = {...low,value:3000,collectedAt:before(400)};
  assert.equal(score({sample:{...low,value:1000}}),1);
  assert.equal(score({sample:{...low,collectedAt:before(400)}}),1);
  assert.equal(score({sample:null}),1);
  assert.equal(score({sample:oldExceedance}),6);
  assert.equal(score({sample:oldExceedance,inlandRain:{...base.inlandRain,total:1.25}}),8);
  assert.equal(score({sample:oldExceedance,inlandRain:{...base.inlandRain,total:.9}}),6);
  assert.equal(score({sample:oldExceedance,posting:{status:"closure",verifiedAt:before(1)}}),10);
  assert.equal(score({sample:{...oldExceedance,collectedAt:before(71)}}),10);
  assert.equal(assess({...base,sample:null},now).notes.length,1);
});


test("rain-only scores rise above a breached runoff limit and cap at eight", () => {
  const local = lowerBound => ({...base.rain,lowerBound});
  const inland = total => ({...base.inlandRain,total});
  assert.deepEqual([.19,.20,.35,.50,4].map(amount => score({rain:local(amount)})),[4,6,7,8,8]);
  assert.deepEqual([.74,.75,1,1.25,4].map(amount => score({inlandRain:inland(amount)})),[4,6,7,8,8]);
  const wet={...base, rain:{...local(1),qualifying:true,endedAt:before(2)}, inlandRain:inland(2)};
  assert.deepEqual(assessCoast([wet,{...base,id:2}],{regionalRain},now).results.map(site=>site.water.score),[8,7]);
  assert.equal(score({posting:{status:"rain advisory",verifiedAt:before(1)}}),7);
  assert.equal(score({posting:{status:"warning",verifiedAt:before(1)},rain:local(4)}),10);
});
