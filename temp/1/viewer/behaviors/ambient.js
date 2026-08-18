/**
 * ambient.js – "Comportamiento Ambient": a diferencia de los otros behaviours
 * (notas efímeras vía AdditiveSynth), éste crea UNA capa persistente de
 * LoopSynth (sample loopeado con fade-in) que suena hasta que el intérprete
 * muere (fade-out en dispose). El walker recorre el grafo y mapea atributos de
 * los nodos a parámetros del loop, pero en forma GRADUAL:
 *
 *   stats.norm(attr, nodo) → operador (avg/min/max/vel, ventana temporal en ms)
 *     → ventana del slot [min,max] → rango natural del target
 *     → loops.ramp(layerId, target, valor, rampMs)
 *
 * El operador es la "amortiguación": 10 nodos con degree dispar en ráfaga
 * producen un promedio móvil, no 10 saltos. `windowMs` es la inercia (15 s =
 * clima; 1 s = textura reactiva); `rampMs` es la articulación del transporte.
 *
 * Además de los slots continuos hay eventSlots discretos (Level/Band con
 * histéresis sobre la señal pre-suavizada) que puntúan la deriva con gestos:
 *   - swell: al cruzar el umbral hacia arriba, el gain sube y vuelve (~5 s) —
 *     el drone "anuncia" la llegada a una región (mientras dura el gesto se
 *     suprimen las rampas continuas de gain para no pisarlo);
 *   - panLfo: al entrar a la banda se activa un LFO de paneo lento (el sonido
 *     flota); al salir se apaga.
 *
 * sonify() retorna null: la capa persistente ES el sonido. El estado (layerId,
 * operadores, reloj musical) vive en el closure del walker; el engine llama
 * walker.dispose() al purgarlo (energía/remove/clear) → fade-out de la capa.
 * El synth llega vía ctx.services.audio.loops (inyectado por main.js).
 */

import { randomWalk } from '../traversal/strategies/randomWalk.js';
import { STAT_KEYS } from '../graphStats.js';
import { Convolution, Min, Max, Velocity, Level, Band, SignalType } from '../../operators/index.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── Opciones de sample ───────────────────────────────────────────────────────
// main.js las llena tras cargar el manifest (setSampleOptions), antes de que se
// construya el menú. Fallback visible si el manifest falló.
let SAMPLE_OPTIONS = { '': '(sin samples)' };

/** Registra los instrumentos disponibles y resuelve el default del behaviour. */
export function setSampleOptions(names) {
  if (!names?.length) return;
  SAMPLE_OPTIONS = Object.fromEntries(names.map((n) => [n, n]));
  if (!ambient.defaults.instrument) ambient.defaults.instrument = names[0];
}

// ── Mod matrix ───────────────────────────────────────────────────────────────
const MOD_SOURCES = Object.fromEntries(STAT_KEYS.map((k) => [k, k]));
const MOD_OPS = { avg: 'promedio', min: 'mín', max: 'máx', vel: 'velocity' };
const MOD_TARGETS = {
  none: '—', gain: 'gain', frequency: 'cutoff', Q: 'Q',
  playbackRate: 'rate', detune: 'detune', pan: 'pan',
  lfoRate: 'LFO rate', lfoDepth: 'LFO depth',
};
const EVENT_MODES = { level: 'level (umbral)', band: 'band (rango)' };
const EVENT_ACTIONS = { none: '—', swell: 'swell gain', panLfo: 'pan LFO' };

// Depth por defecto del LFO continuo según su destino (≈15 % del rango útil),
// usada cuando sólo se mapea lfoRate y nadie fija la profundidad.
const LFO_DEFAULT_DEPTH = { gain: 0.08, frequency: 600 };
const PAN_LFO_RATE = 0.07;  // Hz — deriva estéreo lenta del gesto panLfo
const SWAP_FADE_SEC = 0.15; // corte rápido al cambiar de sample en vivo

/** v01 [0,1] → valor en el rango natural del target de LoopSynth. */
function toTargetValue(target, v01, params) {
  switch (target) {
    case 'gain':         return v01 * params.baseGain;
    case 'playbackRate': return 0.5 + v01 * 1.5;                 // 0.5 … 2
    case 'detune':       return -1200 + v01 * 2400;              // ±1 octava (cents)
    case 'frequency':    return 100 * Math.pow(80, v01);         // 100 … 8000 Hz (log)
    case 'Q':            return v01 * 12;
    case 'pan':          return -1 + v01 * 2;
    case 'lfoRate':      return 0.02 + v01 * 3.98;               // 0.02 … 4 Hz
    case 'lfoDepth':     return params.lfoTarget === 'gain' ? v01 * 0.4 : v01 * 4000;
    default:             return v01;
  }
}

/** Instancia el operador de suavizado de un slot continuo. */
function makeOp(kind, windowMs) {
  switch (kind) {
    case 'min': return new Min(SignalType.scalar, windowMs);
    case 'max': return new Max(SignalType.scalar, windowMs);
    case 'vel': return new Velocity(SignalType.scalar, 1);
    default:    return new Convolution(SignalType.scalar, windowMs, () => 1); // avg
  }
}

export const ambient = {
  id: 'ambient',
  label: 'Ambient',
  icon: 'fa-water',
  maxWalkers: 1,

  defaults: {
    hopIntervalMs: 400, energyMode: 'infinite', energyBudget: 120, energyCost: 1,
    // fadeSec sólo aplica al lanzar/borrar; cambiar instrument en vivo reinstancia
    // la capa con un corte rápido (SWAP_FADE_SEC). El resto es editable en vivo.
    instrument: '',              // resuelto por setSampleOptions (primer sample)
    baseGain: 0.6, fadeSec: 4, rampMs: 800, lfoTarget: 'frequency',
    modSlots: [
      { source: 'degree',       op: 'avg', windowMs: 4000, target: 'frequency', min: 0.1,  max: 0.9 },
      { source: 'localDensity', op: 'avg', windowMs: 6000, target: 'gain',      min: 0.25, max: 0.9 },
      { source: 'age',          op: 'avg', windowMs: 5000, target: 'detune',    min: 0.35, max: 0.65 },
      { source: 'clustering',   op: 'max', windowMs: 8000, target: 'Q',         min: 0,    max: 0.5 },
    ],
    eventSlots: [
      { source: 'degree', windowMs: 3000, mode: 'level', threshold: 0.65, bandMax: 1, hysteresis: 0.1,
        action: 'swell', amount: 1.5, gestureMs: 5000 },
      { source: 'distToGlobalCentroid', windowMs: 4000, mode: 'band', threshold: 0.6, bandMax: 1, hysteresis: 0.05,
        action: 'panLfo', amount: 0.8, gestureMs: 0 },
    ],
  },

  /**
   * randomWalk + capa LoopSynth persistente + pipeline de operadores. Todo el
   * estado vive en este closure; dispose() (llamado por el engine) lo libera.
   */
  createWalker(graph, stats, params, startNodeId, ctx) {
    const loops = ctx.services?.audio?.loops ?? null;
    const energy = params.energyMode === 'finite' ? params.energyBudget : Infinity;
    const inner = randomWalk(graph, stats, {
      startNodeId,
      hopIntervalMs: params.hopIntervalMs,
      energy,
      energyCost: params.energyCost,
    });

    let layerId = null;
    let layerInstrument = null; // sample de la capa actual (o del intento en vuelo);
                                // si params.instrument difiere → swap (ver advance)
    let creating = false;      // createLayer en vuelo (async: fetch + decode)
    let failed = false;        // sample irrecuperable → no reintentar cada hop
    let disposed = false;
    let tMs = 0;               // reloj musical: avanza hopIntervalMs por hop, no
                               // wall-clock (en catch-up caerían dt≈0 y Velocity divergiría)
    let gainHoldUntil = 0;     // tMs hasta el que se suprimen rampas continuas de gain
                               // (fade-in inicial o swell en curso)
    const timers = new Set();  // setTimeout de retorno de swells (limpiados en dispose)

    // Cache de operadores continuos por índice de slot; se recrean si el usuario
    // edita source/op/window en vivo (el menú muta los slots in place).
    const opCache = [];
    // Cache de detectores de eventos: pre-suavizado (avg) + Level/Band.
    const evCache = [];
    // Estado del LFO continuo (targets lfoRate/lfoDepth de la mod matrix).
    let lfoAppliedTarget = null;
    let lfoRate = null, lfoDepth = null;

    function ensureLayer(fadeSec = params.fadeSec) {
      if (!loops?.ready || creating || failed || disposed || layerId != null) return;
      if (!params.instrument) { failed = true; return; }
      creating = true;
      layerInstrument = params.instrument;                 // marca el intento (éxito o no)
      loops.createLayer({
        instrument: params.instrument,
        gain: params.baseGain,
        fadeSec,
        pan: 0,
        // Filtro neutro SIEMPRE: frequency/Q (y el LFO de cutoff) necesitan destino.
        filter: { type: 'lowpass', frequency: 18000, Q: 0 },
      }).then((id) => {
        creating = false;
        if (id == null) { failed = true; return; }
        if (disposed) { loops.remove(id, 0.5); return; }   // murió mientras cargaba
        layerId = id;
        gainHoldUntil = tMs + fadeSec * 1000;              // no pisar el fade-in
      });
    }

    // Cambio de sample en vivo: mata la capa actual con un corte rápido (sin el
    // fade-out largo) y reinstancia con el instrument nuevo. También rehabilita
    // el reintento si el sample anterior había fallado.
    function swapLayerIfInstrumentChanged() {
      if (creating || disposed) return;                    // el próximo hop lo resuelve
      if (layerInstrument === null || params.instrument === layerInstrument) return;
      if (layerId != null) { loops.remove(layerId, SWAP_FADE_SEC); layerId = null; }
      failed = false;
      // El estado de LFO vivía en la capa muerta: forzar re-aplicación en la nueva.
      lfoAppliedTarget = null; lfoRate = lfoDepth = null;
      for (const c of evCache) if (c) c.lfoActive = false;
      ensureLayer(SWAP_FADE_SEC * 2);                      // entrada corta, sin clicks
    }

    function syncOp(i, slot) {
      const c = opCache[i];
      if (c && c.source === slot.source && c.kind === slot.op && c.windowMs === slot.windowMs) return c.op;
      c?.op.dispose();
      const op = makeOp(slot.op, slot.windowMs);
      opCache[i] = { op, source: slot.source, kind: slot.op, windowMs: slot.windowMs };
      return op;
    }

    function fireSwell(slot) {
      if (layerId == null) return;
      const peak = Math.min(1, params.baseGain * slot.amount);
      const upMs = Math.max(100, slot.gestureMs * 0.3);
      const downMs = Math.max(100, slot.gestureMs * 0.7);
      gainHoldUntil = Math.max(gainHoldUntil, tMs + slot.gestureMs);
      loops.ramp(layerId, 'gain', peak, upMs);
      const t = setTimeout(() => {
        timers.delete(t);
        if (disposed || layerId == null) return;
        loops.ramp(layerId, 'gain', params.baseGain, downMs);
      }, upMs);
      timers.add(t);
    }

    function setPanLfo(slot, on) {
      if (layerId == null) return;
      loops.setLFO(layerId, 'pan', on
        ? { rate: PAN_LFO_RATE, depth: clamp(slot.amount, 0, 1), enabled: true }
        : { enabled: false });
    }

    function syncDetector(i, slot) {
      const c = evCache[i];
      const key = `${slot.source}|${slot.windowMs}|${slot.mode}|${slot.threshold}|${slot.bandMax}|${slot.hysteresis}`;
      if (c && c.key === key) return c;
      if (c) { c.pre.dispose(); c.det.dispose(); }
      const pre = new Convolution(SignalType.scalar, slot.windowMs, () => 1);
      const det = slot.mode === 'band'
        ? new Band(SignalType.scalar, slot.threshold, slot.bandMax, slot.hysteresis)
        : new Level(SignalType.scalar, slot.threshold, slot.hysteresis);
      // Sólo el swell usa el flanco (gesto momentáneo). El toggle panLfo se
      // sincroniza por valor en applyEventSlots: los detectores no disparan
      // evento en su primera muestra (nacer dentro de la banda) y un flanco
      // puede caer mientras la capa aún carga — el polling cubre ambos casos.
      const onTrigger = () => { if (slot.action === 'swell') fireSwell(slot); };
      if (slot.mode === 'band') det.onEnter(onTrigger);
      else det.onUp(onTrigger);
      const entry = { key, pre, det, lfoActive: false };
      evCache[i] = entry;
      return entry;
    }

    /** Salida del operador → [0,1]. vel se recentra: ±rango completo por ventana = 0/1. */
    function normalizeOut(kind, out, windowMs) {
      if (kind === 'vel') return clamp(0.5 + 0.5 * out * windowMs, 0, 1);
      return clamp(out, 0, 1);
    }

    function applyContinuousSlots(ev) {
      let desiredRate, desiredDepth;

      const slots = params.modSlots ?? [];
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot || slot.target === 'none' || !slot.target) continue;
        const op = syncOp(i, slot);
        op.in(stats.norm(slot.source, ev.to), tMs);
        op.update(tMs);
        const out = op.out();
        if (out === undefined) continue;               // ventana aún vacía
        const n = normalizeOut(slot.op, out, slot.windowMs);
        const v01 = clamp(slot.min + n * (slot.max - slot.min), 0, 1);
        const value = toTargetValue(slot.target, v01, params);

        if (slot.target === 'lfoRate') { desiredRate = value; continue; }
        if (slot.target === 'lfoDepth') { desiredDepth = value; continue; }
        if (layerId == null) continue;
        if (slot.target === 'gain' && tMs < gainHoldUntil) continue; // fade-in/swell en curso
        loops.ramp(layerId, slot.target, value, params.rampMs);
      }

      // LFO continuo: un solo setLFO por hop sobre params.lfoTarget.
      if ((desiredRate !== undefined || desiredDepth !== undefined) && layerId != null) {
        const tgt = params.lfoTarget;
        if (lfoAppliedTarget && lfoAppliedTarget !== tgt) {
          loops.setLFO(layerId, lfoAppliedTarget, { enabled: false });
          lfoRate = lfoDepth = null;
        }
        const rate = desiredRate ?? lfoRate ?? 0.15;
        const depth = desiredDepth ?? lfoDepth ?? LFO_DEFAULT_DEPTH[tgt] ?? 0;
        if (rate !== lfoRate || depth !== lfoDepth || lfoAppliedTarget !== tgt) {
          loops.setLFO(layerId, tgt, { rate, depth, enabled: true });
          lfoAppliedTarget = tgt; lfoRate = rate; lfoDepth = depth;
        }
      }
    }

    function applyEventSlots(ev) {
      const slots = params.eventSlots ?? [];
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot || slot.action === 'none' || !slot.action) continue;
        const entry = syncDetector(i, slot);
        const { pre, det } = entry;
        pre.in(stats.norm(slot.source, ev.to), tMs);
        pre.update(tMs);
        const out = pre.out();
        if (out === undefined) continue;
        det.in(out, tMs);                              // Level/Band disparan en in()
        det.update(tMs);
        if (slot.action === 'panLfo' && layerId != null) {
          const on = det.out() === 1;                  // estado con histéresis
          if (on !== entry.lfoActive) { setPanLfo(slot, on); entry.lfoActive = on; }
        }
      }
    }

    return {
      get hopIntervalMs() { return inner.hopIntervalMs; },
      get alive() { return inner.alive; },

      advance() {
        const ev = inner.advance();
        if (!ev) return null;
        tMs += inner.hopIntervalMs;
        swapLayerIfInstrumentChanged();
        ensureLayer();
        applyContinuousSlots(ev);
        applyEventSlots(ev);
        return ev;
      },

      /** Llamado por el engine al purgar el walker: fade-out de la capa. */
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const t of timers) clearTimeout(t);
        timers.clear();
        for (const c of opCache) c?.op.dispose();
        opCache.length = 0;
        for (const c of evCache) { c?.pre.dispose(); c?.det.dispose(); }
        evCache.length = 0;
        if (layerId != null) { loops?.remove(layerId, params.fadeSec); layerId = null; }
      },
    };
  },

  /** Sin notas efímeras: la capa persistente ES el sonido de este behaviour. */
  sonify() { return null; },

  /** Controles: capa + mod matrix continua + slots de eventos discretos. */
  buildMenu(folder, s, { addSlider, addSelect }) {
    addSelect(s, 'instrument', { label: 'sample', options: SAMPLE_OPTIONS });
    addSlider(s, 'baseGain', { label: 'gain base', min: 0, max: 1, step: 0.01 });
    addSlider(s, 'fadeSec', { label: 'fade s', min: 0.5, max: 10, step: 0.5 });
    addSlider(s, 'rampMs', { label: 'rampa ms', min: 50, max: 5000, step: 50 });
    addSelect(s, 'lfoTarget', { label: 'LFO →', options: { frequency: 'cutoff', gain: 'gain' } });

    for (let i = 0; i < s.modSlots.length; i++) {
      const slot = s.modSlots[i];
      addSelect(slot, 'source', { label: `m${i + 1} src`, options: MOD_SOURCES });
      addSelect(slot, 'op', { label: `m${i + 1} op`, options: MOD_OPS });
      addSlider(slot, 'windowMs', { label: `m${i + 1} vent ms`, min: 500, max: 15000, step: 250 });
      addSelect(slot, 'target', { label: `m${i + 1} dst`, options: MOD_TARGETS });
      addSlider(slot, 'min', { label: `m${i + 1} min`, min: 0, max: 1, step: 0.01 });
      addSlider(slot, 'max', { label: `m${i + 1} max`, min: 0, max: 1, step: 0.01 });
    }

    for (let i = 0; i < (s.eventSlots?.length ?? 0); i++) {
      const slot = s.eventSlots[i];
      addSelect(slot, 'source', { label: `e${i + 1} src`, options: MOD_SOURCES });
      addSlider(slot, 'windowMs', { label: `e${i + 1} vent ms`, min: 500, max: 15000, step: 250 });
      addSelect(slot, 'mode', { label: `e${i + 1} modo`, options: EVENT_MODES });
      addSlider(slot, 'threshold', { label: `e${i + 1} umbral`, min: 0, max: 1, step: 0.01 });
      addSlider(slot, 'bandMax', { label: `e${i + 1} máx`, min: 0, max: 1, step: 0.01 });
      addSlider(slot, 'hysteresis', { label: `e${i + 1} hist`, min: 0, max: 0.3, step: 0.01 });
      addSelect(slot, 'action', { label: `e${i + 1} acción`, options: EVENT_ACTIONS });
      addSlider(slot, 'amount', { label: `e${i + 1} cant`, min: 0, max: 2, step: 0.05 });
      addSlider(slot, 'gestureMs', { label: `e${i + 1} gesto ms`, min: 500, max: 15000, step: 250 });
    }
  },
};
