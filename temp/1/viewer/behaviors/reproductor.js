/**
 * reproductor.js – "Comportamiento Reproductor": como el Clásico, pero el walker
 * principal (padre) engendra walkers hijos. Cuando el padre pisa un nodo de grado
 * alto (>= degreeThreshold) y la camada viva no llegó al tope (maxChildren),
 * instancia un hijo desde ese mismo nodo vía ctx.spawnChild().
 *
 * Los hijos se diferencian del padre así:
 *   - presupuesto acotado: mueren tras `childBudget` saltos (energía finita);
 *   - camino forzado a divergir: al engendrar en un nodo, el padre junta las
 *     aristas salientes (excluyendo por la que vino), se RESERVA una para sí (la
 *     toma en su próximo salto) y reparte LAS DEMÁS entre los hijos, una por hijo.
 *     Cada hijo toma su arista asignada en el primer salto y luego camina al azar
 *     (defaultPickNext), sin perseguir al padre → arrancan por ramas distintas;
 *   - sonido: desfase de hop chico respecto del padre (flam) + ganancia reducida.
 *
 * Estado compartido (camada / "brood"): un objeto { children } que el padre crea
 * y pasa a cada hijo por `extra` en spawnChild. El merge de params en el motor es
 * shallow, así que la referencia del brood sobrevive y sirve de censo: el hijo se
 * anota al nacer y el padre poda los muertos para respetar el tope. Ver engine.js.
 */

import { randomWalk, defaultPickNext } from '../traversal/strategies/randomWalk.js';
import { quantizeNormToScale } from './pitch.js';
import { STAT_KEYS } from '../graphStats.js';

/** Map a node's fingerprint attribute to a quantised pentatonic pitch (Hz). */
function noteFor(nodeId, p, stats) {
  const n = stats.norm(p.freqAttr, nodeId);          // [0,1]
  return quantizeNormToScale(n, 'pentatonic', p.baseOctave, p.octaves);
}

/** Fisher–Yates in place (usa Math.random; el reparto de ramas no necesita rng del walker). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const reproductor = {
  id: 'reproductor',
  label: 'Reproductor',
  icon: 'fa-code-branch',
  maxWalkers: 12,                // techo de seguridad; el tope real lo aplica brood/maxChildren

  defaults: {
    // Movimiento/energía del padre los aporta walkerParams (hop/energy compartidos).
    hopIntervalMs: 180, energyMode: 'infinite', energyBudget: 40, energyCost: 1,
    // Pitch/envelope (como el Clásico). baseOctave grave: el padre "suena viejo".
    freqAttr: 'age', baseOctave: 2, octaves: 3, durationSec: 0.25,
    velNew: 0.9, velRevisit: 0.4,
    attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.8,
    // Reproducción. childPitchSemitones: transpone los hijos (+12 octava, +7 quinta) →
    // suenan más agudos/jóvenes. childHopMult: tempo de los hijos (× del hop del padre).
    degreeThreshold: 4, maxChildren: 3, childBudget: 12,
    childPitchSemitones: 12, childHopMult: 1, childHopOffset: 10, childGain: 0.5,
  },

  /**
   * Padre o hijo según params._isChild. El padre siembra y reparte ramas; el hijo
   * toma su rama asignada y luego camina al azar, con energía acotada, anotándose
   * en la camada compartida.
   */
  createWalker(graph, stats, params, startNodeId, ctx) {
    if (params._isChild) {
      const brood = params._brood;
      const firstEdge = params._firstEdge;           // half-edge asignado para el 1er salto
      let used = false;
      const inner = randomWalk(graph, stats, {
        startNodeId,
        hopIntervalMs: params.hopIntervalMs * params.childHopMult + params.childHopOffset,
        energy: Math.max(1, params.childBudget),
        energyCost: 1,
        pickNext: (args) => {
          if (!used && firstEdge >= args.s && firstEdge < args.e) { used = true; return firstEdge; }
          used = true;
          return defaultPickNext(args);              // luego, caminata aleatoria normal
        },
      });
      const child = {
        get hopIntervalMs() { return inner.hopIntervalMs; },
        get alive() { return inner.alive; },
        advance() {
          const ev = inner.advance();
          if (!ev) return null;
          ev.isChild = true;                         // → sonify baja el volumen, highlight otro color
          return ev;
        },
      };
      brood.children.push(child);                    // censo de camada viva
      return child;
    }

    // Padre: random walk normal que siembra hijos en nodos de grado alto, pero al
    // engendrar reserva su propia arista y manda a los hijos por las otras.
    const { adjOffsets, adjNeighbors } = graph;
    const brood = { children: [] };
    let pendingEdge = -1;                            // arista reservada para el próximo salto del padre
    const energy = params.energyMode === 'finite' ? params.energyBudget : Infinity;
    const inner = randomWalk(graph, stats, {
      startNodeId,
      hopIntervalMs: params.hopIntervalMs,
      energy,
      energyCost: params.energyCost,
      pickNext: (args) => {
        if (pendingEdge >= args.s && pendingEdge < args.e) { const i = pendingEdge; pendingEdge = -1; return i; }
        pendingEdge = -1;
        return defaultPickNext(args);
      },
    });
    return {
      get hopIntervalMs() { return inner.hopIntervalMs; },
      get alive() { return inner.alive; },
      advance() {
        const ev = inner.advance();
        if (!ev) return null;
        brood.children = brood.children.filter((c) => c.alive);   // poda muertos → libera cupo

        if (stats.raw.degree[ev.to] >= params.degreeThreshold) {
          // Aristas salientes del nodo, sin volver por donde vino el padre.
          const s = adjOffsets[ev.to], e = adjOffsets[ev.to + 1];
          const cands = [];
          for (let i = s; i < e; i++) if (adjNeighbors[i] !== ev.from) cands.push(i);
          if (cands.length > 0) {
            shuffle(cands);
            pendingEdge = cands[0];                  // el padre se reserva una rama
            let room = params.maxChildren - brood.children.length;
            for (let c = 1; c < cands.length && room > 0; c++, room--) {
              ctx.spawnChild(ev.to, { _isChild: true, _brood: brood, _firstEdge: cands[c] });
            }
          }
        }
        return ev;
      },
    };
  },

  /** Como el Clásico; los hijos suenan más bajo (childGain) y transpuestos (childPitchSemitones). */
  sonify(ev, ctx, params) {
    let gain = ev.isNewVisit ? params.velNew : params.velRevisit;
    let freq = noteFor(ev.to, params, ctx.stats);
    if (ev.isChild) {
      gain *= params.childGain;
      freq *= Math.pow(2, params.childPitchSemitones / 12);   // transpone (octava/quinta armonizan)
    }
    return {
      freq,
      durationMs: params.durationSec * 1000,
      gain,
      adsr: {
        attack: params.attack, decay: params.decay,
        sustain: params.sustain, release: params.release,
      },
      position: ctx.position,
      nodeId: ev.to,
    };
  },

  /** Controles: pitch/envelope (como Clásico) + parámetros de reproducción. */
  buildMenu(folder, s, { addSlider, addSelect }) {
    addSelect(s, 'freqAttr', { label: 'pitch ←', options: Object.fromEntries(STAT_KEYS.map((k) => [k, k])) });
    addSlider(s, 'baseOctave', { label: 'base oct', min: 1, max: 6, step: 1 });
    addSlider(s, 'octaves', { label: 'octaves', min: 1, max: 5, step: 1 });
    addSlider(s, 'durationSec', { label: 'note s', min: 0.05, max: 1.5, step: 0.05 });
    addSlider(s, 'attack', { label: 'attack', min: 0.001, max: 1, step: 0.005 });
    addSlider(s, 'decay', { label: 'decay', min: 0.001, max: 1, step: 0.005 });
    addSlider(s, 'sustain', { label: 'sustain', min: 0, max: 1, step: 0.01 });
    addSlider(s, 'release', { label: 'release', min: 0.001, max: 3, step: 0.01 });
    // Reproducción.
    addSlider(s, 'degreeThreshold', { label: 'umbral grado', min: 1, max: 12, step: 1 });
    addSlider(s, 'maxChildren', { label: 'max hijos', min: 0, max: 6, step: 1 });
    addSlider(s, 'childBudget', { label: 'saltos hijo', min: 2, max: 40, step: 1 });
    addSlider(s, 'childPitchSemitones', { label: 'pitch hijo st', min: -24, max: 24, step: 1 });
    addSlider(s, 'childHopMult', { label: 'tempo hijo ×', min: 0.25, max: 4, step: 0.25 });
    addSlider(s, 'childHopOffset', { label: 'desfase ms', min: 0, max: 60, step: 1 });
    addSlider(s, 'childGain', { label: 'vol hijo', min: 0, max: 1, step: 0.05 });
  },
};
