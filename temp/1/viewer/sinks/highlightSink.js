/**
 * highlightSink.js – visual consumer of TraverseEvents. Owns the per-instance
 * `aWave` attributes and ALL the visual interpretation (the engine no longer
 * touches them). For each step it animates a pulse travelling from `from` to
 * `to` along `edgeId` over [tStart, tStart+duration], lights `to` on arrival,
 * then lets node highlights fade out per frame. See docs/plan-recorrido-sonoro.md §C.
 *
 * Two clocks meet here: the engine emits discrete, hop-paced events; this sink
 * renders them continuously at frame rate. Intensities from multiple walkers
 * combine with max(). Only touched indices are written and flushed as a partial
 * GPU range, so a busy graph never re-uploads the full buffer.
 */

import { attachWaveAttribute, applyWaveMaterial, flushWaveAttribute } from '../waveMaterial.js';

const EPS = 1e-3;

/**
 * @param {object} cfg
 * @param {import('three').InstancedMesh} cfg.nodes
 * @param {import('three').InstancedMesh} cfg.edges
 * @param {object} [cfg.params]
 */
export function createHighlightSink({ nodes, edges, params = {} }) {
  const P = {
    fadeFactor:   params.fadeFactor   ?? 0.92, // per-frame node fade (geom @60fps)
    edgePulseHalf: params.edgePulseHalf ?? 0.5, // where the edge pulse peaks in [0,1]
  };

  const nodeCount = nodes ? nodes.count : 0;
  const edgeCount = edges ? edges.count : 0;

  const nodeAttr = nodes ? attachWaveAttribute(nodes.geometry, nodeCount) : null;
  const edgeAttr = edges ? attachWaveAttribute(edges.geometry, edgeCount) : null;
  if (nodes) applyWaveMaterial(nodes.material, { hotColor: params.nodeHot ?? '#ff7a2a', childColor: params.nodeChildHot ?? '#2ad1ff', emissiveBoost: params.nodeBoost ?? 2.4 });
  if (edges) applyWaveMaterial(edges.material, { hotColor: params.edgeHot ?? '#ffd24a', childColor: params.edgeChildHot ?? '#48c4ff', emissiveBoost: params.edgeBoost ?? 1.8 });

  const aNode = nodeAttr ? nodeAttr.array : new Float32Array(0);
  const aEdge = edgeAttr ? edgeAttr.array : new Float32Array(0);

  // Active edge-travel animations (one per recent step). `sign` is +1 for regular
  // walkers and -1 for reproduced children, so the shader can colour them apart.
  /** @type {{edgeId:number, to:number, tStart:number, duration:number, sign:number}[]} */
  const anims = [];

  // Hot node set: nodes with aWave > EPS, faded per frame.
  const hotNodes = new Set();
  // Indices written since last flush (per attribute).
  const touchedNodes = new Set();
  const touchedEdges = new Set();

  /** Receive a batch of TraverseEvents from the engine. */
  function onEvents(events) {
    for (const ev of events) {
      anims.push({ edgeId: ev.edgeId, to: ev.to, tStart: ev.tStart, duration: ev.duration, sign: ev.isChild ? -1 : 1 });
    }
  }

  /**
   * Advance visuals to engine time `now` (ms) and upload changes.
   * @param {number} now engine clock (same scale as ev.tStart)
   */
  function update(now) {
    touchedNodes.clear();
    touchedEdges.clear();

    // ── Edge-travel pulses + arrival lighting ──
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const t = (now - a.tStart) / a.duration; // progress 0..1 (can exceed 1)
      if (t < 0) continue;

      if (t >= 1) {
        // Step finished: arrival fully lights the node; edge handed to fade=0.
        lightNode(a.to, a.sign);
        if (a.edgeId >= 0 && a.edgeId < edgeCount) setEdge(a.edgeId, 0);
        anims.splice(i, 1);
        continue;
      }
      // Pulse along the edge: triangular ramp peaking at edgePulseHalf.
      if (a.edgeId >= 0 && a.edgeId < edgeCount) {
        const peak = P.edgePulseHalf;
        const pulse = t < peak ? t / peak : (1 - t) / (1 - peak);
        setEdge(a.edgeId, a.sign * pulse);
      }
      // The destination node starts warming up as the pulse approaches.
      lightNode(a.to, a.sign * t * t);
    }

    // ── Per-frame node fade over the hot set (magnitude fades, sign preserved) ──
    for (const id of hotNodes) {
      const v = aNode[id] * P.fadeFactor;
      if (Math.abs(v) <= EPS) { aNode[id] = 0; hotNodes.delete(id); }
      else aNode[id] = v;
      touchedNodes.add(id);
    }

    // ── Upload only what changed ──
    if (touchedNodes.size && nodeAttr) flushWaveAttribute(nodeAttr, touchedNodes);
    if (touchedEdges.size && edgeAttr) flushWaveAttribute(edgeAttr, touchedEdges);
  }

  function lightNode(id, v) {
    if (id < 0 || id >= nodeCount) return;
    // Combine by magnitude so the strongest source wins, keeping its sign (colour).
    if (Math.abs(v) > Math.abs(aNode[id])) { aNode[id] = v; }
    if (Math.abs(aNode[id]) > EPS) hotNodes.add(id);
    touchedNodes.add(id);
  }

  function setEdge(id, v) {
    if (id < 0 || id >= edgeCount) return;
    aEdge[id] = v;
    touchedEdges.add(id);
  }

  /** Clear all highlight immediately. */
  function reset() {
    for (const id of hotNodes) { aNode[id] = 0; touchedNodes.add(id); }
    for (const a of anims) if (a.edgeId >= 0 && a.edgeId < edgeCount) setEdge(a.edgeId, 0);
    hotNodes.clear();
    anims.length = 0;
    if (nodeAttr) flushWaveAttribute(nodeAttr, touchedNodes);
    if (edgeAttr) flushWaveAttribute(edgeAttr, touchedEdges);
  }

  return {
    params: P,
    onEvents,
    update,
    reset,
    get hotNodeCount() { return hotNodes.size; },
    get animCount() { return anims.length; },
  };
}
