import assert from "node:assert/strict";
import { test } from "node:test";
import type { Metrics } from "./data.ts";
import { boundsOf } from "./geo.ts";
import {
  classBreaks,
  cityMedianSeries,
  latestAtOrBefore,
  median,
  pickYear,
  quantile,
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
