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
  return estimates.length ? `${Math.max(...estimates).toFixed(2)} in` : "Unavailable";
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}


export function scoreFactors(site, now) {
  const { rating } = site;
  return rating.signals.flatMap(signal => {
    if (signal.field === "evidence" && rating.gaps.length)
      return rating.gaps.map(text => ({ score:signal.score, text }));
    if (signal.field === "bacteria" && signal.historical) {
      const ageText = site.sample ? age(site.sample.collectedAt,now) : "date unknown";
      return [{ score:signal.score, text:`Past bacteria exceedance · ${ageText}` }];
    }
    if (Number.isFinite(signal.amount)) {
      const local = signal.field === "local";
      const window = local ? "72 hours" : "4 days";
      const text = `${signal.amount.toFixed(2)} in ${signal.field} rain in last ${window}`;
      const warning = signal.score >= 6
        ? (local ? "Potential dangerous chemicals from local runoff" : "Potential algae blooms from inland runoff")
        : undefined;
      return [{ score:signal.score, text, warning }];
    }
    return [{ score:signal.score, text:signal.reason }];
  });
}
