import { colorToken, colorWithAlpha } from "../color-tokens.ts";
import { useEffect, useId, useRef } from "octane";
import ChartJS from "chart.js/auto";
import { drawDateRuler, rulerPalette, RULER_HEIGHT } from "./DateRuler.tsx";
import { visibleMaximum, visibleTemperatureRange, type TimeMarker } from "../data/chart-axis.ts";
import type { BarElement, ChartDataset, ChartType, Plugin } from "chart.js";
import {
  FORECAST_DAYS,
  HISTORY_DAYS,
  MAX_FORECAST_SCROLL,
  forecastDayAt,
  hourlyChartX,
  positionForForecastDay,
  type ForecastTimeline,
} from "../data/forecast-timeline.ts";

type ChartSample = { x: number; label: string; windDirection?: number | null };
type Threshold = { value: number; label?: string; color: string };
type Dataset = ChartDataset<"line" | "bar", (number | null)[]> & { atDayStart?: boolean };
type Plot = ChartJS<ChartType, { x: number; y: number | null }[]>;
type RainPeak = { day: number; x: number; value: number; label: string };
type DailyPeak = { day: number; x: number; value: number; label: string; axis: string; color: string };
const inches = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const compassPoints = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const TOUCH_DRAG_MULTIPLIER = 1.75;

type Props = {
  label: string;
  title?: string;
  summary?: string;
  description?: string;
  samples: ChartSample[];
  datasets: Dataset[];
  timeline: ForecastTimeline;
  today: string;
  type?: ChartType;
  minimum?: number;
  maximum?: number;
  tooltipUnit?: string;
  height?: number;
  temperatureAxis?: boolean;
  thresholds?: Threshold[];
  markers?: TimeMarker[];
  visibleScale?: boolean;
  daily?: boolean;
};

function mountChart(element: HTMLCanvasElement, initial: Props) {
  const context = element.getContext("2d");
  if (!context) return;
  const ctx = context;
  const source = document.createElement("canvas");
  const font = getComputedStyle(element).fontFamily;
  const ink = colorToken("ink");
  const muted = colorToken("muted-strong");
  const surface = colorToken("surface");
  const rulerColors = rulerPalette();
  const windInk = colorToken("chart-today"), temperatureInk = colorToken("chart-temperature");
  const tooltipBorder = colorToken("tooltip-border");
  const divider = colorWithAlpha("ink", .16);
  const todayFill = colorWithAlpha("chart-today", .025);
  const futureFill = [colorWithAlpha("chart-today", .17), colorWithAlpha("chart-today", .095)];
  const pastFill = [colorWithAlpha("chart-today", .06), colorWithAlpha("chart-today", .115)];
  const { daily, timeline } = initial;
  const domainMin = -HISTORY_DAYS;
  const domainMax = hourlyChartX(FORECAST_DAYS + 1);
  let props = initial;
  // Separate event layers once per data change, rather than on scroll frames.
  let tickerMarkers: TimeMarker[] = [];
  let crossingMarkers: TimeMarker[] = [];
  function cacheMarkers() {
    tickerMarkers = [];
    crossingMarkers = [];
    for (const marker of props.markers ?? []) {
      (marker.kind === "uv-rising" || marker.kind === "uv-falling" ? crossingMarkers : tickerMarkers).push(marker);
    }
  }
  cacheMarkers();
  let readings: { x: number; index: number }[] = [];
  let rainPeaks: RainPeak[] = [];
  let dailyPeaks: DailyPeak[] = [];
  let plot: Plot | undefined;
  let width = 0, height = 0, builtSpan = 1;
  let hover: { x: number; y: number } | undefined;
  let pointer: { id: number; x: number; y: number; dragging: boolean } | undefined;
  let frame: number | undefined;
  let disposed = false;
  let inView = false;
  let stripDirty = true;
  let scaleSignature = "";
  function viewportScales() {
    return {
      maximum: props.visibleScale ? visibleMaximum(props.samples, props.datasets, timeline.position, timeline.span) : props.maximum,
      wind: props.datasets.some((dataset) => dataset.yAxisID === "wind")
        ? visibleMaximum(props.samples, props.datasets.filter((dataset) => dataset.yAxisID === "wind"), timeline.position, timeline.span, 20, 5) : undefined,
      temperature: props.temperatureAxis ? visibleTemperatureRange(props.samples, props.datasets.filter((dataset) => dataset.yAxisID === "temperature"), timeline.position, timeline.span) : undefined,
    };
  }
  let scaleTimer: ReturnType<typeof setTimeout> | undefined;

  const plotDecorations: Plugin = {
    id: "weatherPlotDecorations",
    beforeDraw({ ctx: paint, chartArea, scales }) {
      const { top, bottom } = chartArea;
      for (let day = domainMin; day <= FORECAST_DAYS; day++) {
        const start = scales.x.getPixelForValue(hourlyChartX(day));
        const end = scales.x.getPixelForValue(hourlyChartX(day + 1));
        paint.fillStyle = day === 0 ? todayFill : day < 0 ? pastFill[-day % 2] : futureFill[day % 2];
        paint.fillRect(start, top, end - start, bottom - top);
        paint.fillStyle = divider;
        paint.fillRect(start, top, 1, bottom - top);
      }
    },
    afterDatasetsDraw({ ctx: paint, chartArea, scales }) {
      paint.save();
      paint.lineWidth = 1.5;
      paint.setLineDash([6, 4]);
      for (const { value, color } of props.thresholds ?? []) {
        const y = scales.y.getPixelForValue(value);
        if (y < chartArea.top || y > chartArea.bottom) continue;
        paint.strokeStyle = color;
        paint.beginPath();
        paint.moveTo(chartArea.left, y);
        paint.lineTo(chartArea.right, y);
        paint.stroke();
      }
      paint.restore();
    },
    afterDatasetDraw({ ctx: paint, chartArea }, { index, meta }) {
      const series = props.datasets[index];
      if (series?.yAxisID !== "wind") return;
      paint.save();
      paint.beginPath();
      paint.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
      paint.clip();
      paint.strokeStyle = ink;
      paint.lineWidth = 1.15;
      paint.lineCap = "round";
      paint.lineJoin = "round";
      meta.data.forEach((element, hour) => {
        const direction = props.samples[hour]?.windDirection;
        if (direction == null || (series.data[hour] ?? 0) <= 0) return;
        const bar = (element as BarElement).getProps(["x", "y", "width", "height"]);
        if (bar.x == null || bar.y == null) return;
        const size = Math.max(1.75, Math.min(4.25, bar.width * .7));
        paint.save();
        paint.translate(bar.x, bar.y + (bar.height >= 3 * size + 3 ? size + 2 : -size - 2));
        // Provider directions describe the source. Point the arrow downwind.
        paint.rotate((direction + 180) * Math.PI / 180);
        paint.beginPath();
        paint.moveTo(0, size);
        paint.lineTo(0, -size);
        paint.moveTo(-size * .62, -size * .25);
        paint.lineTo(0, -size);
        paint.lineTo(size * .62, -size * .25);
        paint.stroke();
        paint.restore();
      });
      paint.restore();
    },
  };

  function drawViewport() {
    if (!plot) return;
    const { chartArea, scales, currentDevicePixelRatio: ratio } = plot;
    const { left, top, bottom } = chartArea;
    const rightGutter = plot.width - chartArea.right;
    const right = width - rightGutter;
    const plotWidth = right - left;
    if (plotWidth <= 0) return;
    const start = timeline.position;
    const end = start + timeline.span;
    const x = (value: number) => left + (value - start) * plotWidth / timeline.span;
    const stripStart = scales.x.getPixelForValue(start);
    const stripEnd = scales.x.getPixelForValue(end);
    ctx.clearRect(0, 0, width, height);
    // The source bitmap contains the whole forecast and both y-axes. Only the
    // middle slice moves, so scroll frames never run Chart.js layout or drawing.
    const copy = (sourceX: number, sourceWidth: number, destX: number, destWidth: number) => {
      if (sourceWidth <= 0 || destWidth <= 0) return;
      ctx.drawImage(source, sourceX * ratio, 0, sourceWidth * ratio, source.height, destX, 0, destWidth, height);
    };
    copy(0, left, 0, left);
    copy(stripStart, stripEnd - stripStart, left, plotWidth);
    copy(chartArea.right, rightGutter, right, rightGutter);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, 0, plotWidth, height);
    ctx.clip();
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";


    for (const { value, label, color } of props.thresholds ?? []) {
      const y = scales.y.getPixelForValue(value);
      if (!label || y < top || y > bottom) continue;
      ctx.font = `11px ${font}`;
      const labelWidth = ctx.measureText(label).width;
      ctx.fillStyle = surface;
      ctx.fillRect(right - labelWidth - 10, y - 17, labelWidth + 10, 15);
      ctx.fillStyle = color;
      ctx.fillText(label, right - labelWidth - 4, y - 9);
      if (value === 2 && crossingMarkers.length) {
        ctx.save();
        ctx.strokeStyle = surface;
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        for (const marker of crossingMarkers) {
          const markerX = hourlyChartX(marker.x);
          if (markerX < start || markerX > end) continue;
          const pixel = x(markerX);
          const time = `~${marker.label}`;
          const timeWidth = ctx.measureText(time).width;
          // The lower-UV side lies before a rising crossing and after a falling
          // crossing. Never clamp a label back inside the filled UV shape.
          const labelX = marker.kind === "uv-rising" ? pixel - timeWidth - 8 : pixel + 8;
          if (labelX < left + 4 || labelX + timeWidth > right - 4) continue;
          ctx.strokeText(time, labelX, y);
          ctx.fillText(time, labelX, y);
          ctx.beginPath();
          ctx.arc(pixel, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (dailyPeaks.length) {
      ctx.font = `700 11px ${font}`;
      ctx.strokeStyle = surface;
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
      for (const peak of dailyPeaks) {
        if (peak.x < start || peak.x >= end) continue;
        const axis = scales[peak.axis];
        if (!axis) continue;
        const labelWidth = ctx.measureText(peak.label).width;
        const position = Math.max(left + 2, Math.min(right - labelWidth - 2, x(peak.x) - labelWidth / 2));
        const preferredY = Math.max(top + 8, Math.min(bottom - 8, axis.getPixelForValue(peak.value) - 9));
        let y = preferredY;
        for (let attempt = 0; attempt < 24; attempt++) {
          const offset = attempt === 0 ? 0 : Math.ceil(attempt / 2) * 14 * (attempt % 2 ? -1 : 1);
          const candidate = preferredY + offset;
          if (candidate < top + 7 || candidate > bottom - 7) continue;
          y = candidate;
          if (!occupied.some((box) => position < box.right + 3 && position + labelWidth > box.left - 3 && y - 6 < box.bottom && y + 6 > box.top)) break;
        }
        occupied.push({ left: position, right: position + labelWidth, top: y - 6, bottom: y + 6 });
        ctx.fillStyle = peak.color;
        ctx.strokeText(peak.label, position, y);
        ctx.fillText(peak.label, position, y);
      }
    }

    let nearest = -1;
    let distance = Infinity;
    let hasReadings = false;
    const pointerInPlot = hover && hover.x >= left && hover.x <= right && hover.y >= top && hover.y <= bottom;
    for (const { index, x: value } of readings) {
      if (value < start) continue;
      if (value > end) break;
      hasReadings = true;
      if (!pointerInPlot) break;
      if (pointerInPlot && hover) {
        const dx = Math.abs(hover.x - x(value));
        if (dx < distance) {
          distance = dx;
          nearest = index;
        }
      }
    }
    if (!hasReadings) {
      ctx.font = `13px ${font}`;
      ctx.fillStyle = muted;
      ctx.textAlign = "center";
      ctx.fillText("No readings in this view", (left + right) / 2, (top + bottom) / 2);
    }
    ctx.restore();

    // Tickers are drawn over the cached data, so they reserve no plot space.
    drawDateRuler(ctx, width, bottom - RULER_HEIGHT, props.today, timeline, tickerMarkers, font, rulerColors, { overlay: true });

    // The data reaches both screen edges; haloed labels sit above the plot.
    ctx.save();
    ctx.font = `11px ${font}`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = surface;
    for (const id of ["y", "wind", "temperature"]) {
      const axis = scales[id];
      if (!axis) continue;
      ctx.textAlign = id === "y" ? "left" : "right";
      ctx.fillStyle = id === "wind" ? windInk : id === "temperature" ? temperatureInk : muted;
      for (const tick of axis.ticks) {
        const y = axis.getPixelForValue(tick.value);
        // Keep the label and its halo at least 4px below the plot top.
        if (y < top + 10 || y > bottom) continue;
        const label = `${tick.value}${id === "wind" ? " mph" : id === "temperature" ? "°" : scales.wind ? " ft" : ""}`;
        const inset = width < 640 ? 8 : 4;
        const pixel = id === "y" ? inset : width - inset;
        ctx.strokeText(label, pixel, Math.max(top + 6, Math.min(bottom - 6, y)));
        ctx.fillText(label, pixel, Math.max(top + 6, Math.min(bottom - 6, y)));
      }
    }
    ctx.restore();

    if (nearest >= 0 && hover) {
      const sample = props.samples[nearest];
      const heading = sample.label || "Daily total";
      const rows = props.datasets.flatMap((dataset) => {
        const value = dataset.data[nearest];
        if (value == null) return [];
        const title = dataset.label || "";
        const [, name, unit] = title.match(/^(.*?)\s*\(([^)]+)\)$/) || [];
        const from = dataset.yAxisID === "wind" && value > 0 && sample.windDirection != null
          ? ` · from ${compassPoints[Math.round(sample.windDirection / 45) % 8]}`
          : "";
        const units = props.tooltipUnit || unit;
        const suffix = units && units !== "°F" ? ` ${units}` : units || "";
        return [`${name || title}: ${value.toLocaleString("en-US")}${suffix}${from}`];
      });
      ctx.save();
      ctx.font = `600 12px ${font}`;
      const headingWidth = ctx.measureText(heading).width;
      ctx.font = `12px ${font}`;
      const tooltipWidth = Math.max(headingWidth, ...rows.map((row) => ctx.measureText(row).width)) + 20;
      const tooltipHeight = 20 + (rows.length + 1) * 16;
      const marker = x(hourlyChartX(sample.x));
      const tipX = Math.max(2, marker + tooltipWidth + 12 <= width ? marker + 8 : marker - tooltipWidth - 8);
      const tipY = Math.max(2, Math.min(height - tooltipHeight - 2, hover.y - tooltipHeight / 2));
      ctx.strokeStyle = divider;
      ctx.beginPath();
      ctx.moveTo(marker, top);
      ctx.lineTo(marker, bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tooltipWidth, tooltipHeight, 8);
      ctx.fillStyle = surface;
      ctx.fill();
      ctx.strokeStyle = tooltipBorder;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.textBaseline = "middle";
      ctx.font = `600 12px ${font}`;
      ctx.fillText(heading, tipX + 10, tipY + 18);
      ctx.font = `12px ${font}`;
      rows.forEach((row, index) => ctx.fillText(row, tipX + 10, tipY + 34 + index * 16));
      ctx.restore();
    }
  }

  function scheduleDraw() {
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      drawViewport();
    });
  }

  function buildStrip() {
    const nextWidth = element.clientWidth, nextHeight = element.clientHeight;
    if (!nextWidth || !nextHeight || disposed) return;
    stripDirty = false;
    builtSpan = timeline.span;
    width = nextWidth;
    height = nextHeight;
    const deviceRatio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(width * deviceRatio);
    element.height = Math.round(height * deviceRatio);
    ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);

    plot?.destroy();
    source.width = width;
    source.height = height;
    const samples = props.samples.map((sample) => ({ ...sample, x: hourlyChartX(sample.x) }));
    readings = samples.flatMap(({ x }, index) =>
      props.datasets.some((dataset) => dataset.data[index] != null) ? [{ x, index }] : [],
    );
    const rain = props.datasets.find((dataset) => dataset.yAxisID === "rainfall");
    const wind = props.datasets.find((dataset) => dataset.yAxisID === "wind");
    const peaksByDay = new Map<number, RainPeak>();
    rain?.data.forEach((value, index) => {
      const day = Math.floor(props.samples[index].x);
      if (value != null && value > (peaksByDay.get(day)?.value ?? 0)) {
        peaksByDay.set(day, { day, x: samples[index].x, value, label: `${inches.format(value)}″` });
      }
    });
    rainPeaks = [...peaksByDay.values()];
    dailyPeaks = props.datasets.flatMap((dataset) => {
      if (daily && dataset.atDayStart) return [];
      const peaks = new Map<number, DailyPeak>();
      const unit = props.tooltipUnit || dataset.label?.match(/\(([^)]+)\)$/)?.[1] || "";
      const color = typeof dataset.borderColor === "string" ? dataset.borderColor : ink;
      dataset.data.forEach((value, index) => {
        if (value == null || !Number.isFinite(value)) return;
        if (unit === "in" && value === 0) return;
        const day = Math.floor(props.samples[index].x);
        const existing = peaks.get(day);
        if (existing && value <= existing.value) return;
        const label = unit === "in" ? `${inches.format(value)}″` : `${Number(value.toFixed(1))}${unit === "°F" ? "°" : unit ? ` ${unit}` : ""}`;
        peaks.set(day, { day, x: dataset.atDayStart ? hourlyChartX(props.samples[index].x - .5) : samples[index].x, value, label, axis: dataset.yAxisID || "y", color });
      });
      return [...peaks.values()];
    });
    const highestRain = Math.max(0, ...rainPeaks.map((peak) => peak.value));
    const bounds = viewportScales();
    scaleSignature = JSON.stringify(bounds);
    plot = new ChartJS(source, {
      type: props.type || "line",
      data: {
        datasets: props.datasets.map(({ atDayStart, ...dataset }) => ({
          ...dataset,
          clip: 0,
          data: samples.map(({ x }, i) => ({
            x: atDayStart ? hourlyChartX(props.samples[i].x - .5) : x,
            y: dataset.data[i] ?? null,
          })),
        })),
      },
      plugins: [plotDecorations],
      options: {
        responsive: false,
        maintainAspectRatio: false,
        devicePixelRatio: 1,
        animation: false,
        parsing: false,
        events: [],
        layout: { autoPadding: false, padding: { top: 0, bottom: 0, right: 0 } },
        font: { family: font },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { type: "linear", min: hourlyChartX(domainMin), max: domainMax, offset: false, display: false },
          ...(rain ? {
            rainfall: {
              type: "linear" as const,
              axis: "y" as const,
              display: false,
              min: 0,
              max: highestRain ? highestRain * 1.65 : 1,
            },
          } : {}),
          y: {
            afterFit: (scale) => { scale.width = 0; },
            min: props.minimum,
            max: bounds.maximum,
            suggestedMax: !props.visibleScale && props.thresholds?.length
              ? Math.max(...props.thresholds.map((threshold) => threshold.value)) * 1.15
              : undefined,
            ticks: {
              display: false,
              color: wind ? colorToken("water-ink") : muted,
              font: { family: font },
              ...(wind ? { callback: (value: string | number) => `${value} ft` } : {}),
            },
            grid: { color: colorWithAlpha("muted", .18) },
          },
          ...(wind ? {
            wind: {
              afterFit: (scale) => { scale.width = 0; },
              type: "linear" as const,
              position: "right" as const,
              min: 0,
              max: bounds.wind,
              grid: { drawOnChartArea: false },
              ticks: {
                display: false,
                color: colorToken("chart-today"),
                font: { family: font },
                callback: (value: string | number) => `${value} mph`,
              },
            },
          } : {}),
          ...(props.temperatureAxis
            ? {
                temperature: {
                  min: bounds.temperature?.min,
                  max: bounds.temperature?.max,
                  afterFit: (scale) => { scale.width = 0; },
                  type: "linear" as const,
                  position: "right" as const,
                  grid: { drawOnChartArea: false },
                  ticks: {
                    display: false,
                    color: colorToken("chart-temperature"),
                    font: { family: font },
                    callback: (value: string | number) => `${value}°`,
                  },
                },
              }
            : {}),
        },
      },
    });

    const { left, right } = plot.chartArea;
    const stripWidth = Math.round(width + (right - left) * (domainMax - hourlyChartX(domainMin) - timeline.span) / timeline.span);
    plot.options.devicePixelRatio = Math.min(deviceRatio, 8192 / stripWidth);
    plot.resize(stripWidth, height);
    if (inView) drawViewport();
  }

  function invalidateStrip() {
    stripDirty = true;
    if (inView) buildStrip();
  }

  function moveByPixels(pixels: number) {
    if (!plot) return;
    const plotWidth = width - plot.width + plot.chartArea.right - plot.chartArea.left;
    if (plotWidth > 0) timeline.moveTo(timeline.position + pixels * timeline.span / plotWidth);
  }

  function pointerDown(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    element.setPointerCapture(event.pointerId);
  }

  function showHover(event: PointerEvent) {
    const bounds = element.getBoundingClientRect();
    hover = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    scheduleDraw();
  }

  function pointerMove(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) {
      if (event.pointerType === "mouse") showHover(event);
      return;
    }
    const dx = event.clientX - pointer.x;
    const isTouch = event.pointerType === "touch";
    if (!pointer.dragging) {
      const dragThreshold = isTouch ? 3 : 5;
      if (Math.abs(dx) < dragThreshold || Math.abs(dx) < Math.abs(event.clientY - pointer.y)) return;
      pointer.dragging = true;
      hover = undefined;
      element.classList.add("dragging");
      scheduleDraw();
    }
    moveByPixels(-dx * (isTouch ? TOUCH_DRAG_MULTIPLIER : 1));
    pointer.x = event.clientX;
  }

  function pointerEnd(event: PointerEvent) {
    if (pointer && !pointer.dragging && event.type === "pointerup") showHover(event);
    pointer = undefined;
    element.classList.remove("dragging");
  }

  function keydown(event: KeyboardEvent) {
    const day = forecastDayAt(timeline.position, timeline.span);
    switch (event.key) {
      case "ArrowLeft": timeline.moveTo(positionForForecastDay(day - 1, timeline.span), true); break;
      case "ArrowRight": timeline.moveTo(positionForForecastDay(day + 1, timeline.span), true); break;
      case "Home": timeline.moveTo(0, true); break;
      case "End": timeline.moveTo(MAX_FORECAST_SCROLL, true); break;
      default: return;
    }
    event.preventDefault();
  }

  const events = new AbortController();
  const { signal } = events;
  element.addEventListener("pointerdown", pointerDown, { signal });
  element.addEventListener("pointermove", pointerMove, { signal });
  element.addEventListener("pointerup", pointerEnd, { signal });
  element.addEventListener("lostpointercapture", pointerEnd, { signal });
  element.addEventListener("pointerleave", () => {
    if (!hover) return;
    hover = undefined;
    scheduleDraw();
  }, { signal });
  element.addEventListener("keydown", keydown, { signal });

  const unsubscribe = timeline.subscribe(() => {
    hover = undefined;
    if (builtSpan !== timeline.span) invalidateStrip();
    else if (inView) drawViewport();
    // Re-scale only after a drag settles, and only if the visible value bucket
    // changes. Panning itself remains bitmap-only with no Chart.js updates.
    clearTimeout(scaleTimer);
    if (props.visibleScale || props.temperatureAxis || props.datasets.some((dataset) => dataset.yAxisID === "wind")) scaleTimer = setTimeout(() => {
      if (scaleSignature !== JSON.stringify(viewportScales())) invalidateStrip();
    }, 140);
  });
  const visibility = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) return;
    if (stripDirty) buildStrip();
    else drawViewport();
  });
  visibility.observe(element);
  const resize = new ResizeObserver(() => {
    if (width !== element.clientWidth || height !== element.clientHeight) invalidateStrip();
  });
  resize.observe(element);
  if (document.fonts.status === "loading") void document.fonts.ready.then(invalidateStrip);

  return {
    update(next: Props) {
      const dataChanged = props.samples !== next.samples || props.datasets !== next.datasets || props.thresholds !== next.thresholds;
      const dateChanged = props.today !== next.today;
      const markersChanged = props.markers !== next.markers;
      props = next;
      if (markersChanged) cacheMarkers();
      if (dataChanged) invalidateStrip();
      else if (inView && (dateChanged || markersChanged)) drawViewport();
    },
    destroy() {
      disposed = true;
      clearTimeout(scaleTimer);
      events.abort();
      unsubscribe();
      resize.disconnect();
      visibility.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      plot?.destroy();
    },
  };
}

export function Chart(props: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const renderer = useRef<ReturnType<typeof mountChart>>(undefined);
  const descriptionId = useId();

  useEffect(() => {
    if (canvas.current) renderer.current = mountChart(canvas.current, props);
    return () => renderer.current?.destroy();
  }, []);

  useEffect(() => {
    renderer.current?.update(props);
  }, [props.samples, props.datasets, props.thresholds, props.markers, props.today]);

  return (
    <>
      {props.title && <div className="chart-heading"><h3>{props.title}</h3>{props.summary && <span className="runoff-summary">{props.summary}</span>}</div>}
      <div className="chart-wrap forecast-chart" style={props.height ? { "--chart-height": `${props.height * 1.5}px` } : undefined}>
      {props.description && <span className="visually-hidden" id={descriptionId}>{props.description}</span>}
      <canvas
        ref={canvas}
        role="img"
        aria-label={props.label}
        aria-describedby={props.description ? `${descriptionId} forecast-instructions` : "forecast-instructions"}
        tabIndex={0}
      >
        {props.label}
      </canvas>
      </div>
    </>
  );
}
