const data = window.beachSnapshot;
const layouts = [
  { id: "ledger", name: "Coast Ledger", selected: true, description: "One compact table and an uncluttered map with a selected pin." },
  { id: "atlas", name: "Regional Atlas", selected: true, description: "Coast sections in the table, with a linked site list on the map." },
  { id: "matrix", name: "Evidence Matrix", description: "Separate evidence columns and a selectable evidence layer on the map." },
  { id: "board", name: "Conditions Board", description: "Table rows grouped by rating, with reasons labeled along the shoreline." },
];
const labels = { avoid: "Avoid water contact", rain: "Avoid after rain", unknown: "Insufficient data", recent: "Recent test below limit" };
const positions = [[27,8],[30,14],[33,20],[37,26],[39,32],[42,38],[45,44],[50,51],[47,57],[44,63],[44,69],[42,76],[52,83],[58,90],[62,96]];
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
const rainText = site => !site.rain?.lowerBound ? "Rain total unverified" : `≥${site.rain.lowerBound.toFixed(2)} in`;
const sampleCell = site => `<strong>${safe(reading(site.sample))}</strong><small>${safe(site.sample?.units)}${site.sample ? " · " : ""}${safe(age(site.sample?.collectedAt))}</small>`;
const details = site => `<button class="detail" data-site="${site.id}" aria-label="Details for ${safe(site.name)}">Details</button>`;
const reason = site => `<span class="rating">${labels[site.rating.state]}</span><small>${safe(site.rating.reason)}</small>`;
const grid = document.querySelector("#choices");
const dialog = document.querySelector("#detail");

function table(layout) {
  const matrix = layout.id === "matrix";
  const header = matrix ? ["Beach", "Rating", "Latest test", "72h rain", "Runoff", "Details"] : ["Beach", "Water quality", "Latest test", "Details"];
  const rows = layout.id === "board" ? [...data.sites].sort((a, b) => Object.keys(labels).indexOf(a.rating.state) - Object.keys(labels).indexOf(b.rating.state)) : data.sites;
  const group = site => layout.id === "atlas" ? site.area : layout.id === "board" ? labels[site.rating.state] : null;
  return `<div class="data-scroll" tabindex="0" role="region" aria-label="Beach results"><table><thead><tr>${header.map(label => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${rows.map((site, index) => {
    const section = group(site);
    const groupHeading = section && (index === 0 || group(rows[index - 1]) !== section)
      ? `</tbody><tbody><tr class="group ${site.rating.state}"><th colspan="${header.length}" scope="rowgroup">${safe(section)}</th></tr>` : "";
    return `${groupHeading}<tr class="${site.rating.state}"><th scope="row">${safe(site.name)}<small>${safe(site.location)}</small></th><td>${reason(site)}</td><td>${sampleCell(site)}</td>${matrix ? `<td>${safe(rainText(site))}<small>Partial gauge coverage</small></td><td>${site.outfall ? "Outfall mapped" : "Unverified"}</td>` : ""}<td>${details(site)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function map(layout) {
  const selected = data.sites.find(site => site.id === layout.site) ?? data.sites[0];
  const annotations = layout.id === "board";
  const mapText = site => layout.layer === "sample" ? reading(site.sample) : layout.layer === "rain" ? rainText(site) : site.rating.reason;
  return `${layout.id === "matrix" ? `<label>Map labels <select class="layer"><option value="status">Rating reason</option><option value="sample" ${layout.layer === "sample" ? "selected" : ""}>Latest test</option><option value="rain" ${layout.layer === "rain" ? "selected" : ""}>72h rain</option></select></label>` : ""}
  <div class="map"><div class="map-visual" role="group" aria-label="Schematic map showing all monitored beaches"><p class="map-help">Coast schematic<br>Oceanside to the border</p>
  ${data.sites.map((site, index) => {
    const [x,y] = positions[index];
    const style = `--x:${x}%;--y:${y}%;--label-x:${x + 5}%`;
    return `<button class="pin ${site.rating.state}" data-pin="${site.id}" style="${style}" aria-label="${safe(site.name)}. ${labels[site.rating.state]}" aria-pressed="${selected.id === site.id}">${index + 1}</button>
      ${annotations ? `<span class="map-label ${site.rating.state}" style="${style}">${safe(mapText(site))}</span>` : ""}`;
  }).join("")}</div>
  ${layout.id === "atlas" ? `<div class="map-list" aria-label="Sites on the map">${data.sites.map(site => `<button class="${site.rating.state}" data-pin="${site.id}" aria-pressed="${selected.id === site.id}">${safe(site.name)}<strong>${safe(site.rating.reason)}</strong></button>`).join("")}</div>` : ""}
  <aside class="map-note ${selected.rating.state}"><strong>${safe(selected.name)}</strong>${reason(selected)}<small>${layout.layer && layout.layer !== "status" ? safe(mapText(selected)) + " · " : ""}${safe(age(selected.sample?.collectedAt))}</small>${details(selected)}</aside></div>`;
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

function paintOption(layout) {
  layout.panel.querySelector(".view").innerHTML = layout.view === "map" ? map(layout) : table(layout);
  layout.panel.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", button.dataset.view === layout.view));
}

function density() {
  grid.classList.remove("carousel");
  const isCarousel = grid.scrollHeight > innerHeight / 2;
  grid.classList.toggle("carousel", isCarousel);
  document.body.classList.toggle("is-carousel", isCarousel);
}

function update() {
  for (const layout of layouts) {
    layout.panel.hidden = Boolean(layout.discarded);
    layout.panel.classList.toggle("minimized", Boolean(layout.minimized));
    layout.panel.querySelector("[data-minimize]").textContent = layout.minimized ? "Expand" : "Minimize";
  }
  document.querySelector("#count").textContent = `${layouts.filter(layout => !layout.discarded).length} of ${layouts.length} shown`;
  requestAnimationFrame(density);
}

for (const layout of layouts) {
  layout.view = "table";
  const panel = document.createElement("article");
  layout.panel = panel;
  panel.className = `layout ${layout.id}`;
  panel.innerHTML = `<header class="layout-summary"><h2>${layout.name}${layout.selected ? '<span class="label">Shortlisted</span>' : ''}</h2><p>${layout.description}</p>
    <div class="layout-actions"><button data-minimize>Minimize</button><button data-discard>Discard</button></div></header>
    <section class="app"><h3>Beach water quality</h3><p class="stamp">Archived comparison · ${safe(date(data.generatedAt))} Pacific</p>
    <div class="view-switch" aria-label="Beach display"><button data-view="table">Table</button><button data-view="map">Map</button></div><div class="view"></div></section>`;
  grid.append(panel);
  paintOption(layout);
  panel.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if ("minimize" in button.dataset) { layout.minimized = !layout.minimized; update(); }
    if ("discard" in button.dataset) { layout.discarded = true; update(); document.querySelector("#restore").focus(); }
    if (button.dataset.view) { layout.view = button.dataset.view; paintOption(layout); }
    if (button.dataset.pin) {
      const wasPin = button.classList.contains("pin");
      const listScroll = panel.querySelector(".map-list")?.scrollTop;
      layout.site = Number(button.dataset.pin);
      paintOption(layout);
      if (listScroll) panel.querySelector(".map-list").scrollTop = listScroll;
      panel.querySelector(`${wasPin ? ".pin" : ".map-list button"}[data-pin="${layout.site}"]`)?.focus();
    }
    if (button.dataset.site) openDetail(data.sites.find(site => site.id === Number(button.dataset.site)));
  });
  panel.addEventListener("change", event => {
    if (event.target.matches(".layer")) { layout.layer = event.target.value; paintOption(layout); panel.querySelector(".layer").focus(); }
  });
}
document.querySelector("#restore").onclick = () => { for (const layout of layouts) { layout.discarded = false; layout.minimized = false; } update(); };
document.querySelector("#shortlist").onclick = () => { for (const layout of layouts) layout.discarded = !layout.selected; update(); };
for (const [id, direction] of [["prev", -1], ["next", 1]]) {
  document.querySelector(`#${id}`).onclick = () => grid.scrollBy({ left: direction * Math.min(grid.clientWidth, 616), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
}
window.addEventListener("resize", density);
update();
