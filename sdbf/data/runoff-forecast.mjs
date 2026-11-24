import { pointTotal,rainPeriods,hour } from "./point-rain.mjs";

import { localRainAmount, rainScore, scoreLabel } from "./rating.mjs";

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
  const localTotals=daily(site.localPoint),inlandTotals=daily(site.inlandPoint);
  const localDaily=localTotals.map(value=>value.hours?value.total:null),inlandDaily=inlandTotals.map(value=>value.hours?value.total:null);
  const localKnown=localTotals.every(value=>value.complete),inlandKnown=inlandTotals.every(value=>value.complete);
  const localTotal=localDaily.reduce((sum,value)=>sum+(Number.isFinite(value)?value:0),0);
  const inlandTotal=inlandDaily.reduce((sum,value)=>sum+(Number.isFinite(value)?value:0),0);
  const rolling=(point,hours)=>ends.map(end=>{const value=pointTotal(point,end-hours*hour,end);return value.hours?value.total:null;});
  const rollingAt=(point,hours,end)=>{const value=pointTotal(point,end-hours*hour,end);return value.hours?value.total:null;};
  // The rating uses the highest local 72-hour amount in the beach's region.
  // Decay the current reading over 72 hours while retaining forecast rainfall.
  const region=[site,...regionalSites.filter(candidate=>candidate !== site)].filter(candidate=>candidate.area && candidate.area===site.area);
  const regionalAt=end=>{
    const amounts=region.map(candidate=>{
      const point=rollingAt(candidate.localPoint,rainPeriods.local,end);
      if(end<=now) return point;
      const current=localRainAmount(candidate,now);
      const decay=current*Math.max(0,1-(end-now)/(rainPeriods.local*hour));
      return point==null && !current ? null : Math.max(point ?? 0,decay);
    }).filter(Number.isFinite);
    return amounts.length ? Math.max(...amounts) : null;
  };
  const regionalCurrent=region.length ? Math.max(...region.map(candidate=>localRainAmount(candidate,now))) : null;
  return {starts,ends,localDaily,inlandDaily,regionalCurrent,
    regional3:ends.map(regionalAt),regional3Before:regionalAt(starts[0]),regional3After:regionalAt(ends.at(-1)+day),
    currentX:4+(Math.floor(now/hour)*hour-today)/day-.5,
    localCurrent:localRainAmount(site,now),
    inlandCurrent:site.inlandRain?.total ?? null,
    local3:rolling(site.localPoint,rainPeriods.local),inland4:rolling(site.inlandPoint,rainPeriods.inland),
    local3Before:rollingAt(site.localPoint,rainPeriods.local,starts[0]),
    inland4Before:rollingAt(site.inlandPoint,rainPeriods.inland,starts[0]),
    local3After:rollingAt(site.localPoint,rainPeriods.local,ends.at(-1)+day),
    inland4After:rollingAt(site.inlandPoint,rainPeriods.inland,ends.at(-1)+day),
    localTotal,inlandTotal,localKnown,inlandKnown};
}

export function safeEstimate(site,now,snapshot,regionalSites=[]) {
  if(site.rating.score<=2)return `${scoreLabel(site.rating.score)} based on current evidence.`;
  const rainFields=new Set(["local","inland","regional"]);
  const persistent=site.rating.signals.filter(signal=>!rainFields.has(signal.field) && signal.score>=3);
  if(persistent.every(signal=>signal.field==="bacteria") && persistent.length && site.rating.score<=5)
    return `Bacteria levels are elevated but still below the advisory level. ${scoreLabel(site.rating.score)}.`;
  if(persistent.length)return "Cannot estimate when it will be safe to swim.";
  const county=site.rating.signals.some(signal=>signal.field==="regional" && /countywide rain advisory/i.test(signal.reason));
  if(county){
    const regional=snapshot?.regionalRain;
    const lift=Date.parse(regional?.estimatedLiftAt);
    if(regional?.advisory==="active" && Number.isFinite(lift) && lift>now)
      return `County rain advisory estimated to lift by ${pacificDate.format(lift)}. Follow the current County posting.`;
    return "A lower-risk date requires an updated County rain advisory status.";
  }
  const values=runoffHorizon(site,now,regionalSites);
  const dayIndex=values.ends.findIndex((_,index)=>index>=4 && values.local3[index]!=null && values.inland4[index]!=null && values.regional3[index]!=null && rainScore(values.local3[index],values.inland4[index],values.regional3[index])<=2);
  if(dayIndex>=4)return `Rain-related risk forecast to be low by ${pacificDate.format(values.ends[dayIndex])}.`;
  return `Low rain-related risk is not forecast in the next ${FORECAST_DAYS} days with available data.`;
}
