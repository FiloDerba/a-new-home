"use client";

import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, type BuurtCollection } from "../lib/data.ts";
import { boundsOf } from "../lib/geo.ts";
import type { Theme } from "../lib/scale.ts";

const SOURCE = "buurten";
const BASEMAP: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const INK: Record<Theme, string> = { light: "#0b0b0b", dark: "#f0efec" };
const BOUNDARY: Record<Theme, string> = {
  light: "rgba(252,252,251,0.8)",
  dark: "rgba(26,26,25,0.6)",
};

// Basemap labels are drawn over our coloured polygons, so they need strong contrast and a sharp halo.
const LABEL: Record<Theme, { text: string; halo: string }> = {
  light: { text: "#0b0b0b", halo: "rgba(252,252,251,0.95)" },
  dark: { text: "#f0efec", halo: "rgba(14,14,13,0.95)" },
};

export interface HoverInfo {
  code: string;
  x: number;
  y: number;
}

interface Props {
  geo: BuurtCollection;
  values: Record<string, number | null>;
  fill: ExpressionSpecification;
  theme: Theme;
  selected: string | null;
  onSelect: (code: string | null) => void;
  onHover: (hover: HoverInfo | null) => void;
}

/** Style loads wipe sources and layers, so this runs on every `style.load`. */
function addLayers(map: MapLibreMap, geo: BuurtCollection, theme: Theme) {
  map.addSource(SOURCE, { type: "geojson", data: geo, promoteId: "code" });
  // Insert below the basemap's labels so street and canal names stay readable.
  const firstLabel = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
  const flag = (key: string): ExpressionSpecification => ["boolean", ["feature-state", key], false];
  map.addLayer(
    {
      id: "buurten-fill",
      type: "fill",
      source: SOURCE,
      paint: { "fill-color": "#c9c8c3", "fill-opacity": 0.88 },
    },
    firstLabel,
  );
  map.addLayer(
    {
      id: "buurten-line",
      type: "line",
      source: SOURCE,
      paint: {
        "line-color": ["case", flag("selected"), INK[theme], flag("hover"), INK[theme], BOUNDARY[theme]],
        "line-width": ["case", flag("selected"), 2.5, flag("hover"), 1.5, 0.6],
      },
    },
    firstLabel,
  );
  for (const layer of map.getStyle().layers) {
    if (layer.type === "symbol" && layer.layout?.["text-field"]) {
      map.setPaintProperty(layer.id, "text-color", LABEL[theme].text);
      map.setPaintProperty(layer.id, "text-halo-color", LABEL[theme].halo);
      map.setPaintProperty(layer.id, "text-halo-width", 2);
      map.setPaintProperty(layer.id, "text-halo-blur", 0);
    }
  }
}

export default function MapView({ geo, values, fill, theme, selected, onSelect, onHover }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const themeRef = useRef(theme);
  const handlers = useRef({ onSelect, onHover });
  // Bumped on every style load: sources and feature state must be re-applied after it.
  const [styleVersion, setStyleVersion] = useState(0);

  useEffect(() => {
    themeRef.current = theme;
    handlers.current = { onSelect, onHover };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    void (async () => {
      // Imported lazily: MapLibre needs `window`, which the static prerender does not have.
      const { Map, setWorkerUrl } = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      setWorkerUrl(`${BASE_PATH}/maplibre-gl-worker.js`); // copied to public/ by scripts/copy-worker.mjs
      const bounds = boundsOf(geo.features.map((feature) => feature.geometry.coordinates));
      const instance = new Map({
        container: container.current,
        style: BASEMAP[themeRef.current],
        bounds,
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
      });
      map = instance;
      mapRef.current = instance;

      let hovered: string | null = null;
      const clearHover = () => {
        if (hovered) instance.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
        hovered = null;
        instance.getCanvas().style.cursor = "";
        handlers.current.onHover(null);
      };

      instance.on("style.load", () => {
        hovered = null;
        addLayers(instance, geo, themeRef.current);
        setStyleVersion((version) => version + 1);
      });
      instance.on("mousemove", "buurten-fill", (event) => {
        const code = event.features?.[0]?.properties?.code as string | undefined;
        if (!code) return;
        if (hovered !== code) {
          if (hovered) instance.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
          hovered = code;
          instance.setFeatureState({ source: SOURCE, id: code }, { hover: true });
        }
        instance.getCanvas().style.cursor = "pointer";
        handlers.current.onHover({ code, x: event.point.x, y: event.point.y });
      });
      instance.on("mouseleave", "buurten-fill", clearHover);
      instance.on("click", (event) => {
        const hit = instance.queryRenderedFeatures(event.point, { layers: ["buurten-fill"] });
        handlers.current.onSelect((hit[0]?.properties?.code as string | undefined) ?? null);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [geo]);

  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    mapRef.current?.setStyle(BASEMAP[theme]);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0 || !map.getSource(SOURCE)) return;
    map.setPaintProperty("buurten-fill", "fill-color", fill);
    for (const [code, value] of Object.entries(values)) {
      map.setFeatureState({ source: SOURCE, id: code }, { value, selected: code === selected });
    }
  }, [styleVersion, values, fill, selected]);

  return <div ref={container} className="map" role="application" aria-label="Map of Amsterdam buurten" />;
}
