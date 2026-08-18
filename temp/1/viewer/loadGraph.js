/**
 * loadGraph.js – load a hypergraph .glb (exported by src/gpu/exportGLB.js) and
 * rebuild the CPU-side `graph` structure the viewer needs.
 *
 * The .glb carries:
 *   • two InstancedMesh ('nodes' spheres, 'edges' cylinders) — the renderables.
 *   • scene.userData.hypergraph — small metadata (round-trips via glTF `extras`).
 *   • five hidden "carrier" meshes (graphData_*) whose single custom attribute
 *     holds a large topology/attribute array as a real binary accessor.
 *
 * The exporter writes custom attributes uppercase+`_`-prefixed; GLTFLoader reads
 * them back lowercased (e.g. carrier attribute 'nodePositions' → glTF
 * '_NODEPOSITIONS' → three '_nodepositions'). We read by those lowercase keys.
 *
 * Everything is indexed by `nodeId` = the instance index inside the 'nodes'
 * InstancedMesh, which is the single id tying picking, propagation and audio.
 */

import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildSpatialIndex } from './spatialIndex.js';
import { computeNodeStats } from './graphStats.js';

/** Find an object in the scene graph by exact name. */
function findByName(root, name) {
  let found = null;
  root.traverse((o) => { if (!found && o.name === name) found = o; });
  return found;
}

/** Read a carrier mesh's single custom attribute array by lowercase key. */
function readCarrier(scene, carrierName, attrKey) {
  const mesh = findByName(scene, carrierName);
  if (!mesh || !mesh.geometry) {
    throw new Error(`loadGraph: missing carrier mesh '${carrierName}'`);
  }
  const attr = mesh.geometry.getAttribute(attrKey);
  if (!attr) {
    const have = Object.keys(mesh.geometry.attributes).join(', ');
    throw new Error(
      `loadGraph: carrier '${carrierName}' has no attribute '${attrKey}' (has: ${have})`,
    );
  }
  return attr;
}

/** Like readCarrier but returns null instead of throwing when absent (optional). */
function readCarrierOptional(scene, carrierName, attrKey) {
  const mesh = findByName(scene, carrierName);
  return mesh?.geometry?.getAttribute(attrKey) ?? null;
}

/**
 * Load and parse a hypergraph GLB.
 *
 * @param {string} url  e.g. '/models/model09.glb'
 * @returns {Promise<{ gltf: object, nodes: import('three').InstancedMesh,
 *   edges: import('three').InstancedMesh, graph: object }>}
 */
export async function loadGraph(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;

  const meta = scene.userData?.hypergraph;
  if (!meta || meta.version !== 1) {
    throw new Error('loadGraph: scene.userData.hypergraph missing or wrong version');
  }
  const { numNodes, numEdges, nodeRadius } = meta;

  const nodes = findByName(scene, 'nodes');
  const edges = findByName(scene, 'edges');
  if (!nodes) throw new Error("loadGraph: missing 'nodes' InstancedMesh");

  // ── Topology arrays from the carrier meshes ──
  // Uint32 accessors round-trip as UNSIGNED_INT → typed array is Uint32Array;
  // copy out so the GeometryBufferAttribute backing store can be GC'd.
  const positions = new Float32Array(
    readCarrier(scene, 'graphData_nodePositions', '_nodepositions').array,
  );
  // nodeAge is optional: models exported before the age carrier existed still
  // load (age defaults to 0 everywhere — that attribute of the fingerprint is
  // simply flat). New exports carry the real creation step per node.
  const ageAttr = readCarrierOptional(scene, 'graphData_nodeAge', '_nodeage');
  const nodeAge = ageAttr ? new Uint32Array(ageAttr.array) : new Uint32Array(numNodes);
  if (!ageAttr) console.warn('[loadGraph] no nodeAge carrier (old model) — age defaults to 0');
  const adjOffsets = new Uint32Array(
    readCarrier(scene, 'graphData_adjOffsets', '_adjoffsets').array,
  );
  const adjNeighbors = new Uint32Array(
    readCarrier(scene, 'graphData_adjNeighbors', '_adjneighbors').array,
  );
  const adjEdgeIds = new Uint32Array(
    readCarrier(scene, 'graphData_adjEdgeIds', '_adjedgeids').array,
  );

  // ── Round-trip sanity checks (cheap, catch export/loader breakage early) ──
  if (positions.length !== 3 * numNodes)
    throw new Error(`loadGraph: positions.length ${positions.length} ≠ 3*${numNodes}`);
  if (nodeAge.length !== numNodes)
    throw new Error(`loadGraph: nodeAge.length ${nodeAge.length} ≠ ${numNodes}`);
  if (adjOffsets.length !== numNodes + 1)
    throw new Error(`loadGraph: adjOffsets.length ${adjOffsets.length} ≠ ${numNodes + 1}`);
  if (adjNeighbors.length !== 2 * numEdges)
    throw new Error(`loadGraph: adjNeighbors.length ${adjNeighbors.length} ≠ 2*${numEdges}`);
  if (adjEdgeIds.length !== adjNeighbors.length)
    throw new Error('loadGraph: adjEdgeIds/adjNeighbors length mismatch');
  if (adjOffsets[numNodes] !== adjNeighbors.length)
    throw new Error('loadGraph: CSR offsets do not close on neighbours length');

  // Carriers were exported with onlyVisible:false; they have no `position`
  // attribute and must never reach the renderer. Drop them now that their data
  // is copied out.
  for (const cn of ['graphData_nodePositions', 'graphData_nodeAge', 'graphData_adjOffsets',
                    'graphData_adjNeighbors', 'graphData_adjEdgeIds']) {
    findByName(scene, cn)?.removeFromParent();
  }

  const graph = {
    numNodes,
    numEdges,
    positions,    // Float32Array(3*numNodes)
    nodeAge,      // Uint32Array(numNodes) — creation step per node (fingerprint input)
    adjOffsets,   // Uint32Array(numNodes+1)
    adjNeighbors, // Uint32Array(2*numEdges)
    adjEdgeIds,   // Uint32Array(2*numEdges)
    radii: nodeRadius, // uniform radius (number)
    spatial: null,     // filled below
  };

  // Single source of truth: BVH built from the same positions used everywhere.
  graph.spatial = buildSpatialIndex(graph);

  // Per-node fingerprint (degree, edge-length stats, neighbourhood shape, age, …).
  // Computed once at load; the spatial index above backs the density query.
  graph.stats = computeNodeStats(graph);

  return { gltf, scene, nodes, edges, graph };
}

/** O(1) world position of a node id, written into `out`. */
export function nodePosition(graph, nodeId, out = new Vector3()) {
  const b = 3 * nodeId;
  return out.set(graph.positions[b], graph.positions[b + 1], graph.positions[b + 2]);
}
