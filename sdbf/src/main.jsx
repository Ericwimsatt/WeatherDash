import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { assessCoast, sampleEvidence, scoreColors } from "../data/rating.mjs";
import { age, date, mapCauses, postingText, rainDisplay, reading } from "./evidence.js";
import { safeEstimate } from "../data/runoff-forecast.mjs";
import { drawMap, project } from "./map.js";

import { withPointRain } from "../data/point-rain.mjs";
import "../preview/geography.js";
import "../preview/snapshot.js";

const RunoffChart = lazy(() => import("./runoff.jsx"));
const geography = window.beachGeography;
const initial = window.beachSnapshot;
const mapScore = site => `${site.rating.score}/10 · ${site.rating.label}`;

function Sample({ sample, now }) {
  return <><strong>{reading(sample)}</strong>{sample && <small>{sample.units} · {age(sample.collectedAt, now)}</small>}</>;
}

function Rating({ rating }) {
  return <div className={`score ${rating.score >= 7 ? "hazard" : ""}`}>
    <strong className="score-number" style={{"--score-color":rating.color}}>{rating.score}<span>/10</span></strong>
    <small>{rating.label}</small>
  </div>;
}

function FactorHelp({ why, label = "Why does this matter?" }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="factor-help-button" aria-expanded={open} aria-label={label} onClick={() => setOpen(open => !open)}>
      <span aria-hidden="true">?</span>
    </button>
    {open && <div className="factor-help-text" role="note">{why}</div>}
  </>;
}

function BacteriaHelp() {
  return <>
    <strong>What the bacteria test tells you</strong>
    <p>Beach tests look for Enterococcus, a sign that human or animal waste may be in the water. Some programs also test coliform bacteria. These are clues that germs may be present, including viruses and bacteria that can cause stomach illness, rashes, or ear and breathing infections.</p>
    <p>The County uses ddPCR, a test that counts bacterial DNA. Results are usually ready the same day. Its advisory level is 1,413 DNA copies per 100 mL of water. Culture tests grow live bacteria and use a different limit: 104 MPN or CFU per 100 mL. Those limits serve a similar purpose; the readings cannot be compared number for number.</p>
    <p>We check tests from the past 4 days. A reading at 25% of its test’s advisory level raises the score to at least 3: sensitive groups should use caution. At 40%, it scores at least 4. At 75%, it scores at least 5, and sensitive groups should avoid water contact. Swimming may still be possible below the limit, but some risk remains. “Bacteria levels higher than normal” is our caution label, not a measured local average or a County advisory. Follow current County postings.</p>
    <a href="https://www.sandiegocounty.gov/content/sdc/deh/lwqd/beachandbay.html">County testing and current beach status</a>{" · "}
    <a href="https://www.epa.gov/newsreleases/epa-approves-rapid-test-assess-beach-water-quality-san-diego-county">How the DNA test works</a>
  </>;
}

function ScoreFactors({ site, now }) {
  const factors = mapCauses(site,now);
  return <ul className="score-factors" aria-label="Contributing factors">
    {factors.map(({score,text,warning,why,href}) => <li key={text} className={score>=7 ? "hazard" : undefined}>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${text} — view County notices (opens in a new tab)`}>{text}</a> : text}{why && <FactorHelp why={why} />}{warning && <strong className="runoff-warning hazard">{warning}</strong>}
    </li>)}
  </ul>;
}

function Rain({site,inland=false,now}) {
  return <strong>{rainDisplay(site,inland,now)}</strong>;
}

const westLabels = new Set([381, 373, 351, 644, 461, 455]);
const closeLabels = new Map([[646,-8],[644,6],[455,5]]);

function MapView({ sites, now, open }) {
  const canvas = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    const target = canvas.current;
    const observer = new ResizeObserver(() => drawMap(target, geography));
    observer.observe(target);
    return () => { observer.disconnect(); clearTimeout(timer.current); };
  }, []);
  function hover(event, id) {
    if (event.pointerType !== "mouse") return;
    const target = event.currentTarget;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => open(id, target), 350);
  }
  function activate(event, id) {
    clearTimeout(timer.current);
    open(id, event.currentTarget);
  }
  return <>
    <div className="map">
      <figure className="map-figure">
        <div className="map-visual" role="group" aria-label="Map of San Diego County beaches, towns, bays and highways">
          <canvas className="basemap" aria-hidden="true" ref={canvas} /><span className="north" aria-hidden="true">N ↑</span>
          {sites.map(site => {
            const [x,y] = project(site.lon, site.lat);
            return <div key={site.id} className={`station ${westLabels.has(site.id) ? "station-west" : ""}`}
              style={{"--x":`${x*100}%`, "--y":`${y*100}%`, "--offset":`${closeLabels.get(site.id) ?? 0}px`, "--rating":site.rating.color}}>
              <button className="station-dot" type="button" onClick={event => activate(event,site.id)} aria-haspopup="dialog"
                aria-label={`${site.name}. Safety score ${site.rating.score} of 10. Show details.`} />
              <button className="station-name" type="button" onClick={event => activate(event, site.id)}
                onPointerEnter={event => hover(event, site.id)} onPointerLeave={() => clearTimeout(timer.current)}
                aria-haspopup="dialog" aria-label={`${site.name}. ${mapScore(site)}. Show details.`}>
                {site.name}
              </button>
            </div>;
          })}
        </div>
        <div className="score-legend" aria-label="Safety scores from 1, lowest observed concern, to 10, dangerous">
          {scoreColors.map((color,index) => <span key={color} style={{"--score-color":color,"--score-ink":index >= 1 && index <= 6 ? "#182a26" : "#fff"}}>{index+1}</span>)}
          <small>Lower concern → higher risk</small>
        </div>
      </figure>
      <table className="map-list"><thead><tr><th scope="col">Beach</th><th scope="col">Safety score</th></tr></thead><tbody>{sites.map(site => <tr style={{"--rating":site.rating.color}} key={site.id}>
        <th scope="row"><button className="beach-link" onClick={event => activate(event, site.id)} onPointerEnter={event => hover(event, site.id)} onPointerLeave={() => clearTimeout(timer.current)} aria-haspopup="dialog">{site.name}</button></th>
        <td><span className="evidence-dot" aria-hidden="true" />{mapScore(site)}<ScoreFactors site={site} now={now} /></td>
      </tr>)}</tbody></table>
    </div>
  </>;
}

function Detail({ site, sites, snapshot, now, dismiss }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const [bacteriaHelpOpen, setBacteriaHelpOpen] = useState(false);
  const sample = site.sample;
  const evidence = sampleEvidence(sample);
  const weather = snapshot.context?.[site.rainGauge];
  const hazardous = field => site.rating.signals.some(signal => signal.field===field && signal.score>=5) ? "hazard" : undefined;
  const hazardFields = ["bacteria","county"].filter(field=>site.rating.signals.some(signal=>signal.field===field && signal.score>=7));
  const evidenceRows = {
    local: <><dt>Local rain in the past 72 hours</dt><dd className={hazardous("local")}><Rain site={site} now={now} /></dd></>,
    inland: <><dt>Inland rain in the past 4 days</dt><dd className={hazardous("inland")}><Rain site={site} inland now={now} /></dd></>,
    bacteria: <><dt>Latest bacteria test <button type="button" className="factor-help-button" aria-label="What do bacteria tests mean?" aria-expanded={bacteriaHelpOpen} aria-controls="bacteria-explainer" onClick={() => setBacteriaHelpOpen(open => !open)}><span aria-hidden="true">?</span></button></dt><dd className={hazardous("bacteria")}><Sample sample={sample} now={now} />{evidence?.difference != null && <small>{Math.abs(evidence.difference).toLocaleString("en-US")} {evidence.difference >= 0 ? "at or above" : "below"} the limit</small>}</dd>{bacteriaHelpOpen && <dd id="bacteria-explainer" className="factor-help-text bacteria-explainer"><BacteriaHelp /></dd>}</>,
    county: <><dt>County status</dt><dd className={hazardous("county")}><strong>{postingText(site)}</strong>{["advisory","warning","closure","rain advisory"].includes(site.posting?.status) && <small><a href="https://cosdapps.sandiegocounty.gov/sdbeachinfo/" target="_blank" rel="noopener noreferrer">View County notices</a></small>}<small>Updated {date(site.posting?.observedAt)} Pacific</small></dd></>,
  };
  const orderedHazards = [...hazardFields].sort((a,b) => Math.max(...site.rating.signals.filter(signal=>signal.field===b).map(signal=>signal.score))-Math.max(...site.rating.signals.filter(signal=>signal.field===a).map(signal=>signal.score)));
  const remaining = ["local","inland","bacteria","county"].filter(field=>!orderedHazards.includes(field));
  const rows = fields => <dl className="quick-evidence">{fields.map(field=><React.Fragment key={field}>{evidenceRows[field]}</React.Fragment>)}</dl>;

  return <dialog className="beach-detail" ref={dialog} onClose={dismiss} aria-labelledby="detail-title">
    <header className="dialog-heading"><h2 id="detail-title">{site.name}</h2><form method="dialog"><button autoFocus>Close</button></form></header>
    <div className="modal-score"><Rating rating={site.rating} /><ScoreFactors site={site} now={now} /><p className="safe-estimate">{safeEstimate(site,now,snapshot,sites)}</p></div>
    {site.rating.notes.map(note => <p key={note} className="timeline-note">{note}</p>)}
    {orderedHazards.length>0 && rows(orderedHazards)}
    <Suspense fallback={<p className="timeline-note">Loading runoff forecast…</p>}><RunoffChart site={site} sites={sites} now={now} /></Suspense>
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

async function requestSnapshot(endpoint, signal, method="GET") {
  const response = await fetch(endpoint, { method, signal, headers:{ Accept:"application/json" } });
  if (!response.ok) throw Error(`Beach data ${response.status}`);
  return response.json();
}

function CoastNotice({ snapshot, now }) {
  const regional = snapshot.regionalRain;
  if (regional?.advisory !== "active") return null;
  const estimated = regional?.estimatedLiftAt;
  return <section className="coast-status" aria-label="Coastwide water quality">
    <strong className="hazard">Danger</strong>
    <p>County warning following recent regional rainfall. Rain can carry pollutants into beaches and bays across the region. {estimated && (
      Date.parse(estimated) > now ? `The County estimates the advisory may lift on ${date(estimated)} Pacific; confirmation is pending.`
        : `The County’s estimated lift date was ${date(estimated)} Pacific; confirmation is pending.`
    )} <a href="https://cosdapps.sandiegocounty.gov/sdbeachinfo/" target="_blank" rel="noopener noreferrer">View County notices</a></p>
  </section>;
}

function App() {
  const [snapshot,setSnapshot] = useState(null);
  const [now,setNow] = useState(Date.now);
  const [detailId,setDetailId] = useState(null);
  const pending = useRef(null);
  const focusTarget = useRef(null);

  function open(id, target) {
    if (detailId != null) return;
    focusTarget.current = target;
    setDetailId(id);
  }

  function dismiss() {
    setDetailId(null);
    requestAnimationFrame(() => focusTarget.current?.focus({preventScroll:true}));
  }

  async function refresh() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const apply = ({snapshot: incoming}) => {
      if (incoming?.sites?.length) setSnapshot(previous =>
        !previous || Date.parse(incoming.generatedAt) >= Date.parse(previous.generatedAt) ? incoming : previous);
    };
    const timeout = setTimeout(() => controller.abort(),65000);
    const check = requestSnapshot("/api/source",controller.signal);
    await Promise.allSettled([
      requestSnapshot("/api/cache",controller.signal).then(apply), check.then(result => { apply(result); return result; }),
    ]);
    clearTimeout(timeout);
    if (pending.current !== controller) return;
    pending.current = null;
    setSnapshot(previous => previous ?? initial);
    setNow(Date.now());
  }

  useEffect(() => {
    void refresh();
    const fallback = setTimeout(() => setSnapshot(previous => previous ?? initial),1600);
    const sampleClock = setInterval(() => setNow(Date.now()),60000);
    const updates = setInterval(() => { if (!document.hidden) void refresh(); },5*60000);
    const connected = () => { void refresh(); };
    let pullStartY = null;
    const pullStart = event => {
      if (window.scrollY <= 0 && !document.querySelector("dialog[open]") && event.touches.length === 1) {
        pullStartY = event.touches[0].clientY;
      } else {
        pullStartY = null;
      }
    };
    const pullEnd = event => {
      if (pullStartY !== null && window.scrollY <= 0 && event.changedTouches.length === 1
        && event.changedTouches[0].clientY - pullStartY >= 90) window.location.reload();
      pullStartY = null;
    };
    window.addEventListener("online",connected);
    document.addEventListener("touchstart",pullStart,{passive:true});
    document.addEventListener("touchend",pullEnd,{passive:true});
    return () => {
      pending.current?.abort();
      pending.current = null;
      clearTimeout(fallback);
      clearInterval(sampleClock);
      clearInterval(updates);
      window.removeEventListener("online",connected);
      document.removeEventListener("touchstart",pullStart);
      document.removeEventListener("touchend",pullEnd);
    };
  }, []);

  if (!snapshot) return <>
    <header className="page-heading"><h1>San Diego Beach Finder</h1></header>
    <div className="skeleton" role="status"><span className="visually-hidden">Loading beach conditions</span><div /><div /><div /><div /><div /></div>
  </>;

  const enriched = snapshot.sites.map(site => withPointRain(site,snapshot.pointRain,now,snapshot.rainHistory));
  const result = assessCoast(enriched,{regionalRain:snapshot.regionalRain},now);
  const sites = enriched.map((site,index) => ({...site,rating:result.results[index].water}));
  const detail = sites.find(site => site.id === detailId);

  return <>
    <header className="page-heading"><h1>San Diego Beach Finder</h1></header>
    <main>
      <CoastNotice snapshot={snapshot} now={now} />
      <section aria-label="Beach water quality evidence">
        <MapView sites={sites} now={now} open={open} />
      </section>
      <footer><a href="/methodology.html">How water quality is rated</a><p>Geography from <a href="https://tigerweb.geo.census.gov/tigerweb/">U.S. Census TIGERweb</a></p></footer>
    </main>
    {detail && <Detail site={detail} sites={sites} snapshot={snapshot} now={now} dismiss={dismiss} />}
  </>;
}

createRoot(document.getElementById("root")).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(error => console.warn("Offline setup unavailable",error));
}
