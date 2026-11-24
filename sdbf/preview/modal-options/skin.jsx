import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {assessCoast,sampleEvidence} from '../../data/rating.mjs';
import {age,date,postingText,rainDisplay,reading,scoreFactors,mapCauses} from '../../src/evidence.js';
import {safeEstimate} from '../../data/runoff-forecast.mjs';
import {withPointRain} from '../../data/point-rain.mjs';
import {drawMap} from './map.js';
import './evidence-snapshot.js';
import '../geography.js';
const RunoffChart=lazy(()=>import('../../src/runoff.jsx'));
function Sample({ sample, now }) {
  return <><strong>{reading(sample)}</strong>{sample && <small>{sample.units} · {age(sample.collectedAt, now)}</small>}</>;
}

function Rating({ rating }) {
  return <div className={`score ${rating.score >= 7 ? "hazard" : ""}`}>
    <strong className="score-number" style={{"--score-color":rating.color}}>{rating.score}<span>/10</span></strong>
    <small>{rating.label}</small>
  </div>;
}

function FactorHelp({ why }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="factor-help-button" aria-expanded={open} aria-label="Why does this matter?" onClick={() => setOpen(open => !open)}>
      <span aria-hidden="true">?</span>
    </button>
    {open && <span className="factor-help-text" role="note">{why}</span>}
  </>;
}

function ScoreFactors({ site, now, causesOnly=false }) {
  const factors = causesOnly ? mapCauses(site,now) : scoreFactors(site,now);
  return <ul className="score-factors" aria-label="Contributing factors">
    {factors.map(({score,text,warning,why}) => <li key={text} className={score>=7 ? "hazard" : undefined}>
      {text}{why && <FactorHelp why={why} />}{warning && <strong className="runoff-warning hazard">{warning}</strong>}
    </li>)}
  </ul>;
}

function Rain({site,inland=false,now}) {
  return <strong>{rainDisplay(site,inland,now)}</strong>;
}

function Detail({ site, snapshot, now, dismiss }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.setAttribute("open", ""); }, []);
  const sample = site.sample;
  const evidence = sampleEvidence(sample);
  const weather = snapshot.context?.[site.rainGauge];
  const hazardous = field => site.rating.signals.some(signal => signal.field===field && signal.score>=5) ? "hazard" : undefined;
  const hazardFields = ["bacteria","county"].filter(field=>site.rating.signals.some(signal=>signal.field===field && signal.score>=7));
  const evidenceRows = {
    local: <><dt>Local rain in the past 72 hours</dt><dd className={hazardous("local")}><Rain site={site} now={now} /></dd></>,
    inland: <><dt>Inland rain in the past 4 days</dt><dd className={hazardous("inland")}><Rain site={site} inland now={now} /><small>About 3 miles inland</small></dd></>,
    bacteria: <><dt>Latest bacteria test</dt><dd className={hazardous("bacteria")}><Sample sample={sample} now={now} />{evidence?.difference != null && <small>{Math.abs(evidence.difference).toLocaleString("en-US")} {evidence.difference >= 0 ? "at or above" : "below"} the limit</small>}</dd></>,
    county: <><dt>County posting</dt><dd className={hazardous("county")}><strong>{postingText(site)}</strong><small>Updated {date(site.posting?.observedAt)} Pacific</small></dd></>,
  };
  const orderedHazards = [...hazardFields].sort((a,b) => Math.max(...site.rating.signals.filter(signal=>signal.field===b).map(signal=>signal.score))-Math.max(...site.rating.signals.filter(signal=>signal.field===a).map(signal=>signal.score)));
  const remaining = ["local","inland","bacteria","county"].filter(field=>!orderedHazards.includes(field));
  const rows = fields => <dl className="quick-evidence">{fields.map(field=><React.Fragment key={field}>{evidenceRows[field]}</React.Fragment>)}</dl>;

  return <dialog ref={dialog} onClose={dismiss} aria-labelledby="detail-title">
    <header className="dialog-heading"><h2 id="detail-title">{site.name}</h2><form method="dialog"><button>Close</button></form></header>
    <div className="modal-score"><Rating rating={site.rating} /><ScoreFactors site={site} now={now} /><p className="safe-estimate">{safeEstimate(site,now,snapshot)}</p></div>
    {site.rating.notes.map(note => <p key={note} className="timeline-note">{note}</p>)}
    {orderedHazards.length>0 && rows(orderedHazards)}
    <Suspense fallback={<p className="timeline-note">Loading runoff forecast…</p>}><RunoffChart site={site} now={now} /></Suspense>
    {rows(remaining)}
    <details className="monitoring-details">
      <summary>Monitoring details and recent tests</summary>
      <dl>
        <dt>Sampling point</dt><dd>{site.location} · {site.monitor}</dd>
        <dt>Sample time</dt><dd>{date(sample?.collectedAt)} Pacific · {sample?.method || "Method unavailable"}</dd>
        <dt>Rain points</dt><dd>{site.coastal?.name ?? site.rainGauge}{site.inlandRain?.name && <small>Inland · {site.inlandRain.name}</small>}</dd>
        <dt>Spill reports</dt><dd><a href="https://www.sandiegocounty.gov/content/sdc/hhsa/programs/phs/community_epidemiology/south-region-health-concerns/Environmental-Dashboard.html">County environmental dashboard</a></dd>
        {weather?.river && <><dt>River discharge</dt><dd>{weather.river.cfs} ft³/s · {weather.river.station}<small>{date(weather.river.observedAt)} Pacific · USGS</small></dd></>}
        {weather?.air != null && <><dt>Air temperature</dt><dd>{weather.air} °F · Open-Meteo<small>{date(weather.airAt)} Pacific{weather.wind != null && ` · Wind ${weather.wind} mph`}</small></dd></>}
        {weather?.sunrise && <><dt>Sunrise / sunset</dt><dd>{date(weather.sunrise)} / {date(weather.sunset)} Pacific</dd></>}
        {weather?.sea && <><dt>Modeled sea temperature</dt><dd>{weather.sea.temperature} °F · Open-Meteo Marine</dd></>}
        {weather?.water && <><dt>Observed water temperature</dt><dd>{weather.water.temperature} °F · {weather.water.station}<small>{date(weather.water.observedAt)} Pacific · NOAA</small></dd></>}
        {weather?.level && <><dt>Observed water level</dt><dd>{weather.level.height} ft · {weather.level.station}<small>{date(weather.level.observedAt)} Pacific · NOAA MLLW</small></dd></>}
        {weather?.tide && <><dt>Next predicted tide</dt><dd>{weather.tide.height} ft {weather.tide.type === "H" ? "high" : "low"} · {weather.tide.station}<small>{date(weather.tide.at)} Pacific · NOAA MLLW</small></dd></>}
      </dl>
      {site.history.length>0 && <table className="sample-history"><thead><tr><th scope="col">Collected</th><th scope="col">Enterococcus</th></tr></thead>
        <tbody>{site.history.slice(0,4).map(point => <tr key={point.id}><td>{date(point.collectedAt)}</td><td className={sampleEvidence(point)?.above ? "hazard" : undefined}>{reading(point)} {point.units} · {point.method}</td></tr>)}</tbody></table>}
      <p><a href={`https://cosdapps.sandiegocounty.gov/sdbeachinfo/SamplesReport?SiteId=${site.countyId}`}>County sample report</a></p>
    </details>
  </dialog>;
}


const theme=new URLSearchParams(location.search).get('theme')||'artistic';
document.documentElement.dataset.theme=theme;
const snapshot=window.visualSnapshot;
const now=Date.parse(snapshot.generatedAt);
const enriched=snapshot.sites.map(site=>withPointRain(site,snapshot.pointRain,now,snapshot.rainHistory));
const assessment=assessCoast(enriched,{regionalRain:snapshot.regionalRain},now);
const sites=enriched.map((site,index)=>({...site,rating:assessment.results[index].water}));
const site=sites.find(s=>s.name==='La Jolla Shores')||sites[0];
function Preview(){const [open,setOpen]=useState(true);const canvas=useRef(null);useEffect(()=>{const observer=new ResizeObserver(()=>drawMap(canvas.current,window.beachGeography));observer.observe(canvas.current);return()=>observer.disconnect()},[]);return <><canvas className="skin-map" ref={canvas} aria-hidden="true"/><button className="reopen" onClick={()=>setOpen(true)}>Open beach detail</button>{open&&<Detail site={site} snapshot={snapshot} now={now} dismiss={()=>setOpen(false)}/>}</>}
createRoot(document.getElementById('root')).render(<Preview/>);
