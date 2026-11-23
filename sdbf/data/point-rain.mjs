export const hour = 3600000;
export const rainPeriods = { local:72, inland:96 };
export const rainLimits = { local:.2, inland:.75 };

const milesInland = 3;
const milesPerLongitudeDegreeAtEquator = 69.17;

export const pointIds = site => [`local:${site.id}`, `inland:3mi:${site.id}`];

export function pointLocations(sites) {
  return sites.flatMap(site => {
    const [local, inland] = pointIds(site);
    const milesPerDegree = milesPerLongitudeDegreeAtEquator * Math.cos(site.lat * Math.PI / 180);
    return [
      { id:local, name:`${site.name} coast`, lat:site.lat, lon:site.lon },
      { id:inland, name:`3 mi inland of ${site.name}`, lat:site.lat, lon:site.lon + milesInland / milesPerDegree },
    ];
  });
}

export function pointTotal(point, from, through) {
  const start = Math.floor(from/hour)*hour;
  const end = Math.floor(through/hour)*hour;
  const expected = (end-start)/hour;
  const offset = Math.round((start-point?.start)/hour);
  if (expected <= 0 || !Number.isFinite(offset)) return { total:null, complete:false, hours:0 };
  let total = 0, hours = 0, endedAt;
  for (let i=1; i<=expected; i++) {
    const value = point.values[offset+i];
    if (!Number.isFinite(value) || value < 0) continue;
    hours++;
    total += value;
    if (value > 0) endedAt = new Date(start+i*hour).toISOString();
  }
  return { total:hours ? Number(total.toFixed(3)) : null, complete:hours===expected, hours, endedAt };
}

export function withPointRain(site, points, now) {
  const [localKey,inlandKey] = pointIds(site);
  const local = points?.[localKey];
  const inland = points?.[inlandKey];
  const summarize = (point, hours) => {
    if (!point) return null;
    const checked = Date.parse(point.verifiedAt);
    const cutoff = Math.min(now,checked);
    const summary = pointTotal(point,now-hours*hour,cutoff);
    return {
      ...summary, complete:summary.complete && summary.hours===hours,
      verifiedAt:point.verifiedAt, name:point.name, lat:point.lat, lon:point.lon,
    };
  };
  const coastal = summarize(local,rainPeriods.local);
  if (coastal?.total >= rainLimits.local) {
    // Qualifying rain must fall in one rolling 24-hour period.
    const cutoff = Math.min(now,Date.parse(local.verifiedAt));
    for (let end=cutoff; end>now-rainPeriods.local*hour; end-=hour) {
      if (pointTotal(local,Math.max(now-rainPeriods.local*hour,end-24*hour),end).total >= rainLimits.local) {
        coastal.qualifying = true;
        break;
      }
    }
  }
  return { ...site, coastal, inlandRain:summarize(inland,rainPeriods.inland), localPoint:local, inlandPoint:inland };
}
