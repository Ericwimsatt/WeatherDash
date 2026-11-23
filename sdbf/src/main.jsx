import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { assessCoast, sampleEvidence } from "../data/rating.mjs";
import { age, countyUrl, coverage, date, labels, outfallText, postingText, rainText, reading } from "./evidence.js";
import { drawMap, project } from "./map.js";
import { measurementChart } from "./charts.js";
import "../preview/geography.js";
import "../preview/snapshot.js";

const geography = window.beachGeography;
const initial = window.beachSnapshot;
const day = 86400000;
const layers = [
  ["status", "Water quality", site => labels[site.rating.state]],
  ["county", "County posting", postingText],
  ["sample", "Latest bacteria test", (site, now) => site.sample ? `${reading(site.sample)} · ${age(site.sample.collectedAt, now)}` : "Sample unavailable"],
  ["rain", "72h rain", rainText],
  ["runoff", "Mapped runoff", outfallText],
];

function Sample({ sample, now }) {
  return <><strong>{reading(sample)}</strong>{sample && <small>{sample.units} · {age(sample.collectedAt, now)}</small>}</>;
}

function Rating({ site }) {
  return <><strong className="rating">{labels[site.rating.state]}</strong><small>{site.rating.reason}</small></>;
}

function Table({ sites, now, open }) {
  return <>
    <p className="scroll-hint">Scroll the table for the rest of the evidence.</p>
    <div className="data-scroll" tabIndex={0} role="region" aria-label="Scrollable beach evidence table">
      <table><colgroup><col className="rating-column" /><col className="site-column" /><col className="sample-column" /><col /><col /><col /></colgroup>
        <thead><tr>{["Water quality", "Beach", "Latest bacteria test", "County posting", "72h rain", "Mapped runoff"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{sites.map(site => <tr key={site.id} className={site.rating.state}>
          <td><Rating site={site} /></td>
          <th scope="row"><button className="beach-link" onClick={event => open(site.id, event.currentTarget)}>{site.name}</button><small>{site.location}</small></th>
          <td><Sample sample={site.sample} now={now} /></td>
          <td><strong>{postingText(site)}</strong><small>{date(site.posting?.observedAt)}</small></td>
          <td><strong>{rainText(site)}</strong><small>{coverage(site)}</small></td>
          <td><strong>{outfallText(site)}</strong><small>{site.runoff?.hazard || "Current flow unverified"}</small></td>
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
    <div className="map">
      <figure className="map-figure">
        <div className="map-visual" role="group" aria-label="Map of San Diego County beaches, towns, bays and highways">
          <canvas className="basemap" aria-hidden="true" ref={canvas} /><span className="north" aria-hidden="true">N ↑</span>
          {sites.map(site => {
            const [x,y] = project(site.lon, site.lat);
            return <div key={site.id} className={`station ${site.rating.state} ${westLabels.has(site.id) ? "station-west" : ""}`}
              style={{"--x":`${x*100}%`, "--y":`${y*100}%`, "--offset":`${closeLabels.get(site.id) ?? 0}px`}}>
              <span className="station-dot" aria-hidden="true" />
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
      <table className="map-list"><thead><tr><th scope="col">Beach</th><th scope="col">{title}</th></tr></thead><tbody>{sites.map(site => <tr className={site.rating.state} key={site.id}>
        <th scope="row"><button className="beach-link" onClick={event => activate(event, site.id)} onPointerEnter={event => hover(event, site.id)} onPointerLeave={() => clearTimeout(timer.current)} aria-haspopup="dialog">{site.name}</button></th>
        <td><span className="evidence-dot" aria-hidden="true" />{getValue(site, now)}</td>
      </tr>)}</tbody></table>
    </div>
  </>;
}

function Chart({ title, points, maximum, limit, now, note }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const draw = () => measurementChart(canvas, points, maximum, limit, now);
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, maximum, limit, now]);
  const short = new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", timeZone:"America/Los_Angeles" });
  return <section className="timeline"><h3>{title}</h3><p>{note}</p>
    <canvas ref={ref} role="img" aria-label={`${title} over the last 30 days`} />
    <div className="axis">{[30,15,0].map(offset => <span key={offset}>{short.format(now - offset*day)}</span>)}</div>
  </section>;
}

function Detail({ site, snapshot, now, dismiss }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const sample = site.sample;
  const evidence = sampleEvidence(sample);
  const values = site.history.filter(point => point.units === sample?.units && point.method === sample?.method &&
    Date.parse(point.collectedAt) >= now - 30*day && Date.parse(point.collectedAt) <= now);
  const rain = (snapshot.rainSeries[site.rainGauge] ?? []).filter(point => Date.parse(point.end) >= now - 30*day);
  const weather = snapshot.context?.[site.rainGauge];
  return <dialog ref={dialog} onClose={dismiss} aria-labelledby="detail-title">
    <header className="dialog-heading"><h2 id="detail-title">{site.name}</h2><form method="dialog"><button autoFocus>Close</button></form></header>
    <p className={site.rating.state}><Rating site={site} /></p>
    <dl>
      <dt>Monitoring point</dt><dd>{site.location} · {site.monitor}</dd>
      <dt>County posting</dt><dd>{postingText(site)}<small>Source update {date(site.posting?.observedAt)} · checked {date(site.posting?.verifiedAt)}</small></dd>
      <dt>Coastwide rain</dt><dd>{snapshot.regionalRain?.advisory === "active" ? "Countywide advisory" : snapshot.regionalRain?.advisory === "clear" ? "County notice clear at last check" : "Unverified"} {snapshot.regionalRain?.estimatedLiftAt && <small>Estimated lift {date(snapshot.regionalRain.estimatedLiftAt)} Pacific</small>}</dd>
      <dt>Latest Enterococcus</dt><dd>{reading(sample)} {sample?.units}<small>{sample?.method} · collected {date(sample?.collectedAt)} Pacific</small></dd>
      <dt>Single-sample limit</dt><dd>{evidence?.threshold?.toLocaleString("en-US") ?? "Unavailable"} {evidence?.difference != null && <small>{Math.abs(evidence.difference).toLocaleString("en-US")} {evidence.difference >= 0 ? "at or above" : "below"} the limit</small>}</dd>
      <dt>72h observed rain</dt><dd>{rainText(site)} · {site.rainGauge}<small>{coverage(site)}{site.rain?.endedAt && ` · last measured rain ended ${date(site.rain.endedAt)}`}</small></dd>
      <dt>Mapped outfall</dt><dd>{outfallText(site)}<small>{site.outfall?.name}{site.outfall?.name ? " · " : ""}{site.runoff?.hazard || "Current flow unverified"}</small></dd>
      <dt>Spill and runoff reports</dt><dd><a href="https://www.sandiegocounty.gov/content/sdc/hhsa/programs/phs/community_epidemiology/south-region-health-concerns/Environmental-Dashboard.html">County environmental dashboard</a></dd>
      {weather?.river && <><dt>San Diego River flow</dt><dd>{weather.river.cfs} ft³/s · {weather.river.station}<small>{date(weather.river.observedAt)} Pacific · USGS gauge context</small></dd></>}
      {weather?.air != null && <><dt>Modeled air temperature</dt><dd>{weather.air} °F · Open-Meteo<small>{date(weather.airAt)} Pacific{weather.wind != null && ` · Wind ${weather.wind} mph`}</small></dd></>}
      {weather?.sunrise && <><dt>Sunrise / sunset</dt><dd>{date(weather.sunrise)} / {date(weather.sunset)} Pacific</dd></>}
      {weather?.sea && <><dt>Modeled sea temperature</dt><dd>{weather.sea.temperature} °F · Open-Meteo Marine<small>{date(weather.sea.at)} Pacific</small></dd></>}
      {weather?.level && <><dt>Observed water level</dt><dd>{weather.level.height} ft · {weather.level.station}<small>{date(weather.level.observedAt)} Pacific · NOAA MLLW</small></dd></>}
      {weather?.water && <><dt>Observed water temperature</dt><dd>{weather.water.temperature} °F · {weather.water.station}<small>{date(weather.water.observedAt)} Pacific · NOAA</small></dd></>}
      {weather?.tide && <><dt>Next predicted tide</dt><dd>{weather.tide.height} ft {weather.tide.type === "H" ? "high" : "low"} · {weather.tide.station}<small>{date(weather.tide.at)} Pacific · NOAA MLLW</small></dd></>}
    </dl>
    <Chart title="Enterococcus sample history" note={values.length ? `${values.length} comparable results in the last 30 days.` : "No comparable results in the last 30 days."}
      points={values.map(point => ({ at:point.collectedAt, value:point.value }))} maximum={Math.max(1,evidence?.threshold ?? 0,...values.map(point => point.value))} limit={evidence?.threshold} now={now} />
    <Chart title="Observed rain" note="Inches per measured interval. Unobserved intervals remain blank."
      points={rain.map(point => ({ at:point.end, value:point.inches }))} maximum={Math.max(.1,...rain.map(point => point.inches))} now={now} />
    <p><a href={`https://cosdapps.sandiegocounty.gov/sdbeachinfo/SamplesReport?SiteId=${site.countyId}`}>County sample report</a> · <a href={countyUrl}>County postings</a></p>
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
  const heading = result.coastRainHold || (result.candidates.length ? `${result.candidates.length} sites with recent tests below the limit` : "No lower-concern beach verified");
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
  const [snapshot,setSnapshot] = useState(initial);
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
        Date.parse(incoming.generatedAt) >= Date.parse(previous.generatedAt) ? incoming : previous);
    };
    const timeout = setTimeout(() => controller.abort(),65000);
    const check = manual ? requestSnapshot("/api/cache",controller.signal,"POST") : requestSnapshot("/api/source",controller.signal);
    const results = await Promise.allSettled([
      requestSnapshot("/api/cache",controller.signal).then(apply), check.then(result => { apply(result); return result; }),
    ]);
    clearTimeout(timeout);
    if (pending.current !== controller) return;
    pending.current = null;
    setNow(Date.now());
    setRefreshing(false);
    const source = results[1];
    if (source.status === "rejected" || source.value.unavailable?.length)
      setStatus("Some sources are unavailable. Showing the latest saved evidence.");
  }

  useEffect(() => {
    void refresh();
    const sampleClock = setInterval(() => setNow(Date.now()),60000);
    const updates = setInterval(() => { if (!document.hidden) void refresh(); },5*60000);
    const connected = () => { void refresh(); };
    window.addEventListener("online",connected);
    return () => {
      pending.current?.abort();
      pending.current = null;
      clearInterval(sampleClock);
      clearInterval(updates);
      window.removeEventListener("online",connected);
    };
  }, []);

  const result = assessCoast(snapshot.sites,{regionalRain:snapshot.regionalRain},now);
  const sites = snapshot.sites.map((site,index) => ({...site,rating:result.results[index].water}));
  const urgency = { avoid:0, rain:1, unknown:2, recent:3 };
  const tableSites = [...sites].sort((a,b) => urgency[a.rating.state]-urgency[b.rating.state] || b.lat-a.lat);
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
