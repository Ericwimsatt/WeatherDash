import { colorToken, colorWithAlpha } from "../color-tokens.ts";
import { useEffect, useRef } from "octane";
import ChartJS from "chart.js/auto";
import type { ChartDataset, ChartType, Plugin } from "chart.js";
export type Threshold = { value: number; label?: string; color: string };
type Props = {
  label: string;
  labels: string[];
  datasets: ChartDataset[];
  type?: ChartType;
  yTitle?: string;
  minimum?: number;
  maximum?: number;
  tooltipUnit?: string;
  height?: number;
  temperatureAxis?: boolean;
  thresholds?: Threshold[];
  edgePadding?: number;
  todayIndex?: number;
};
export function Chart(props: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const instance = useRef<ChartJS | null>(null);
  const thresholds = useRef(props.thresholds || []);
  const todayIndex = useRef(props.todayIndex);
  useEffect(() => {
    if (!canvas.current) return;
    const thresholdLines: Plugin = {
      id: "weatherThresholds",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales.y) return;
        ctx.save();
        ctx.font = "11px system-ui";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        if (todayIndex.current != null && todayIndex.current >= 0) {
          const x = scales.x.getPixelForValue(todayIndex.current);
          ctx.strokeStyle = colorToken("chart-today");
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        for (const threshold of thresholds.current) {
          const y = scales.y.getPixelForValue(threshold.value);
          if (y < chartArea.top || y > chartArea.bottom) continue;
          ctx.strokeStyle = threshold.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
          ctx.setLineDash([]);
          if (!threshold.label) continue;
          const label = threshold.label;
          const width = ctx.measureText(label).width;
          ctx.fillStyle = colorToken("surface");
          ctx.fillRect(chartArea.right - width - 10, y - 17, width + 10, 15);
          ctx.fillStyle = threshold.color;
          ctx.fillText(label, chartArea.right - 4, y - 4);
        }
        ctx.restore();
      },
    };
    const chart = new ChartJS(canvas.current, {
      type: props.type || "line",
      data: { labels: props.labels, datasets: props.datasets },
      plugins: [thresholdLines],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: false,
            labels: { color: colorToken("muted-strong"), boxWidth: 12 },
          },
          tooltip: {
            backgroundColor: colorToken("surface"),
            titleColor: colorToken("ink"),
            bodyColor: colorToken("ink"),
            footerColor: colorToken("muted-strong"),
            borderColor: colorToken("tooltip-border"),
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            filter: (item) => item.parsed.y != null,
            ...(props.tooltipUnit
              ? {
                  callbacks: {
                    label: (item: import("chart.js").TooltipItem<ChartType>) =>
                      `${item.dataset.label}: ${item.formattedValue} ${props.tooltipUnit}`,
                  },
                }
              : {}),
          },
        },
        scales: {
          x: {
            ...(props.edgePadding
              ? {
                  min: 0,
                  max: props.labels.length - 1,
                  offset: false,
                }
              : {}),
            grid: { display: false },
            ticks: {
              color: colorToken("muted-strong"),
              maxTicksLimit: 8,
              maxRotation: 0,
              ...(props.edgePadding
                ? {
                    callback: function (
                      this: ChartJS["scales"][string],
                      value: string | number,
                    ) {
                      const index = Number(value),
                        padding = props.edgePadding!;
                      return index < padding ||
                        index >= this.getLabels().length - padding
                        ? ""
                        : this.getLabelForValue(index);
                    },
                  }
                : {}),
            },
          },
          y: {
            min: props.minimum,
            max: props.maximum,
            suggestedMax: props.thresholds?.length
              ? Math.max(...props.thresholds.map((t) => t.value)) * 1.15
              : undefined,
            title: {
              display: !!props.yTitle,
              text: props.yTitle,
              color: colorToken("muted-strong"),
            },
            ticks: { color: colorToken("muted-strong") },
            grid: { color: colorWithAlpha("muted", .18) },
          },
          ...(props.temperatureAxis
            ? {
                temperature: {
                  type: "linear" as const,
                  position: "right" as const,
                  grid: { drawOnChartArea: false },
                  ticks: {
                    color: colorToken("chart-temperature"),
                    callback: (value: string | number) => `${value}°F`,
                  },
                },
              }
            : {}),
        },
      },
    });
    instance.current = chart;
    return () => {
      chart.destroy();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    const chart = instance.current;
    if (!chart) return;
    thresholds.current = props.thresholds || [];
    todayIndex.current = props.todayIndex;
    chart.data.labels = props.labels;
    chart.data.datasets = props.datasets;
    chart.update("none");
  }, [props.labels, props.datasets, props.thresholds, props.todayIndex]);
  return (
    <div className="chart-wrap" style={{ height: props.height || 180 }}>
      <canvas ref={canvas} role="img" aria-label={props.label}>
        {props.label}
      </canvas>
    </div>
  );
}
