/**
 * palettes.js – curated multi-stop colour palettes for node colouring.
 *
 * Each palette is an evenly-spaced sequence of colour stops (heatmap-style). The
 * node colourer (see applyNodeColors in main.js) samples a palette at the node's
 * normalised attribute value t∈[0,1]. All stops are vivid (saturation ≥ 50 %, no
 * greys) so the gradient reads clearly against the dark background.
 *
 * Stops are precomputed into THREE.Color arrays (`colors`) so the per-node loop
 * does no string parsing. samplePalette() lerps adjacent stops in sRGB — the same
 * Color.lerp the old 2-colour age gradient used.
 */

import { Color } from 'three';

/** label = menu name; stops = hex sequence (low t → high t). */
const RAW = {
  warm:     { label: 'warm',     stops: ['#ffe14d', '#ff8c1a', '#ff2d2d'] },
  cool:     { label: 'cool',     stops: ['#22d3ee', '#3b6bff', '#7a2dff'] },
  fire:     { label: 'fire',     stops: ['#3a0ca3', '#c81d6b', '#ff7a1a', '#ffe14d'] },
  ocean:    { label: 'ocean',    stops: ['#0a3f8c', '#1390c0', '#2fe0c0'] },
  forest:   { label: 'forest',   stops: ['#b7e84d', '#34b34a', '#0a6b4a'] },
  sunset:   { label: 'sunset',   stops: ['#ffd24d', '#ff6f3f', '#d6336c', '#7a2dff'] },
  spectral: { label: 'spectral', stops: ['#ff2d2d', '#ff9e1a', '#ffe14d', '#34b34a', '#2a6cff', '#7a2dff'] },
  magma:    { label: 'magma',    stops: ['#1b0a4a', '#7a1f6b', '#e0521f', '#ffcf66'] },
  ice:      { label: 'ice',      stops: ['#0a2d6b', '#2a8cff', '#9fe0ff'] },
  aurora:   { label: 'aurora',   stops: ['#2dffb8', '#22b6ff', '#6a4dff'] },
};

/** { key: { label, stops, colors:Color[] } } — colours precomputed once. */
export const PALETTES = Object.fromEntries(
  Object.entries(RAW).map(([key, p]) => [
    key,
    { label: p.label, stops: p.stops, colors: p.stops.map((hex) => new Color(hex)) },
  ]),
);

/**
 * Sample a palette (array of THREE.Color) at t∈[0,1] into `out`, linearly
 * interpolating between evenly-spaced adjacent stops. Returns `out`.
 */
export function samplePalette(colors, t, out) {
  const n = colors.length;
  if (n === 1) return out.copy(colors[0]);
  const s = Math.min(1, Math.max(0, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(s));
  return out.copy(colors[i]).lerp(colors[i + 1], s - i);
}
