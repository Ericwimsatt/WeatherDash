import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { assessCoast, sampleEvidence, scoreColors } from "../data/rating.mjs";
import { age, bacteriaExplanation, contributionClass, date, evidenceLimitations, mapCauses, regionalRainLabel, regionalRainWhy, postingText, rainDisplay, rainDrivesScore, reading, sampleSummary } from "./evidence.js";
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
  return <><strong>{sampleSummary(sample)}</strong><p className="sample-reading">{bacteriaExplanation(sample, now, false)}</p>{sample && <small className="sample-collected">Collected {date(sample.collectedAt)} Pacific · {age(sample.collectedAt,now)}</small>}</>;
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
    {open && <div className="factor-help-text" role="note">{why} <a href="/methodology.html">How the score is calculated</a></div>}
  </>;
}

function BacteriaHelp() {
  return <>
    <p>Enterococcus indicates waste contamination that can cause illness. DNA and culture tests use different limits.</p>
    <p>A low result does not guarantee safe water. Follow County postings.</p>
    <a href="/methodology.html#bacteria-scoring">About bacteria testing</a>
  </>;
}

function ScoreFactors({ site, now, detail = false }) {
  const directNotice = ["advisory", "warning", "closure"].includes(site.posting?.status);
  const factors = mapCauses(site,now).filter(factor => !detail ||
    (!["local", "county"].includes(factor.field) && !factor.text.startsWith("Regional rain:") || factor.text.startsWith("Local rain gauge:")) &&
      !(directNotice && factor.field === "nearbyCounty"));
  if (!factors.length) return null;
  return <ul className="score-factors" aria-label="Contributing factors">
    {factors.map(({contribution,text,warning,why,href,field}) => <li key={text} className={contributionClass(contribution)}>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${text} — view County notices (opens in a new tab)`}>{text}</a> : text}{why && <FactorHelp why={field === "bacteria" ? <BacteriaHelp /> : why} label={field === "bacteria" ? "What do bacteria tests mean?" : undefined} />}{warning && <strong className="runoff-warning hazard">{warning}</strong>}
    </li>)}
  </ul>;
}

function Rain({site,regional=false,now}) {
  return <strong>{rainDisplay(site,regional,now)}</strong>;
}

const westLabels = new Set([381, 373, 351, 644, 461, 455]);
const closeLabels = new Map([[646,-8],[644,6],[455,5]]);

function MapView({ sites, now, open }) {
  const canvas = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    const target = canvas.current;
    let active = true;
    const observer = new ResizeObserver(() => drawMap(target, geography));
    observer.observe(target);
    // Canvas text needs an explicit redraw when the self-hosted faces arrive.
    Promise.all([
      document.fonts.load('400 16px "Atkinson Hyperlegible"'),
      document.fonts.load('700 16px "Atkinson Hyperlegible"'),
      document.fonts.load('italic 400 16px "Atkinson Hyperlegible"'),
    ]).then(() => { if (active) drawMap(target, geography); })
      .catch(error => console.warn("Map font unavailable", error));
    return () => { active = false; observer.disconnect(); clearTimeout(timer.current); };
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
          {scoreColors.map((color,index) => <span key={color} style={{"--score-color":color,"--score-ink":index >= 2 && index <= 6 ? "#101010" : "#fff"}}>{index+1}</span>)}
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
  const [regionalHelpOpen, setRegionalHelpOpen] = useState(false);
  const sample = site.sample;
  const earlierBacteriaWarning = site.rating.signals.find(signal => signal.field === "bacteria" && signal.collectedAt !== sample?.collectedAt);
  const earlierBacteriaSample = earlierBacteriaWarning && site.history.find(point =>
    point.collectedAt === earlierBacteriaWarning.collectedAt && point.value / sampleEvidence(point)?.threshold === earlierBacteriaWarning.ratio);
  const rainFirst = rainDrivesScore(site);
  const estimate = safeEstimate(site,now,snapshot,sites);
  const limitations = evidenceLimitations(site,now);
  const notes = [...new Set([...limitations, ...site.rating.notes.filter(note =>
    note !== "The last test was more than 4 days ago.")])];
  const weather = snapshot.context?.[site.rainGauge];
  const hazardous = field => contributionClass(Math.max(0,...site.rating.signals.filter(signal =>
    signal.field===field && (field !== "regional" || Number.isFinite(signal.amount))).map(signal => signal.contribution ?? 0)));
  const hazardFields = ["bacteria","county"].filter(field=>site.rating.signals.some(signal=>signal.field===field && signal.score>=7));
  const evidenceRows = {
    local: <><dt>Local rain in the past 72 hours</dt><dd className={hazardous("local")}><Rain site={site} now={now} /></dd></>,
    regional: <><dt>{regionalRainLabel} <button type="button" className="factor-help-button" aria-label="What does regional rain mean?" aria-expanded={regionalHelpOpen} aria-controls="regional-rain-explainer" onClick={() => setRegionalHelpOpen(open => !open)}><span aria-hidden="true">?</span></button></dt><dd className={hazardous("regional")}><Rain site={site} regional now={now} /></dd>{regionalHelpOpen && <dd id="regional-rain-explainer" className="factor-help-text regional-rain-explainer">{regionalRainWhy} <a href="/methodology.html">How the score is calculated</a></dd>}</>,
    bacteria: <><dt>Latest bacteria test <button type="button" className="factor-help-button" aria-label="What do bacteria tests mean?" aria-expanded={bacteriaHelpOpen} aria-controls="bacteria-explainer" onClick={() => setBacteriaHelpOpen(open => !open)}><span aria-hidden="true">?</span></button></dt><dd className={hazardous("bacteria")}><Sample sample={sample} now={now} />{earlierBacteriaSample && <p className="sample-reading"><strong>Earlier elevated sample.</strong> {bacteriaExplanation(earlierBacteriaSample,now)} Elevated results count for four days.</p>}</dd>{bacteriaHelpOpen && <dd id="bacteria-explainer" className="factor-help-text bacteria-explainer"><BacteriaHelp /></dd>}</>,
    county: <><dt>County status</dt><dd className={hazardous("county")}><strong>{postingText(site)}</strong>{["advisory","warning","closure","rain advisory"].includes(site.posting?.status) && <small><a href="https://cosdapps.sandiegocounty.gov/sdbeachinfo/" target="_blank" rel="noopener noreferrer">View County notices</a></small>}<small>Updated {date(site.posting?.observedAt)} Pacific</small></dd></>,
  };
  const orderedHazards = [...hazardFields].sort((a,b) => Math.max(...site.rating.signals.filter(signal=>signal.field===b).map(signal=>signal.score))-Math.max(...site.rating.signals.filter(signal=>signal.field===a).map(signal=>signal.score)));
  const remaining = ["bacteria","county"].filter(field=>!orderedHazards.includes(field));
  const rows = fields => fields.length > 0 && <dl className="quick-evidence">{fields.map(field=><React.Fragment key={field}>{evidenceRows[field]}</React.Fragment>)}</dl>;
  const runoff = <>
    {rows(["local","regional"])}
    <Suspense fallback={<p className="timeline-note">Loading runoff forecast…</p>}><RunoffChart site={site} sites={sites} now={now} /></Suspense>
  </>;

  return <dialog className="beach-detail" ref={dialog} onClose={dismiss} aria-labelledby="detail-title">
    <header className="dialog-heading"><h2 id="detail-title">{site.name}</h2><form method="dialog"><button autoFocus>Close</button></form></header>
    <div className="modal-score"><Rating rating={site.rating} /><ScoreFactors site={site} now={now} detail />{estimate && <p className="safe-estimate">{estimate}</p>}</div>
    {notes.map(note => <p key={note} className="timeline-note">{note}</p>)}
    {orderedHazards.length>0 && rows(orderedHazards)}
    {rainFirst && runoff}
    {rows(remaining)}
    {!rainFirst && runoff}
    <details className="monitoring-details">
      <summary>Monitoring details and recent tests</summary>
      <dl>
        <dt>Sampling point</dt><dd>{site.location} · {site.monitor}</dd>
        <dt>Sample time</dt><dd>{date(sample?.collectedAt)} Pacific · {sample?.method || "Method unavailable"}</dd>
        <dt>Latest test reading</dt><dd>{reading(sample)}{sample && ` ${sample.units}`}</dd>
        <dt>Rain points</dt><dd>{site.coastal?.name ?? site.rainGauge}</dd>
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
  const sites = enriched.map((site,index) => ({...site,regionalEstimate:result.results[index].regionalEstimate,rating:result.results[index].water}));
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
