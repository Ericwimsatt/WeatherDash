import { pointTotal,rainPeriods,hour } from "./point-rain.mjs";

import { averageRain, localRainAmount, regionalRainEstimate, rainScore } from "./rating.mjs";

const day=24*hour;
const calendar=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Los_Angeles"});
const pacificDate=new Intl.DateTimeFormat("en-US",{month:"2-digit",day:"2-digit",timeZone:"America/Los_Angeles"});
export const FORECAST_DAYS=10;

export function dayStart(now) {
  const date=calendar.format(now);
  const seven=Date.parse(date+"T07:00:00Z");
  return calendar.format(seven)===date ? seven : seven+hour;
}

export function runoffHorizon(site,now,regionalSites=[]) {
  const today=dayStart(now);
  const starts=Array.from({length:FORECAST_DAYS+5},(_,index)=>today+(index-4)*day);
  const ends=starts.map(time=>time+day);
  const daily=point=>ends.map((end,index)=>pointTotal(point,starts[index],end));
  const localTotals=daily(site.localPoint);
  const localDaily=localTotals.map(value=>value.hours?value.total:null);
  const localKnown=localTotals.every(value=>value.complete);
  const localTotal=localDaily.reduce((sum,value)=>sum+(Number.isFinite(value)?value:0),0);
  const rollingAt=(point,hours,end)=>pointTotal(point,end-hours*hour,end).total;
  const region=[site,...regionalSites.filter(candidate=>candidate !== site)]
    .filter(candidate=>candidate === site || site.area && candidate.area===site.area);
  const maximum=values=>{
    const known=values.filter(Number.isFinite);
    return known.length ? Math.max(...known) : null;
  };
  const coastalAt=end=>maximum(region.map(candidate=>{
    const point=rollingAt(candidate.localPoint,rainPeriods.local,end);
    if(end<=now) return point;
    const current=localRainAmount(candidate,now);
    const decay=current*Math.max(0,1-(end-now)/(rainPeriods.local*hour));
    return point==null && !current ? null : Math.max(point ?? 0,decay);
  }));
  const regionalAt=end=>averageRain(rollingAt(site.inlandPoint,rainPeriods.inland,end),coastalAt(end));
  const regionalDaily=ends.map((end,index)=>averageRain(
    pointTotal(site.inlandPoint,starts[index],end).total,
    maximum(region.map(candidate=>pointTotal(candidate.localPoint,starts[index],end).total))));
  const regionalKnown=regionalDaily.every(Number.isFinite);
  const regionalTotal=regionalDaily.reduce((sum,value)=>sum+(value ?? 0),0);
  return {starts,ends,localDaily,regionalDaily,
    regionalCurrent:regionalRainEstimate(site,region,now).total,
    regional:ends.map(regionalAt),regionalBefore:regionalAt(starts[0]),regionalAfter:regionalAt(ends.at(-1)+day),
    currentX:4+(Math.floor(now/hour)*hour-today)/day-.5,
    localCurrent:localRainAmount(site,now),
    local3:ends.map(end=>rollingAt(site.localPoint,rainPeriods.local,end)),
    local3Before:rollingAt(site.localPoint,rainPeriods.local,starts[0]),
    local3After:rollingAt(site.localPoint,rainPeriods.local,ends.at(-1)+day),
    localTotal,regionalTotal,localKnown,regionalKnown};
}

export function safeEstimate(site,now,snapshot,regionalSites=[]) {
  if(site.rating.score<=2)return null;
  const rainFields=new Set(["local","regional"]);
  const persistent=site.rating.signals.filter(signal=>!rainFields.has(signal.field) && signal.score>=3);
  if(persistent.every(signal=>signal.field==="bacteria") && persistent.length && site.rating.score<=5)
    return "Safety at this beach will be reassessed when bacteria levels are re-tested.";
  if(persistent.length)return null;
  const county=site.rating.signals.some(signal=>signal.field==="regional" && /countywide rain advisory/i.test(signal.reason));
  if(county){
    const regional=snapshot?.regionalRain;
    const lift=Date.parse(regional?.estimatedLiftAt);
    if(regional?.advisory==="active" && Number.isFinite(lift) && lift>now)
      return `County rain advisory estimated to lift by ${pacificDate.format(lift)}. Follow the current County posting.`;
    return "When the county rain advisory is lifted, the beach will be reassessed.";
  }
  const values=runoffHorizon(site,now,regionalSites);
  const dayIndex=values.ends.findIndex((_,index)=>index>=4 && values.local3[index]!=null && values.regional[index]!=null && rainScore(values.local3[index],values.regional[index])<=2);
  if(dayIndex>=4)return `Rain-related risk forecast to be low by ${pacificDate.format(values.ends[dayIndex])}.`;
  return `Expect rain-related risk to continue for the next ${FORECAST_DAYS} days based on current forecast.`;
}
