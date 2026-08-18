/**
 * graphStats.js – per-node "fingerprint" computed once at load from the graph's
 * geometry + topology (+ exported `age`). Pure function: depends only on
 * `graph.positions`, the CSR adjacency, `graph.nodeAge` and `graph.spatial`, so
 * the exact same code could run at export time if load-time cost ever matters
 * (see docs/plan-recorrido-sonoro.md §A).
 *
 * The result is Structure-of-Arrays keyed by nodeId, plus a per-attribute range
 * and a `norm(attr, id)` helper that maps any raw value to [0,1] — the form the
 * audio sink will consume to drive frequency/duration/timbre.
 *
 * Cost: groups A–D are O(V + E + Σ k²) with k the degree; for the low-degree
 * Wolfram graphs this is a few ms even at ~65k. The only genuinely expensive
 * global metrics (eccentricity / betweenness) are deliberately omitted.
 */

/** Names of the scalar attributes that get a range + are normalisable. */
export const STAT_KEYS = [
  'degree',
  'edgeLenMin', 'edgeLenMax', 'edgeLenAvg', 'edgeLenStd', 'edgeLenSum',
  'neighborDegAvg', 'neighborDegMin', 'neighborDegMax',
  'triangles', 'clustering',
  'dirBalance',
  'nbhdLinearity', 'nbhdPlanarity', 'nbhdSphericity',
  'centroidOffset', 'distToGlobalCentroid', 'localDensity',
  'componentSize', 'geodesicFromCenter',
  'age',
];

/**
 * @param {object} graph loaded graph (numNodes, positions, nodeAge, adjOffsets,
 *   adjNeighbors, adjEdgeIds, spatial)
 * @param {object} [opts]
 * @param {number} [opts.densityRadiusFactor=2.5] localDensity radius = factor * mean edge length
 * @returns {object} stats
 */
export function computeNodeStats(graph, opts = {}) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const densityRadiusFactor = opts.densityRadiusFactor ?? 2.5;

  const N = graph.numNodes;
  const pos = graph.positions;
  const off = graph.adjOffsets;
  const nbr = graph.adjNeighbors;

  // ── Allocate raw arrays ──
  const raw = {};
  for (const k of STAT_KEYS) raw[k] = new Float32Array(N);

  // age is a direct copy (Float32 so all attrs share one normalisation path).
  for (let u = 0; u < N; u++) raw.age[u] = graph.nodeAge[u];

  // ── degree + global centroid ──
  let Cx = 0, Cy = 0, Cz = 0;
  for (let u = 0; u < N; u++) {
    raw.degree[u] = off[u + 1] - off[u];
    Cx += pos[3 * u]; Cy += pos[3 * u + 1]; Cz += pos[3 * u + 2];
  }
  if (N > 0) { Cx /= N; Cy /= N; Cz /= N; }

  // ── Group A + C (single pass over adjacency) ──
  let edgeLenTotal = 0; // for the density radius scale
  for (let u = 0; u < N; u++) {
    const ux = pos[3 * u], uy = pos[3 * u + 1], uz = pos[3 * u + 2];

    raw.distToGlobalCentroid[u] = Math.hypot(ux - Cx, uy - Cy, uz - Cz);

    const s = off[u], e = off[u + 1];
    const k = e - s;
    if (k === 0) continue; // isolated node: leave A/C stats at 0

    let lmin = Infinity, lmax = -Infinity, lsum = 0, lsumsq = 0;
    let ndSum = 0, ndMin = Infinity, ndMax = -Infinity;
    let dirx = 0, diry = 0, dirz = 0;          // sum of unit directions
    let nx = 0, ny = 0, nz = 0;                 // sum of neighbour positions
    let sxx = 0, syy = 0, szz = 0, sxy = 0, sxz = 0, syz = 0; // for covariance

    for (let i = s; i < e; i++) {
      const v = nbr[i];
      const vx = pos[3 * v], vy = pos[3 * v + 1], vz = pos[3 * v + 2];
      const dx = vx - ux, dy = vy - uy, dz = vz - uz;
      const len = Math.hypot(dx, dy, dz) || 1e-12;

      if (len < lmin) lmin = len;
      if (len > lmax) lmax = len;
      lsum += len; lsumsq += len * len;

      dirx += dx / len; diry += dy / len; dirz += dz / len;

      nx += vx; ny += vy; nz += vz;
      sxx += vx * vx; syy += vy * vy; szz += vz * vz;
      sxy += vx * vy; sxz += vx * vz; syz += vy * vz;

      const dv = off[v + 1] - off[v];
      ndSum += dv;
      if (dv < ndMin) ndMin = dv;
      if (dv > ndMax) ndMax = dv;
    }

    edgeLenTotal += lsum;

    raw.edgeLenMin[u] = lmin;
    raw.edgeLenMax[u] = lmax;
    raw.edgeLenAvg[u] = lsum / k;
    const varLen = Math.max(0, lsumsq / k - (lsum / k) * (lsum / k));
    raw.edgeLenStd[u] = Math.sqrt(varLen);
    raw.edgeLenSum[u] = lsum;

    raw.neighborDegAvg[u] = ndSum / k;
    raw.neighborDegMin[u] = ndMin;
    raw.neighborDegMax[u] = ndMax;

    raw.dirBalance[u] = Math.hypot(dirx, diry, dirz) / k; // 0 balanced … 1 one-sided

    // Neighbourhood centroid + offset from the node.
    const mx = nx / k, my = ny / k, mz = nz / k;
    raw.centroidOffset[u] = Math.hypot(ux - mx, uy - my, uz - mz);

    // Covariance (about neighbour centroid) → shape via eigenvalues.
    const cxx = sxx / k - mx * mx, cyy = syy / k - my * my, czz = szz / k - mz * mz;
    const cxy = sxy / k - mx * my, cxz = sxz / k - mx * mz, cyz = syz / k - my * mz;
    const [l1, , l3] = eig3sym(cxx, cyy, czz, cxy, cxz, cyz);
    const l2 = (cxx + cyy + czz) - l1 - l3; // trace-preserving middle eigenvalue
    if (l1 > 1e-12) {
      raw.nbhdLinearity[u] = (l1 - l2) / l1;
      raw.nbhdPlanarity[u] = (l2 - l3) / l1;
      raw.nbhdSphericity[u] = l3 / l1;
    } // else neighbours coincident → leave at 0
  }

  // ── Group B: local clustering + triangles (marker-stamp membership) ──
  const mark = new Int32Array(N); // 0 = unmarked; stamped with u+1 per node
  for (let u = 0; u < N; u++) {
    const s = off[u], e = off[u + 1];
    const k = e - s;
    if (k < 2) continue;
    const token = u + 1;
    for (let i = s; i < e; i++) mark[nbr[i]] = token;
    let links2 = 0; // counts each neighbour-neighbour edge twice
    for (let i = s; i < e; i++) {
      const v = nbr[i];
      const vs = off[v], ve = off[v + 1];
      for (let j = vs; j < ve; j++) {
        if (mark[nbr[j]] === token) links2++;
      }
    }
    const eU = links2 / 2;            // edges among u's neighbours
    raw.triangles[u] = eU;
    raw.clustering[u] = (2 * eU) / (k * (k - 1));
  }

  // ── Group C: localDensity via BVH range query ──
  const meanEdgeLen = graph.numEdges > 0 ? edgeLenTotal / (2 * graph.numEdges) : 1;
  const densityRadius = densityRadiusFactor * meanEdgeLen;
  if (graph.spatial?.queryRadius) {
    for (let u = 0; u < N; u++) {
      const c = graph.spatial.queryRadius(pos[3 * u], pos[3 * u + 1], pos[3 * u + 2], densityRadius);
      raw.localDensity[u] = Math.max(0, c - 1); // exclude self
    }
  }

  // ── Group D: connected components (union-find over adjacency) ──
  const parent = new Int32Array(N);
  for (let u = 0; u < N; u++) parent[u] = u;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let u = 0; u < N; u++) {
    for (let i = off[u], e = off[u + 1]; i < e; i++) {
      const v = nbr[i];
      if (v > u) { const ru = find(u), rv = find(v); if (ru !== rv) parent[ru] = rv; }
    }
  }
  const compSize = new Int32Array(N);
  const componentId = new Int32Array(N);
  for (let u = 0; u < N; u++) { const r = find(u); componentId[u] = r; compSize[r]++; }
  for (let u = 0; u < N; u++) raw.componentSize[u] = compSize[componentId[u]];

  // ── Group D: geodesic (hops) from the node nearest the global centroid ──
  let center = 0, bestD = Infinity;
  for (let u = 0; u < N; u++) {
    if (raw.distToGlobalCentroid[u] < bestD) { bestD = raw.distToGlobalCentroid[u]; center = u; }
  }
  bfsHops(center, off, nbr, N, raw.geodesicFromCenter);

  // ── Ranges + normaliser ──
  const range = {};
  for (const key of STAT_KEYS) {
    let mn = Infinity, mx = -Infinity;
    const a = raw[key];
    for (let u = 0; u < N; u++) {
      const v = a[u];
      if (!Number.isFinite(v) || v < 0) continue; // skip sentinels (e.g. unreached geodesic)
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === Infinity) { mn = 0; mx = 0; }
    range[key] = { min: mn, max: mx };
  }

  function norm(attr, id) {
    const r = range[attr];
    if (!r) return 0;
    const v = raw[attr][id];
    if (!Number.isFinite(v) || v < 0) return 0;
    const span = r.max - r.min;
    return span > 0 ? Math.min(1, Math.max(0, (v - r.min) / span)) : 0;
  }

  /** Snapshot of one node's fingerprint (raw + normalised) — for the debug panel. */
  function describe(id) {
    const out = {};
    for (const key of STAT_KEYS) out[key] = { raw: raw[key][id], norm: norm(key, id) };
    return out;
  }

  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return {
    raw, range, componentId, norm, describe,
    keys: STAT_KEYS,
    scale: { meanEdgeLen, densityRadius },
    computeMs: ms,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Unweighted BFS hop distances from `src`; unreached nodes get -1. */
function bfsHops(src, off, nbr, N, out) {
  out.fill(-1);
  if (N === 0) return;
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  out[src] = 0;
  queue[tail++] = src;
  while (head < tail) {
    const u = queue[head++];
    const du = out[u];
    for (let i = off[u], e = off[u + 1]; i < e; i++) {
      const v = nbr[i];
      if (out[v] < 0) { out[v] = du + 1; queue[tail++] = v; }
    }
  }
}

/**
 * Eigenvalues of a symmetric 3×3 matrix [[a11,a12,a13],[a12,a22,a23],[a13,a23,a33]],
 * returned descending [λ1, λ2, λ3]. Closed-form trig method (Smith 1961).
 */
function eig3sym(a11, a22, a33, a12, a13, a23) {
  const p1 = a12 * a12 + a13 * a13 + a23 * a23;
  if (p1 === 0) {
    // already diagonal
    const v = [a11, a22, a33].sort((x, y) => y - x);
    return v;
  }
  const q = (a11 + a22 + a33) / 3;
  const p2 = (a11 - q) ** 2 + (a22 - q) ** 2 + (a33 - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  // B = (1/p) (A - qI)
  const b11 = (a11 - q) / p, b22 = (a22 - q) / p, b33 = (a33 - q) / p;
  const b12 = a12 / p, b13 = a13 / p, b23 = a23 / p;
  // detB
  const detB =
    b11 * (b22 * b33 - b23 * b23) -
    b12 * (b12 * b33 - b23 * b13) +
    b13 * (b12 * b23 - b22 * b13);
  let r = detB / 2;
  r = Math.min(1, Math.max(-1, r));
  const phi = Math.acos(r) / 3;
  const eig1 = q + 2 * p * Math.cos(phi);
  const eig3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  const eig2 = 3 * q - eig1 - eig3;
  return [eig1, eig2, eig3];
}
