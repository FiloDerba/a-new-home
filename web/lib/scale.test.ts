import assert from "node:assert/strict";
import { test } from "node:test";
import type { Metrics } from "./data.ts";
import { boundsOf } from "./geo.ts";
import {
  classBreaks,
  cityMedianSeries,
  isDiverging,
  latestAtOrBefore,
  median,
  pickYear,
  quantile,
  QUANTILES,
  rampFor,
  RATIO_BREAKS,
  yearIndexesWithData,
} from "./scale.ts";

const metrics: Metrics = {
  years: [2010, 2011, 2012],
  buurten: {
    A: { avg_woz_eur: [null, 100, 300], green_pct: [null, null, 5], population: [1, 2, 3] },
    B: { avg_woz_eur: [null, 200, null], green_pct: [null, null, 7], population: [1, 2, 3] },
  },
  gebieden: {},
};

test("quantile interpolates between values", () => {
  assert.equal(quantile([0, 10], 0.5), 5);
  assert.equal(quantile([1, 2, 3], 0), 1);
  assert.equal(quantile([1, 2, 3], 1), 3);
});

test("median handles empty and even-length input", () => {
  assert.equal(median([]), null);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("classBreaks are strictly increasing even when values tie", () => {
  const breaks = classBreaks([5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(breaks.length, 7);
  assert.ok(breaks.every((value, i) => i === 0 || value > breaks[i - 1]));
  assert.deepEqual(classBreaks([]), []);
});

test("yearIndexesWithData skips years where every buurt is null", () => {
  assert.deepEqual(yearIndexesWithData(metrics, "avg_woz_eur"), [1, 2]);
  assert.deepEqual(yearIndexesWithData(metrics, "green_pct"), [2]);
  assert.deepEqual(yearIndexesWithData(metrics, "population"), [0, 1, 2]);
});

test("pickYear defaults to the latest and otherwise snaps to the closest allowed year", () => {
  assert.equal(pickYear([1, 2], metrics.years, null), 2);
  assert.equal(pickYear([1, 2], metrics.years, 2005), 1);
  assert.equal(pickYear([2], metrics.years, 2010), 2);
});

test("cityMedianSeries is null where no buurt has data", () => {
  assert.deepEqual(cityMedianSeries(metrics, "avg_woz_eur"), [null, 150, 300]);
});

test("latestAtOrBefore walks back to the last known value", () => {
  assert.deepEqual(latestAtOrBefore([1, null, null], 2), { value: 1, index: 0 });
  assert.equal(latestAtOrBefore([null, null], 1), null);
});

test("every metric has one colour per break, in both themes", () => {
  for (const metric of ["avg_woz_eur", "green_pct", "population"] as const) {
    for (const theme of ["light", "dark"] as const) {
      assert.equal(rampFor(metric, theme).length, QUANTILES.length);
    }
  }
  assert.equal(RATIO_BREAKS.length, QUANTILES.length);
  assert.ok(RATIO_BREAKS.every((value, i) => i === 0 || value > RATIO_BREAKS[i - 1]));
});

test("only the price metric is diverging, with the midpoint at the median", () => {
  assert.ok(isDiverging("avg_woz_eur"));
  assert.ok(!isDiverging("green_pct"));
  assert.equal(RATIO_BREAKS[3], 1);
  assert.equal(rampFor("avg_woz_eur", "light")[3], "#f0efec");
  assert.equal(rampFor("avg_woz_eur", "dark")[3], "#383835");
});

/** Relative luminance of a #rrggbb colour (WCAG), 0 = black, 1 = white. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("green space runs from near-white to dark green in both themes", () => {
  for (const theme of ["light", "dark"] as const) {
    const ramp = rampFor("green_pct", theme);
    const lightness = ramp.map(luminance);
    assert.ok(lightness.every((value, i) => i === 0 || value < lightness[i - 1]), theme);
    assert.ok(lightness[0] > 0.9, `${theme}: low end is near white`);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt((ramp.at(-1) as string).slice(i, i + 2), 16));
    assert.ok(g > r + 50 && g > b + 50, `${theme}: high end is green`);
  }
});

test("population gets darker on light and brighter on dark, so high is always the extreme", () => {
  const light = rampFor("population", "light").map(luminance);
  const dark = rampFor("population", "dark").map(luminance);
  assert.ok(light.every((value, i) => i === 0 || value < light[i - 1]));
  assert.ok(dark.every((value, i) => i === 0 || value > dark[i - 1]));
});

test("boundsOf covers nested coordinates", () => {
  const polygon = [
    [
      [4.8, 52.3],
      [5.0, 52.4],
    ],
  ];
  assert.deepEqual(boundsOf(polygon), [
    [4.8, 52.3],
    [5.0, 52.4],
  ]);
});
