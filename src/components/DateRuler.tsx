import { useEffect, useRef } from "octane";
import { colorToken } from "../color-tokens.ts";
import { FORECAST_DAYS, HISTORY_DAYS, forecastDateLabel, forecastDayAt, hourlyChartX, positionForForecastDay, type ForecastTimeline } from "../data/forecast-timeline.ts";
import { shiftDate } from "../../shared/time.ts";
import type { TimeMarker } from "../data/chart-axis.ts";

export const RULER_HEIGHT = 32;
export const rulerPalette = () => ({ ink: colorToken("ink"), surface: colorToken("surface"), muted: colorToken("muted-strong") });

// Shared drawing keeps every ruler aligned without extra component subscriptions.
export function drawDateRuler(ctx: CanvasRenderingContext2D, width: number, top: number, today: string, timeline: ForecastTimeline, markers: TimeMarker[], font: string, { ink, surface, muted }: ReturnType<typeof rulerPalette>, options: { primary?: boolean; overlay?: boolean } = {}) {
  const x = (value: number) => (value - timeline.position) * width / timeline.span;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, width, RULER_HEIGHT); ctx.clip();
  ctx.font = `11px ${font}`;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // Events and dates share the same band; no separate event-label gutter.
  for (let day = -HISTORY_DAYS; day <= FORECAST_DAYS; day++) {
    const left = x(hourlyChartX(day)), right = x(hourlyChartX(day + 1));
    if (right < 0 || left > width) continue;
    ctx.fillStyle = day === 0 ? surface : Math.abs(day) % 2 ? "#f0f1f0" : "#e5e8e6";
    if (!options.overlay) ctx.fillRect(left, top, right - left, RULER_HEIGHT);
    ctx.fillStyle = muted;
    for (let hour = 0; hour < 24; hour++) {
      const tick = x(hourlyChartX(day + hour / 24));
      const height = hour === 0 ? RULER_HEIGHT : hour === 12 ? 18 : hour % 6 === 0 ? 8 : 4;
      ctx.fillRect(tick, options.primary ? top : top + RULER_HEIGHT - height, 1, height);
    }
  }
  const occupied: { left: number; right: number; lane: number }[] = [];
  for (const marker of markers) {
    const pixel = x(hourlyChartX(marker.x));
    if (pixel < 0 || pixel > width) continue;
    const tide = marker.kind === "high" || marker.kind === "low";
    const uv = marker.kind === "uv-rising" || marker.kind === "uv-falling";
    const label = tide ? `${marker.kind === "high" ? "H" : "L"} ~${marker.label}` : uv ? `UV 2 ~${marker.label}` : marker.label;
    const size = ctx.measureText(label).width;
    const left = Math.max(2, Math.min(width - size - 2, pixel - size / 2));
    const lane = [0, 1].find((lane) => !occupied.some((box) => box.lane === lane && left < box.right + 5 && left + size > box.left - 5));
    if (lane == null) continue;
    occupied.push({ left, right: left + size, lane });
    const y = top + (options.overlay ? 26 - lane * 11 : (tide ? 10 : 17) + lane * 11);
    ctx.strokeStyle = surface; ctx.lineWidth = 4;
    ctx.strokeText(label, left, y);
    ctx.fillStyle = ink; ctx.fillText(label, left, y);
    if (marker.kind === "sunrise" || marker.kind === "sunset") {
      ctx.strokeStyle = muted; ctx.lineWidth = 1;
      const horizon = y - 10;
      ctx.beginPath(); ctx.arc(pixel, horizon, 4, Math.PI, 0);
      ctx.moveTo(pixel - 6, horizon); ctx.lineTo(pixel + 6, horizon); ctx.stroke();
    }
  }
  for (let day = -HISTORY_DAYS; day <= FORECAST_DAYS; day++) {
    const a = Math.max(2, x(hourlyChartX(day))), b = Math.min(width - 2, x(hourlyChartX(day + 1)));
    if (b <= a) continue;
    // Fit the date into a free part of its day, giving event times priority.
    const boxes = occupied.filter((box) => box.left < b && box.right > a).sort((a, b) => a.left - b.left);
    const gaps: { left: number; right: number }[] = [];
    let cursor = a;
    for (const box of boxes) {
      gaps.push({ left: cursor, right: box.left - 6 });
      cursor = Math.max(cursor, box.right + 6);
    }
    gaps.push({ left: cursor, right: b });
    const gap = gaps.sort((a, b) => (b.right - b.left) - (a.right - a.left))[0];
    const date = shiftDate(today, day);
    const label = options.primary ? forecastDateLabel(today, day, gap.right - gap.left < 150) : `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
    const size = ctx.measureText(label).width;
    if (gap.right - gap.left < size + 6) continue;
    const position = (gap.left + gap.right - size) / 2;
    ctx.strokeStyle = options.overlay || day === 0 ? surface : Math.abs(day) % 2 ? "#f0f1f0" : "#e5e8e6";
    ctx.lineWidth = 4;
    ctx.strokeText(label, position, top + (options.primary ? 24 : options.overlay ? 26 : 12));
    ctx.fillStyle = ink; ctx.fillText(label, position, top + (options.primary ? 24 : options.overlay ? 26 : 12));
  }
  ctx.restore();
}

const NO_MARKERS: TimeMarker[] = [];

type Props = { today: string; timeline: ForecastTimeline; markers?: TimeMarker[]; fixed?: boolean };
export function DateRuler({ today, timeline, markers = NO_MARKERS, fixed = false }: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef({ today, markers });
  latest.current = { today, markers };
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let visible = true;
    const font = getComputedStyle(element).fontFamily;
    const palette = rulerPalette();
    let accessibleDate = "";
    const draw = () => {
      if (!visible) return;
      const rulerHeight = RULER_HEIGHT;
      const width = element.clientWidth, ratio = Math.min(devicePixelRatio || 1, 2);
      if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
      if (element.height !== Math.round(rulerHeight * ratio)) element.height = Math.round(rulerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, rulerHeight);
      drawDateRuler(ctx, width, 0, latest.current.today, timeline, latest.current.markers, font, palette, { primary: !fixed });
      const day = forecastDayAt(timeline.position, timeline.span);
      const label = forecastDateLabel(latest.current.today, day);
      if (label !== accessibleDate) {
        accessibleDate = label;
        element.setAttribute("aria-valuenow", String(day));
        element.setAttribute("aria-valuetext", label);
      }
    };
    redraw.current = draw;
    const resize = new ResizeObserver(() => { if (!fixed) timeline.setViewportWidth(element.clientWidth); draw(); });
    resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) draw(); });
    observer.observe(element);
    const unsubscribe = timeline.subscribe(draw);
    let pointer: { x: number; y: number; dragged: boolean } | undefined;
    const controller = new AbortController(), options = { signal: controller.signal };
    element.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = { x: event.clientX, y: event.clientY, dragged: false };
      element.setPointerCapture(event.pointerId);
    }, options);
    element.addEventListener("pointermove", (event) => {
      if (!pointer) return;
      const dx = event.clientX - pointer.x;
      if (!pointer.dragged && (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(event.clientY - pointer.y))) return;
      pointer.dragged = true;
      timeline.moveTo(timeline.position - dx * timeline.span / element.clientWidth);
      pointer.x = event.clientX;
    }, options);
    element.addEventListener("pointerup", (event) => {
      if (pointer && !pointer.dragged) {
        const position = timeline.position + (event.clientX - element.getBoundingClientRect().left) / element.clientWidth * timeline.span;
        const day = Array.from({ length: HISTORY_DAYS + FORECAST_DAYS + 1 }, (_, i) => i - HISTORY_DAYS).find((day) => position >= hourlyChartX(day) && position < hourlyChartX(day + 1));
        if (day != null) timeline.moveTo(positionForForecastDay(day, timeline.span), true);
      }
      pointer = undefined;
    }, options);
    element.addEventListener("lostpointercapture", () => { pointer = undefined; }, options);
    element.addEventListener("keydown", (event) => {
      const day = forecastDayAt(timeline.position, timeline.span);
      const next = event.key === "ArrowLeft" ? day - 1 : event.key === "ArrowRight" ? day + 1 : event.key === "Home" ? 0 : event.key === "End" ? FORECAST_DAYS : undefined;
      if (next == null) return;
      event.preventDefault(); timeline.moveTo(positionForForecastDay(next, timeline.span), true);
    }, options);
    draw();
    return () => { controller.abort(); unsubscribe(); resize.disconnect(); observer.disconnect(); };
  }, [timeline, fixed]);
  useEffect(() => redraw.current(), [today, markers]);
  return <div className={`date-ruler-frame${fixed ? " date-ruler-bottom" : ""}`}><canvas ref={canvas} tabIndex={0} role="slider" aria-valuemin={-HISTORY_DAYS} aria-valuemax={FORECAST_DAYS} aria-valuenow={timeline.settledDay} aria-label="Forecast date ticker. Drag, select a date, or use arrow keys to change dates." /></div>;
}
