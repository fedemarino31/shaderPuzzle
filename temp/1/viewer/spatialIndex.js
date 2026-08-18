/**
 * spatialIndex.js – a small BVH of axis-aligned bounding boxes, one AABB per
 * graph node (sphere center ± radius). Built once from graph.positions (the
 * single source of truth shared with picking and audio), never rebuilt because
 * node positions are static after load.
 *
 * Query primitives:
 *   • queryRay(origin, dir)  → nearest node hit by a ray (mouse / VR controller)
 *   • queryPoint(p)          → nearest node whose sphere contains p (VR hand)
 *   • queryRadius(p, R)      → count of node centers within R of p (graphStats density)
 *
 * Median split on the largest extent axis. The tree is stored in flat typed
 * arrays (no per-node objects) so 65k–1M nodes stay cheap to build and traverse.
 *
 * Internal layout per BVH node (index k):
 *   bbMin[3k..3k+2], bbMax[3k..3k+2]   AABB of the subtree
 *   left[k]   : index of left child, or -1 if leaf
 *   right[k]  : index of right child, or  the leaf's primitive range:
 *   start[k], count[k]                  range into `order` (leaves only)
 * `order` is a permutation of nodeIds; a leaf covers order[start..start+count).
 */

const LEAF_SIZE = 8; // max node ids per leaf

/**
 * @param {{ numNodes:number, positions:Float32Array, radii:number|Float32Array }} graph
 * @returns {object} spatial index with queryRay / queryPoint
 */
export function buildSpatialIndex(graph) {
  const N = graph.numNodes;
  const pos = graph.positions;
  const radiusOf = typeof graph.radii === 'number'
    ? () => graph.radii
    : (i) => graph.radii[i];

  // Per-primitive AABB + centroid, precomputed once.
  const order = new Uint32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  const cx = new Float32Array(N), cy = new Float32Array(N), cz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    cx[i] = pos[3 * i]; cy[i] = pos[3 * i + 1]; cz[i] = pos[3 * i + 2];
  }

  // BVH node arrays. Upper bound on node count for a binary tree over N leaves
  // with LEAF_SIZE primitives each is < 2*ceil(N/LEAF_SIZE); 4*N+8 is ample.
  const cap = Math.max(1, 4 * Math.ceil(N / LEAF_SIZE) + 8);
  const bbMin = new Float32Array(3 * cap);
  const bbMax = new Float32Array(3 * cap);
  const left  = new Int32Array(cap).fill(-1);
  const start = new Int32Array(cap).fill(-1);
  const count = new Int32Array(cap).fill(0);
  let nodeCount = 0;

  // Iterative build with an explicit stack to avoid deep recursion on big graphs.
  // Each work item: [bvhIndex, rangeStart, rangeEnd).
  const allocNode = () => nodeCount++;
  const root = allocNode();
  const stack = [[root, 0, N]];

  const tmp = new Float32Array(3); // scratch

  while (stack.length) {
    const [k, lo, hi] = stack.pop();
    const n = hi - lo;

    // Compute the AABB of primitives [lo,hi) (center ± radius).
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = lo; i < hi; i++) {
      const id = order[i];
      const r = radiusOf(id);
      if (cx[id] - r < minX) minX = cx[id] - r;
      if (cy[id] - r < minY) minY = cy[id] - r;
      if (cz[id] - r < minZ) minZ = cz[id] - r;
      if (cx[id] + r > maxX) maxX = cx[id] + r;
      if (cy[id] + r > maxY) maxY = cy[id] + r;
      if (cz[id] + r > maxZ) maxZ = cz[id] + r;
    }
    bbMin[3 * k] = minX; bbMin[3 * k + 1] = minY; bbMin[3 * k + 2] = minZ;
    bbMax[3 * k] = maxX; bbMax[3 * k + 1] = maxY; bbMax[3 * k + 2] = maxZ;

    if (n <= LEAF_SIZE) {
      left[k] = -1;
      start[k] = lo;
      count[k] = n;
      continue;
    }

    // Split axis = largest centroid extent.
    let cminX = Infinity, cminY = Infinity, cminZ = Infinity;
    let cmaxX = -Infinity, cmaxY = -Infinity, cmaxZ = -Infinity;
    for (let i = lo; i < hi; i++) {
      const id = order[i];
      if (cx[id] < cminX) cminX = cx[id]; if (cx[id] > cmaxX) cmaxX = cx[id];
      if (cy[id] < cminY) cminY = cy[id]; if (cy[id] > cmaxY) cmaxY = cy[id];
      if (cz[id] < cminZ) cminZ = cz[id]; if (cz[id] > cmaxZ) cmaxZ = cz[id];
    }
    const ex = cmaxX - cminX, ey = cmaxY - cminY, ez = cmaxZ - cminZ;
    const axis = ex >= ey && ex >= ez ? cx : (ey >= ez ? cy : cz);

    // Median split via in-place nth-element partition on `order[lo,hi)`.
    const mid = (lo + hi) >> 1;
    nthElement(order, lo, hi, mid, axis);

    // Degenerate guard: all centroids identical on the chosen axis → make a leaf
    // (avoids infinite splits when many nodes coincide).
    if (axis[order[lo]] === axis[order[hi - 1]]) {
      left[k] = -1;
      start[k] = lo;
      count[k] = n;
      continue;
    }

    const l = allocNode();
    const r = allocNode();
    left[k] = l;
    start[k] = r; // for internal nodes, `start` stores the right child index
    stack.push([l, lo, mid]);
    stack.push([r, mid, hi]);
  }

  // ── Queries ──────────────────────────────────────────────────────────────
  const isLeaf = (k) => left[k] === -1;
  const rightChild = (k) => start[k];

  /**
   * Nearest node whose sphere is hit by ray(origin, dir). dir need not be unit.
   * @returns {number} nodeId or -1
   */
  function queryRay(ox, oy, oz, dx, dy, dz) {
    // Normalise dir for consistent t units.
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    const invx = 1 / dx, invy = 1 / dy, invz = 1 / dz;

    let bestT = Infinity, bestId = -1;
    const st = [0];
    while (st.length) {
      const k = st.pop();
      if (!rayHitsAABB(k, ox, oy, oz, invx, invy, invz, bestT)) continue;
      if (isLeaf(k)) {
        const s = start[k], c = count[k];
        for (let i = s; i < s + c; i++) {
          const id = order[i];
          const t = raySphereT(ox, oy, oz, dx, dy, dz, cx[id], cy[id], cz[id], radiusOf(id));
          if (t >= 0 && t < bestT) { bestT = t; bestId = id; }
        }
      } else {
        st.push(left[k]);
        st.push(rightChild(k));
      }
    }
    return bestId;
  }

  function rayHitsAABB(k, ox, oy, oz, invx, invy, invz, maxT) {
    let t1 = (bbMin[3 * k] - ox) * invx, t2 = (bbMax[3 * k] - ox) * invx;
    let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
    t1 = (bbMin[3 * k + 1] - oy) * invy; t2 = (bbMax[3 * k + 1] - oy) * invy;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (bbMin[3 * k + 2] - oz) * invz; t2 = (bbMax[3 * k + 2] - oz) * invz;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    return tmax >= Math.max(tmin, 0) && tmin < maxT;
  }

  /**
   * Nearest node whose sphere contains point p (distance ≤ radius), else nearest
   * sphere surface within search; returns the node with smallest center distance
   * among those that actually contain p.
   * @returns {number} nodeId or -1
   */
  function queryPoint(px, py, pz) {
    let bestD2 = Infinity, bestId = -1;
    const st = [0];
    while (st.length) {
      const k = st.pop();
      if (!pointNearAABB(k, px, py, pz, bestD2)) continue;
      if (isLeaf(k)) {
        const s = start[k], c = count[k];
        for (let i = s; i < s + c; i++) {
          const id = order[i];
          const ddx = px - cx[id], ddy = py - cy[id], ddz = pz - cz[id];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          const r = radiusOf(id);
          if (d2 <= r * r && d2 < bestD2) { bestD2 = d2; bestId = id; }
        }
      } else {
        st.push(left[k]);
        st.push(rightChild(k));
      }
    }
    return bestId;
  }

  /**
   * Count node centers within radius R of point p (a density query). Used by
   * graphStats.localDensity. Includes any node whose center coincides with p, so
   * callers querying a node's own position should subtract 1 for self.
   * @returns {number} count of centers with ‖center − p‖ ≤ R
   */
  function queryRadius(px, py, pz, R) {
    const R2 = R * R;
    let n = 0;
    const st = [0];
    while (st.length) {
      const k = st.pop();
      if (!pointNearAABB(k, px, py, pz, R2)) continue;
      if (isLeaf(k)) {
        const s = start[k], c = count[k];
        for (let i = s; i < s + c; i++) {
          const id = order[i];
          const ddx = px - cx[id], ddy = py - cy[id], ddz = pz - cz[id];
          if (ddx * ddx + ddy * ddy + ddz * ddz <= R2) n++;
        }
      } else {
        st.push(left[k]);
        st.push(rightChild(k));
      }
    }
    return n;
  }

  /**
   * Nearest node *center* within radius R of point p (a tolerance query). Unlike
   * queryPoint, the point need not lie inside the node's sphere — any center
   * within R qualifies, and the closest one wins. Used by the VR controller's
   * proximity pick (trigger fires the node nearest to the controller tip).
   * @returns {number} nodeId or -1
   */
  function queryNearestWithinRadius(px, py, pz, R) {
    const R2 = R * R;
    let bestD2 = R2, bestId = -1;
    const st = [0];
    while (st.length) {
      const k = st.pop();
      // Prune against the current best distance (starts at R2, shrinks on hits).
      if (!pointNearAABB(k, px, py, pz, bestD2)) continue;
      if (isLeaf(k)) {
        const s = start[k], c = count[k];
        for (let i = s; i < s + c; i++) {
          const id = order[i];
          const ddx = px - cx[id], ddy = py - cy[id], ddz = pz - cz[id];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 <= bestD2) { bestD2 = d2; bestId = id; }
        }
      } else {
        st.push(left[k]);
        st.push(rightChild(k));
      }
    }
    return bestId;
  }

  /** True if AABB k could contain a sphere center within sqrt(bestD2) of p. */
  function pointNearAABB(k, px, py, pz, bestD2) {
    // Squared distance from p to the AABB; if it already exceeds the best center
    // distance, no contained sphere here can win.
    let d2 = 0;
    const clampDist = (v, lo, hi) => (v < lo ? lo - v : (v > hi ? v - hi : 0));
    let e = clampDist(px, bbMin[3 * k],     bbMax[3 * k]);     d2 += e * e;
    e     = clampDist(py, bbMin[3 * k + 1], bbMax[3 * k + 1]); d2 += e * e;
    e     = clampDist(pz, bbMin[3 * k + 2], bbMax[3 * k + 2]); d2 += e * e;
    return d2 < bestD2;
  }

  return {
    numNodes: N,
    nodeCount,
    queryRay,
    queryPoint,
    queryRadius,
    queryNearestWithinRadius,
    // expose for debugging/tests
    _order: order,
  };
}

// Analytic ray-vs-sphere: smallest non-negative t of intersection, else -1.
function raySphereT(ox, oy, oz, dx, dy, dz, sx, sy, sz, r) {
  const lx = ox - sx, ly = oy - sy, lz = oz - sz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  if (c > 0 && b > 0) return -1;          // origin outside, sphere behind
  const disc = b * b - c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  const t0 = -b - sq;
  if (t0 >= 0) return t0;
  const t1 = -b + sq;
  return t1 >= 0 ? t1 : -1;               // inside the sphere
}

/**
 * In-place Hoare-style nth_element: partition order[lo,hi) around the value at
 * rank `nth` using key(id)=axisArr[id]. After return, order[nth] holds the
 * element that would be there if the range were fully sorted by the axis, and
 * everything left of nth is ≤ it. O(n) average.
 */
function nthElement(order, lo, hi, nth, axisArr) {
  let l = lo, r = hi - 1;
  while (l < r) {
    const pivot = axisArr[order[(l + r) >> 1]];
    let i = l, j = r;
    while (i <= j) {
      while (axisArr[order[i]] < pivot) i++;
      while (axisArr[order[j]] > pivot) j--;
      if (i <= j) {
        const t = order[i]; order[i] = order[j]; order[j] = t;
        i++; j--;
      }
    }
    if (nth <= j) r = j;
    else if (nth >= i) l = i;
    else break;
  }
}
