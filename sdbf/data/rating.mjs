import { hour,rainLimits } from "./point-rain.mjs";
// Earth & Ember: forest → leaf → golden yellow (4) → orange → brick red.
export const scoreColors = ["#365b32","#5b803b","#97ad50","#e5cc62","#dca94c","#cd873e","#bc6436","#aa4433","#8a302e","#64282b"];

export function scoreLabel(score) {
  if (score <= 2) return "Low risk";
  if (score <= 4) return "Sensitive groups should use caution";
  if (score <= 6) return "Sensitive groups should avoid";
  if (score <= 8) return "Everyone should avoid water contact";
  return "Extremely high risk of infection if you enter the water";
}

function fresh(timestamp, now, hours) {
  const age = now - Date.parse(timestamp);
  return age >= 0 && age <= hours * hour;
}

export function sampleEvidence(sample) {
  if (sample?.parameter !== "Enterococcus" || !Number.isFinite(sample.value) || sample.value < 0)
    return null;

  const method = String(sample.method ?? "").toLowerCase();
  const units = String(sample.units ?? "").toLowerCase().replace(/\s/g, "");
  const threshold = method === "ddpcr" && units === "copies/100ml" ? 1413
    : ((method === "mf" && units === "cfu/100ml") ||
      (["mtf", "mpn", "enterolert"].includes(method) && units === "mpn/100ml")) ? 104
    : null;
  if (threshold === null) return null;

  const above = ["=", ">", ">="].includes(sample.qualifier) && sample.value >= threshold;
  const below = sample.qualifier === "<" && sample.value <= threshold ||
    ["=", "<="].includes(sample.qualifier) && sample.value < threshold;
  return { threshold, above, below, difference: sample.qualifier === "=" ? sample.value - threshold : null };
}

function rainHold(rain, now) {
  return rain?.stormActive || rain?.qualifying &&
    (!Number.isFinite(Date.parse(rain.endedAt)) || fresh(rain.endedAt, now, 72));
}

export function localRainAmount({ rain, coastal }, now) {
  const measured = fresh(rain?.verifiedAt,now,3) || rainHold(rain,now) ? rain?.lowerBound : null;
  const modeled = fresh(coastal?.verifiedAt,now,3) ? coastal.total : null;
  return Math.max(measured ?? 0,modeled ?? 0);
}

// Shared by the current rating, runoff chart guides, and rain outlook.
export const rainBands = {
  local:[{amount:.03,score:2,reason:"Light local rain in the past 72 hours may cause runoff"},
    {amount:rainLimits.local,score:4,reason:"Local rain causing some unsafe runoff"},
    {amount:.35,score:6,reason:"Elevated local rain in the past 72 hours"},
    {amount:.5,score:8,reason:"Heavy local rain in the past 72 hours"}],
  regional:[{amount:.35,score:3,reason:"Recent regional rain"},
    {amount:.75,score:4,reason:"Regional rain may cause unsafe runoff"},
    {amount:1,score:5,reason:"Elevated regional rain may cause unsafe runoff"},
    {amount:1.25,score:6,reason:"Heavy regional rain may cause unsafe runoff"}],
};

export function rainBand(field, amount) {
  return rainBands[field].findLast(band => amount >= band.amount);
}

// The blend retains the longer inland window without counting it separately.
export const averageRain = (inland, coastal) => Number.isFinite(inland) && Number.isFinite(coastal)
  ? (inland + coastal) / 2 : null;

export function regionalRainEstimate(site, sites=[site], now=Date.now()) {
  const inland = site.inlandRain;
  const region = sites.filter(candidate => candidate === site || site.area && candidate.area === site.area);
  const coastal = region.filter(candidate =>
    fresh(candidate.coastal?.verifiedAt,now,3) && Number.isFinite(candidate.coastal?.total) ||
    fresh(candidate.rain?.verifiedAt,now,3) && Number.isFinite(candidate.rain?.lowerBound));
  const coastalTotal = coastal.length ? Math.max(...coastal.map(candidate => localRainAmount(candidate,now))) : null;
  const inlandTotal = fresh(inland?.verifiedAt,now,3) ? inland.total : null;
  const total = averageRain(inlandTotal,coastalTotal);
  const times = [inland?.verifiedAt,...coastal.map(candidate =>
    fresh(candidate.coastal?.verifiedAt,now,3) ? candidate.coastal.verifiedAt : candidate.rain.verifiedAt)]
    .map(Date.parse).filter(Number.isFinite);
  return {total, inlandTotal, coastalTotal,
    verifiedAt:total == null ? null : new Date(Math.min(...times)).toISOString()};
}

export function rainScore(local, regional) {
  return Math.max(1,rainBand("local",local)?.score ?? 0,rainBand("regional",regional)?.score ?? 0);
}

const countyHold = { score:7, reason:"Countywide rain advisory" };
const countyPenalties = { advisory:6, warning:8, closure:10 };

export function nearbyAdvisoryWeight(miles) {
  return miles >= 0 && miles <= 2 ? .7 : miles <= 4 && miles > 2 ? .25 : 0;
}

function distanceMiles(a, b) {
  if (![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite)) return Infinity;
  const radians = degrees => degrees * Math.PI / 180;
  const h = Math.sin(radians(b.lat-a.lat)/2)**2 +
    Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lon-a.lon)/2)**2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1,h)));
}

function nearbyAdvisory(site, sources) {
  let strongest;
  for (const source of sources) {
    if (source.id === site.id) continue;
    const miles = distanceMiles(site,source);
    const weight = nearbyAdvisoryWeight(miles);
    if (!weight) continue;
    // Round the distance-weighted additive penalty to whole points.
    const penalty = Math.round(countyPenalties[source.posting.status]*weight);
    if (!strongest || penalty > strongest.penalty || penalty === strongest.penalty && miles < strongest.miles) {
      strongest = { penalty, miles, weight, sourceId:source.id, sourceName:source.name,
        status:source.posting.status,
        reason:`San Diego county issued an advisory for ${source.name} nearby` };
    }
  }
  return strongest;
}

export function assess(site, now=Date.now()) {
  const { posting, sample, runoff, regionalRain } = site;
  const evidence = sampleEvidence(sample);
  const signals = [];
  const gaps = [];
  const notes = [];
  const add = (score, reason, field, details) => signals.push({score,reason,field,...details});
  if (regionalRain?.advisory === "active") add(countyHold.score,countyHold.reason,"regional");

  const official = countyPenalties[posting?.status];
  const countySignals = [];
  const countyFresh = fresh(posting?.verifiedAt,now,12);
  if (official) countySignals.push({penalty:official,reason:`${countyFresh ? "County" : "Last County posting:"} ${posting.status}`,field:"county"});
  else if (posting?.status === "rain advisory") add(7,`${countyFresh ? "County" : "Last County posting:"} rain advisory`,"county");
  else if (posting?.status !== "open" || !countyFresh) gaps.push("Current County status unverified");
  if (site.nearbyAdvisory) {
    countySignals.push({...site.nearbyAdvisory,field:"nearbyCounty"});
  }
  if (regionalRain?.advisory !== "active" && (regionalRain?.advisory !== "clear" || !fresh(regionalRain?.verifiedAt,now,3)))
    gaps.push("Countywide rain status unverified");

  if (runoff?.hazard) add(10,runoff.hazard,"runoff");

  const localAmount = localRainAmount(site,now);
  const local = rainBand("local",localAmount);
  if (local) add(local.score,local.reason,"local",{amount:localAmount});

  const regionalEstimate = site.regionalEstimate ?? regionalRainEstimate(site,[site],now);
  const regional = rainBand("regional",regionalEstimate.total);
  if (regional) add(regional.score,regional.reason,"regional",{amount:regionalEstimate.total});

  // Compare each result against its own method's limit; raw units cannot be mixed.
  const recent = [sample, ...(site.history ?? [])].flatMap(point => {
    const result = sampleEvidence(point);
    return result && fresh(point.collectedAt,now,96) ? [{ point, result }] : [];
  });
  let bacteriaSignal;
  for (const { point, result } of recent) {
    const ratio = point.value / result.threshold;
    // Upper bounds are not measured concentrations. Lower bounds can establish concern.
    const knownMinimum = ["=", ">", ">="].includes(point.qualifier);
    const score = result.above ? (ratio >= 2 || localAmount >= rainLimits.local ? 10 : 9)
      : knownMinimum && ratio >= .75 ? 5
      : knownMinimum && ratio >= .4 ? 4
      : knownMinimum && ratio >= .25 ? 3
      : knownMinimum && ratio >= .1 ? 2 : 0;
    if (score && (!bacteriaSignal || score > bacteriaSignal.score ||
      score === bacteriaSignal.score && ratio > bacteriaSignal.ratio)) {
      bacteriaSignal = { score, ratio, collectedAt:point.collectedAt };
    }
  }
  if (bacteriaSignal) {
    const { score, ...details } = bacteriaSignal;
    add(score,score >= 9 ? "Bacteria test above the county's safe limit in the past 4 days"
      : score >= 3 ? "Bacteria levels higher than normal" : "Bacteria levels are higher than normal but still below the caution level",
      "bacteria",details);
  }
  if (evidence?.above && !fresh(sample.collectedAt,now,96)) {
    add(6,"Older bacteria test above the county's safe limit","bacteria",{historical:true, collectedAt:sample.collectedAt});
    notes.push("The last test was more than 4 days ago.");
  } else if (evidence?.below && fresh(sample?.collectedAt,now,96)) {
    const hazardEnded = [posting?.lastHazardEnded, regionalRain?.endedAt, runoff?.lastHazardEnded].filter(Boolean);
    if (hazardEnded.some(end => !Number.isFinite(Date.parse(end)) || Date.parse(end) >= Date.parse(sample.collectedAt))) {
      notes.push("The latest bacteria sample predates the last known hazard.");
    }
  } else if (!evidence?.below && !evidence?.above) {
    notes.push("No comparable bacteria result is available.");
  }

  if (gaps.length) add(gaps.length > 1 ? 6 : 5,gaps[0],"evidence");
  if (!signals.length) add(1,"No current risk indicators","evidence");
  signals.sort((a,b) => b.score-a.score);
  const {score:baseScore,reason} = signals[0];
  const baseSignals = [...signals];
  let score = baseScore;
  let finalReason = reason;
  if (countySignals.length) {
    if (baseScore === 1) signals.pop();
    const baseline = score;
    countySignals.sort((a,b) => b.penalty-a.penalty);
    score = Math.min(10,baseline + countySignals[0].penalty);
    for (const { penalty, reason, field, ...details } of countySignals)
      add(Math.min(10,baseline+penalty),reason,field,{...details,penalty});
    signals.sort((a,b) => b.score-a.score);
    finalReason = countySignals[0].reason;
  }
  // Attribute only the final points lost when this signal is removed.
  // Reapply both caps and the strongest-only rules for overlapping evidence.
  for (const signal of signals) {
    const withoutBase = Math.max(1,...baseSignals.filter(item => item !== signal).map(item => item.score));
    const withoutCounty = Math.max(0,...signals.filter(item => item !== signal).map(item => item.penalty ?? 0));
    const without = Math.min(10,withoutBase + withoutCounty);
    signal.contribution = Math.max(0,score-without);
  }
  return { score, reason:finalReason, label:scoreLabel(score), color:scoreColors[score-1], signals, gaps, notes };
}

export function assessCoast(sites, { regionalRain } = {}, now=Date.now()) {
  // Retain last-known local restrictions, just as direct County postings do.
  // Rain-only notices already have their own regional scoring rules.
  const advisorySources = sites.filter(site => ["advisory","warning","closure"].includes(site.posting?.status));
  const results = sites.map(site => {
    const regionalEstimate = regionalRainEstimate(site,sites,now);
    return {id:site.id, regionalEstimate, water:assess({...site,regionalEstimate,regionalRain,
      nearbyAdvisory:nearbyAdvisory(site,advisorySources)},now)};
  });
  return {
    coastRainHold:regionalRain?.advisory === "active" ? countyHold.reason : null,
    results,
    candidates:results.filter(site => site.water.score <= 2).map(site => site.id),
  };
}
