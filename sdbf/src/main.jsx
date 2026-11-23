import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { assessCoast, sampleEvidence, scoreColors } from "../data/rating.mjs";
import { age, countyUrl, date, outfallText, postingText, rainDisplay, reading, scoreFactors } from "./evidence.js";
import { drawMap, project } from "./map.js";

import { withPointRain } from "../data/point-rain.mjs";
import "../preview/geography.js";
import "../preview/snapshot.js";

const RunoffChart = lazy(() => import("./runoff.jsx"));
const geography = window.beachGeography;
const initial = window.beachSnapshot;
const layers = [
  ["status", "Safety score", site => `${site.rating.score}/10 · ${site.rating.label}`],
  ["county", "County posting", postingText],
  ["sample", "Latest bacteria test", (site, now) => site.sample ? `${reading(site.sample)} · ${age(site.sample.collectedAt, now)}` : "Sample unavailable"],
  ["rain", "Local rain · 72h", site => rainDisplay(site).value],
  ["inland", "Inland rain · 4 days", site => rainDisplay(site,true).value],
];

function Sample({ sample, now }) {
  return <><strong>{reading(sample)}</strong>{sample && <small>{sample.units} · {age(sample.collectedAt, now)}</small>}</>;
}

function Rating({ rating }) {
  return <div className={`score ${rating.score >= 7 ? "hazard" : ""}`}>
    <strong className="score-number" style={{"--score-color":rating.color}}>{rating.score}<span>/10</span></strong>
    <small>{rating.label}</small>
  </div>;
}

function ScoreFactors({ site, now }) {
  return <ul className="score-factors" aria-label="Contributing factors">
    {scoreFactors(site,now).map(({score,text}) => <li key={text} className={score>=7 ? "hazard" : undefined}>{text}</li>)}
  </ul>;
}

function Rain({site,inland=false}) {
  const display = rainDisplay(site,inland);
  return <><strong>{display.value}</strong><small>{display.note}</small></>;
}

function Table({ sites, now, open }) {
  return <>
    <p className="scroll-hint">Swipe for inland rain, bacteria, and County postings.</p>
    <div className="data-scroll" tabIndex={0} role="region" aria-label="Scrollable beach evidence table">
      <table><colgroup><col className="site-column" /><col className="rating-column" /><col /><col /><col className="sample-column" /><col /></colgroup>
        <thead><tr>{["Beach", "Safety score", "Local rain · 72h", "Inland rain · 4 days", "Latest bacteria test", "County posting"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{sites.map(site => <tr key={site.id}>
          <th scope="row"><button className="beach-link" onClick={event => open(site.id,event.currentTarget)}>{site.name}</button><small>{site.location}</small></th>
          <td><Rating rating={site.rating} /><ScoreFactors site={site} now={now} /></td>
          <td><Rain site={site} /></td><td><Rain site={site} inland /></td>
          <td><Sample sample={site.sample} now={now} /></td>
          <td><strong>{postingText(site)}</strong><small>{date(site.posting?.observedAt)}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

const westLabels = new Set([381, 373, 351, 644, 461, 455]);
const closeLabels = new Map([[646,-8],[644,6],[455,5]]);

function MapView({ sites, now, open }) {
  const canvas = useRef(null);
  const timer = useRef(null);
  const [layer, setLayer] = useState("status");
  const [, title, getValue] = layers.find(item => item[0] === layer);
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
    <div className="map-controls"><label>Map evidence <select value={layer} onChange={event => setLayer(event.target.value)}>{layers.map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
    <div className="score-legend" aria-label="Safety scores from 1, lowest observed concern, to 10, dangerous">
      {scoreColors.map((color,index) => <span key={color} style={{"--score-color":color}}>{index+1}</span>)}
      <small>Lower concern → higher risk</small>
    </div>
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
                aria-haspopup="dialog" aria-label={`${site.name}. ${getValue(site, now)}. Show details.`}>
                {site.name}
              </button>
            </div>;
          })}
        </div>
        <figcaption>Geography from <a href="https://tigerweb.geo.census.gov/tigerweb/">U.S. Census TIGERweb</a></figcaption>
      </figure>
      <table className="map-list"><thead><tr><th scope="col">Beach</th><th scope="col">{title}</th></tr></thead><tbody>{sites.map(site => <tr style={{"--rating":site.rating.color}} key={site.id}>
        <th scope="row"><button className="beach-link" onClick={event => activate(event, site.id)} onPointerEnter={event => hover(event, site.id)} onPointerLeave={() => clearTimeout(timer.current)} aria-haspopup="dialog">{site.name}</button></th>
        <td><span className="evidence-dot" aria-hidden="true" />{getValue(site, now)}{layer==="status" && <ScoreFactors site={site} now={now} />}</td>
      </tr>)}</tbody></table>
    </div>
  </>;
}

function Detail({ site, snapshot, now, dismiss }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const sample = site.sample;
  const evidence = sampleEvidence(sample);
  const weather = snapshot.context?.[site.rainGauge];
  const hazardous = field => site.rating.signals.some(signal => signal.field===field && signal.score>=5) ? "hazard" : undefined;

  return <dialog ref={dialog} onClose={dismiss} aria-labelledby="detail-title">
    <header className="dialog-heading"><h2 id="detail-title">{site.name}</h2><form method="dialog"><button autoFocus>Close</button></form></header>
    <div className="modal-score"><Rating rating={site.rating} /><ScoreFactors site={site} now={now} /></div>
    <dl className="quick-evidence">
      <dt>Local rain · 72h</dt><dd className={hazardous("local")}><Rain site={site} />{site.rain?.lowerBound>0 && !site.rain.complete && <small>Gauge minimum {site.rain.lowerBound.toFixed(2)} in</small>}</dd>
      <dt>Inland rain · 4 days</dt><dd className={hazardous("inland")}><Rain site={site} inland /><small>{site.inlandRain?.name}</small>{site.inlandGaugeRain?.lowerBound>0 && !site.inlandGaugeRain.complete && <small>{site.inlandGaugeRain.station} gauge minimum {site.inlandGaugeRain.lowerBound.toFixed(2)} in</small>}</dd>
      <dt>Latest bacteria test</dt><dd className={hazardous("bacteria")}><Sample sample={sample} now={now} />
        {evidence?.difference != null && <small>{Math.abs(evidence.difference).toLocaleString("en-US")} {evidence.difference >= 0 ? "at or above" : "below"} the limit</small>}</dd>
      <dt>County posting</dt><dd className={hazardous("county")}><strong>{postingText(site)}</strong><small>Updated {date(site.posting?.observedAt)} Pacific</small></dd>
    </dl>
    <Suspense fallback={<p className="timeline-note">Loading runoff chart…</p>}><RunoffChart site={site} now={now} /></Suspense>
    <details className="monitoring-details">
      <summary>Monitoring details and recent tests</summary>
      <dl>
        <dt>Sampling point</dt><dd>{site.location} · {site.monitor}</dd>
        <dt>Sample time</dt><dd>{date(sample?.collectedAt)} Pacific · {sample?.method || "Method unavailable"}</dd>
        <dt>Nearby outfall</dt><dd>{outfallText(site)}<small>{site.outfall?.name}</small></dd>
        <dt>Rain points</dt><dd>{site.coastal?.name ?? site.rainGauge}<small>Inland · {site.inlandRain?.name ?? "Unavailable"}</small><small>Weather-model estimates describe nearby grid areas. Gauges measure rain at a station.</small></dd>
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
      <p><a href={`https://cosdapps.sandiegocounty.gov/sdbeachinfo/SamplesReport?SiteId=${site.countyId}`}>County sample report</a> · <a href={countyUrl}>County postings</a></p>
    </details>
  </dialog>;
}

async function requestSnapshot(endpoint, signal, method="GET") {
  const response = await fetch(endpoint, { method, signal, headers:{ Accept:"application/json" } });
  if (!response.ok) throw Error(`Beach data ${response.status}`);
  return response.json();
}

function CoastNotice({ result, snapshot, now }) {
  const regional = snapshot.regionalRain;
  const isActive = regional?.advisory === "active";
  const estimated = regional?.estimatedLiftAt;
  const heading = result.coastRainHold || (result.candidates.length ? `${result.candidates.length} sites with the lowest observed concern` : "No beach currently scores 1–2");
  return <section className="coast-status" aria-label="Coastwide water quality">
    <strong>{heading}</strong>
    {result.coastRainHold && <p>Applies to all coastal beaches and bays. {isActive && estimated && (
      Date.parse(estimated) > now ? `County estimated lift ${date(estimated)} Pacific, pending confirmation.`
        : `County’s estimated lift was ${date(estimated)} Pacific. Confirmation is pending.`
    )}</p>}
    <p className="stamp">County checked {date(snapshot.countyCheckedAt ?? regional?.verifiedAt)} Pacific · <a href={countyUrl}>Current County postings</a></p>
  </section>;
}

function App() {
  const [snapshot,setSnapshot] = useState(null);
  const [now,setNow] = useState(Date.now);
  const [view,setView] = useState(new URLSearchParams(location.search).get("view") === "map" ? "map" : "table");
  const [detailId,setDetailId] = useState(null);
  const [refreshing,setRefreshing] = useState(true);
  const [status,setStatus] = useState("");
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

  async function refresh(manual = false) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setRefreshing(true);
    setStatus("");
    const apply = ({snapshot: incoming}) => {
      if (incoming?.sites?.length) setSnapshot(previous =>
        !previous || Date.parse(incoming.generatedAt) >= Date.parse(previous.generatedAt) ? incoming : previous);
    };
    const timeout = setTimeout(() => controller.abort(),65000);
    const check = manual ? requestSnapshot("/api/cache",controller.signal,"POST") : requestSnapshot("/api/source",controller.signal);
    const results = await Promise.allSettled([
      requestSnapshot("/api/cache",controller.signal).then(apply), check.then(result => { apply(result); return result; }),
    ]);
    clearTimeout(timeout);
    if (pending.current !== controller) return;
    pending.current = null;
    setSnapshot(previous => previous ?? initial);
    setNow(Date.now());
    setRefreshing(false);
    const source = results[1];
    if (source.status === "rejected" || source.value.unavailable?.length)
      setStatus("Some sources are unavailable. Showing the latest saved evidence.");
  }

  useEffect(() => {
    void refresh();
    const fallback = setTimeout(() => setSnapshot(previous => previous ?? initial),1600);
    const sampleClock = setInterval(() => setNow(Date.now()),60000);
    const updates = setInterval(() => { if (!document.hidden) void refresh(); },5*60000);
    const connected = () => { void refresh(); };
    window.addEventListener("online",connected);
    return () => {
      pending.current?.abort();
      pending.current = null;
      clearTimeout(fallback);
      clearInterval(sampleClock);
      clearInterval(updates);
      window.removeEventListener("online",connected);
    };
  }, []);

  if (!snapshot) return <>
    <header className="page-heading"><h1>San Diego Beach Finder</h1><p>Water quality from Oceanside to the border</p></header>
    <div className="skeleton" role="status"><span className="visually-hidden">Loading beach conditions</span><div /><div /><div /><div /><div /></div>
  </>;

  const enriched = snapshot.sites.map(site => withPointRain(site,snapshot.pointRain,now));
  const result = assessCoast(enriched,{regionalRain:snapshot.regionalRain},now);
  const sites = enriched.map((site,index) => ({...site,rating:result.results[index].water}));
  const tableSites = [...sites].sort((a,b) => a.rating.score-b.rating.score || b.lat-a.lat);
  const detail = sites.find(site => site.id === detailId);

  return <>
    <header className="page-heading"><h1>San Diego Beach Finder</h1><p>Water quality from Oceanside to the border</p></header>
    <main>
      <CoastNotice result={result} snapshot={snapshot} now={now} />
      <div className="view-bar">
        <div className="view-switch" aria-label="Beach display">
          <button type="button" aria-pressed={view==="table"} onClick={() => setView("table")}>Table</button>
          <button type="button" aria-pressed={view==="map"} onClick={() => setView("map")}>Map</button>
        </div>
        <button className="refresh" type="button" disabled={refreshing} onClick={() => void refresh(true)}>{refreshing ? "Checking sources…" : "Refresh evidence"}</button>
      </div>
      {status && <p className="source-status" role="status">{status}</p>}
      <section aria-label="Beach water quality evidence">
        {view==="map" ? <MapView sites={sites} now={now} open={open} /> : <Table sites={tableSites} now={now} open={open} />}
      </section>
      <footer><a href={countyUrl}>Official County beach notices</a> · <a href="/methodology.html">How water quality is rated</a></footer>
    </main>
    {detail && <Detail site={detail} snapshot={snapshot} now={now} dismiss={dismiss} />}
  </>;
}

createRoot(document.getElementById("root")).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(error => console.warn("Offline setup unavailable",error));
}
