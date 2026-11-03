"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  loadData,
  METRICS,
  type BuurtCollection,
  type BuurtMetric,
  type Metrics,
} from "../lib/data.ts";
import {
  classBreaks,
  fillColor,
  NO_DATA,
  pickYear,
  pooledValues,
  rampFor,
  yearIndexesWithData,
  type Theme,
} from "../lib/scale.ts";
import MapView, { type HoverInfo } from "./MapView.tsx";
import Panel from "./Panel.tsx";
import RankTable, { type RankRow } from "./RankTable.tsx";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const METRIC_KEYS = Object.keys(METRICS) as BuurtMetric[];

function useTheme(): Theme {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DARK_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => (window.matchMedia(DARK_QUERY).matches ? "dark" : "light"),
    () => "light",
  );
}

export default function Explorer() {
  const [data, setData] = useState<{ geo: BuurtCollection; metrics: Metrics } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<BuurtMetric>("avg_woz_eur");
  const [yearPick, setYearPick] = useState<number | null>(null);
  const [view, setView] = useState<"map" | "table">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const theme = useTheme();

  useEffect(() => {
    loadData().then(setData, (reason: unknown) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, []);

  const metrics = data?.metrics;
  const allowed = useMemo(() => (metrics ? yearIndexesWithData(metrics, metric) : []), [metrics, metric]);
  const breaks = useMemo(() => (metrics ? classBreaks(pooledValues(metrics, metric)) : []), [metrics, metric]);
  const yearIndex = metrics ? pickYear(allowed, metrics.years, yearPick) : 0;

  const values = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(metrics?.buurten ?? {}).map(([code, buurt]) => [code, buurt[metric][yearIndex] ?? null]),
      ),
    [metrics, metric, yearIndex],
  );
  const ramp = rampFor(theme);
  const fill = useMemo(() => fillColor(breaks, rampFor(theme), NO_DATA[theme]), [breaks, theme]);
  const byCode = useMemo(
    () => new Map((data?.geo.features ?? []).map((feature) => [feature.properties.code, feature.properties])),
    [data],
  );

  const rows: RankRow[] = useMemo(
    () =>
      [...byCode.values()]
        .map((props) => ({
          code: props.code,
          name: props.name,
          gebied: metrics?.gebieden[props.gebied]?.name ?? props.gebied,
          value: values[props.code] ?? null,
        }))
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    [byCode, metrics, values],
  );

  if (error) return <p className="status">Could not load the data: {error}. Run the pipeline first (see README).</p>;
  if (!data || !metrics) return <p className="status">Loading…</p>;

  const { label, format, axis } = METRICS[metric];
  const year = metrics.years[yearIndex];
  const hovered = hover ? byCode.get(hover.code) : undefined;
  const hoveredValue = hover ? values[hover.code] : null;

  return (
    <div className="app">
      <header>
        <div>
          <h1>Where to live in Amsterdam</h1>
          <p className="muted">House values and green space per neighbourhood, from the city&apos;s open data.</p>
        </div>
        <div className="controls">
          <div className="segmented" role="group" aria-label="Metric">
            {METRIC_KEYS.map((key) => (
              <button key={key} type="button" aria-pressed={key === metric} onClick={() => setMetric(key)}>
                {METRICS[key].label}
              </button>
            ))}
          </div>
          <label className="year">
            <span>Year</span>
            <input
              type="range"
              min={0}
              max={allowed.length - 1}
              value={allowed.indexOf(yearIndex)}
              onChange={(event) => setYearPick(metrics.years[allowed[Number(event.target.value)]])}
              aria-valuetext={String(year)}
            />
            <output>{year}</output>
          </label>
          <div className="segmented" role="group" aria-label="View">
            {(["map", "table"] as const).map((key) => (
              <button key={key} type="button" aria-pressed={key === view} onClick={() => setView(key)}>
                {key === "map" ? "Map" : "Table"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="stage">
        <div className="canvas">
          {view === "map" ? (
            <>
              <MapView
                geo={data.geo}
                values={values}
                fill={fill}
                theme={theme}
                selected={selected}
                onSelect={setSelected}
                onHover={setHover}
              />
              {hover && hovered && (
                <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
                  <b>{hoveredValue === null ? "no data" : format(hoveredValue)}</b>
                  <span>{hovered.name}</span>
                </div>
              )}
              <div className="legend">
                <b>
                  {label}, {year}
                </b>
                <div className="ramp" style={{ background: `linear-gradient(to right, ${ramp.join(",")})` }} />
                <div className="ramp-labels">
                  <span>{breaks.length ? axis(breaks[0]) : ""}</span>
                  <span>{breaks.length ? axis(breaks[3]) : ""}</span>
                  <span>{breaks.length ? axis(breaks[6]) : ""}</span>
                </div>
                <span className="nodata">
                  <i style={{ background: NO_DATA[theme] }} aria-hidden="true" /> No data
                </span>
              </div>
            </>
          ) : (
            <RankTable
              rows={rows}
              caption={`${label} per buurt, ${year}`}
              format={format}
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </div>
        <Panel
          buurt={selected ? (byCode.get(selected) ?? null) : null}
          metrics={metrics}
          metric={metric}
          yearIndex={yearIndex}
          onClear={() => setSelected(null)}
        />
      </div>

      <footer className="muted">
        Source: Gemeente Amsterdam open data (BBGA, gebieden). WOZ values are blank where the city publishes none.
        Past years use today&apos;s buurt boundaries.
      </footer>
    </div>
  );
}
