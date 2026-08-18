/**
 * spatialSynth.js – shared 3D spatial synthesiser service for the viewer.
 *
 * Every behaviour (see ../behaviors/) plays its notes through this one service,
 * so "interacting with the synth" is the single thing all behaviours have in
 * common. It wraps AdditiveSynth (raw Web Audio) to position each note at its
 * node with a PannerNode cached per node — exactly the design in
 * docs/Spatialization3D_design.md, already implemented in AdditiveSynth.
 *
 * Besides the ephemeral notes, the service owns a LoopSynth for persistent
 * ambient layers (looping samples), exposed through the `loops` sub-API used by
 * the ambient behaviour. Both engines share one explicit MasterBus, so a single
 * compressor integrates notes and pads (same pattern as LoopSynthTest).
 * Sample decode is lazy (per instrument, on first layer); only the manifest —
 * plain JSON, no AudioContext needed — is fetched eagerly via loadManifest()
 * so the menu can list instruments before any audio gesture.
 *
 * Lifecycle: the AudioContext can only start from a user gesture, so `start()`
 * is idempotent and called from the click/XR handler. The service is a
 * singleton that survives model swaps; `clearAllNodes()` drops the per-node
 * panners when the graph (and thus the node ids/positions) changes.
 */

import { AdditiveSynth } from '../../synth/AdditiveSynth.js';
import { MasterBus } from '../../synth/MasterBus.js';
import { LoopSynth } from '../../synth/LoopSynth.js';
import { SampleLibrary } from '../../synth/SampleLibrary.js';
import { fetchSampleManifest } from '../../synth/sampleManifest.js';

const dbToLin = (db) => Math.pow(10, db / 20);
const DEFAULT_ROOT_FREQUENCY = 261.63; // C4, same default as preloadSamples

/**
 * @param {object} [opts] initial volume/compressor/panner config.
 * @returns shared synth service: { start, play, setListener, setNodePosition,
 *   clearAllNodes, setVolumeDb, setCompressor, setPanningModel, loadManifest,
 *   loops, dispose, started }
 */
export function createSpatialSynth(opts = {}) {
  let ctx = null;
  let synth = null;
  let masterBus = null;
  let loopSynth = null;
  const sampleLibrary = new SampleLibrary();
  let manifest = [];          // [{ name, file, rootFrequency? }] from samples.json
  let manifestPromise = null; // idempotence guard for loadManifest()
  let loopsEnabled = true;    // remembered so a pre-start toggle still applies
  // Node ids that have a cached panner, so clearAllNodes() can release them
  // without reaching into AdditiveSynth's private map.
  const playedNodes = new Set();

  const cfg = {
    volumeDb:      opts.volumeDb      ?? -10,
    compEnabled:   opts.compEnabled   ?? true,
    compThreshold: opts.compThreshold ?? -18,
    compRatio:     opts.compRatio     ?? 4,
    panningModel:  opts.panningModel  ?? 'HRTF',
  };

  /** Fetch the sample manifest (no AudioContext needed). Idempotent. */
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetchSampleManifest()
        .then((list) => { manifest = list; return list; })
        .catch((err) => { console.warn('[spatialSynth] sample manifest failed:', err); return []; });
    }
    return manifestPromise;
  }

  /** Create the AudioContext + synths on the first user gesture (idempotent). */
  async function start() {
    if (synth) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (_) {} }
    // One explicit master section shared by both engines: master volume lives on
    // its input gain, so it scales notes AND loop layers identically.
    masterBus = new MasterBus(ctx, { output: ctx.destination });
    masterBus.input.gain.value = dbToLin(cfg.volumeDb);
    synth = new AdditiveSynth(ctx, {
      masterBus,
      masterGain: 1.0, // submix neutral; overall level is masterBus.input
      panner: { panningModel: cfg.panningModel },
    });
    loopSynth = new LoopSynth(ctx, { masterBus, sampleLibrary });
    loopSynth.setGain(loopsEnabled ? 1 : 0);
    applyCompressor();
  }

  /**
   * Play one positioned note.
   * @param {object} spec { freq, durationMs?, gain?, adsr?, harmonics?,
   *   filter?, unison?, vibrato?, position?, nodeId? }
   */
  function play(spec) {
    if (!synth || !spec) return;
    synth.playNote({
      freq:      spec.freq,
      durationMs: spec.durationMs ?? null,
      gain:      spec.gain ?? 1.0,
      adsr:      spec.adsr,            // undefined → AdditiveSynth's default ADSR
      harmonics: spec.harmonics,       // undefined → default additive timbre
      filter:    spec.filter,          // optional per-note override (modulation matrix)
      unison:    spec.unison,          // optional per-note override
      vibrato:   spec.vibrato,         // optional per-note override
      position:  spec.position ?? null,
      nodeId:    spec.nodeId ?? null,
    });
    if (spec.nodeId != null) playedNodes.add(spec.nodeId);
  }

  // ── Persistent loop layers (ambient behaviour) ────────────────────────────
  const loops = {
    get ready() { return !!loopSynth; },

    /** Instrument names available in the manifest (for menu selects). */
    sampleNames() { return manifest.map((e) => e.name); },

    /**
     * Decode the layer's sample on demand, then start the layer (fade-in).
     * @param {object} spec LoopSynth.addLayer spec ({ instrument, gain, … })
     * @returns {Promise<number|null>} layerId, or null if synth/sample missing
     */
    async createLayer(spec) {
      if (!loopSynth || !spec?.instrument) return null;
      try {
        await loadManifest();
        const entry = manifest.find((e) => e.name === spec.instrument);
        if (!entry) return null;
        await sampleLibrary.loadInstrument({
          audioCtx: ctx,
          name: entry.name,
          url: '/samples/' + entry.file,
          rootFrequency: entry.rootFrequency ?? DEFAULT_ROOT_FREQUENCY,
        });
        return loopSynth ? loopSynth.addLayer(spec) : null;
      } catch (err) {
        console.warn(`[spatialSynth] loop layer "${spec.instrument}" failed:`, err);
        return null;
      }
    },

    ramp:   (id, param, target, ms) => loopSynth?.rampLayer(id, param, target, ms),
    set:    (id, param, value)      => loopSynth?.setLayerParam(id, param, value),
    setLFO: (id, target, lfoCfg)    => loopSynth?.setLayerLFO(id, target, lfoCfg),
    remove: (id, fadeSec)           => loopSynth?.removeLayer(id, fadeSec),

    /** Mute/unmute all layers (audio-enabled toggle; notes are gated upstream). */
    setEnabled(on) {
      loopsEnabled = !!on;
      loopSynth?.setGain(on ? 1 : 0);
    },
  };

  /** Move the listener (camera). Called every frame from the render loop. */
  function setListener(pose) { synth?.setListener(pose); }

  /** Reposition the cached panner of a node (e.g. animated graph). */
  function setNodePosition(nodeId, xyz) { synth?.setNodePosition(nodeId, xyz); }

  /** Release every per-node panner (on model swap). */
  function clearAllNodes() {
    if (synth) for (const id of playedNodes) synth.clearNode(id);
    playedNodes.clear();
  }

  function setVolumeDb(db) {
    cfg.volumeDb = db;
    if (masterBus) masterBus.input.gain.value = dbToLin(db);
  }

  function applyCompressor() {
    if (!masterBus) return;
    masterBus.setCompressor(cfg.compEnabled
      ? { threshold: cfg.compThreshold, ratio: cfg.compRatio }
      : { threshold: 0, ratio: 1 });
  }

  function setCompressor({ enabled, threshold, ratio } = {}) {
    if (enabled   != null) cfg.compEnabled   = enabled;
    if (threshold != null) cfg.compThreshold = threshold;
    if (ratio     != null) cfg.compRatio     = ratio;
    applyCompressor();
  }

  function setPanningModel(model) {
    cfg.panningModel = model;
    synth?.setPannerDefaults({ panningModel: model });
  }

  /** Release per-node panners; the AudioContext is kept alive for the session. */
  function dispose() { clearAllNodes(); }

  return {
    start, play, setListener, setNodePosition, clearAllNodes,
    setVolumeDb, setCompressor, setPanningModel, loadManifest, loops, dispose,
    get started() { return !!synth; },
  };
}
