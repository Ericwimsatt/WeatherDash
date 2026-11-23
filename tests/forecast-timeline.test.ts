import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_DAYS,
  HISTORY_DAYS,
  MIN_FORECAST_SCROLL,
  MAX_FORECAST_SCROLL,
  TODAY_START_HOUR,
  forecastDayAt,
  hourlyChartX,
  positionForForecastDay,
} from "../src/data/forecast-timeline.ts";

test("home starts at 5 a.m. and shows some of the first forecast day", () => {
  assert(Math.abs(hourlyChartX(TODAY_START_HOUR / 24)) < 1e-10);
  const todayWidth = hourlyChartX(1);
  assert(todayWidth > .5 && todayWidth <= .9);
  const futureWidth = hourlyChartX(2) - todayWidth;
  assert(Math.abs(futureWidth - todayWidth / 2) < 1e-10);
  assert.equal(MIN_FORECAST_SCROLL, hourlyChartX(-HISTORY_DAYS));
  assert.equal(MAX_FORECAST_SCROLL + 1, hourlyChartX(FORECAST_DAYS + 1));
});

test("keyboard navigation can select all three past dates and all ten forecast dates", () => {
  for (let day = -HISTORY_DAYS; day <= FORECAST_DAYS; day++) {
    assert.equal(forecastDayAt(positionForForecastDay(day)), day);
  }
  assert.equal(positionForForecastDay(-HISTORY_DAYS - 1), MIN_FORECAST_SCROLL);
  assert.equal(positionForForecastDay(0), 0);
  assert.equal(positionForForecastDay(FORECAST_DAYS + 1), MAX_FORECAST_SCROLL);
});
