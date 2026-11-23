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
  return hours < 24 ? `${hours}h old` : `${Math.floor(hours / 24)}d old`;
}

export function reading(sample) {
  if (!sample) return "Unavailable";
  const qualifier = sample.qualifier && sample.qualifier !== "=" ? sample.qualifier : "";
  return qualifier + sample.value.toLocaleString("en-US");
}

export function rainDisplay(site, inland = false) {
  const point = inland ? site.inlandRain : site.coastal;
  const gauge = inland ? null : site.rain;
  const estimates = [point?.total,gauge?.lowerBound].filter(Number.isFinite);
  return estimates.length ? `${Math.max(...estimates).toFixed(2)} in` : "";
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}


const FACTOR_WHY = {
  local: "Rain washes oil, fertilizer, pet waste, and litter off streets into storm drains, which empty straight into the ocean. In a heavy storm, the sewer system can also overflow into the sea.",
  inland: "Rain sweeps fertilizer from farms and fields into rivers that reach the ocean, where it feeds algae blooms. Some of that algae is dangerous to people.",
  bacteria: "Enterococcus is a sign of sewage or animal waste in the water. Swallowing it or swimming in it can cause stomach illness, skin rashes, and ear or eye infections.",
  county: "The County posts advisories, warnings, and closures when water contact is likely to make people sick, based on recent bacteria results or a known hazard.",
  runoff: "A reported spill or sewage overflow puts pathogens directly into the water. Stay out until the County confirms it is safe again.",
  countywide: "Rain across the region washes pollutants off streets into every beach and bay, so all water contact is riskier for a few days.",
  regionalRain: "Widespread rain raises the runoff risk at every beach in the region, on top of each beach's own conditions.",
  unverified: "When current County data is unavailable, the true water quality is uncertain, so treat the water with extra caution.",
  clear: "No hazards are showing right now, but bacteria tests are only a snapshot and conditions can change quickly.",
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
      const window = local ? "72 hours" : "4 days";
      const text = `${signal.amount.toFixed(2)} in ${signal.field} rain in last ${window}`;
      const warning = signal.score >= 6
        ? (local ? "Potential dangerous chemicals from local runoff" : "Potential algae blooms from inland runoff")
        : undefined;
      return [{ score:signal.score, text, warning, why: local ? FACTOR_WHY.local : FACTOR_WHY.inland }];
    }
    return [{ score:signal.score, text:signal.reason, why:reasonWhy(signal) }];
  });
}
