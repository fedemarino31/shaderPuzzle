/**
 * angular.js – "Comportamiento Angular": the pitch of each note is driven by the
 * 3D direction of the edge just traversed, expressed in spherical coordinates of
 * the graph's local space (Y is "up"):
 *
 *   β (beta)  = angle from the vertical +Y axis        → acos(dy),  [0, π]
 *               0 = edge points up, π = down, π/2 = horizontal.
 *   α (alpha) = azimuth of the edge projected on the XZ floor plane, measured
 *               from +X                                 → atan2(dz, dx), [0, 2π).
 *
 * Three selectable pitch modes (see §1 of the design):
 *   - 'absolute'    : α or β normalised → quantised onto a scale.
 *   - 'directional' : cumulative; each edge raises/lowers the scale degree by an
 *                     amount set by its inclination (round(maxStep·cos β)).
 *   - 'relative'    : cumulative; the *change of direction* from the previous edge
 *                     (turn = acos(dirPrev·dirNow)) sets the jump size, signed by
 *                     whether the edge tilts more up or down than the last one.
 *
 * A flexible modulation matrix (modSlots) maps any node fingerprint attribute or
 * geometric quantity (α/β/turn/new-visit) to a synth nuance (gain, duration,
 * ADSR, brightness, filter, unison, vibrato) — all configurable from the menu so
 * combinations can be explored without code changes.
 *
 * Per-walker melodic memory (cumulative degree index, previous edge direction)
 * lives in a custom walker that wraps randomWalk, so sonify() stays stateless and
 * the memory is released when the engine drops the walker.
 */

import { randomWalk } from '../traversal/strategies/randomWalk.js';
import { quantizeNormToScale, degreeToFreq, scaleLength } from './pitch.js';
import { STAT_KEYS } from '../graphStats.js';

const TWO_PI = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── Modulation matrix ───────────────────────────────────────────────────────
// Sources resolve to a normalised [0,1] value; targets map that value (through
// the slot's min/max window) onto a synth parameter's natural range below.
const TARGET_RANGE = {
  gain:         [0, 1],
  duration:     [50, 1500],   // ms
  attack:       [0.001, 1],   // s
  decay:        [0.001, 1.5], // s
  sustain:      [0, 1],
  release:      [0.01, 3],    // s
  brightness:   [0.2, 2.5],   // spectral tilt (higher = brighter)
  filterCutoff: [200, 12000], // Hz
  unisonDetune: [0, 50],      // cents
  vibratoAmount:[0, 80],      // cents
};

/** Select-option maps for the menu. */
export const MOD_SOURCES = {
  ...Object.fromEntries(STAT_KEYS.map((k) => [k, k])),
  alpha: 'α floor', beta: 'β vertical', turn: 'turn', isNewVisit: 'new visit',
};
export const MOD_TARGETS = {
  none: '—', gain: 'gain', duration: 'duration',
  attack: 'attack', decay: 'decay', sustain: 'sustain', release: 'release',
  brightness: 'brightness', filterCutoff: 'filter cutoff',
  unisonDetune: 'unison detune', vibratoAmount: 'vibrato',
};

/** Resolve a modulation source to [0,1]. */
function sourceNorm(source, ev, stats) {
  switch (source) {
    case 'alpha':      return ev.alpha / TWO_PI;
    case 'beta':       return ev.beta / Math.PI;
    case 'turn':       return ev.turn / Math.PI;
    case 'isNewVisit': return ev.isNewVisit ? 1 : 0;
    default:           return stats.norm(source, ev.to);   // any STAT_KEY
  }
}

/** Build an 8-partial harmonic series with a brightness tilt (≈1 dark … bright). */
function harmonicsFromBrightness(tilt) {
  const exp = 1 / Math.max(0.05, tilt);   // smaller tilt → faster high-partial decay
  const out = new Array(8);
  for (let k = 0; k < 8; k++) out[k] = Math.pow(1 / (k + 1), exp);
  return out;
}

/** Apply one modulation slot's value onto the note spec (in place). */
function applyTarget(spec, target, value01) {
  const range = TARGET_RANGE[target];
  if (!range) return;
  const v = range[0] + value01 * (range[1] - range[0]);
  switch (target) {
    case 'gain':         spec.gain = v; break;
    case 'duration':     spec.durationMs = v; break;
    case 'attack':       spec.adsr.attack = v; break;
    case 'decay':        spec.adsr.decay = v; break;
    case 'sustain':      spec.adsr.sustain = v; break;
    case 'release':      spec.adsr.release = v; break;
    case 'brightness':   spec.harmonics = harmonicsFromBrightness(v); break;
    case 'filterCutoff': spec.filter = { enabled: true, type: 'lowpass', cutoffStart: v, cutoffEnd: v, resonance: 1 }; break;
    case 'unisonDetune': spec.unison = { enabled: true, voices: 3, detune: v }; break;
    case 'vibratoAmount':spec.vibrato = { enabled: true, amount: v, rate: 5 }; break;
  }
}

export const angular = {
  id: 'angular',
  label: 'Angular',
  icon: 'fa-compass',
  maxWalkers: 1,

  defaults: {
    hopIntervalMs: 180, energyMode: 'infinite', energyBudget: 40, energyCost: 1,
    pitchMode: 'absolute', angleSource: 'beta', angleOffset: 0, angleReverse: false,
    scale: 'pentatonic', baseOctave: 3, octaves: 3, maxStep: 2,
    durationSec: 0.25, gain: 0.7,
    attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.8,
    modSlots: [
      { source: 'age',        target: 'brightness',   min: 0,   max: 1 },
      { source: 'degree',     target: 'unisonDetune',  min: 0,   max: 0.6 },
      { source: 'clustering', target: 'release',       min: 0.1, max: 0.8 },
    ],
  },

  /**
   * Movement = randomWalk; the wrapper adds per-step spherical angles (α, β,
   * turn) and the cumulative scale-degree index used by the non-absolute modes.
   */
  createWalker(graph, stats, params, startNodeId /*, ctx */) {
    const energy = params.energyMode === 'finite' ? params.energyBudget : Infinity;
    const inner = randomWalk(graph, stats, {
      startNodeId,
      hopIntervalMs: params.hopIntervalMs,
      energy,
      energyCost: params.energyCost,
    });

    const pos = graph.positions;
    const maxIndex = Math.max(1, params.octaves) * scaleLength(params.scale) - 1;
    let degreeIndex = Math.round(maxIndex / 2);   // start mid-range for cumulative modes
    let prevX = 0, prevY = 0, prevZ = 0, prevDy = 0, hasPrev = false;

    return {
      get hopIntervalMs() { return inner.hopIntervalMs; },
      get alive() { return inner.alive; },
      advance() {
        const ev = inner.advance();
        if (!ev) return null;

        const a = ev.from * 3, b = ev.to * 3;
        let dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const len = Math.hypot(dx, dy, dz) || 1e-12;
        dx /= len; dy /= len; dz /= len;

        const beta = Math.acos(clamp(dy, -1, 1));            // [0,π] from +Y
        let alpha = Math.atan2(dz, dx);                      // (-π,π]
        if (alpha < 0) alpha += TWO_PI;                      // [0,2π) from +X on XZ

        let turn = 0;
        if (hasPrev) {
          turn = Math.acos(clamp(prevX * dx + prevY * dy + prevZ * dz, -1, 1));
        }

        if (params.pitchMode === 'directional') {
          degreeIndex = clamp(degreeIndex + Math.round(params.maxStep * Math.cos(beta)), 0, maxIndex);
        } else if (params.pitchMode === 'relative') {
          const dir = Math.sign(dy - prevDy) || 1;
          degreeIndex = clamp(degreeIndex + dir * Math.round(params.maxStep * (turn / Math.PI)), 0, maxIndex);
        }

        ev.alpha = alpha; ev.beta = beta; ev.turn = turn; ev.degreeIndex = degreeIndex;
        prevX = dx; prevY = dy; prevZ = dz; prevDy = dy; hasPrev = true;
        return ev;
      },
    };
  },

  /** Pitch from the chosen mode, plus per-node nuances from the modulation matrix. */
  sonify(ev, ctx, params) {
    let freq;
    if (params.pitchMode === 'absolute') {
      const raw = params.angleSource === 'alpha' ? ev.alpha / TWO_PI : ev.beta / Math.PI;
      let n = params.angleReverse ? 1 - raw : raw;
      n = (n + (params.angleOffset ?? 0)) % 1;
      if (n < 0) n += 1;
      freq = quantizeNormToScale(n, params.scale, params.baseOctave, params.octaves);
    } else {
      freq = degreeToFreq(ev.degreeIndex ?? 0, params.scale, params.baseOctave);
    }

    const spec = {
      freq,
      durationMs: params.durationSec * 1000,
      gain: params.gain,
      adsr: { attack: params.attack, decay: params.decay, sustain: params.sustain, release: params.release },
      position: ctx.position,
      nodeId: ev.to,
    };

    const slots = params.modSlots ?? [];
    for (const slot of slots) {
      if (!slot || slot.target === 'none' || !slot.target) continue;
      const v = sourceNorm(slot.source, ev, ctx.stats);
      const value01 = clamp(slot.min + v * (slot.max - slot.min), 0, 1);
      applyTarget(spec, slot.target, value01);
    }
    return spec;
  },

  /** Build this behaviour's controls inside its folder (see menu §3 in the plan). */
  buildMenu(folder, s, { addSlider, addSelect, addSwitch }) {
    addSelect(s, 'pitchMode', { label: 'pitch mode', options: { absolute: 'absolute', directional: 'directional', relative: 'relative' } });
    addSelect(s, 'angleSource', { label: 'angle', options: { beta: 'β vertical', alpha: 'α floor' } });
    addSlider(s, 'angleOffset', { label: 'angle 0', min: 0, max: 1, step: 0.01 });
    addSwitch(s, 'angleReverse', { label: 'reverse' });
    addSelect(s, 'scale', { label: 'scale', options: { pentatonic: 'pentatonic', major: 'major', minor: 'minor', wholeTone: 'whole tone', chromatic: 'chromatic' } });
    addSlider(s, 'baseOctave', { label: 'base oct', min: 1, max: 6, step: 1 });
    addSlider(s, 'octaves', { label: 'octaves', min: 1, max: 5, step: 1 });
    addSlider(s, 'maxStep', { label: 'max step', min: 1, max: 7, step: 1 });
    addSlider(s, 'durationSec', { label: 'note s', min: 0.05, max: 1.5, step: 0.05 });
    addSlider(s, 'gain', { label: 'gain', min: 0, max: 1, step: 0.01 });
    addSlider(s, 'attack', { label: 'attack', min: 0.001, max: 1, step: 0.005 });
    addSlider(s, 'decay', { label: 'decay', min: 0.001, max: 1, step: 0.005 });
    addSlider(s, 'sustain', { label: 'sustain', min: 0, max: 1, step: 0.01 });
    addSlider(s, 'release', { label: 'release', min: 0.001, max: 3, step: 0.01 });

    // Modulation matrix: 3 generic source→target slots.
    for (let i = 0; i < s.modSlots.length; i++) {
      const slot = s.modSlots[i];
      addSelect(slot, 'source', { label: `m${i + 1} src`, options: MOD_SOURCES });
      addSelect(slot, 'target', { label: `m${i + 1} dst`, options: MOD_TARGETS });
      addSlider(slot, 'min', { label: `m${i + 1} min`, min: 0, max: 1, step: 0.01 });
      addSlider(slot, 'max', { label: `m${i + 1} max`, min: 0, max: 1, step: 0.01 });
    }
  },
};
