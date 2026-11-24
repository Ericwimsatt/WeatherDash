import { colorToken, colorWithAlpha } from "./color-tokens.ts";
import { useEffect, useMemo, useRef, useState } from "octane";
import { Chart } from "./components/Chart.tsx";
import {
  createForecastTimeline,
  forecastDateLabel,
  forecastDayAt,
  FORECAST_DAYS,
  HISTORY_DAYS,
  hourlyChartX,
  positionForForecastDay,
  TODAY_START_HOUR,
  type ForecastTimeline,
} from "./data/forecast-timeline.ts";
import { LOCATIONS, SWIM_SPOTS, INLAND, type Location } from "./config.ts";
import { useLocation } from "./data/hooks.ts";
import { emptyBundle, type Bundle } from "../shared/model.ts";
import { type Range } from "./data/providers.ts";
import { type WeatherResult } from "./data/repository.ts";
import {
  weatherDay,
  uvDay,
  sunForDay,
  waterForDay,
  tidesForDay,
  extrema,
  observedRain,
  runoffSummary,
  runoffTotals,
  RUNOFF_LIMITS,
  rainfallTotal,
  runoffExplanation,
  regionWeatherClass,
} from "./data/selectors.ts";
import {
  pstDate,
  midnight,
  shiftDate,
  displayTime,
  displayHour,
  HOUR,
  pst,
} from "../shared/time.ts";
const number = (v: number | null | undefined, digits = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
function Skeleton({ wide = false }: { wide?: boolean }) {
  return (
    <span
      className={`skeleton${wide ? " skeleton-wide" : ""}`}
      aria-label="Loading"
    />
  );
}
function Value({ value, pending }: { value: string; pending: boolean }) {
  return value === "—" && pending ? <Skeleton /> : <>{value}</>;
}
function Status({
  result,
  pending,
}: {
  result?: WeatherResult;
  pending: boolean;
}) {
  if (pending) return null;
  const hasData =
    result &&
    [
      result.bundle.hourly_weather,
      result.bundle.hourly_tides,
      result.bundle.daily_sun_times,
      result.bundle.daily_water_temperature,
    ].some((rows) => rows.length);
  if (!hasData)
    return (
      <p className="error" role="status">
        Weather unavailable.
      </p>
    );
  return result.writeFailed ? (
    <p className="error" role="status">
      Changes not saved.
    </p>
  ) : null;
}
const line = (
  label: string,
  data: (number | null | undefined)[],
  color: string,
  extra = {},
) => ({
  label,
  data: data.map((v) => v ?? null),
  borderColor: color,
  backgroundColor: color + "22",
  fill: true,
  pointRadius: 1.5,
  tension: 0.25,
  spanGaps: false,
  ...extra,
});
type ForecastProps = {
  location: Location;
  today: string;
  range: Range;
  timeline: ForecastTimeline;
};

const forecastDates = (today: string) =>
  Array.from({ length: HISTORY_DAYS + FORECAST_DAYS + 1 }, (_, index) => shiftDate(today, index - HISTORY_DAYS));

function useSummaryDate(today: string, timeline: ForecastTimeline) {
  const [day, setDay] = useState(() => timeline.settledDay);
  useEffect(() => timeline.subscribeSummary(setDay), [timeline]);
  return shiftDate(today, day);
}

const sunTime = (time: string | null | undefined) => time ? displayTime(time).slice(0, -1) : "—";

function hourlySamples<T extends { hour: string }>(days: T[][]) {
  return days.flatMap((rows, index) => {
    const day = index - HISTORY_DAYS;
    return rows.map((row, index) => ({
      ...row,
      x: day + (index + .5) / rows.length,
      label: displayHour(row.hour),
      tick: day === 0 ? (index - TODAY_START_HOUR) % 2 === 0 : index % 4 === 0,
    }));
  });
}

function Daylight({ location, today, range, timeline }: ForecastProps) {
  const query = useLocation(location, range);
  const bundle = query.data?.bundle;
  const pending = query.isFetching;
  const date = useSummaryDate(today, timeline);
  const selectedSun = bundle && sunForDay(bundle, date);
  const sunMarkers = useMemo(() => forecastDates(today).flatMap((date, index) => {
    const sun = bundle && sunForDay(bundle, date);
    return ([sun?.sunrise_pst, sun?.sunset_pst]).flatMap((time) => {
      if (!time) return [];
      const hour = (Date.parse(time) - Date.parse(midnight(date))) / HOUR;
      return hour >= 0 && hour < 24 ? [{ label: sunTime(time), x: index - HISTORY_DAYS + hour / 24 }] : [];
    });
  }), [bundle, today]);
  const days = useMemo(() => {
    const data = bundle ?? emptyBundle();
    const now = Date.now();
    return forecastDates(today).map((day) => {
      const temperatures = new Map(weatherDay(data, day, now).map((row) => [row.hour, row.temperature_f]));
      const uv = uvDay(data, day).map((row) => ({
        ...row,
        temperature: temperatures.get(row.hour),
        rain: rainfallTotal(data, row.hour, pst(Date.parse(row.hour) + HOUR), now).total,
      }));
      return { uv };
    });
  }, [bundle, today]);
  const uvHours = useMemo(() => hourlySamples(days.map((day) => day.uv)), [days]);
  const uvSeries = useMemo(() => [
    line(
      "UV index",
      uvHours.map((r) => r.uv_index),
      colorToken("chart-warm"),
      { yAxisID: "y" },
    ),
    line(
      "Temperature (°F)",
      uvHours.map((r) => r.temperature),
      colorToken("chart-temperature"),
      {
        yAxisID: "temperature",
        borderDash: [5, 3],
        fill: false,
      },
    ),
    line(
      "Rain (in)",
      uvHours.map((row) => row.rain),
      colorToken("ocean"),
      {
        type: "bar" as const,
        yAxisID: "rainfall",
        order: 1,
        barThickness: "flex",
        categoryPercentage: .6,
        backgroundColor: colorWithAlpha("ocean", .42),
      },
    ),
  ], [uvHours]);
  const uvThresholds = useMemo(() => [{ value: 2, label: "UV 2", color: colorToken("warning") }], []);
  const hasRain = uvHours.some((row) => (row.rain ?? 0) > 0);
  const hasRainToday = uvHours.some(({ hour, rain }) => hour.startsWith(today) && (rain ?? 0) > 0);
  const hasWeather = uvHours.some((row) => row.uv_index != null || row.temperature != null);
  return (
    <section className="card" id="irCard" aria-label="Daylight">
      <Status result={query.data} pending={pending} />
      <div className="daylight-chart">
        {hasWeather || hasRain ? (
          <Chart
            title="UV Index, Temperature, and Precipitation"
            label="Hourly UV index, temperature, and rainfall"
            description={`Sunrise ${sunTime(selectedSun?.sunrise_pst)}, sunset ${sunTime(selectedSun?.sunset_pst)}`}
            sunMarkers={sunMarkers}
            samples={uvHours}
            today={today}
            timeline={timeline}
            datasets={uvSeries}
            minimum={0}
            maximum={10}
            temperatureAxis
            thresholds={uvThresholds}
          />
        ) : (
          <div className="chart-placeholder">
            {pending ? <Skeleton wide /> : <p>UV unavailable.</p>}
          </div>
        )}
        {hasRainToday && (
          <a
            className="rain-radar"
            href={`https://www.windy.com/-Weather-radar-radar?radar,${location.lat},${location.lon},9`}
            target="_blank"
            rel="noreferrer"
          >
            Doppler
          </a>
        )}
      </div>
    </section>
  );
}
function Swim({ location, inland, today, range, timeline }: ForecastProps & { inland: Location }) {
  const query = useLocation(location, range, "swim"),
    inlandQuery = useLocation(inland, range);
  const bundle = query.data?.bundle;
  const inlandBundle = inlandQuery.data?.bundle;
  const pending = query.isFetching;
  const swimHours = useMemo(() => {
    const data = bundle ?? emptyBundle();
    const now = Date.now();
    return hourlySamples(forecastDates(today).map((day) => {
      const heights = new Map(tidesForDay(data, day, now).map((row) => [row.hour_pst, row.height_ft]));
      return weatherDay(data, day, now).map(({ hour, wind_speed_mph, wind_direction_deg }) => ({
        hour,
        height: heights.get(hour),
        windSpeed: wind_speed_mph,
        windDirection: wind_direction_deg,
      }));
    }));
  }, [bundle, today]);
  const runoffData = useMemo(() => {
    const local = bundle ?? emptyBundle(), upstream = inlandBundle ?? emptyBundle();
    const dates = [...forecastDates(today), shiftDate(today, FORECAST_DAYS + 1)];
    const now = Date.now();
    const rain = (data: Bundle) => dates.map((day) =>
      rainfallTotal(data, midnight(day), midnight(shiftDate(day, 1)), now),
    );
    return {
      runoff: runoffSummary(local, upstream, today),
      warningDetails: runoffExplanation(local, upstream, today),
      samples: dates.map((_, index) => ({ x: index - HISTORY_DAYS + .5, label: "" })),
      localRain: rain(local),
      inlandRain: rain(upstream),
      localTotals: runoffTotals(local, dates, 3, now),
      inlandTotals: runoffTotals(upstream, dates, 4, now),
    };
  }, [bundle, inlandBundle, today]);
  const { runoff, warningDetails, samples, localRain, inlandRain, localTotals, inlandTotals } = runoffData;
  const runoffSeries = useMemo(() => [
    line(
      "Local",
      localRain.map((r) => r.total),
      colorToken("ocean"),
      { type: "bar" as const, barThickness: 24, backgroundColor: colorToken("ocean") },
    ),
    line(
      "Inland",
      inlandRain.map((r) => r.total),
      colorToken("chart-warm"),
      { type: "bar" as const, barThickness: 24, backgroundColor: colorToken("chart-warm"), order: 1 },
    ),
    line(
      "Local 3 day total",
      localTotals.map((r) => r.total),
      colorToken("ocean"),
      { type: "line" as const, atDayStart: true, order: 2, backgroundColor: colorWithAlpha("ocean", .2) },
    ),
    line(
      "Inland 4 day total",
      inlandTotals.map((r) => r.total),
      colorToken("chart-warm"),
      { type: "line" as const, atDayStart: true, order: 2, backgroundColor: colorWithAlpha("chart-warm", .2) },
    ),
  ], [localRain, inlandRain, localTotals, inlandTotals]);
  const swimSeries = useMemo(() => [
    line(
      "Tide height (ft)",
      swimHours.map((row) => row.height),
      colorToken("ocean"),
      { yAxisID: "y", fill: "start" as const, backgroundColor: colorWithAlpha("ocean", .10) },
    ),
    line(
      "Wind (mph)",
      swimHours.map((row) => row.windSpeed),
      colorToken("chart-today"),
      {
        type: "bar" as const,
        yAxisID: "wind",
        order: 1,
        barThickness: "flex",
        categoryPercentage: .6,
        backgroundColor: colorWithAlpha("chart-today", .32),
      },
    ),
  ], [swimHours]);
  const runoffThresholds = useMemo(() => [
    {
      value: RUNOFF_LIMITS.local,
      label: `Local limit · ${RUNOFF_LIMITS.local}″`,
      color: colorToken("ocean"),
    },
    {
      value: RUNOFF_LIMITS.inland,
      color: colorToken("chart-warm"),
    },
  ], []);
  const hasRunoff = [localRain, inlandRain, localTotals, inlandTotals].some(
    (series) => series.some((day) => (day.total ?? 0) > 0),
  );
  return (
    <section className="card" id="bbCard" aria-label={location.name}>
      {runoff.warning && (
        <p
          className="runoff-warn"
          title="Swimming may be unsafe after more than 0.25 inches of local rain in the last 2 days or over 1 inch of inland rain in the last 4 days, because runoff can carry fertilizer and contribute to possible algae blooms."
          tabIndex={0}
        >
          {`Runoff warning: ${warningDetails}`}
        </p>
      )}
      {hasRunoff && (
        <div className="runoff-section">
          <Chart
            title={`${location.name} Runoff Forecast`}
            summary={`Local last 2 days: ${number(runoff.local.total, 2)} in · Inland last 4 days: ${number(runoff.inland.total, 2)} in`}
            label="Local and inland rain, rolling totals and runoff thresholds"
            tooltipUnit="in"
            daily
            samples={samples}
            today={today}
            timeline={timeline}
            datasets={runoffSeries}
            type="bar"
            minimum={0}
            height={240}
            thresholds={runoffThresholds}
          />
        </div>
      )}
      <Status result={query.data} pending={pending} />
      <div className="swim-chart">
        {swimHours.some((row) => row.height != null || row.windSpeed != null) ? (
          <Chart
            title={`${location.name} Tides and Wind`}
            label="Hourly tide height and wind speed"
            description="Tide height in feet relative to MLLW. Wind speed in miles per hour."
            samples={swimHours}
            today={today}
            timeline={timeline}
            datasets={swimSeries}
          />
        ) : (
          <div className="chart-placeholder">
            <h3>{location.name} Tides and Wind</h3>
            {pending ? <Skeleton wide /> : "Tide and wind data unavailable."}
          </div>
        )}
      </div>
      <WaterTemperature bundle={bundle} today={today} timeline={timeline} pending={pending} />
    </section>
  );
}

function WaterTemperature({ bundle, today, timeline, pending }: {
  bundle?: Bundle;
  today: string;
  timeline: ForecastTimeline;
  pending: boolean;
}) {
  const date = useSummaryDate(today, timeline);
  const water = bundle && waterForDay(bundle, date);
  return (
    <div className="water-temp">
      Water temp:{" "}
      <strong>
        <Value
          value={water ? `${number(water.mean_temperature_f, 1)}°F` : "—"}
          pending={pending}
        />
      </strong>
    </div>
  );
}

function Region({
  location,
  date,
  range,
  onNavigate,
}: {
  location: Location;
  date: string;
  range: Range;
  onNavigate: (id: string) => void;
}) {
  const q = useLocation(location, range),
    bundle = q.data?.bundle || emptyBundle(),
    hours = weatherDay(bundle, date),
    temp = extrema(hours.map((r) => r.temperature_f));
  const codes = hours
      .map((r) => r.weather_code)
      .filter((v): v is number => v != null),
    code = codes.length ? Math.max(...codes) : null;
  const rain = hours.map((r) => r.rainfall_in);
  const recorded =
    date <= pstDate()
      ? observedRain(bundle, midnight(date), midnight(shiftDate(date, 1)))
      : null;
  const amount = recorded
    ? recorded.total
    : rain.some((v) => v != null)
      ? rain.reduce<number>((a, v) => a + (v ?? 0), 0)
      : null;
  const partial = recorded ? !recorded.complete : rain.some((v) => v == null);
  return (
    <a
      className={`region-item ${regionWeatherClass(code, amount)}`}
      href={`/${location.id}`}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        e.preventDefault();
        onNavigate(location.id);
      }}
    >
      <span className="name">{location.short || location.name}</span>
      <span className="temps">
        {temp ? (
          `${number(temp.max)}°/${number(temp.min)}°`
        ) : q.isFetching ? (
          <Skeleton />
        ) : (
          "—"
        )}
      </span>
      <span className="precip" title={partial ? "Partial total" : undefined}>
        {amount != null ? `${partial ? "≥" : ""}${number(amount, 2)}″` : "—"}
      </span>
    </a>
  );
}
function ForecastHeading({ location, today, timeline }: {
  location: Location;
  today: string;
  timeline: ForecastTimeline;
}) {
  const [position, setPosition] = useState(() => timeline.position);
  const day = forecastDayAt(position);
  const dates = useRef<HTMLDivElement | null>(null);
  useEffect(() => timeline.subscribe(setPosition), [timeline]);
  useEffect(() => {
    const strip = dates.current;
    if (!strip) return;
    const frame = strip.parentElement?.parentElement;
    if (!frame) return;
    let pointer: { id: number; x: number; startX: number; startY: number; dragging: boolean } | undefined;
    let suppressClick = false;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, dragging: false };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!pointer.dragging) {
        if (Math.abs(event.clientX - pointer.startX) < 5 || Math.abs(event.clientX - pointer.startX) < Math.abs(event.clientY - pointer.startY)) return;
        pointer.dragging = true;
        frame.setPointerCapture(event.pointerId);
        frame.classList.add("dragging");
      }
      timeline.moveTo(timeline.position - (event.clientX - pointer.x) / strip.clientWidth);
      pointer.x = event.clientX;
    };
    const end = () => {
      suppressClick = !!pointer?.dragging;
      pointer = undefined;
      frame.classList.remove("dragging");
    };
    const click = (event: MouseEvent) => {
      if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
    };
    frame.addEventListener("pointerdown", down);
    frame.addEventListener("pointermove", move);
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);
    frame.addEventListener("click", click, true);
    return () => {
      frame.removeEventListener("pointerdown", down);
      frame.removeEventListener("pointermove", move);
      frame.removeEventListener("pointerup", end);
      frame.removeEventListener("pointercancel", end);
      frame.removeEventListener("click", click, true);
    };
  }, [timeline]);

  return (
    <div className="region-heading">
      <h2>{location.name}</h2>
      <div className="date-ruler-frame"><div className="date-ruler-inner"><div className="date-slider" ref={dates} role="group" aria-label="Forecast dates">
        {Array.from({ length: HISTORY_DAYS + FORECAST_DAYS + 1 }, (_, index) => {
          const offset = index - HISTORY_DAYS;
          const start = hourlyChartX(offset);
          const end = hourlyChartX(offset + 1);
          const visibleStart = Math.max(start, position);
          const visibleEnd = Math.min(end, position + 1);
          const visibleWidth = visibleEnd - visibleStart;
          return <div key={offset}>
          {offset !== 0 && <span aria-hidden="true" className={`date-shade ${Math.abs(offset) % 2 ? "date-shade-odd" : "date-shade-even"}`}
            style={{ left: `${(start - position) * 100}%`, width: `${(end - start) * 100}%` }} />}
          {Array.from({ length: 24 }, (_, hour) => <span key={hour} aria-hidden="true"
            className={`date-tick ${hour === 0 ? "day-tick" : hour % 6 === 0 ? "major-tick" : ""}`}
            style={{ left: `${(hourlyChartX(offset + hour / 24) - position) * 100}%` }} />)}
          <button
            key={offset}
            className={`date-option ${offset === 0 ? "date-option-today" : Math.abs(offset) % 2 ? "date-option-odd" : "date-option-even"}`}
            style={{ left: `${(visibleStart - position) * 100}%`, width: `${Math.max(0, visibleWidth) * 100}%`, visibility: visibleWidth >= .09 ? "visible" : "hidden" }}
            aria-label={forecastDateLabel(today, offset)}
            aria-current={day === offset ? "date" : undefined}
            onClick={() => timeline.moveTo(positionForForecastDay(offset), true)}
          >{forecastDateLabel(today, offset, visibleWidth < .3)}</button></div>;
        })}
        <span aria-hidden="true" className="date-tick day-tick" style={{ left: `${(hourlyChartX(FORECAST_DAYS + 1) - position) * 100}%` }} />
      </div></div></div>
    </div>
  );
}

function RegionalTemperatures({ today, range, timeline, onNavigate }: {
  today: string;
  range: Range;
  timeline: ForecastTimeline;
  onNavigate: (id: string) => void;
}) {
  const date = useSummaryDate(today, timeline);
  const groups = [...new Set(LOCATIONS.map((location) => location.group))];
  return (
    <section className="card full" id="regCard" aria-labelledby="regions-heading">
      <h2 id="regions-heading">Regional Temps</h2>
      <div id="regionContainer">
        {groups.map((group) => (
          <div className="region-group" key={group}>
            <h3 className="group-title">{group}</h3>
            <div className="region-row">
              {LOCATIONS.filter((location) => location.group === group).map((location) => (
                <Region key={location.id} location={location} date={date} range={range} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function App() {
  const [today, setToday] = useState(pstDate());
  const [timeline] = useState(createForecastTimeline);
  const [regionId, setRegionId] = useState(window.location.pathname.slice(1));
  const region = LOCATIONS.find((l) => l.id === regionId) || LOCATIONS[0],
    spot = SWIM_SPOTS[region.id],
    inland = region.id === "encinitas" ? region : INLAND;
  // Inland runoff needs four days of measurements before the earliest visible date.
  const range = useMemo(() => ({
    from: shiftDate(today, -HISTORY_DAYS - 4),
    to: shiftDate(today, FORECAST_DAYS),
  }), [today]);
  useEffect(() => {
    const timer = setInterval(() => setToday(pstDate()), 60000);
    const pop = () => setRegionId(window.location.pathname.slice(1));
    window.addEventListener("popstate", pop);
    return () => {
      clearInterval(timer);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  useEffect(() => {
    document.title = regionId ? `${region.name} — WeatherDash` : "WeatherDash";
  }, [regionId]);
  useEffect(() => {
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      if (!dx || (!event.shiftKey && Math.abs(dx) < Math.abs(event.deltaY))) return;
      event.preventDefault();
      const chart = document.querySelector<HTMLElement>(".forecast-chart canvas");
      const width = Math.max(1, (chart?.clientWidth ?? window.innerWidth) - 94);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
      timeline.moveTo(timeline.position + dx * unit / width);
    };
    window.addEventListener("wheel", wheel, { passive: false });
    return () => window.removeEventListener("wheel", wheel);
  }, [timeline]);
  function navigate(id: string) {
    history.pushState(null, "", `/${id}`);
    setRegionId(id);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  return (
    <>
      <header>
        <h1>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("");
            }}
          >
            EricWeather
          </a>
        </h1>
        {regionId && (
          <div className="header-actions">
            {regionId && (
              <a
                className="back-btn"
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("");
                }}
              >
                All regions
              </a>
            )}
          </div>
        )}
      </header>
      <main id="main">
        <span className="visually-hidden" id="forecast-instructions">
          Use the left and right arrow keys when a chart is focused to change dates.
        </span>
        <ForecastHeading location={region} today={today} timeline={timeline} />
        <div className="card-grid">
          <Daylight location={region} today={today} range={range} timeline={timeline} />
          <Swim location={spot} inland={inland} today={today} range={range} timeline={timeline} />
          <RegionalTemperatures today={today} range={range} timeline={timeline} onNavigate={navigate} />
        </div>
      </main>
    </>
  );
}
