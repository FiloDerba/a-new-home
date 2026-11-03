"use client";

import { METRICS, type BuurtMetric, type BuurtProps, type Metrics } from "../lib/data.ts";
import { cityMedianSeries, latestAtOrBefore, valuesAt } from "../lib/scale.ts";
import Trend from "./Trend.tsx";

interface Props {
  buurt: BuurtProps | null;
  metrics: Metrics;
  metric: BuurtMetric;
  yearIndex: number;
  onClear: () => void;
}

const ALL_METRICS = Object.keys(METRICS) as BuurtMetric[];

export default function Panel({ buurt, metrics, metric, yearIndex, onClear }: Props) {
  const year = metrics.years[yearIndex];
  const { label, format, axis } = METRICS[metric];

  if (!buurt) {
    const values = valuesAt(metrics, metric, yearIndex);
    const median = cityMedianSeries(metrics, metric)[yearIndex];
    return (
      <aside className="panel">
        <h2>Amsterdam, {year}</h2>
        <p className="muted">Click a neighbourhood on the map, or pick one from the table.</p>
        <dl className="stats">
          <dt>{label}, median buurt</dt>
          <dd>{median === null ? "no data" : format(median)}</dd>
          <dt>Buurten with data</dt>
          <dd>
            {values.length} of {Object.keys(metrics.buurten).length}
          </dd>
        </dl>
      </aside>
    );
  }

  const series = metrics.buurten[buurt.code];
  const gebied = metrics.gebieden[buurt.gebied];
  const livability = gebied && latestAtOrBefore(gebied.livability_score, yearIndex);
  const safety = gebied && latestAtOrBefore(gebied.safety_score, yearIndex);

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <h2>{buurt.name}</h2>
          <p className="muted">{gebied?.name ?? buurt.gebied}</p>
        </div>
        <button type="button" className="ghost" onClick={onClear} aria-label="Clear selection">
          ✕
        </button>
      </div>

      <dl className="stats">
        {ALL_METRICS.map((key) => {
          const value = series?.[key][yearIndex];
          return (
            <div key={key} className={key === metric ? "stat current" : "stat"}>
              <dt>{METRICS[key].label}</dt>
              <dd>{value === null || value === undefined ? "no data" : METRICS[key].format(value)}</dd>
            </div>
          );
        })}
      </dl>

      <h3>{label} over time</h3>
      {series?.[metric].every((value) => value === null) && (
        <p className="muted">This buurt has no data for this metric in any year.</p>
      )}
      {series && (
        <Trend
          years={metrics.years}
          lines={[
            { label: buurt.name, values: series[metric], kind: "primary" },
            { label: "Amsterdam median", values: cityMedianSeries(metrics, metric), kind: "reference" },
          ]}
          format={format}
          axis={axis}
          activeIndex={yearIndex}
        />
      )}

      <h3>Resident survey</h3>
      {livability || safety ? (
        <p>
          Pleasant to live in <b>{livability ? livability.value.toFixed(1) : "–"}</b> / 10 · Safety{" "}
          <b>{safety ? safety.value.toFixed(1) : "–"}</b> / 10
          <span className="muted block">
            Measured for the whole {gebied?.name} area, not this buurt
            {livability ? ` (${metrics.years[livability.index]})` : ""}.
          </span>
        </p>
      ) : (
        <p className="muted">No survey data for this area before 2015.</p>
      )}
    </aside>
  );
}
