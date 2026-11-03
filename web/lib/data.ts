import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type BuurtMetric = "avg_woz_eur" | "green_pct" | "population";
export type Series = (number | null)[];

/** metrics.json, written by `uv run export`. Arrays are aligned with `years`. */
export interface Metrics {
  years: number[];
  buurten: Record<string, Record<BuurtMetric, Series>>;
  gebieden: Record<string, { name: string; livability_score: Series; safety_score: Series }>;
}

export interface BuurtProps {
  code: string;
  name: string;
  gebied: string;
}
export type BuurtCollection = FeatureCollection<Polygon | MultiPolygon, BuurtProps>;

// en-GB: "1,690" is unambiguous in an English UI, where en-NL would print "1.690".
const eur = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export const METRICS: Record<
  BuurtMetric,
  { label: string; format: (v: number) => string; axis: (v: number) => string }
> = {
  avg_woz_eur: {
    label: "Average WOZ value",
    format: (v) => eur.format(v),
    axis: (v) => `€${Math.round(v / 1000)}k`,
  },
  green_pct: {
    label: "Green space",
    format: (v) => `${v.toFixed(1)}%`,
    axis: (v) => `${Math.round(v)}%`,
  },
  population: {
    label: "Population",
    format: (v) => integer.format(v),
    axis: (v) => integer.format(v),
  },
};

/** "" locally; "/a-new-home" on GitHub Pages, set at build time (see deploy workflow). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  // Our own pipeline writes these files, and `uv run export` validates them.
  return (await response.json()) as T;
}

export async function loadData(): Promise<{ geo: BuurtCollection; metrics: Metrics }> {
  const [geo, metrics] = await Promise.all([
    getJson<BuurtCollection>(`${BASE_PATH}/data/buurten.geojson`),
    getJson<Metrics>(`${BASE_PATH}/data/metrics.json`),
  ]);
  return { geo, metrics };
}
