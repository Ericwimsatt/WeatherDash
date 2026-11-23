export const hour = 3600000;
export const rainPeriods = { local:72, inland:96 };
export const rainLimits = { local:.2, inland:.75 };

// Inland points represent the nearby drainage corridor, sampled at a point rather than averaged over a watershed.
const inland = {
  "San Luis Rey Valley":[33.241,-117.276], "Carlsbad inland":[33.137,-117.256],
  "Batiquitos inland":[33.091,-117.236], "Encinitas inland":[33.048,-117.228],
  "San Elijo watershed":[33.020,-117.204], "San Dieguito Valley":[32.985,-117.205],
  "Peñasquitos watershed":[32.944,-117.171], "Rose Canyon":[32.850,-117.196],
  "Mission Valley":[32.765,-117.182], "Chula Vista inland":[32.618,-117.083],
  "Tijuana River Valley inland":[32.558,-117.047],
};
const assignments = {
  588:"San Luis Rey Valley",388:"Carlsbad inland",401:"Batiquitos inland",381:"Encinitas inland",
  706:"San Elijo watershed",373:"San Dieguito Valley",418:"Peñasquitos watershed",
  365:"Rose Canyon",351:"Rose Canyon",646:"Mission Valley",644:"Mission Valley",
  325:"Chula Vista inland",461:"Chula Vista inland",322:"Tijuana River Valley inland",455:"Tijuana River Valley inland",
};
const inlandGauges = { "Rose Canyon":"KMYF", "Mission Valley":"KMYF", "Chula Vista inland":"KSDM", "Tijuana River Valley inland":"KSDM" };
export const inlandGaugeFor = site => inlandGauges[assignments[site.id]];
export const pointIds = site => [`local:${site.id}`,`inland:${assignments[site.id]}`];

export function pointLocations(sites) {
  return [
    ...sites.map(site => ({ id:pointIds(site)[0], name:`${site.name} coast`, lat:site.lat, lon:site.lon })),
    ...Object.entries(inland).map(([name,[lat,lon]]) => ({ id:`inland:${name}`, name, lat, lon })),
  ];
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
