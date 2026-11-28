import { useEffect, useMemo, useRef, useState } from "octane";
import { LOCATIONS, SF_MAP_BEACHES as beaches, type Location } from "../config.ts";
import { useLocation } from "../data/hooks.ts";
import type { Range } from "../data/providers.ts";
import type { ForecastTimeline } from "../data/forecast-timeline.ts";
import { MAP_LOCATIONS, projectMap, isInMap, nearestMapLocation, selectMapLocations, summarizeMapWeather, fieldScale, fieldColor, interpolateHigh, type Coordinates, type MapReading, type FieldSample } from "../data/regional-map.ts";
import { shiftDate } from "../../shared/time.ts";
import { waterForDay, weatherDay, extrema } from "../data/selectors.ts";
import baseMap from "../assets/maps/san-francisco.svg?raw";
import icons from "../assets/maps/icons.json";
import "./regional-map.css";

const coordinatesStyle = (p: Coordinates) => { const { x, y } = projectMap(p); return { left: `${x / 10}%`, top: `${y / 8.75}%` }; };
const n = (value: number | null | undefined, digits = 0) => value == null ? "—" : value.toFixed(digits);
function MapIcon({ name }: { name: keyof typeof icons }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = icons[name]; }, [name]);
  return <span className="regional-map__icon" ref={ref} aria-hidden="true" />;
}
function MapSample({ location, date, range, onReading }: { location: Location; date: string; range: Range; onReading: (id: string, date: string, reading: MapReading, loading: boolean) => void }) {
  const q = useLocation(location, range);
  useEffect(() => {
    if (q.data) onReading(location.id, date, summarizeMapWeather(q.data.bundle, date), q.isFetching);
    else onReading(location.id, date, { high: null, low: null, uv: null, rain: null, wind: null, partialRain: true }, q.isFetching);
  }, [q.data, q.isFetching, date, location.id]);
  return null;
}
function BeachConditions({ beach, date, range }: { beach: Location; date: string; range: Range }) {
  const q = useLocation(beach, range, "swim");
  const water = q.data && waterForDay(q.data.bundle, date);
  const wind = q.data && extrema(weatherDay(q.data.bundle, date).map(r => r.wind_speed_mph));
  return <p><strong>{beach.name}</strong> · Water {n(water?.mean_temperature_f)}°F · Wind {n(wind?.max)} mph{q.isFetching ? " · Updating…" : !water && !wind ? " · Beach data unavailable" : ""}. Water quality and surf safety are not available.</p>;
}
export function RegionalMap({ today, range, timeline, onNavigate }: { today: string; range: Range; timeline: ForecastTimeline; onNavigate: (id: string) => void }) {
  const [day, setDay] = useState(() => timeline.settledDay);
  const date = shiftDate(today, day);
  const [user, setUser] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [readings, setReadings] = useState<Record<string, { date: string; reading: MapReading; loading: boolean }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [beach, setBeach] = useState<Location | null>(null);
  const [zoom, setZoom] = useState(1);
  const artwork = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => timeline.subscribeSummary(setDay), [timeline]);
  const visible = useMemo(() => selectMapLocations(user), [user]);
  const nearest = user && isInMap(user) ? nearestMapLocation(user) : null;
  const current = (id: string) => readings[id]?.date === date ? readings[id].reading : undefined;
  const samples: FieldSample[] = MAP_LOCATIONS.flatMap(l => { const r = current(l.id); return r?.high != null ? [{ ...l, high: r.high }] : []; });
  const scale = fieldScale(samples);
  const signature = samples.map(p => `${p.lat},${p.lon}:${p.high}`).join("|");
  const gradient = useMemo(() => {
    if (samples.length < 2) return "";
    const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 140;
    const ctx = canvas.getContext("2d"); if (!ctx) return "";
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const high = interpolateHigh(samples, x / (canvas.width - 1) * 1000, y / (canvas.height - 1) * 875)!;
      const rgb = fieldColor(high, scale), i = (y * canvas.width + x) * 4;
      pixels.data.set([...rgb, 255], i);
    }
    ctx.putImageData(pixels, 0, 0); return canvas.toDataURL();
  }, [signature]);
  useEffect(() => { if (artwork.current) artwork.current.innerHTML = baseMap; }, []);
  useEffect(() => {
    const image = artwork.current?.querySelector(".regional-map__field");
    if (gradient) image?.setAttribute("href", gradient); else image?.removeAttribute("href");
  }, [gradient]);
  function receive(id: string, day: string, reading: MapReading, loading: boolean) {
    setReadings(previous => {
      const next = { date: day, reading, loading };
      return JSON.stringify(previous[id]) === JSON.stringify(next) ? previous : { ...previous, [id]: next };
    });
  }
  function locate() {
    if (!navigator.geolocation) { setLocationStatus("Location is unavailable in this browser."); return; }
    setLocating(true); setLocationStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted.current) return;
      const p = { lat: position.coords.latitude, lon: position.coords.longitude };
      setUser(p); setLocating(false);
      if (isInMap(p)) { setSelected(nearestMapLocation(p).id); setBeach(null); }
      setLocationStatus(isInMap(p) ? `Nearest forecast: ${nearestMapLocation(p).name}.` : "You’re outside the SF map. San Francisco readings remain shown.");
    }, error => { if (mounted.current) { setLocating(false); setLocationStatus(error.code === 1 ? "Location access is off. Enable it in your browser to prioritize a nearby reading." : "Couldn’t find your location. Try again."); } }, { maximumAge: 300000, timeout: 10000 });
  }
  useEffect(() => {
    // Reuse an existing grant; requesting a new grant is an explicit button action.
    navigator.permissions?.query({ name: "geolocation" }).then(result => { if (mounted.current && result.state === "granted") locate(); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (zoom === 1 || !viewport.current) return;
    const p = user && isInMap(user) ? projectMap(user) : projectMap(visible[0]);
    const container = viewport.current, plane = container.firstElementChild as HTMLElement;
    container.scrollLeft = p.x / 1000 * plane.clientWidth - container.clientWidth / 2;
    container.scrollTop = p.y / 875 * plane.clientHeight - container.clientHeight / 2;
  }, [zoom, user]);
  const selection = MAP_LOCATIONS.find(l => l.id === selected), selectedReading = selected ? current(selected) : undefined;
  const route = selection && (LOCATIONS.find(l => l.id === selection.id) || LOCATIONS.filter(l => l.group === "San Francisco").reduce((a, b) => Math.hypot(a.lat - selection.lat, a.lon - selection.lon) < Math.hypot(b.lat - selection.lat, b.lon - selection.lon) ? a : b));
  const loading = MAP_LOCATIONS.some(l => !readings[l.id] || readings[l.id].loading);
  return <section className="regional-map" aria-labelledby="regional-map-title">
    {MAP_LOCATIONS.map(l => <MapSample key={l.id} location={l} date={date} range={range} onReading={receive} />)}
    <div className="regional-map__toolbar"><div><h2 id="regional-map-title">San Francisco</h2><p>{date === today ? "Today" : date} · High / low °F · UV max · rain in · wind &gt;15 mph</p></div><div className="regional-map__actions"><button type="button" onClick={locate} disabled={locating}><MapIcon name="person-pin" />{locating ? "Locating…" : "Use my location"}</button><button type="button" aria-pressed={zoom > 1} onClick={() => setZoom(zoom === 1 ? 2 : 1)}>{zoom === 1 ? "Zoom in" : "Show all SF"}</button></div></div>
    <div className="regional-map__legend"><span>Daily high °F <b>{scale.min}°</b><i /><b>{scale.max}°</b></span><span>{samples.length < 2 ? loading ? "Loading map forecasts…" : "Forecasts unavailable" : `${samples.length} forecast samples · 15 readings · interpolated highs`}</span></div>
    <div className={`regional-map__viewport ${zoom > 1 ? "is-zoomed" : ""}`} ref={viewport}>
      <div className="regional-map__plane" style={{ width: zoom === 1 ? "100%" : "200%" }}>
        <div className="regional-map__art" ref={artwork} aria-hidden="true" />
        {visible.map(l => { const r = current(l.id), near = nearest?.id === l.id; return <button type="button" key={l.id} className={`regional-map__reading ${near ? "is-near" : ""}`} data-map-reading={l.id} aria-pressed={selected === l.id} aria-label={`${l.name}${near ? ", nearest forecast to you" : ""}: high ${n(r?.high)}, low ${n(r?.low)} degrees Fahrenheit, UV maximum ${n(r?.uv)}${r?.rain != null && r.rain > .05 ? `, rain ${n(r.rain, 2)} inches` : ""}${r?.wind != null && r.wind > 15 ? `, wind ${n(r.wind)} miles per hour` : ""}`} style={coordinatesStyle(l)} onClick={() => { setSelected(l.id); setBeach(null); }}><span className="regional-map__temperatures"><b>{n(r?.high)}°</b><span>/</span><em>{n(r?.low)}°</em></span><span className="regional-map__secondary"><span>UV{n(r?.uv)}</span>{r?.rain != null && r.rain > .05 && <span className="regional-map__rain">{r.partialRain ? "≥" : ""}{n(r.rain, 2)}″</span>}</span>{r?.wind != null && r.wind > 15 && <span className="regional-map__wind">{n(r.wind)} mph</span>}{near && <small>Near you</small>}</button>; })}
        {beaches.map(b => <button type="button" className="regional-map__beach" key={b.id} style={coordinatesStyle(b)} aria-label={`${b.name}: beach conditions`} onClick={() => { setBeach(b); setSelected(null); }}><MapIcon name="freestyle" /></button>)}
        {user && isInMap(user) && <span className="regional-map__person" style={coordinatesStyle(user)} role="img" aria-label="Your approximate location"><MapIcon name="person-pin" /></span>}
        <div className="regional-map__exits"><button onClick={() => onNavigate("millValley")}><MapIcon name="compass-solid" />Marin</button><button onClick={() => onNavigate("oakland")}>East Bay<MapIcon name="compass-solid" /></button></div>
      </div>
    </div>
    <div className="regional-map__details"><label className="regional-map__point-picker">Forecast reading<select value={selected || ""} onChange={e => { setSelected(e.currentTarget.value || null); setBeach(null); }}><option value="">Choose a location</option>{visible.map(l => <option key={l.id} value={l.id}>{l.name}{nearest?.id === l.id ? " · near you" : ""}</option>)}</select></label><div aria-live="polite">{locationStatus && <p>{locationStatus}</p>}{beach ? <BeachConditions key={beach.id} beach={beach} date={date} range={range} /> : selection ? <p><strong>{selection.name}</strong> · High {n(selectedReading?.high)}° / low {n(selectedReading?.low)}°F{route && <button onClick={() => onNavigate(route.id)}>Open {route.name} forecast</button>}</p> : <p>Select a reading or swimmer for details. <span>Land / parks: DataSF · elevation: USGS.</span></p>}</div></div>
  </section>;
}
