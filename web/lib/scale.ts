import type { ExpressionSpecification } from "maplibre-gl";
import type { BuurtMetric, Metrics, Series } from "./data.ts";

// Single-hue sequential blue, light -> dark (design-system steps 100..700).
export const RAMP = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#256abf",
  "#184f95",
  "#0d366b",
] as const;
export const NO_DATA = { light: "#c9c8c3", dark: "#4a4a46" } as const;
// One colour stop per quantile, so each colour covers roughly the same number of buurten.
export const QUANTILES = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95] as const;

export type Theme = "light" | "dark";

/** On a dark surface the low end must recede into the surface, so the ramp is reversed. */
export function rampFor(theme: Theme): string[] {
  return theme === "light" ? [...RAMP] : [...RAMP].reverse();
}

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return quantile([...values].sort((a, b) => a - b), 0.5);
}

/** Quantile breaks, nudged to be strictly increasing: MapLibre rejects repeated stops. */
export function classBreaks(values: number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (const q of QUANTILES) {
    const value = quantile(sorted, q);
    const previous = breaks.at(-1);
    breaks.push(previous === undefined ? value : Math.max(value, previous + 1e-6));
  }
  return breaks;
}

export function pooledValues(metrics: Metrics, metric: BuurtMetric): number[] {
  return Object.values(metrics.buurten)
    .flatMap((buurt) => buurt[metric])
    .filter((value): value is number => value !== null);
}

export function valuesAt(metrics: Metrics, metric: BuurtMetric, yearIndex: number): number[] {
  return Object.values(metrics.buurten)
    .map((buurt) => buurt[metric][yearIndex])
    .filter((value): value is number => value !== null);
}

/** Indexes into `years` where at least one buurt has a value for this metric. */
export function yearIndexesWithData(metrics: Metrics, metric: BuurtMetric): number[] {
  return metrics.years.flatMap((_, index) => (valuesAt(metrics, metric, index).length ? [index] : []));
}

/** The allowed year index closest to the wanted year; the latest one when none is wanted. */
export function pickYear(allowed: number[], years: number[], wanted: number | null): number {
  if (wanted === null) return allowed[allowed.length - 1];
  return allowed.reduce((best, index) =>
    Math.abs(years[index] - wanted) <= Math.abs(years[best] - wanted) ? index : best,
  );
}

export function cityMedianSeries(metrics: Metrics, metric: BuurtMetric): Series {
  return metrics.years.map((_, index) => median(valuesAt(metrics, metric, index)));
}

/** The most recent non-null value at or before an index, with where it was found. */
export function latestAtOrBefore(
  series: Series,
  index: number,
): { value: number; index: number } | null {
  for (let i = Math.min(index, series.length - 1); i >= 0; i--) {
    const value = series[i];
    if (value !== null) return { value, index: i };
  }
  return null;
}

/** MapLibre fill-color: interpolate the ramp over the breaks; grey where a buurt has no value. */
export function fillColor(
  breaks: number[],
  ramp: readonly string[],
  noData: string,
): ExpressionSpecification {
  const value: ExpressionSpecification = ["feature-state", "value"];
  if (breaks.length < 2) return ["literal", noData] as unknown as ExpressionSpecification;
  const stops = breaks.flatMap((stop, i) => [stop, ramp[i]]);
  return [
    "case",
    ["==", ["typeof", value], "number"],
    ["interpolate", ["linear"], value, ...stops],
    noData,
  ] as ExpressionSpecification;
}
