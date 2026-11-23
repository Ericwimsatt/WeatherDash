import { midnight, shiftDate } from "../../shared/time.ts";

export const HISTORY_DAYS = 3;
export const FORECAST_DAYS = 10;
export const TODAY_START_HOUR = 5;

const TODAY_VISIBLE_WIDTH = .88;
const TODAY_WIDTH = TODAY_VISIBLE_WIDTH * 24 / (24 - TODAY_START_HOUR);
const TODAY_LEFT = TODAY_VISIBLE_WIDTH - TODAY_WIDTH;
const OTHER_DAY_WIDTH = TODAY_VISIBLE_WIDTH / 2;

// The home viewport starts at 5 a.m. and shows part of tomorrow. Scrolling
// left can still reach today's overnight readings and the three prior dates.
export function hourlyChartX(calendarX: number) {
  if (calendarX < 0) return TODAY_LEFT + calendarX * OTHER_DAY_WIDTH;
  if (calendarX <= 1) return TODAY_LEFT + calendarX * TODAY_WIDTH;
  return TODAY_VISIBLE_WIDTH + (calendarX - 1) * OTHER_DAY_WIDTH;
}

export const MIN_FORECAST_SCROLL = hourlyChartX(-HISTORY_DAYS);
export const MAX_FORECAST_SCROLL = hourlyChartX(FORECAST_DAYS + 1) - 1;

export function forecastDayAt(position: number) {
  // Favor the outer day at each edge, where a compressed day can't be centered.
  if (position <= MIN_FORECAST_SCROLL) return -HISTORY_DAYS;
  if (position >= MAX_FORECAST_SCROLL) return FORECAST_DAYS;
  const center = position + .5;
  for (let day = FORECAST_DAYS; day > -HISTORY_DAYS; day--) {
    if (center >= hourlyChartX(day)) return day;
  }
  return -HISTORY_DAYS;
}

export function positionForForecastDay(day: number) {
  if (day === 0) return 0;
  return Math.max(MIN_FORECAST_SCROLL, Math.min(MAX_FORECAST_SCROLL, hourlyChartX(day + .5) - .5));
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "Etc/GMT+8",
});

export function forecastDateLabel(today: string, offset: number, compact = false) {
  const date = shiftDate(today, offset);
  if (compact) return offset === 0 ? "Today" : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
  const label = dateFormat.format(new Date(midnight(date)));
  return offset === 0 ? `Today · ${label}` : label;
}

export function createForecastTimeline() {
  let position = 0;
  let settledDay = 0;
  let frame: number | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<(position: number) => void>();
  const summaryListeners = new Set<(day: number) => void>();
  function settle() {
    settleTimer = undefined;
    const day = forecastDayAt(position);
    if (day === settledDay) return;
    settledDay = day;
    for (const listener of summaryListeners) listener(day);
  }

  return {
    get position() {
      return position;
    },
    get settledDay() {
      return settledDay;
    },
    moveTo(next: number, snap = false) {
      const bounded = Math.max(MIN_FORECAST_SCROLL, Math.min(MAX_FORECAST_SCROLL, next));
      if (bounded !== position) {
        position = bounded;
        frame ??= requestAnimationFrame(() => {
          frame = undefined;
          for (const listener of listeners) listener(position);
        });
      }

      clearTimeout(settleTimer);
      if (snap) settle();
      else if (forecastDayAt(position) !== settledDay) settleTimer = setTimeout(settle, 140);
    },
    subscribe(listener: (position: number) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSummary(listener: (day: number) => void) {
      summaryListeners.add(listener);
      return () => {
        summaryListeners.delete(listener);
      };
    },
  };
}

export type ForecastTimeline = ReturnType<typeof createForecastTimeline>;
