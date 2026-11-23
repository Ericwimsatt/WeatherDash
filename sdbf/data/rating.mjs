const hour = 60 * 60 * 1000;
const restrictions = new Set(["closure", "warning", "advisory", "rain advisory"]);

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
  if (rain?.stormActive) return "Qualifying rain is ongoing";
  if (rain?.qualifying && fresh(rain.endedAt, now, 72)) return "Within 72 hours of qualifying rain";
  if (rain?.qualifying && (!Number.isFinite(Date.parse(rain.endedAt)) || Date.parse(rain.endedAt) > now))
    return "Qualifying rain with unverified end time";
  return null;
}

function checkCoastRain(regionalRain, sites, now) {
  if (regionalRain?.advisory === "active") return "Countywide rain advisory";
  if (rainHold(regionalRain, now) || sites.some(site => rainHold(site.rain, now)))
    return "Coastwide hold after qualifying rain";
  return null;
}

export function assess({ posting, sample, rain, runoff, regionalRain, coastRainHold }, now = Date.now()) {
  const result = sampleEvidence(sample);
  if (restrictions.has(posting?.status)) {
    return { state: "avoid", reason: `County ${posting.status}` };
  }
  if (runoff?.hazard) return { state: "avoid", reason: runoff.hazard };
  if (result?.above) return { state: "avoid", reason: "Latest test at or above limit" };

  const rainReason = coastRainHold ?? checkCoastRain(regionalRain, [{ rain }], now);
  if (rainReason) return { state: "rain", reason: rainReason };

  if (posting?.status !== "open" || !fresh(posting.verifiedAt, now, 12))
    return { state: "unknown", reason: "Current County status unverified" };
  if (regionalRain?.advisory !== "clear" || !regionalRain.complete || !fresh(regionalRain.verifiedAt, now, 3))
    return { state: "unknown", reason: "Coastwide rain status unverified" };
  if (!rain?.complete || !fresh(rain.verifiedAt, now, 3))
    return { state: "unknown", reason: "Incomplete local rain observations" };
  if (!runoff?.clear || !fresh(runoff.verifiedAt, now, 12))
    return { state: "unknown", reason: "Runoff status unverified" };
  if (!result?.below || !fresh(sample.collectedAt, now, 48))
    return { state: "unknown", reason: "No comparable sample in the last 48 hours" };
  const hazardEnded = [posting.lastHazardEnded, rain.qualifying ? rain.endedAt : null, regionalRain.endedAt, runoff.lastHazardEnded]
    .filter(Boolean);
  if (hazardEnded.some(end => !Number.isFinite(Date.parse(end)) || Date.parse(end) >= Date.parse(sample.collectedAt)))
    return { state: "unknown", reason: "No comparable sample after the latest hazard" };

  return { state: "recent", reason: "Recent test below limit" };
}

export function assessCoast(sites, { regionalRain, surf } = {}, now = Date.now()) {
  const coastRainHold = checkCoastRain(regionalRain, sites, now);
  const surfCurrent = Date.parse(surf?.issuedAt) <= now && Date.parse(surf?.validUntil) > now;
  const surfHold = surfCurrent && surf.ripCurrentRisk === "high" ? "NWS high rip-current risk" : null;
  const coastHold = coastRainHold ?? surfHold;

  const results = sites.map(site => {
    const water = assess({ ...site, regionalRain, coastRainHold }, now);
    const canConsider = water.state === "recent" && surfCurrent && surf.ripCurrentRisk === "low";
    return {
      id: site.id,
      water,
      decision: coastHold || water.state === "rain" || water.state === "avoid" ? "avoid" : canConsider ? "consider" : "unverified",
    };
  });

  return {
    coastRainHold,
    surfHold,
    results,
    candidates: results.filter(site => site.decision === "consider").map(site => site.id),
  };
}
