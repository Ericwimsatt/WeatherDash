import test from "node:test";
import assert from "node:assert/strict";
import { assess, assessCoast, sampleEvidence, scoreLabel, scoreColors, rainScore, regionalRainPoints, nearbyAdvisoryWeight } from "./rating.mjs";
const now = Date.parse("2026-11-22T20:00:00Z");
const before = hours => new Date(now-hours*3600000).toISOString();
const regionalRain = { advisory:"clear", verifiedAt:before(1) };
const low = { parameter:"Enterococcus", method:"ddPCR", units:"Copies/100ml", qualifier:"=", value:100, collectedAt:before(24) };
const base = { id:1, area:"North County", posting:{status:"open",verifiedAt:before(1)}, sample:low, regionalRain,
  rain:{complete:true,lowerBound:0,verifiedAt:before(1)},
  inlandRain:{complete:true,total:0,verifiedAt:before(1)},
};
const score = changes => assess({...base,...changes},now).score;

const located = (id, miles, changes={}) => ({...base,id,name:`Beach ${id}`,
  lat:33 + miles/3958.7613*180/Math.PI,lon:-117,...changes});
const notice = (status="advisory") => located(10,0,{name:"Moonlight Beach",posting:{status,verifiedAt:before(1)}});
const coast = sites => assessCoast(sites,{regionalRain},now).results.map(result=>result.water);

test("nearby County penalties use inclusive two- and four-mile bands", () => {
  for (const [distance,weight] of [[0,.7],[1,.7],[2,.7],[2.00001,.25],[4,.25],[4.00001,0],[6,0],[7,0],[NaN,0]])
    assert.equal(nearbyAdvisoryWeight(distance),weight);
  const ratings = coast([notice(),... [1,3,5,6,7].map((miles,index)=>located(index+20,miles))]);
  assert.deepEqual(ratings.map(rating=>rating.score),[7,5,3,1,1,1]);
  assert.equal(ratings[0].signals.some(signal=>signal.field==="nearbyCounty"),false);
  assert.equal(ratings[1].color,scoreColors[4]);
  assert.equal(ratings[1].signals[0].sourceName,"Moonlight Beach");
  assert.equal(ratings[1].signals[0].weight,.7);
});

test("nearby warnings and closures never reduce a stronger local hazard or stack", () => {
  for (const status of ["warning","closure"]) {
    assert.deepEqual(coast([notice(status),located(20,1),located(21,3)]).map(r=>r.score),status === "warning" ? [9,7,3] : [10,8,4]);
  }
  const sources = [notice(),located(11,1,{posting:{status:"closure",verifiedAt:before(1)}})];
  const target = located(20,1.5);
  const rating = coast([...sources,target]).at(-1);
  assert.equal(rating.score,8);
  assert.equal(rating.signals.filter(signal=>signal.field==="nearbyCounty").length,1);
  assert.equal(rating.signals[0].sourceId,11);
  assert.equal(coast([notice(),located(20,1,{runoff:{hazard:"Verified spill"}})])[1].score,10);
  const wet = located(20,1,{rain:{...base.rain,lowerBound:.35}});
  assert.equal(coast([notice(),wet])[1].score,10);
});

test("only direct local notices spread, including retained restrictions until cleared", () => {
  for (const status of ["open","unknown","rain advisory"]) {
    assert.equal(coast([notice(status),located(20,1)])[1].score,1);
  }
  const stale = {...notice(),posting:{status:"advisory",verifiedAt:before(48)}};
  assert.equal(coast([stale,located(20,1)])[1].score,5);
  assert.deepEqual(coast([notice(),located(20,3),located(21,5)]).map(r=>r.score),[7,3,1]);
  assert.equal(coast([notice(),base])[1].score,1);
  const crossRegion = located(20,1,{area:"Central Coast"});
  assert.equal(coast([notice(),crossRegion])[1].score,5);
});

test("nearby advisory labels and explanations name the source beach", async () => {
  const { mapCauses, scoreFactors } = await import("../src/evidence.js");
  const site = located(20,3);
  site.rating = coast([notice(),site])[1];
  for (const factors of [mapCauses(site,now),scoreFactors(site,now)]) {
    assert.equal(factors[0].text,"San Diego county issued an advisory for Moonlight Beach nearby");
    assert.match(factors[0].why,/3.0 miles/);
    assert.match(factors[0].why,/25%/);
    assert.match(factors[0].href,/sdbeachinfo/);
  }
});

test("lowest score requires current County evidence without active risk indicators", () => {
  assert.equal(score({}),1);
  assert.equal(score({rain:{complete:false},coastal:{complete:true,total:0,verifiedAt:before(1)}}),1);
  assert.equal(score({sample:{...low,collectedAt:before(72)}}),1);
  assert.equal(score({sample:null,rain:null,inlandRain:null}),1);
});

test("County and confirmed runoff hazards impose a floor even with low bacteria", () => {
  assert.equal(score({posting:{status:"closure",verifiedAt:before(48)}}),10);
  assert.equal(score({posting:{status:"advisory",verifiedAt:before(1)}}),7);
  assert.equal(score({runoff:{hazard:"Verified spill"}}),10);
});

test("regional rainfall adds points only at or above 0.12 inches", () => {
  const central = {...base,id:2,area:"Central Coast"};
  const north = {...base,id:3,coastal:{total:.35,verifiedAt:before(1)}};
  const sites = [base,central,north];
  const regional = assessCoast(sites,{regionalRain},now);
  assert.equal(regional.coastRainHold,null);
  assert.deepEqual(regional.regionalRainfall,[["North County",3]]);
  assert.deepEqual(regional.results.map(x=>x.water.score),[4,1,8]);
  assert.equal(regional.results[0].water.signals[0].reason,"Regional rainfall · +3");
  assert.equal(regional.results[2].water.signals.at(-1).reason,"Regional rainfall · +2");
  for (const [total,points] of [[.04,0],[.05,0],[.119,0],[.12,2],[.20,2],[.35,3]]) {
    const modeled = {...central,coastal:{total,verifiedAt:before(1)}};
    const neighbor = {...central,id:4};
    assert.equal(assessCoast([base,modeled,neighbor],{regionalRain},now).results[2].water.score,1+points);
  }
  const stale = {...north,coastal:{...north.coastal,verifiedAt:before(4)}};
  assert.deepEqual(assessCoast([base,stale],{regionalRain},now).results.map(x=>x.water.score),[1,1]);
  const official = assessCoast(sites,{regionalRain:{advisory:"active",estimatedLiftAt:before(24)}},now);
  assert.equal(official.coastRainHold,"Countywide rain advisory");
  assert.deepEqual(official.results.map(x=>x.water.score),[8,7,8]);
});

test("bacteria, inland rain, and sample age matter without an advisory", () => {
  assert.equal(score({sample:{...low,value:1500}}),9);
  assert.equal(score({sample:{...low,value:3000}}),10);
  assert.equal(score({sample:{...low,value:1500,collectedAt:before(110)}}),6);
  assert.equal(score({inlandRain:{complete:true,total:1.3,verifiedAt:before(1)}}),6);
  assert.equal(score({posting:{...base.posting,lastHazardEnded:before(3)}}),1);
});

test("unit-specific thresholds, censored results, and ten distinct colors", () => {
  assert.equal(sampleEvidence({...low,units:"MPN/100ml"}),null);
  assert.equal(sampleEvidence({...low,qualifier:"<",value:1413}).below,true);
  assert.equal(sampleEvidence({...low,qualifier:"<",value:1500}).below,false);
  assert.equal(new Set(scoreColors).size,10);
  assert.match(scoreLabel(5),/Sensitive/);
  assert.match(scoreLabel(10),/Extremely high risk/);
});

test("mapped outfall proximity never changes the score and inland rain affects every beach", () => {
  const inlandRain = {complete:true,total:2.24,verifiedAt:before(1)};
  const near = assess({...base,outfall:{meters:2},inlandRain},now);
  const far = assess({...base,outfall:{meters:980},inlandRain},now);
  const unmapped = assess({...base,inlandRain},now);
  assert.deepEqual(near,far);
  assert.deepEqual(near,unmapped);
  assert.equal(near.score,6);
  assert.equal(near.signals[0].amount,2.24);
  assert.equal(assess({...base,outfall:{meters:2}},now).score,1);
});

test("off-point inland gauges cannot override the three-mile rainfall", () => {
  assert.equal(assess({...base,inlandGaugeRain:{complete:true,lowerBound:4,verifiedAt:before(1)}},now).score,1);
});


test("lab history leaves an otherwise clear beach at 1, with a floor of 6 for a stale exceedance", () => {
  const oldExceedance = {...low,value:3000,collectedAt:before(400)};
  assert.equal(score({sample:{...low,value:1000}}),4);
  assert.equal(score({sample:{...low,collectedAt:before(400)}}),1);
  assert.equal(score({sample:null}),1);
  assert.equal(score({sample:oldExceedance}),6);
  assert.equal(score({sample:oldExceedance,inlandRain:{...base.inlandRain,total:1.25}}),6);
  assert.equal(score({sample:oldExceedance,inlandRain:{...base.inlandRain,total:.9}}),6);
  assert.equal(score({sample:oldExceedance,posting:{status:"closure",verifiedAt:before(1)}}),10);
  assert.equal(score({sample:{...oldExceedance,collectedAt:before(71)}}),10);
  assert.equal(assess({...base,sample:null},now).notes.length,1);
});


test("rain-only scores rise above a breached runoff limit and cap at eight", () => {
  const local = lowerBound => ({...base.rain,lowerBound});
  const inland = total => ({...base.inlandRain,total});
  assert.deepEqual([.19,.20,.35,.50,4].map(amount => score({rain:local(amount)})),[2,4,6,8,8]);
  assert.deepEqual([.74,.75,1,1.25,4].map(amount => score({inlandRain:inland(amount)})),[3,4,5,6,6]);
  const wet={...base, rain:{...local(1),qualifying:true,endedAt:before(2)}, inlandRain:inland(2)};
  assert.deepEqual(assessCoast([wet,{...base,id:2}],{regionalRain},now).results.map(site=>site.water.score),[8,4]);
  const closed = {...base,id:2,posting:{status:"closure",verifiedAt:before(1)}};
  assert.equal(assessCoast([wet,closed],{regionalRain},now).results[1].water.score,10);
  assert.equal(score({posting:{status:"rain advisory",verifiedAt:before(1)}}),7);
  assert.equal(score({posting:{status:"warning",verifiedAt:before(1)},rain:local(4)}),10);
});


test("available rainfall amounts set the score", () => {
  const local = {...base.rain,complete:false,lowerBound:0};
  const inland = {...base.inlandRain,complete:false,total:.04};
  const lowRain = assess({...base,rain:local,inlandRain:inland},now);
  assert.equal(lowRain.score,1);
  assert.deepEqual(lowRain.gaps,[]);
  assert.equal(score({rain:{...local,lowerBound:.22},inlandRain:inland}),4);
  assert.equal(score({rain:local,inlandRain:{...inland,total:1.30}}),6);
  assert.equal(score({rain:null,inlandRain:null,posting:null}),5);
});


test("four-day bacteria readings use method-specific caution levels", () => {
  for (const [ratio, expected] of [[0,1],[.099,1],[.1,2],[.249,2],[.25,3],[.399,3],[.4,4],[.5,4],[.749,4],[.75,5],[.999,5],[1,9],[2,10]]) {
    for (const [method,units,limit] of [["ddPCR","Copies/100ml",1413],["Enterolert","MPN/100ml",104],["MF","CFU/100ml",104]]) {
      assert.equal(score({sample:{...low,method,units,value:ratio*limit,collectedAt:before(96)}}),expected);
    }
  }
  const elevated = {...low,value:1413/2,collectedAt:before(90)};
  const result = assess({...base,history:[elevated]},now);
  assert.equal(result.score,4);
  assert.equal(result.label,"Sensitive groups should use caution");
  assert.equal(result.signals[0].reason,"Bacteria levels higher than normal");
  assert.equal(result.signals[0].collectedAt,elevated.collectedAt);
  assert.equal(score({history:[{...elevated,collectedAt:before(96.01)}]}),1);
  assert.equal(score({history:[{...elevated,collectedAt:before(-1)}]}),1);
  assert.equal(score({history:[{...elevated,units:"MPN/100ml"}]}),1);
  assert.equal(score({history:[{...elevated,value:1500}]}),9);
  assert.equal(score({history:[{...elevated,value:1500,collectedAt:before(97)}]}),1);
  assert.equal(score({sample:{...elevated,qualifier:"<"}}),1);
  assert.equal(score({sample:{...elevated,qualifier:"<="}}),1);
  assert.equal(score({sample:{...elevated,qualifier:">"}}),4);
  assert.equal(score({sample:{...elevated,qualifier:">="}}),4);
  assert.equal(score({history:[elevated],posting:{status:"closure",verifiedAt:before(1)}}),10);
});

test("caution factors retain the bacteria reading and plain-language explanation", async () => {
  const { mapCauses } = await import("../src/evidence.js");
  const site = {...base,history:[{...low,value:800,collectedAt:before(80)}]};
  site.rating = assess(site,now);
  const [factor] = mapCauses(site,now);
  assert.equal(factor.text,"Bacteria levels higher than normal");
  assert.match(factor.why,/3 days ago/);
  assert.match(factor.why,/57%/);
  assert.match(factor.why,/sensitive groups should use caution/);
});


test("Imperial Beach Pier reading near half the limit scores four", () => {
  const result = assess({...base,sample:{...low,value:703}},now);
  assert.equal(result.score,4);
  assert.equal(result.label,"Sensitive groups should use caution");
  assert.equal(result.signals[0].field,"bacteria");
});


test("rain outlook and current ratings agree across all revised rain bands", () => {
  for (const local of [0,.029,.03,.12,.199,.2,.349,.35,.499,.5]) {
    for (const inland of [0,.349,.35,.749,.75,.999,1,1.249,1.25]) {
      for (const regional of [0,.119,.12,.349,.35]) {
        const rating = assess({...base,rain:{...base.rain,lowerBound:local},inlandRain:{...base.inlandRain,total:inland}},now,regionalRainPoints(regional),regional);
        assert.equal(rainScore(local,inland,regional),rating.score);
      }
    }
  }
});


test("direct County notices add the requested points after other scoring, capped at ten", () => {
  for (const [status,penalty] of [["advisory",6],["warning",8],["closure",10]]) {
    const posting = {status,verifiedAt:before(1)};
    assert.equal(score({posting}),Math.min(10,1+penalty));
    assert.equal(score({posting,sample:{...low,value:1413*.25}}),Math.min(10,3+penalty));
    const rated = assess({...base,posting},now,2,.12);
    assert.equal(rated.score,Math.min(10,3+penalty));
    assert.equal(rated.signals.find(signal=>signal.field==="county").penalty,penalty);
  }
  const target = located(20,1,{posting:{status:"advisory",verifiedAt:before(1)}});
  assert.equal(coast([notice("closure"),target])[1].score,8);
});
