import { hour,rainLimits } from "./point-rain.mjs";
export const scoreColors = ["#176440","#2e773c","#577b2b","#6c7721","#8e6d13","#a96513","#ac4b19","#a13523","#a0202e","#81162d"];

export function scoreLabel(score) {
  if (score <= 2) return "Lowest observed concern";
  if (score <= 4) return "Use caution";
  if (score <= 6) return "Sensitive groups should avoid";
  if (score <= 8) return "Avoid water contact";
  return "Dangerous · avoid water";
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

function localRainAmount({ rain, coastal }, now) {
  const measured = fresh(rain?.verifiedAt,now,3) || rainHold(rain,now) ? rain?.lowerBound : null;
  const modeled = fresh(coastal?.verifiedAt,now,3) ? coastal.total : null;
  return Math.max(measured ?? 0,modeled ?? 0);
}

function regionalRainPoints(amount) {
  if (amount >= .35) return 3;
  if (amount >= rainLimits.local) return 2;
  return amount >= .05 ? 1 : 0;
}

const countyHold = { score:7, reason:"Countywide rain advisory" };

export function assess(site, now=Date.now(), regionalPoints=0) {
  const { posting, sample, inlandRain, runoff, regionalRain } = site;
  const evidence = sampleEvidence(sample);
  const signals = [];
  const gaps = [];
  const notes = [];
  const add = (score, reason, field, details) => signals.push({score,reason,field,...details});
  if (regionalRain?.advisory === "active") add(countyHold.score,countyHold.reason,"regional");

  const official = { closure:10, warning:10, advisory:9, "rain advisory":7 }[posting?.status];
  const countyFresh = fresh(posting?.verifiedAt,now,12);
  if (official) add(official,`${countyFresh ? "County" : "Last County posting:"} ${posting.status}`,"county");
  else if (posting?.status !== "open" || !countyFresh) gaps.push("Current County status unverified");
  if (regionalRain?.advisory !== "active" && (regionalRain?.advisory !== "clear" || !fresh(regionalRain?.verifiedAt,now,3)))
    gaps.push("Countywide rain status unverified");

  if (runoff?.hazard) add(10,runoff.hazard,"runoff");

  const localAmount = localRainAmount(site,now);
  const localDetails = { amount:localAmount };
  if (localAmount >= .5) add(8,"Heavy local rain in the past 72 hours","local",localDetails);
  else if (localAmount >= .35) add(7,"Elevated local rain in the past 72 hours","local",localDetails);
  else if (localAmount >= rainLimits.local) add(6,"Local rain crossed the runoff limit","local",localDetails);
  else if (localAmount >= .05) add(4,"Light local rain in the past 72 hours","local",localDetails);

  const inlandAmount = fresh(inlandRain?.verifiedAt,now,3) ? inlandRain?.total ?? 0 : 0;
  const inlandDetails = { amount:inlandAmount };
  if (inlandAmount >= 1.25) add(8,"Heavy inland rain in the past four days","inland",inlandDetails);
  else if (inlandAmount >= 1) add(7,"Elevated inland rain in the past four days","inland",inlandDetails);
  else if (inlandAmount >= rainLimits.inland) add(6,"Inland rain crossed the runoff limit","inland",inlandDetails);
  else if (inlandAmount >= .35) add(4,"Recent inland rain","inland",inlandDetails);

  const hasRecentSample = fresh(sample?.collectedAt,now,48);
  if (evidence?.above) {
    if (fresh(sample.collectedAt,now,72)) {
      add(sample.value/evidence.threshold >= 2 || localAmount >= rainLimits.local ? 10 : 9,"Recent bacteria test at or above the limit","bacteria");
    } else {
      add(6,"Older bacteria test at or above the limit","bacteria",{historical:true});
      notes.push("The last exceedance was more than 72 hours ago.");
    }
  } else if (evidence?.below && hasRecentSample) {
    if (sample.value / evidence.threshold >= .75) add(4,"Recent bacteria result near the limit","bacteria");
    const hazardEnded = [posting?.lastHazardEnded, regionalRain?.endedAt, runoff?.lastHazardEnded].filter(Boolean);
    if (hazardEnded.some(end => !Number.isFinite(Date.parse(end)) || Date.parse(end) >= Date.parse(sample.collectedAt))) {
      notes.push("The latest bacteria sample predates the last known hazard.");
    }
  } else {
    notes.push(evidence?.below ? "The latest below-limit sample is older than 48 hours." : "No comparable bacteria result is available.");
  }

  if (gaps.length) add(gaps.length > 1 ? 6 : 5,gaps[0],"evidence");
  if (!signals.length) add(1,"No current risk indicators","evidence");
  signals.sort((a,b) => b.score-a.score);
  const {score:baseScore,reason} = signals[0];
  const points = Math.min(regionalPoints,Math.max(0,8-baseScore));
  const score = baseScore + points;
  if (points) {
    if (baseScore === 1) signals.pop();
    add(score,`Regional rainfall · +${points}`,"regional");
  }
  return { score, reason:baseScore === 1 && points ? signals[0].reason : reason, label:scoreLabel(score), color:scoreColors[score-1], signals, gaps, notes };
}

export function assessCoast(sites, { regionalRain } = {}, now=Date.now()) {
  const regions = new Map();
  for (const site of sites) {
    const points = regionalRainPoints(localRainAmount(site,now));
    if (site.area && points > (regions.get(site.area) ?? 0)) regions.set(site.area,points);
  }
  const results = sites.map(site => ({ id:site.id, water:assess({ ...site, regionalRain },now,regions.get(site.area)) }));
  return {
    coastRainHold:regionalRain?.advisory === "active" ? countyHold.reason : null,
    regionalRainfall:[...regions],
    results,
    candidates:results.filter(site => site.water.score <= 2).map(site => site.id),
  };
}
