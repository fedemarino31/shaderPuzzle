/**
 * audioRouter.js – audio consumer of TraverseEvents. It is behaviour-agnostic:
 * for each step it asks the *emitting* behaviour how to sonify the event
 * (behaviour.sonify → noteSpec) and forwards the spec to the shared spatial
 * synth, which positions the note at the destination node (PannerNode cached
 * per node). The pitch/mapping logic lives in each behaviour, not here — this
 * file only resolves the node's world position and routes the note.
 *
 * Replaces the old audioSink.js, whose pentatonic mapping now lives in the
 * classic behaviour. See docs/Spatialization3D_design.md for the spatial model.
 */

import { Vector3 } from 'three';

/**
 * @param {object} args
 * @param {object} args.graph       loaded graph (positions, stats)
 * @param {object} args.graphGroup  three.Group the graph is parented to (local→world)
 * @param {object} args.synth       shared spatial synth service (createSpatialSynth)
 */
export function createAudioRouter({ graph, graphGroup, synth }) {
  const P = { enabled: true };
  const tmp = new Vector3();

  /** World-space position of a node (graph-local coords through the group). */
  function worldPos(nodeId) {
    const o = nodeId * 3;
    tmp.set(graph.positions[o], graph.positions[o + 1], graph.positions[o + 2]);
    graphGroup.localToWorld(tmp);
    return [tmp.x, tmp.y, tmp.z];
  }

  function onEvents(events) {
    if (!P.enabled || !synth.started) return;
    for (const ev of events) {
      const spec = ev.behavior.sonify(
        ev,
        { stats: graph.stats, position: worldPos(ev.to), nodeId: ev.to },
        ev.params,
      );
      if (spec) synth.play(spec);
    }
  }

  return { params: P, onEvents };
}
