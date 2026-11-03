import type { ExpressionSpecification } from "maplibre-gl";
import type { BuurtMetric, Metrics, Series } from "./data.ts";

// One-hue sequential ramps, light -> dark. Green and orange share the lightness and chroma
// profile of the design system's blue ramp (steps 100..700), so all hues feel alike.
// Green space runs white -> dark green in both themes: more green space = darker green.
const WHITE_TO_GREEN = ["#fafafa", "#cdebca", "#a0d59b", "#70ba6a", "#3b9e37", "#007900", "#004f00"];
const SEQUENTIAL = {
  green_pct: WHITE_TO_GREEN,
  population: ["#ffd5c6", "#f9ac91", "#ef8057", "#e05104", "#b43f01", "#8a2e00", "#611e00"],
} as const;
// Dark surface: population recedes into the surface at the low end and lights up at the high end.
const DARK_SEQUENTIAL = {
  green_pct: WHITE_TO_GREEN,
  population: ["#621e00", "#882e00", "#b13d00", "#db4e00", "#fe6218", "#fe8e65", "#ffad90"],
} as const;
// Diverging blue <-> red around a neutral midpoint, three steps per arm, pole -> centre.
const BLUE_ARM = ["#184f95", "#3987e5", "#9ec5f4"] as const;
const RED_ARM = ["#9a0117", "#ee353c", "#ffa79f"] as const;
const MIDPOINT = { light: "#f0efec", dark: "#383835" } as const;

// Must stay clearly apart from the diverging midpoint (#f0efec / #383835): "no data" is not "median".
export const NO_DATA = { light: "#c9c8c3", dark: "#76756f" } as const;
// One colour stop per quantile, so each colour covers roughly the same number of buurten.
export const QUANTILES = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95] as const;
// Diverging stops as a ratio to the city median, symmetric on a log scale: 1/2 ... 1 ... 2.
export const RATIO_BREAKS = [1 / 2, 1 / 1.5, 1 / 1.2, 1, 1.2, 1.5, 2] as const;

export type Theme = "light" | "dark";

/** WOZ values are shown relative to the city median; the other metrics on their own scale. */
export function isDiverging(metric: BuurtMetric): boolean {
  return metric === "avg_woz_eur";
}

/**
 * Colours for a metric, low -> high. On a dark surface the colours nearest the midpoint (or the
 * low end) must recede into the surface and the extremes light up.
 */
export function rampFor(metric: BuurtMetric, theme: Theme): string[] {
  if (isDiverging(metric)) {
    return theme === "light"
      ? [...BLUE_ARM, MIDPOINT.light, ...[...RED_ARM].reverse()]
      : [...[...BLUE_ARM].reverse(), MIDPOINT.dark, ...RED_ARM];
  }
  const ramps = theme === "light" ? SEQUENTIAL : DARK_SEQUENTIAL;
  return [...ramps[metric as keyof typeof ramps]];
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
