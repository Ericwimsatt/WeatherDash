import { useEffect, useState } from "octane";
import { Chart } from "./components/Chart.tsx";
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
  tideExtrema,
  extrema,
  observedRain,
  runoffSummary,
  runoffTotals,
  RUNOFF_LIMITS,
  uvWindowLabel,
  rainfallDates,
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
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}
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
function Summary({
  title,
  value,
  pending,
  sub,
  inlineSub = false,
  multilineOnMobile = false,
}: {
  title: string;
  value: string;
  pending: boolean;
  sub?: string;
  inlineSub?: boolean;
  multilineOnMobile?: boolean;
}) {
  return (
    <div className="stat-box">
      <span className="label">{title}</span>
      <span className={inlineSub ? "value sunset-value" : "value"}>
        {multilineOnMobile && value.includes(" · ") ? (
          value.split(" · ").map((part, index) => (
            <span className="mobile-value-line" key={part}>
              {index > 0 && <span className="value-separator"> · </span>}
              {part}
            </span>
          ))
        ) : (
          <Value value={value} pending={pending} />
        )}
        {sub && inlineSub && <span className="sub">{sub}</span>}
      </span>
      {sub && !inlineSub && <span className="sub">{sub}</span>}
    </div>
  );
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
function Daylight({
  location,
  date,
  range,
}: {
  location: Location;
  date: string;
  range: Range;
}) {
  const query = useLocation(location, range),
    bundle = query.data?.bundle || emptyBundle(),
    pending = query.isFetching;
  const hours = weatherDay(bundle, date),
    sun = sunForDay(bundle, date),
    uvHours = uvDay(bundle, date),
    uv = extrema(uvHours.map((r) => r.uv_index));
  const visible = uvHours.filter(
    (r) =>
      Number(r.hour.slice(11, 13)) >= 5 && Number(r.hour.slice(11, 13)) <= 21,
  );
  const rainHours = hours.map(({ hour }) =>
    rainfallTotal(bundle, hour, pst(Date.parse(hour) + HOUR)),
  );
  const dailyTotal = rainfallTotal(
    bundle,
    midnight(date),
    midnight(shiftDate(date, 1)),
  );
  const hasRain = (dailyTotal.total ?? 0) > 0;
  const uvWindow = uvWindowLabel(visible);
  const length =
    sun?.sunrise_pst && sun?.sunset_pst
      ? Math.round(
          (Date.parse(sun.sunset_pst) - Date.parse(sun.sunrise_pst)) / 60000,
        )
      : null;
  return (
    <section className="card" id="irCard" aria-labelledby="daylight-heading">
      <h2 id="daylight-heading">
        {location.id === "innerRichmond"
          ? "Daylight"
          : `${location.name} — Daylight`}
      </h2>
      {hasRain && (
        <div className="rain-section">
          <div className="rain-head">
            <h3>Rainfall total</h3>
            <div className="rain-head-right">
              <span className="rain-total">
                {dailyTotal.total != null && !dailyTotal.complete ? "≥" : ""}
                {number(dailyTotal.total, 2)}″
              </span>
              <a
                className="rain-radar"
                href={`https://www.windy.com/-Weather-radar-radar?radar,${location.lat},${location.lon},9`}
                target="_blank"
                rel="noreferrer"
              >
                Radar ↗
              </a>
            </div>
          </div>
          <Chart
            label="Hourly rainfall for the selected day"
            labels={hours.map((row) => displayHour(row.hour))}
            datasets={[
              line(
                "Rain (in)",
                rainHours.map((hour) => hour.total),
                "#0b6f93",
                { type: "bar" as const, backgroundColor: "#0b6f93" },
              ),
            ]}
            type="bar"
            minimum={0}
          />
        </div>
      )}
      <div className="richmond-grid">
        <Summary
          title="Sunrise"
          value={sun?.sunrise_pst ? displayTime(sun.sunrise_pst) : "—"}
          pending={pending}
        />
        <Summary
          title="Sunset"
          inlineSub
          value={sun?.sunset_pst ? displayTime(sun.sunset_pst) : "—"}
          pending={pending}
          sub={
            length != null
              ? `${Math.floor(length / 60)}h ${length % 60}m`
              : undefined
          }
        />
        <Summary title="Max UV" value={number(uv?.max, 1)} pending={pending} />
        <Summary
          title="UV below 2"
          value={uvWindow}
          pending={pending}
          multilineOnMobile
        />
      </div>
      <Status result={query.data} pending={pending} />
      {uv ? (
        <Chart
          label="Hourly UV index and temperature"
          labels={visible.map((r) => displayHour(r.hour))}
          datasets={[
            line(
              "UV index",
              visible.map((r) => r.uv_index),
              "#c74c25",
            ),
            line(
              "Temperature (°F)",
              visible.map(
                (r) => hours.find((h) => h.hour === r.hour)?.temperature_f,
              ),
              "#527b8f",
              {
                yAxisID: "temperature",
                borderDash: [5, 3],
                fill: false,
              },
            ),
          ]}
          minimum={0}
          maximum={10}
          temperatureAxis
          thresholds={[{ value: 2, label: "UV 2", color: "#a44b3e" }]}
        />
      ) : (
        <div className="chart-placeholder">
          {pending ? <Skeleton wide /> : <p>UV unavailable.</p>}
        </div>
      )}
    </section>
  );
}
function Swim({
  location,
  inland,
  date,
  range,
}: {
  location: Location;
  inland: Location;
  date: string;
  range: Range;
}) {
  const query = useLocation(location, range, "swim"),
    inlandQuery = useLocation(inland, range);
  const bundle = query.data?.bundle || emptyBundle(),
    inlandBundle = inlandQuery.data?.bundle || emptyBundle(),
    pending = query.isFetching;
  const tide = tidesForDay(bundle, date),
    extremes = tideExtrema(tide),
    water = waterForDay(bundle, date),
    hours = weatherDay(bundle, date);
  const wind = hours.filter(
    (r) =>
      Number(r.hour.slice(11, 13)) >= 5 && Number(r.hour.slice(11, 13)) <= 21,
  );
  const runoff = runoffSummary(bundle, inlandBundle);
  const shownDates = rainfallDates();
  const runoffDates = [
    shiftDate(shownDates[0], -1),
    ...shownDates,
    shiftDate(shownDates.at(-1)!, 1),
  ];
  const localRain = runoffDates.map((day) =>
    rainfallTotal(bundle, midnight(day), midnight(shiftDate(day, 1))),
  );
  const inlandRain = runoffDates.map((day) =>
    rainfallTotal(inlandBundle, midnight(day), midnight(shiftDate(day, 1))),
  );
  const warningDetails = runoffExplanation(bundle, inlandBundle);
  const localTotals = runoffTotals(bundle, runoffDates, 2);
  const inlandTotals = runoffTotals(inlandBundle, runoffDates, 4);
  const isMobile = useMediaQuery("(max-width: 639px)");
  return (
    <section className="card" id="bbCard" aria-labelledby="swim-heading">
      <h2 id="swim-heading">{location.name} — Swim Conditions</h2>
      <p
        className={runoff.warning ? "runoff-warn" : "runoff-ok"}
        title={
          runoff.warning
            ? "Swimming may be unsafe after more than 0.25 inches of local rain in the last 2 days or over 1 inch of inland rain in the last 4 days, because runoff can carry fertilizer and contribute to possible algae blooms."
            : undefined
        }
        tabIndex={runoff.warning ? 0 : undefined}
      >
        {runoff.warning
          ? `Runoff warning: ${warningDetails}`
          : runoff.complete
            ? "No runoff warning"
            : "Runoff unavailable"}
      </p>
      <div className="runoff-section">
        <div className="runoff-head">
          <h3>{runoff.warning ? "Runoff Warning" : "Runoff forecast"}</h3>
          <span className="runoff-summary">
            Local last 2 days: {number(runoff.local.total, 2)} in · Inland last 4 days:{" "}
            {number(runoff.inland.total, 2)} in
          </span>
        </div>
        <Chart
          label={
            isMobile
              ? ""
              : "Local and inland rain, rolling totals and runoff thresholds"
          }
          tooltipUnit="in"
          labels={runoffDates.map((d) => d.slice(5))}
          datasets={[
            line(
              "Local",
              localRain.map((r) => r.total),
              "#0b6f93",
              { type: "bar" as const, backgroundColor: "#0b6f93" },
            ),
            line(
              "Inland",
              inlandRain.map((r) => r.total),
              "#c74c25",
              { type: "bar" as const, backgroundColor: "#c74c25", order: 1 },
            ),
            line(
              "Local 2-day",
              localTotals.map((r) => r.total),
              "#0b6f93",
              { type: "line" as const, order: 2, backgroundColor: "#0b6f9333" },
            ),
            line(
              "Inland 4-day",
              inlandTotals.map((r) => r.total),
              "#c74c25",
              { type: "line" as const, order: 2, backgroundColor: "#c74c2533" },
            ),
          ]}
          type="bar"
          minimum={0}
          height={240}
          edgePadding={1}
          todayIndex={runoffDates.indexOf(pstDate())}
          thresholds={[
            {
              value: RUNOFF_LIMITS.local,
              color: "#0b6f93",
            },
            {
              value: RUNOFF_LIMITS.inland,
              color: "#c74c25",
            },
          ]}
        />
      </div>
      <Status result={query.data} pending={pending} />
      <h3 className="tide-label">Tides</h3>
      <div className="tide-times">
        {extremes.length ? (
          extremes.map((r) => (
            <div
              className={`tide-item ${r.type.toLowerCase()}`}
              key={r.hour_pst}
            >
              <div className="tide-type">{r.type}</div>
              <div className="tide-time">{displayTime(r.hour_pst)}</div>
              <div className="tide-height">{number(r.height_ft, 1)} ft</div>
            </div>
          ))
        ) : (
          <div className="tide-item">
            {pending ? <Skeleton /> : "Tides unavailable"}
          </div>
        )}
      </div>
      <div className="swim-charts">
        <div>
          <h3>Tide height</h3>
          {tide.length ? (
            <Chart
              label="Hourly tide height in feet relative to MLLW"
              labels={tide.map((r) => displayHour(r.hour_pst))}
              datasets={[
                line(
                  "Height (ft)",
                  tide.map((r) => r.height_ft),
                  "#0b6f93",
                  { fill: "start" as const, backgroundColor: "#0b6f9333" },
                ),
              ]}
              yTitle="feet"
            />
          ) : (
            <div className="chart-placeholder">
              {pending ? <Skeleton wide /> : "Tide data unavailable."}
            </div>
          )}
        </div>
        <div>
          <h3>Wind</h3>
          {wind.some((r) => r.wind_speed_mph != null) ? (
            <Chart
              label="Hourly wind speed in miles per hour"
              labels={wind.map((r) => displayHour(r.hour))}
              datasets={[
                line(
                  "Wind (mph)",
                  wind.map((r) => r.wind_speed_mph),
                  "#0b6f93",
                  { type: "bar" as const, backgroundColor: "#0b6f93" },
                ),
              ]}
              type="bar"
              minimum={0}
            />
          ) : (
            <div className="chart-placeholder">
              {pending ? <Skeleton wide /> : "Wind unavailable."}
            </div>
          )}
        </div>
      </div>
      <div className="water-temp">
        Water temp:{" "}
        <strong>
          <Value
            value={water ? `${number(water.mean_temperature_f, 1)}°F` : "—"}
            pending={pending}
          />
        </strong>
      </div>
    </section>
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
export function App() {
  const [today, setToday] = useState(pstDate()),
    [date, setDate] = useState(pstDate());
  const [regionId, setRegionId] = useState(window.location.pathname.slice(1));
  const region = LOCATIONS.find((l) => l.id === regionId) || LOCATIONS[0],
    spot = SWIM_SPOTS[region.id],
    inland = region.id === "encinitas" ? region : INLAND;
  const range = { from: shiftDate(today, -6), to: shiftDate(today, 4) };
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
  function navigate(id: string) {
    history.pushState(null, "", id ? `/${id}` : "/");
    setRegionId(id);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  const groups = [...new Set(LOCATIONS.map((l) => l.group))];
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
        <div className="day-tabs" aria-label="Forecast day">
          {[0, 1, 2].map((offset) => (
            <button
              key={offset}
              className={date === shiftDate(today, offset) ? "active" : ""}
              aria-pressed={date === shiftDate(today, offset)}
              onClick={() => setDate(shiftDate(today, offset))}
            >
              {offset === 0
                ? "Today"
                : offset === 1
                  ? "Tomorrow"
                  : new Date(
                      midnight(shiftDate(today, offset)),
                    ).toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone: "Etc/GMT+8",
                    })}
              <small>{shiftDate(today, offset).slice(5)}</small>
            </button>
          ))}
        </div>
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
        <div className="card-grid">
          <Daylight location={region} date={date} range={range} />
          <Swim location={spot} inland={inland} date={date} range={range} />
          <section
            className="card full"
            id="regCard"
            aria-labelledby="regions-heading"
          >
            <h2 id="regions-heading">Regional Temps</h2>
            <div id="regionContainer">
              {groups.map((group) => (
                <div className="region-group" key={group}>
                  <h3 className="group-title">{group}</h3>
                  <div className="region-row">
                    {LOCATIONS.filter((l) => l.group === group).map(
                      (location) => (
                        <Region
                          key={location.id}
                          location={location}
                          date={date}
                          range={range}
                          onNavigate={navigate}
                        />
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
