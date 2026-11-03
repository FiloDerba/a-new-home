import type { Position } from "geojson";

export type Bounds = [[number, number], [number, number]];

/** [[west, south], [east, north]] of any GeoJSON coordinates array. */
export function boundsOf(coordinates: unknown): Bounds {
  const bounds: Bounds = [
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ];
  const visit = (node: unknown): void => {
    if (typeof (node as Position)[0] === "number") {
      const [lng, lat] = node as Position;
      bounds[0] = [Math.min(bounds[0][0], lng), Math.min(bounds[0][1], lat)];
      bounds[1] = [Math.max(bounds[1][0], lng), Math.max(bounds[1][1], lat)];
    } else {
      for (const child of node as unknown[]) visit(child);
    }
  };
  visit(coordinates);
  return bounds;
}
