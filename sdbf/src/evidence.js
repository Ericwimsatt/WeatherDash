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

export function rainDisplay(site, inland = false, now = Date.now()) {
  const point = inland ? site.inlandRain : site.coastal;
  const gauge = inland ? null : site.rain;
  const fresh = time => Number.isFinite(Date.parse(time)) && now >= Date.parse(time) && now - Date.parse(time) <= 3 * 3600000;
  const estimates = [fresh(point?.verifiedAt) ? point?.total : null,
    fresh(gauge?.verifiedAt) ? gauge?.lowerBound : null].filter(Number.isFinite);
  return estimates.length ? `${Math.max(...estimates).toFixed(2)}″` : "Unavailable";
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}


const FACTOR_WHY = {
  local: "Rain washes oil, waste, and litter from streets into storm drains that empty into the ocean. Heavy storms can also cause sewer overflows.",
  inland: "Rain carries pollutants through creeks and rivers toward the coast, where they can affect water quality.",
  bacteria: "Enterococcus can indicate sewage or animal waste in the water. Contact can cause stomach illness, rashes, and ear or eye infections.",
  county: "Water contact may be unsafe because of recent contamination or another known hazard.",
  runoff: "A spill or sewage overflow can put pathogens directly into the water. Avoid contact until conditions are confirmed safe.",
  countywide: "Rain across the region can wash pollutants from streets into beaches and bays, raising risk across the coast.",
  regionalRain: "Widespread rain can carry pollutants into coastal water, adding to local conditions.",
  unverified: "Current conditions could not be confirmed. They may have changed since the last available update.",
  clear: "No current risk factors are showing. Bacteria samples are snapshots, and conditions can change quickly.",
};

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
  return rating.signals.flatMap(signal => {
    if (signal.field === "evidence" && rating.gaps.length)
      return rating.gaps.map(text => ({ score:signal.score, text, why:FACTOR_WHY.unverified }));
    if (signal.field === "bacteria" && signal.historical) {
      const ageText = site.sample ? age(site.sample.collectedAt,now) : "date unknown";
      return [{ score:signal.score, text:`Past bacteria exceedance · ${ageText}`, why:FACTOR_WHY.bacteria }];
    }
    if (Number.isFinite(signal.amount)) {
      const local = signal.field === "local";
      const window = signal.field === "local" ? "in the past 72 hours" : signal.field === "inland" ? "in the past 4 days" : "in the past 72 hours";
      const label = signal.field === "local" ? "Local rain" : signal.field === "inland" ? "Inland rain" : "Regional rain";
      const text = `${label}: ${signal.amount.toFixed(2)}″ ${window}`;
      const warning = signal.score >= 6 && local ? "Potential pollutants from local runoff" : undefined;
      return [{ score:signal.score, text, warning, why: local ? FACTOR_WHY.local : FACTOR_WHY.inland }];
    }
    return [{ score:signal.score, text:signal.reason, why:reasonWhy(signal) }];
  });
}

export function mapCauses(site, now) {
  return scoreFactors(site,now).map(factor => {
    if (/local rain/i.test(factor.text)) return { ...factor, warning:undefined };
    if (/inland rain/i.test(factor.text)) return { ...factor, warning:undefined };
    if (/regional rain/i.test(factor.text)) return { ...factor, warning:undefined };
    if (/bacteria/i.test(factor.text)) return { ...factor, text:"Elevated bacteria can make swimming unsafe.", warning:undefined, why:"Bacteria in the water can cause stomach illness, rashes, and infections." };
    if (/posting|advisory|closure|warning/i.test(factor.text)) return { ...factor, text:"Water contact may be unsafe because of contamination or another hazard.", warning:undefined, why:"Recent contamination or another hazard can make swimming unsafe." };
    if (/regional rain|rain advisory/i.test(factor.text)) return { ...factor, text:"Widespread rain can carry pollutants into coastal water.", warning:undefined, why:"Rain across the region can wash pollutants into beaches and bays." };
    if (/no current risk/i.test(factor.text)) return { ...factor, text:"No current risk factors are showing.", warning:undefined, why:undefined };
    return { ...factor, text:"Current water conditions could not be confirmed.", warning:undefined, why:"Conditions may have changed since the last available evidence." };
  });
}
