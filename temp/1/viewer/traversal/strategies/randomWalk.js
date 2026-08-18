/**
 * randomWalk.js – "lógica 1": a single-path walker that never branches. From the
 * current node it steps to exactly one neighbour each hop, avoiding immediate
 * backtrack when it can. It either walks forever (`energy = Infinity`) or runs a
 * fixed budget that decreases by a constant per step. Many walkers can run at
 * once (each is independent). See docs/plan-recorrido-sonoro.md §B.
 *
 * The next-neighbour choice is injectable via `params.pickNext`, so other biases
 * (toward unvisited, toward a fingerprint attribute, direction continuity, …)
 * can be dropped in without touching the engine. The default picks uniformly
 * among neighbours other than the one we just came from.
 */

/**
 * @param {object} graph  loaded graph (adjOffsets, adjNeighbors, adjEdgeIds)
 * @param {object} stats  per-node fingerprint (available to pickNext)
 * @param {object} params { startNodeId, hopIntervalMs, energy, energyCost, rng, pickNext }
 * @returns {{ hopIntervalMs:number, alive:boolean, advance:()=>object|null }}
 */
export function randomWalk(graph, stats, params = {}) {
  const { adjOffsets, adjNeighbors, adjEdgeIds } = graph;
  const N = graph.numNodes;

  const rng = params.rng ?? Math.random;
  const pickNext = params.pickNext ?? defaultPickNext;

  const visited = new Uint8Array(N);
  let current = params.startNodeId ?? 0;
  let previous = -1;
  let hop = 0;
  visited[current] = 1;

  const state = {
    hopIntervalMs: params.hopIntervalMs ?? 180,
    energy: params.energy ?? Infinity,    // Infinity ⇒ walk forever
    energyCost: params.energyCost ?? 1,
    alive: true,
    advance,
  };

  function advance() {
    if (!state.alive) return null;

    const s = adjOffsets[current], e = adjOffsets[current + 1];
    if (e === s) { state.alive = false; return null; } // dead end (isolated node)

    const idx = pickNext({ graph, stats, current, previous, visited, rng, s, e });
    if (idx < 0) { state.alive = false; return null; }

    const to = adjNeighbors[idx];
    const edgeId = adjEdgeIds[idx];
    const isNewVisit = visited[to] === 0;

    const ev = { from: current, to, edgeId, hop, isNewVisit };

    previous = current;
    current = to;
    visited[to] = 1;
    hop++;

    if (Number.isFinite(state.energy)) {
      state.energy -= state.energyCost;
      if (state.energy <= 0) state.alive = false; // last event still returned
    }
    return ev;
  }

  return state;
}

/**
 * Default choice: uniform among neighbours ≠ previous (no immediate backtrack).
 * Reservoir sampling over the half-edge range [s,e) → no allocation. Falls back
 * to allowing backtrack when `previous` is the only neighbour.
 * @returns {number} half-edge index into adjNeighbors/adjEdgeIds, or -1
 */
export function defaultPickNext({ graph, current, previous, rng, s, e }) {
  const { adjNeighbors } = graph;
  let chosen = -1, count = 0;
  for (let i = s; i < e; i++) {
    if (adjNeighbors[i] === previous) continue;
    count++;
    if (rng() < 1 / count) chosen = i;
  }
  if (chosen === -1) {
    // Only neighbour was `previous` (e.g. a leaf) → backtrack is the sole move.
    const k = e - s;
    chosen = s + Math.min(k - 1, (rng() * k) | 0);
  }
  return chosen;
}
