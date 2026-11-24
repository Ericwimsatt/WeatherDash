import { pointTotal,rainLimits,rainPeriods,hour } from "./point-rain.mjs";

const day=24*hour;
const calendar=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/Los_Angeles"});
const pacificDate=new Intl.DateTimeFormat("en-US",{month:"2-digit",day:"2-digit",timeZone:"America/Los_Angeles"});
export const FORECAST_DAYS=10;

export function dayStart(now) {
  const date=calendar.format(now);
  const seven=Date.parse(date+"T07:00:00Z");
  return calendar.format(seven)===date ? seven : seven+hour;
}

export function runoffHorizon(site,now) {
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
  return {starts,ends,localDaily,inlandDaily,
    currentX:4+(Math.floor(now/hour)*hour-today)/day-.5,
    localCurrent:rollingAt(site.localPoint,rainPeriods.local,Math.min(now,Date.parse(site.localPoint?.verifiedAt))),
    inlandCurrent:rollingAt(site.inlandPoint,rainPeriods.inland,Math.min(now,Date.parse(site.inlandPoint?.verifiedAt))),
    local3:rolling(site.localPoint,rainPeriods.local),inland4:rolling(site.inlandPoint,rainPeriods.inland),
    local3Before:rollingAt(site.localPoint,rainPeriods.local,starts[0]),
    inland4Before:rollingAt(site.inlandPoint,rainPeriods.inland,starts[0]),
    local3After:rollingAt(site.localPoint,rainPeriods.local,ends.at(-1)+day),
    inland4After:rollingAt(site.inlandPoint,rainPeriods.inland,ends.at(-1)+day),
    localTotal,inlandTotal,localKnown,inlandKnown};
}

export function safeEstimate(site,now,snapshot) {
  if(site.rating.score<3)return "Currently safe to swim.";
  const regional=snapshot?.regionalRain;
  const signals=site.rating.signals.filter(signal=>signal.score>=5);
  const bacteria=signals.some(signal=>signal.field==="bacteria");
  const county=signals.some(signal=>signal.field==="county" || signal.field==="regional" && /countywide rain advisory/i.test(signal.reason));
  const lift=Date.parse(regional?.estimatedLiftAt);
  if(bacteria)return `Not forecast to be safe in the next ${FORECAST_DAYS} days.`;
  if(county){
    if(regional?.advisory==="active" && Number.isFinite(lift) && lift>now)
      return `Forecast to be safe to swim in by ${pacificDate.format(lift)}.`;
    return `Not forecast to be safe in the next ${FORECAST_DAYS} days.`;
  }
  const values=runoffHorizon(site,now);
  if((values.localKnown||values.inlandKnown) && Math.max(values.localTotal,values.inlandTotal)<.1)return "No rain forecast in next 10 days.";
  const dayIndex=values.ends.findIndex((_,index)=>index>=4 && values.local3[index]!=null && values.inland4[index]!=null && values.local3[index]<rainLimits.local && values.inland4[index]<rainLimits.inland);
  if(dayIndex>=4)return `Forecast to be safe to swim in by ${pacificDate.format(values.ends[dayIndex])}.`;
  return `Not forecast to be safe in the next ${FORECAST_DAYS} days.`;
}
