/**
 * classic.js – "Comportamiento Clásico": the original viewer behaviour packaged
 * as a pluggable behaviour. One walker per click, single-path random walk, and a
 * note whose pitch is one fingerprint attribute of the destination node mapped
 * to a pentatonic scale. New visits sound louder than revisits. No child
 * walkers (maxWalkers = 1).
 *
 * A behaviour bundles the two strategies that used to be split between the
 * traversal engine and the audio sink:
 *   - createWalker(): how it moves   (reuses randomWalk)
 *   - sonify():       how it sounds  (was audioSink.noteFor)
 * Both read the same per-interprete `params` snapshot, so each interprete keeps
 * the settings active when it was launched.
 */

import { randomWalk } from '../traversal/strategies/randomWalk.js';
import { quantizeNormToScale } from './pitch.js';
import { STAT_KEYS } from '../graphStats.js';

/** Map a node's fingerprint attribute to a quantised pentatonic pitch (Hz). */
function noteFor(nodeId, p, stats) {
  const n = stats.norm(p.freqAttr, nodeId);          // [0,1]
  return quantizeNormToScale(n, 'pentatonic', p.baseOctave, p.octaves);
}

export const classic = {
  id: 'classic',
  label: 'Clásico',
  icon: 'fa-person-walking',
  maxWalkers: 1,                 // no reproduction yet

  // Documents the params this behaviour reads; the live menu state overrides
  // these at launch (see launchInterprete in main.js).
  defaults: {
    hopIntervalMs: 180, energyMode: 'infinite', energyBudget: 40, energyCost: 1,
    freqAttr: 'age', baseOctave: 3, octaves: 3, durationSec: 0.25,
    velNew: 0.9, velRevisit: 0.4,
    attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.8,
  },

  /** How it moves: a single-path random walk (see randomWalk.js). */
  createWalker(graph, stats, params, startNodeId /*, ctx */) {
    const energy = params.energyMode === 'finite' ? params.energyBudget : Infinity;
    return randomWalk(graph, stats, {
      startNodeId,
      hopIntervalMs: params.hopIntervalMs,
      energy,
      energyCost: params.energyCost,
    });
  },

  /**
   * How it sounds: one positioned note for the step's destination node.
   * @param {object} ev   TraverseEvent { to, isNewVisit, … }
   * @param {object} ctx  { stats, position:[x,y,z], nodeId } from the router
   * @param {object} params  per-interprete snapshot
   * @returns {object|null} noteSpec for spatialSynth.play, or null to stay silent
   */
  sonify(ev, ctx, params) {
    return {
      freq: noteFor(ev.to, params, ctx.stats),
      durationMs: params.durationSec * 1000,
      gain: ev.isNewVisit ? params.velNew : params.velRevisit,
      adsr: {
        attack: params.attack, decay: params.decay,
        sustain: params.sustain, release: params.release,
      },
      position: ctx.position,
      nodeId: ev.to,
    };
  },

  /** Build this behaviour's controls inside its folder (see menu §3 in the plan). */
  buildMenu(folder, s, { addSlider, addSelect }) {
    addSelect(s, 'freqAttr', { label: 'pitch ←', options: Object.fromEntries(STAT_KEYS.map((k) => [k, k])) });
    addSlider(s, 'baseOctave', { label: 'base oct', min: 1, max: 6, step: 1 });
    addSlider(s, 'octaves', { label: 'octaves', min: 1, max: 5, step: 1 });
    addSlider(s, 'durationSec', { label: 'note s', min: 0.05, max: 1.5, step: 0.05 });
    addSlider(s, 'attack', { label: 'attack', min: 0.001, max: 1, step: 0.005 });
    addSlider(s, 'decay', { label: 'decay', min: 0.001, max: 1, step: 0.005 });
    addSlider(s, 'sustain', { label: 'sustain', min: 0, max: 1, step: 0.01 });
    addSlider(s, 'release', { label: 'release', min: 0.001, max: 3, step: 0.01 });
  },
};
