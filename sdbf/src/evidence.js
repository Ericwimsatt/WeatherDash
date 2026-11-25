import { rainScore, sampleEvidence } from "../data/rating.mjs";

export const regionalRainWindow = "in last 96 hours";
export const regionalRainLabel = `Regional rain ${regionalRainWindow}`;

const pacific = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export function date(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? pacific.format(parsed) : "Unavailable";
}

export function age(timestamp, now) {
  const hours = Math.floor((now - Date.parse(timestamp)) / 3600000);
  if (!Number.isFinite(hours) || hours < 0) return "Collection time unavailable";
  if (hours < 1) return "Less than an hour ago";
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function reading(sample) {
  if (!sample) return "Unavailable";
  const qualifier = sample.qualifier && sample.qualifier !== "=" ? sample.qualifier : "";
  return qualifier + sample.value.toLocaleString("en-US");
}

export function rainDisplay(site, regional = false, now = Date.now()) {
  const point = regional ? site.regionalEstimate : site.coastal;
  const fresh = time => Number.isFinite(Date.parse(time)) && now >= Date.parse(time) && now - Date.parse(time) <= 3 * 3600000;
  return fresh(point?.verifiedAt) && Number.isFinite(point?.total) ? `${point.total.toFixed(2)}″` : "Unavailable";
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}

export function contributionClass(points) {
  return points >= 4 ? "hazard" : points >= 2 ? "factor-caution" : undefined;
}


export function sampleSummary(sample) {
  const evidence = sampleEvidence(sample);
  if (!sample) return "Unavailable";
  if (evidence?.above) return "At or above advisory level";
  if (evidence?.below) return "Below advisory level";
  return "Advisory comparison unavailable";
}

export function evidenceLimitations(site, now) {
  const limitations = [];
  if (!sampleEvidence(site.sample)) limitations.push("No comparable bacteria result is available.");
  else {
    const sampleAge = now - Date.parse(site.sample.collectedAt);
    if (!Number.isFinite(sampleAge) || sampleAge < 0) limitations.push("Bacteria collection time is unavailable.");
  }
  const missingRain = ["local", "regional"].filter(field => rainDisplay(site, field === "regional", now) === "Unavailable");
  if (missingRain.length) limitations.push(`Recent ${missingRain.join(" and ")} rain data are unavailable.`);
  return limitations;
}

export function rainDrivesScore(site) {
  const signals = site.rating.signals;
  const amount = field => Math.max(0, ...signals.filter(signal => signal.field === field).map(signal => signal.amount ?? 0));
  const countyRain = Math.max(0, ...signals.filter(signal =>
    ["regional", "county"].includes(signal.field) && /rain advisory/i.test(signal.reason)).map(signal => signal.score));
  const rainOnly = Math.max(rainScore(amount("local"), amount("regional")), countyRain);
  return site.rating.score > 1 && rainOnly >= site.rating.score;
}

const FACTOR_WHY = {
  local: "Rain washes oil, waste, and litter from streets into storm drains that empty into the ocean. Heavy storms can also cause sewer overflows.",
  bacteria: "Enterococcus can indicate sewage or animal waste in the water. Contact can cause stomach illness, rashes, and ear or eye infections.",
  county: "Water contact may be unsafe because of recent contamination or another known hazard.",
  runoff: "A spill or sewage overflow can put pathogens directly into the water. Avoid contact until conditions are confirmed safe.",
  countywide: "Rain across the region can wash pollutants from streets into beaches and bays, raising risk across the coast.",
  regionalRain: "Inland rain can cause runoff that takes longer to reach the coast. Runoff can carry nutrients that encourage algal blooms, and currents can bring runoff from north or south of this beach, affecting its water quality. Regional rain averages the inland 96-hour estimate and the highest coastal 72-hour total in this region.",
  unverified: "Current conditions could not be confirmed. They may have changed since the last available update.",
  clear: "No current risk factors are showing. Bacteria samples are snapshots, and conditions can change quickly.",
};

export const regionalRainWhy = FACTOR_WHY.regionalRain;

function reasonWhy(signal) {
  switch (signal.field) {
    case "county": return FACTOR_WHY.county;
    case "runoff": return FACTOR_WHY.runoff;
    case "bacteria": return FACTOR_WHY.bacteria;
    case "regional": return signal.reason === "Countywide rain advisory" ? FACTOR_WHY.countywide : FACTOR_WHY.regionalRain;
    case "evidence": return signal.reason === "No current risk indicators" ? FACTOR_WHY.clear : FACTOR_WHY.unverified;
    default: return undefined;
  }
}

export function scoreFactors(site, now) {
  const { rating } = site;
  const factorsFor = signal => {
    if (signal.field === "nearbyCounty") return [{ score:signal.score, text:signal.reason,
      why:`${signal.sourceName} is ${signal.miles.toFixed(1)} miles away and has a County ${signal.status}. A nearby notice raises concern here, but is not a County advisory for this beach.`,
      href:"https://cosdapps.sandiegocounty.gov/sdbeachinfo/" }];
    if (signal.field === "evidence" && rating.gaps.length)
      return rating.gaps.map(text => ({ score:signal.score, text, why:FACTOR_WHY.unverified }));
    if (signal.field === "bacteria" && signal.historical) {
      const ageText = signal.collectedAt ? age(signal.collectedAt,now) : "date unknown";
      return [{ score:signal.score, text:`Past bacteria exceedance · ${ageText}`, why:FACTOR_WHY.bacteria }];
    }
    if (signal.field === "bacteria" && signal.ratio != null) {
      return [{ score:signal.score, text:signal.reason,
        why:`This concern comes from a sample collected ${age(signal.collectedAt,now)}. ${signal.score < 7 ? "A below-limit result does not mean no risk. “Higher than normal” is the app’s caution label, not a measured local average or a County advisory." : FACTOR_WHY.bacteria}` }];
    }
    if (Number.isFinite(signal.amount)) {
      const local = signal.field === "local";
      const window = local ? "in the past 72 hours" : regionalRainWindow;
      const gaugeDriven = local && signal.amount > (site.coastal?.total ?? -1);
      const label = signal.field === "local" ? (gaugeDriven ? "Local rain gauge" : "Local rain") : "Regional rain";
      const text = `${label}: ${signal.amount.toFixed(2)}″ ${window}`;
      const warning = signal.score >= 4 && local ? "Potential pollutants from local runoff" : undefined;
      return [{ score:signal.score, text, warning, why: local ? FACTOR_WHY.local : FACTOR_WHY.regionalRain }];
    }
    return [{ score:signal.score, text:signal.reason, why:reasonWhy(signal),
      href:signal.field === "county" || signal.reason === "Countywide rain advisory"
        ? "https://cosdapps.sandiegocounty.gov/sdbeachinfo/" : undefined }];
  };
  return rating.signals.flatMap(signal => factorsFor(signal).map(factor => ({...factor, field:signal.field, contribution:signal.contribution})));
}

export function mapCauses(site, now) {
  const factors = scoreFactors(site,now).flatMap(factor => {
    if (factor.field === "runoff") return factor;
    if (/local rain/i.test(factor.text)) return { ...factor, warning:undefined };
    if (/regional rain/i.test(factor.text)) return { ...factor, warning:undefined };
    if (/bacteria/i.test(factor.text) && factor.score < 7) return { ...factor, warning:undefined };
    if (/bacteria/i.test(factor.text)) return { ...factor, text:"Elevated bacteria can make swimming unsafe.", warning:undefined, why:"Bacteria in the water can cause stomach illness, rashes, and infections." };
    if (/posting|advisory|closure|warning/i.test(factor.text)) return { ...factor, warning:undefined };
    if (/regional rain|rain advisory/i.test(factor.text)) return { ...factor, text:"Widespread rain can carry pollutants into coastal water.", warning:undefined, why:"Rain across the region can wash pollutants into beaches and bays." };
    if (/no current risk/i.test(factor.text)) return [];
    return { ...factor, text:"Current water conditions could not be confirmed.", warning:undefined, why:"Conditions may have changed since the last available evidence." };
  });
  return factors.filter((factor,index) => factors.findIndex(other => other.text === factor.text) === index);
}
