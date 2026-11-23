const hour = 60 * 60 * 1000;
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

function coastSignal(regionalRain, sites, now) {
  if (regionalRain?.advisory === "active") return { score:9, reason:"Countywide rain advisory" };
  if (rainHold(regionalRain,now) || sites.some(site => rainHold(site.rain,now)))
    return { score:9, reason:"Qualifying rain measured along the coast" };
  if (sites.some(site => fresh(site.coastal?.verifiedAt,now,3) && rainHold(site.coastal,now)))
    return { score:8, reason:"Coastwide caution after estimated rain" };
  return null;
}

export function assess(site, now=Date.now(), coast=null) {
  const { posting, sample, rain, coastal, inlandRain, inlandGaugeRain, runoff, regionalRain } = site;
  const evidence = sampleEvidence(sample);
  const signals = [];
  const gaps = [];
  const add = (score, reason, field) => signals.push({score,reason,field});
  if (coast) add(coast.score,coast.reason,"regional");

  const official = { closure:10, warning:10, advisory:9, "rain advisory":9 }[posting?.status];
  const countyFresh = fresh(posting?.verifiedAt,now,12);
  if (official) add(official,`${countyFresh ? "County" : "Last County posting:"} ${posting.status}`,"county");
  else if (posting?.status !== "open" || !countyFresh) gaps.push("Current County status unverified");
  if (!coast && (regionalRain?.advisory !== "clear" || !fresh(regionalRain?.verifiedAt,now,3)))
    gaps.push("Countywide rain status unverified");

  if (runoff?.hazard) add(10,runoff.hazard,"runoff");
  if (site.outfall?.meters <= 23 && !runoff?.clear) add(5,"Monitoring point is near a mapped outfall","runoff");

  const measured = (fresh(rain?.verifiedAt,now,3) || rainHold(rain,now)) ? rain?.lowerBound : null;
  const localFresh = fresh(coastal?.verifiedAt,now,3);
  const inlandFresh = fresh(inlandRain?.verifiedAt,now,3);
  const localAmount = Math.max(measured ?? 0, localFresh ? coastal?.total ?? 0 : 0);
  const hasLocalCoverage = fresh(rain?.verifiedAt,now,3) && rain?.complete || localFresh && coastal?.complete;
  if (!hasLocalCoverage) gaps.push("Local rain coverage incomplete");
  if (localAmount >= .5) add(rainHold(rain,now) ? 10 : 9,"Heavy local rain in the past 72 hours","local");
  else if (localAmount >= .2) add(rainHold(rain,now) ? 9 : 8,"Local rain in the past 72 hours","local");
  else if (localAmount >= .05) add(4,"Light local rain in the past 72 hours","local");

  const inlandGaugeFresh = fresh(inlandGaugeRain?.verifiedAt,now,3);
  if (!(inlandFresh && inlandRain?.complete || inlandGaugeFresh && inlandGaugeRain?.complete)) gaps.push("Inland rain coverage incomplete");
  const inlandAmount = Math.max(inlandFresh ? inlandRain?.total ?? 0 : 0,inlandGaugeFresh ? inlandGaugeRain?.lowerBound ?? 0 : 0);
  if (inlandAmount >= 1.25) add(8,"Heavy inland rain in the past four days","inland");
  else if (inlandAmount >= .75) add(6,"Elevated inland rain in the past four days","inland");
  else if (inlandAmount >= .35) add(4,"Recent inland rain","inland");

  const hasRecentSample = fresh(sample?.collectedAt,now,48);
  if (evidence?.above && fresh(sample.collectedAt,now,168)) {
    const recent = fresh(sample.collectedAt,now,72);
    add(recent ? (sample.value/evidence.threshold >= 2 || localAmount >= .2 ? 10 : 9) : 7,
      recent ? "Recent bacteria test at or above the limit" : "Bacteria exceeded the limit earlier this week","bacteria");
  } else if (evidence?.below && hasRecentSample) {
    if (sample.value / evidence.threshold >= .75) add(4,"Recent bacteria result near the limit","bacteria");
    else if (sample.value / evidence.threshold >= .25) add(3,"Recent bacteria test below the limit","bacteria");
    const hazardEnded = [posting?.lastHazardEnded, regionalRain?.endedAt, runoff?.lastHazardEnded]
      .filter(Boolean);
    if (hazardEnded.some(end => !Number.isFinite(Date.parse(end)) || Date.parse(end) >= Date.parse(sample.collectedAt)))
      gaps.push("No lab result since the last known hazard");
  } else gaps.push("No comparable below-limit test in the past 48 hours");

  if (gaps.length) add(gaps.length > 1 ? 6 : 5,gaps[0],"evidence");
  if (!signals.length) add(rain?.complete ? 1 : 2,"Recent low bacteria result and low rainfall","evidence");
  signals.sort((a,b) => b.score-a.score);
  const {score,reason} = signals[0];
  return { score, reason, label:scoreLabel(score), color:scoreColors[score-1], signals, gaps };
}

export function assessCoast(sites, { regionalRain } = {}, now=Date.now()) {
  const coast = coastSignal(regionalRain,sites,now);
  const results = sites.map(site => ({ id:site.id, water:assess({ ...site, regionalRain },now,coast) }));
  return { coastRainHold:coast?.reason ?? null, results, candidates:results.filter(site => site.water.score <= 2).map(site => site.id) };
}
