"use client";

import { useState, type PointerEvent } from "react";
import type { Series } from "../lib/data.ts";

export interface TrendLine {
  label: string;
  values: Series;
  kind: "primary" | "reference";
}

interface Props {
  years: number[];
  lines: TrendLine[];
  format: (value: number) => string;
  axis: (value: number) => string;
  activeIndex: number;
}

const W = 360;
const H = 170;
const MARGIN = { left: 46, right: 10, top: 8, bottom: 22 };

/** Split a series into runs of consecutive values, so gaps in the data show as gaps. */
function segments(values: Series, from: number, to: number, x: (i: number) => number, y: (v: number) => number) {
  let path = "";
  let open = false;
  for (let i = from; i <= to; i++) {
    const value = values[i];
    if (value === null) {
      open = false;
      continue;
    }
    path += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`;
    open = true;
  }
  return path;
}

export default function Trend({ years, lines, format, axis, activeIndex }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const known = years.flatMap((_, i) => (lines.some((line) => line.values[i] !== null) ? [i] : []));
  if (known.length < 2) return <p className="muted">Not enough history to chart.</p>;
  const first = known[0];
  const last = known[known.length - 1];

  const all = lines.flatMap((line) => line.values.slice(first, last + 1)).filter((v): v is number => v !== null);
  const pad = (Math.max(...all) - Math.min(...all) || 1) * 0.08;
  const lo = Math.min(...all) - pad;
  const hi = Math.max(...all) + pad;
  const x = (i: number) => MARGIN.left + ((i - first) / (last - first)) * (W - MARGIN.left - MARGIN.right);
  const y = (v: number) => MARGIN.top + (1 - (v - lo) / (hi - lo)) * (H - MARGIN.top - MARGIN.bottom);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];

  const readoutIndex = Math.min(Math.max(hover ?? activeIndex, first), last);
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const fraction = (px - MARGIN.left) / (W - MARGIN.left - MARGIN.right);
    setHover(Math.min(last, Math.max(first, Math.round(first + fraction * (last - first)))));
  };

  return (
    <figure className="trend">
      <figcaption className="trend-readout" aria-live="polite">
        <strong>{years[readoutIndex]}</strong>
        {lines.map((line) => (
          <span key={line.label} className="key">
            <i className={`swatch ${line.kind}`} aria-hidden="true" />
            {line.label}{" "}
            <b>{line.values[readoutIndex] === null ? "no data" : format(line.values[readoutIndex] as number)}</b>
          </span>
        ))}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Trend ${years[first]} to ${years[last]}: ${lines.map((l) => l.label).join(" and ")}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={W - MARGIN.right} y1={y(tick)} y2={y(tick)} className="grid" />
            <text x={MARGIN.left - 6} y={y(tick) + 3} textAnchor="end" className="tick">
              {axis(tick)}
            </text>
          </g>
        ))}
        {[first, last].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === first ? "start" : "end"} className="tick">
            {years[i]}
          </text>
        ))}
        {activeIndex >= first && activeIndex <= last && (
          <line x1={x(activeIndex)} x2={x(activeIndex)} y1={MARGIN.top} y2={H - MARGIN.bottom} className="active-year" />
        )}
        {[...lines].reverse().map((line) => (
          <path key={line.label} d={segments(line.values, first, last, x, y)} className={`line ${line.kind}`} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={H - MARGIN.bottom} className="crosshair" />
            {lines.map((line) => {
              const value = line.values[hover];
              return value === null ? null : (
                <circle key={line.label} cx={x(hover)} cy={y(value)} r={4} className={`dot ${line.kind}`} />
              );
            })}
          </g>
        )}
      </svg>
    </figure>
  );
}
