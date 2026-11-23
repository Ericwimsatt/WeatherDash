const data = window.beachSnapshot;
const geography = window.beachGeography;
const labels = { avoid: "Avoid water contact", rain: "Avoid after rain", unknown: "Insufficient data", recent: "Recent test below limit" };
const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
const date = timestamp => timestamp ? format.format(new Date(timestamp)) : "Unavailable";
const observed = Date.parse(data.generatedAt);
const age = timestamp => {
  if (!timestamp) return "Sample unavailable";
  const hours = Math.max(0, Math.floor((observed - Date.parse(timestamp)) / 3600000));
  return hours < 24 ? `${hours}h old` : `${Math.floor(hours / 24)}d old`;
};
const reading = sample => sample ? `${sample.qualifier === "=" ? "" : sample.qualifier}${sample.value.toLocaleString("en-US")}` : "—";
const rainText = site => site.rain?.lowerBound > 0 ? `≥${site.rain.lowerBound.toFixed(2)} in` : "Unverified";
const outfallText = site => site.outfall ? `${site.outfall.meters.toLocaleString("en-US")} m to outfall` : "Unverified";
const postingText = site => ({ advisory: "Advisory", closure: "Closure", warning: "Warning", open: "Open" })[site.posting?.status] ?? "Unverified";
const coverage = site => site.rain?.complete ? "Gauge record complete" : "Partial gauge coverage";
const sampleCell = site => `<strong>${safe(reading(site.sample))}</strong><small>${safe(site.sample?.units)}${site.sample ? " · " : ""}${safe(age(site.sample?.collectedAt))}</small>`;
const details = site => `<button type="button" class="detail" data-site="${site.id}" aria-label="Details for ${safe(site.name)}">Details</button>`;
const reason = site => `<span class="rating">${labels[site.rating.state]}</span><small>${safe(site.rating.reason)}</small>`;
const host = document.querySelector("#view");
const dialog = document.querySelector("#detail");
let view = document.documentElement.dataset.initialView === "map" ? "map" : "table";
let layer = "status";
let selectedId = data.sites[0].id;
const layers = [
  ["status", "Water quality", site => labels[site.rating.state]],
  ["county", "County posting", postingText],
  ["sample", "Latest bacteria test", site => site.sample ? `${reading(site.sample)} · ${age(site.sample.collectedAt)}` : "Sample unavailable"],
  ["rain", "72h rain", rainText],
  ["runoff", "Mapped runoff", outfallText],
];

function paintCoastStatus() {
  const region = data.regionalRain;
  const verdict = data.coastRainHold || "County water-quality status";
  const summary = data.coastRainHold && region?.estimatedLiftAt
    ? `All coastal beaches and bays. The County estimated a lift at ${safe(date(region.estimatedLiftAt))} Pacific, pending confirmation.`
    : "Check current County postings before going in the water.";
  document.querySelector("#coast-status").innerHTML = `<strong>${safe(verdict)}</strong>
    <p>${summary}</p><p class="stamp">Snapshot checked ${safe(date(data.generatedAt))} Pacific · <a href="https://www.sdbeachinfo.com/">Current County postings</a></p>`;
}

function table() {
  return `<p class="scroll-hint">Scroll the table for rain and runoff.</p>
  <div class="data-scroll" tabindex="0" role="region" aria-label="Scrollable beach evidence table">
  <table><colgroup><col class="site-column"><col class="rating-column"><col class="sample-column"><col><col><col></colgroup>
  <thead><tr><th scope="col">Beach</th><th scope="col">Water quality</th><th scope="col">Latest bacteria test</th><th scope="col">County posting</th><th scope="col">72h rain</th><th scope="col">Mapped runoff</th></tr></thead>
  <tbody>${data.sites.map(site => `<tr class="${site.rating.state}">
    <th scope="row"><button type="button" class="beach-link" data-site="${site.id}" aria-label="Details for ${safe(site.name)}">${safe(site.name)}</button><small>${safe(site.location)}</small></th>
    <td>${reason(site)}</td><td>${sampleCell(site)}</td>
    <td><strong class="${site.posting.status === "closure" ? "closure-text" : ""}">${safe(postingText(site))}</strong><small>County map</small></td>
    <td><strong>${safe(rainText(site))}</strong><small>${safe(coverage(site))}</small></td>
    <td><strong>${safe(outfallText(site))}</strong><small>Current flow unverified</small></td>
  </tr>`).join("")}</tbody></table></div>`;
}

const bounds = { west:-117.48, east:-116.91, north:33.22, south:32.513 };
function project(lon, lat) {
  return [(lon - bounds.west) / (bounds.east - bounds.west), (bounds.north - lat) / (bounds.north - bounds.south)];
}

const towns = [
  ["Oceanside",-117.315,33.202], ["Carlsbad",-117.284,33.16], ["Encinitas",-117.241,33.044],
  ["Solana Beach",-117.197,32.988], ["Del Mar",-117.207,32.944], ["La Jolla",-117.202,32.862],
  ["San Diego",-117.116,32.747], ["Coronado",-117.215,32.656], ["Imperial Beach",-117.094,32.562],
];
const routeLabels = [
  ["I-5",33.073], ["SR-78",33.172], ["SR-56",32.958], ["SR-52",32.842], ["I-8",32.776],
  ["I-805",32.687], ["I-15",32.918], ["SR-75",32.622],
];

function drawMap(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const pixel = (lon, lat) => { const [x,y] = project(lon,lat); return [x * width, y * height]; };
  const trace = points => points.forEach((point, index) => ctx[index ? "lineTo" : "moveTo"](...pixel(...point)));

  ctx.fillStyle = "#f0ede1";
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = "#dceff5";
  for (const rings of [[geography.ocean], ...geography.waters]) {
    ctx.beginPath();
    for (const ring of rings) { trace(ring); ctx.closePath(); }
    ctx.fill("evenodd");
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [route, segments] of Object.entries(geography.roads)) {
    ctx.beginPath();
    for (const segment of segments) trace(segment);
    ctx.strokeStyle = "#fffdf6";
    ctx.lineWidth = route.startsWith("I-") ? 3.2 : 2.3;
    ctx.stroke();
    ctx.strokeStyle = route.startsWith("I-") ? "#849098" : "#9ca5a1";
    ctx.lineWidth = route.startsWith("I-") ? 1.35 : .85;
    ctx.stroke();
  }
  ctx.save();
  ctx.setLineDash([4,3]);
  ctx.beginPath();
  trace([[-117.12419,32.53432],[-116.90,32.5576]]);
  ctx.strokeStyle = "#657a83";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  function caption(text, point, type) {
    const [x,y] = pixel(...point);
    if (type === "route") {
      ctx.font = "700 9px system-ui";
      const labelWidth = ctx.measureText(text).width + 8;
      ctx.fillStyle = "#fcfbf5";
      ctx.strokeStyle = "#849098";
      ctx.lineWidth = .8;
      ctx.fillRect(x - labelWidth/2,y - 7,labelWidth,14);
      ctx.strokeRect(x - labelWidth/2,y - 7,labelWidth,14);
    } else {
      ctx.font = type === "town" ? "650 12px system-ui" : "italic 11px system-ui";
      ctx.strokeStyle = type === "town" ? "#f0ede1" : "#dceff5";
      ctx.lineWidth = 3;
      ctx.strokeText(text,x,y);
    }
    ctx.fillStyle = type === "town" ? "#213d48" : "#47636e";
    ctx.fillText(text,x,y);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [route, latitude] of routeLabels) {
    const visible = (geography.roads[route] ?? []).flat().filter(([lon,lat]) =>
      lon > bounds.west + .025 && lon < bounds.east - .035 && lat < bounds.north - .02 && lat > bounds.south + .03);
    const point = visible.reduce((best, candidate) =>
      !best || Math.abs(candidate[1]-latitude) < Math.abs(best[1]-latitude) ? candidate : best, null);
    if (point) caption(route,point,"route");
  }
  for (const [name,lon,lat] of towns) caption(name,[lon,lat],"town");
  caption("Pacific Ocean",[-117.392,32.797],"water");
  caption("San Diego Bay",[-117.172,32.648],"water");
  caption("U.S.–Mexico border",[-117.028,32.531],"water");
}

function map() {
  const selected = data.sites.find(site => site.id === selectedId);
  const [,layerTitle,value] = layers.find(([key]) => key === layer);
  return `<div class="map-controls">
    <label>Map evidence <select id="layer">${layers.map(([key,title]) => `<option value="${key}" ${layer === key ? "selected" : ""}>${title}</option>`).join("")}</select></label>
    <label>Beach <select id="map-site">${data.sites.map(site => `<option value="${site.id}" ${selected.id === site.id ? "selected" : ""}>${safe(site.name)}</option>`).join("")}</select></label>
  </div>
  <p class="map-mobile-selection" aria-live="polite"><strong>${safe(selected.name)}</strong> <span>${safe(value(selected))}</span> ${details(selected)}</p>
  <div class="map">
    <figure class="map-figure">
      <div class="map-visual" role="group" aria-label="San Diego coastline map with towns, highways and 15 monitoring points">
        <canvas class="basemap" aria-hidden="true"></canvas><span class="north" aria-hidden="true">N ↑</span>
        ${data.sites.map((site,index) => {
          const [x,y] = project(site.lon,site.lat);
          return `<button type="button" class="pin ${site.rating.state}" data-pin="${site.id}" style="--x:${x*100}%;--y:${y*100}%" title="${safe(site.name)} · ${safe(value(site))}" aria-label="${safe(site.name)}. ${safe(value(site))}" aria-pressed="${selected.id === site.id}">${index+1}</button>`;
        }).join("")}
      </div>
      <figcaption>Geography from <a href="https://tigerweb.geo.census.gov/tigerweb/">U.S. Census TIGERweb</a></figcaption>
    </figure>
    <div class="map-evidence">
      <section class="map-note ${selected.rating.state}" aria-live="polite">
        <h2>${safe(selected.name)}</h2><p>${reason(selected)}</p>
        <dl><dt>County posting</dt><dd>${safe(postingText(selected))}</dd>
          <dt>Latest bacteria test</dt><dd>${sampleCell(selected)}</dd>
          <dt>72h rain</dt><dd>${safe(rainText(selected))}<small>${safe(coverage(selected))}</small></dd>
          <dt>Mapped runoff</dt><dd>${safe(outfallText(selected))}<small>Current flow unverified</small></dd></dl>
        ${details(selected)}
      </section>
      <table class="map-list"><thead><tr><th scope="col">Beach</th><th scope="col">${layerTitle}</th></tr></thead><tbody>${data.sites.map((site,index) =>
        `<tr class="${site.rating.state}"><th scope="row"><button type="button" class="beach-link" data-map-site="${site.id}" aria-pressed="${site.id === selected.id}"><span class="map-index">${index+1}</span> ${safe(site.name)}</button></th><td>${safe(value(site))}</td></tr>`).join("")}</tbody></table>
    </div>
  </div>`;
}
function measurementChart(target, values, maximum, limit) {
  const width = Math.floor(target.getBoundingClientRect().width);
  const height = 112;
  const ratio = window.devicePixelRatio || 1;
  target.width = width * ratio;
  target.height = height * ratio;
  const context = target.getContext("2d");
  context.scale(ratio, ratio);
  const x = timestamp => (Date.parse(timestamp) - (observed - 30 * 86400000)) / (30 * 86400000) * (width - 12) + 6;
  const y = value => height - 8 - value / maximum * (height - 16);
  context.strokeStyle = "#cbd9df";
  for (let offset = 0; offset <= 30; offset += 5) {
    const position = x(new Date(observed - offset * 86400000).toISOString());
    context.beginPath(); context.moveTo(position, 2); context.lineTo(position, height - 8); context.stroke();
  }
  if (limit) {
    context.strokeStyle = "#941f39";
    context.setLineDash([4, 4]);
    context.beginPath(); context.moveTo(6, y(limit)); context.lineTo(width - 6, y(limit)); context.stroke();
  }
  context.fillStyle = "#126557";
  for (const point of values) {
    if (!Number.isFinite(point.value) || x(point.at) < 6 || x(point.at) > width - 6) continue;
    context.beginPath(); context.arc(x(point.at), y(point.value), 3.4, 0, Math.PI * 2); context.fill();
  }
}

function openDetail(site) {
  const sample = site.sample;
  const points = (site.history ?? []).filter(item => item.units === sample?.units && item.method === sample?.method && Date.parse(item.collectedAt) >= observed - 30 * 86400000);
  const rain = data.rainSeries[site.rainGauge] ?? [];
  const latest = new Intl.DateTimeFormat("en-US", { month:"short", day:"numeric", timeZone:"America/Los_Angeles" });
  const axis = `<div class="axis"><span>${latest.format(observed - 30 * 86400000)}</span><span>${latest.format(observed - 15 * 86400000)}</span><span>${latest.format(observed)}</span></div>`;
  const difference = sample?.difference;
  document.querySelector("#detail-body").innerHTML = `
    <h2 id="detail-title">${safe(site.name)}</h2><p class="${site.rating.state}">${reason(site)}</p>
    <dl><dt>Monitoring point</dt><dd>${safe(site.location)} · ${safe(site.monitor)}</dd>
    <dt>Coastwide conditions</dt><dd>${safe(data.coastRainHold || "No verified coastwide hold in this snapshot")}</dd>
    <dt>County snapshot</dt><dd>${safe(site.posting.status)} · ${safe(date(site.posting.observedAt))}</dd>
    <dt>Latest Enterococcus</dt><dd>${safe(reading(sample))} ${safe(sample?.units)} ${sample ? `· ${safe(sample.method)}` : ""}</dd>
    <dt>Sample collected</dt><dd>${safe(date(sample?.collectedAt))}</dd>
    <dt>Single-sample limit</dt><dd>${sample?.threshold ? safe(sample.threshold.toLocaleString("en-US")) : "Unavailable"} ${difference == null ? "" : `· ${Math.abs(difference).toLocaleString("en-US")} ${difference >= 0 ? "at or above" : "below"}`}</dd>
    <dt>72h measured rain</dt><dd>${safe(rainText(site))} · ${safe(site.rainGauge)} · partial coverage</dd>
    <dt>Mapped outfall</dt><dd>${site.outfall ? `${safe(site.outfall.name)} · ${safe(site.outfall.meters)} m` : "Unavailable"}</dd></dl>
    <div class="timeline"><strong>Sample history</strong><p>${points.length ? `${points.length} comparable recorded results in the past 30 days.` : "No comparable results for this point in the snapshot."}</p><canvas id="bacteria" role="img" aria-label="Sample observations on a 30 day axis"></canvas>${axis}</div>
    <div class="timeline"><strong>Measured rain intervals</strong><p>Gauge observations with gaps. Values are inches per reported interval.</p><canvas id="rain" role="img" aria-label="Rain observations on the same 30 day axis"></canvas>${axis}</div>
    <p><a href="https://cosdapps.sandiegocounty.gov/sdbeachinfo/SamplesReport?SiteId=${site.countyId}">County sample report</a> · <a href="https://www.sdbeachinfo.com/">Current County postings</a></p>`;
  dialog.setAttribute("aria-labelledby", "detail-title");
  dialog.showModal();
  measurementChart(document.querySelector("#bacteria"), points.map(point => ({ at:point.collectedAt, value:point.value })), Math.max(1, sample?.threshold ?? 0, ...points.map(point => point.value)), sample?.threshold);
  measurementChart(document.querySelector("#rain"), rain.map(point => ({ at: point.end, value: point.inches })), Math.max(.1, ...rain.map(point => point.inches)));
}

const observer = new ResizeObserver(entries => drawMap(entries[0].target));
function paint() {
  observer.disconnect();
  for (const button of document.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", button.dataset.view === view);
  }
  host.innerHTML = view === "map" ? map() : table();
  const canvas = host.querySelector(".basemap");
  if (canvas) observer.observe(canvas);
}

document.querySelector(".view-switch").addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button || button.dataset.view === view) return;
  view = button.dataset.view;
  paint();
});

host.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.site) {
    openDetail(data.sites.find(site => site.id === Number(button.dataset.site)));
  }
  const name = button.dataset.pin ? "data-pin" : "data-map-site";
  const id = Number(button.getAttribute(name));
  if (id && id !== selectedId) {
    selectedId = id;
    paint();
    host.querySelector(`[${name}="${id}"]`).focus({preventScroll:true});
  }
});

host.addEventListener("change", event => {
  const control = event.target;
  if (control.id === "layer") layer = control.value;
  if (control.id === "map-site") selectedId = Number(control.value);
  if (control.id === "layer" || control.id === "map-site") {
    paint();
    document.getElementById(control.id).focus({preventScroll:true});
  }
});
paintCoastStatus();
paint();
