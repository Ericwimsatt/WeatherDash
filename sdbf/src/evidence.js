export const countyUrl = "https://www.sdbeachinfo.com/";

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
  const number = value => `${value.toFixed(2)} in`;
  if (gauge?.complete && Number.isFinite(gauge.lowerBound) && (!point?.complete || gauge.lowerBound >= point.total)) {
    return { value:number(gauge.lowerBound) };
  }
  if (Number.isFinite(point?.total) && (gauge?.lowerBound ?? 0) <= point.total) {
    return { value:(point.complete ? "" : "≥") + number(point.total), note:point.complete ? undefined : "Incomplete coverage" };
  }
  if (gauge?.lowerBound > 0) return { value:"≥"+number(gauge.lowerBound), note:"Incomplete coverage" };
  return { value:"Unavailable", note:"Rain coverage incomplete" };
}

export function postingText(site) {
  return { advisory:"Advisory", closure:"Closure", warning:"Warning", open:"Open", "rain advisory":"Rain advisory" }[site.posting?.status] ?? "Unverified";
}


const sampleGap = "No comparable below-limit test in the past 48 hours";

export function scoreFactors(site, now) {
  const { rating } = site;
  const factors = rating.signals.flatMap(signal => {
    if (signal.field === "evidence" && rating.gaps.length) {
      return rating.gaps.map(gap => {
        const timestamp = Date.parse(site.sample?.collectedAt);
        const old = Number.isFinite(timestamp) && now-timestamp > 48*3600000;
        return { score:signal.score, text:gap === sampleGap && old ? `Bacteria test ${age(site.sample.collectedAt,now)}` : gap };
      });
    }
    if (Number.isFinite(signal.amount)) {
      const window = signal.field === "local" ? "72h" : "4 days";
      return [{ score:signal.score, text:`${signal.minimum ? "≥" : ""}${signal.amount.toFixed(2)} in ${signal.field} rain · ${window}` }];
    }
    return [{ score:signal.score, text:signal.reason }];
  });
  return factors;
}
