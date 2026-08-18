/**
 * engine.js – the "Orquesta": holds N active *interpretes*, advances each of
 * their walkers on its own hop clock, and emits a stream of TraverseEvents to
 * subscribed sinks (highlight, audio router, auto-camera). The engine knows
 * nothing about three.js or audio: it only produces events in graph terms and
 * carries each event's behaviour reference so the audio router can ask that
 * behaviour how to sonify it. See docs/plan-recorrido-sonoro.md §B.
 *
 * Vocabulary (4 levels, used the same in code and UI):
 *   - Comportamiento (behaviour): the blueprint (classic, angular) — how it moves/sounds.
 *   - Walker: the moving token that hops node to node.
 *   - Intérprete: a running instance spawned on one click; owns 1..maxWalkers
 *     walkers (a main one + children via spawnChild) and a shared budget/params.
 *   - Orquesta: the whole set of live intérpretes (this engine; the "Orquesta" panel).
 *
 * A TraverseEvent describes one step of one walker:
 *   {
 *     walkerId,     // which walker emitted it (filled by the engine)
 *     interpreteId, // which interprete it belongs to (filled by the engine)
 *     behavior,     // the emitting behaviour (filled by the engine) → sonify()
 *     params,       // the interprete's param snapshot (filled by the engine)
 *     from, to,     // nodeId origin and destination of the step
 *     edgeId,       // edge joining from→to (from adjEdgeIds), for highlighting
 *     tStart,       // engine-clock ms when the step begins (filled by the engine)
 *     duration,     // ms the step takes (= walker.hopIntervalMs)
 *     hop,          // step index of this walker (0,1,2,…)
 *     isNewVisit,   // true the first time `to` is reached (musical accent)
 *   }
 *
 * A Behaviour is `{ maxWalkers, createWalker(graph, stats, params, startNodeId,
 * ctx) → Walker, sonify(ev, ctx, params) }`, where a Walker is
 *   { hopIntervalMs:number, alive:boolean, advance(): event|null, dispose?() }.
 * `advance()` performs exactly one step and returns the event minus the fields
 * the engine fills, or null if it could not move. `dispose()`, if present, is
 * called exactly once when the walker leaves the engine for any reason (energy
 * exhausted, interprete removed, orchestra cleared) — behaviours that hold
 * external resources (e.g. a persistent LoopSynth layer) release them there.
 * The `ctx` passed to createWalker exposes `spawnChild(startNodeId,
 * extraParams)` (respecting the interprete's maxWalkers) for behaviours that
 * reproduce, and `services` — the opaque bag injected by the host (audio, …);
 * the engine itself never looks inside it.
 */

const MAX_STEPS_PER_FRAME = 64; // guard against runaway catch-up after a stall

export function createTraversalEngine(graph, stats, services = {}) {
  let clock = 0;            // engine time (ms)
  let nextInterpreteId = 1;
  let nextWalkerId = 1;
  // Bumped whenever the set of live interpretes changes (launch / finish / remove
  // / clear) so the UI can cheaply detect "walkers added or gone" without diffing
  // arrays every frame.
  let revision = 0;
  /** @type {{id:number, startNodeId:number, behavior:object, params:object,
   *          maxWalkers:number, walkers:{id:number, walker:object, acc:number}[]}[]} */
  const interpretes = [];
  const subscribers = new Set();

  /** Add a walker to an interprete, respecting its population cap. */
  function spawnWalkerInto(itp, startNodeId, params) {
    if (itp.walkers.length >= itp.maxWalkers) return null;
    const ctx = {
      interpreteId: itp.id,
      services,
      // Hook for reproducing behaviours: spawn a child sharing the cap.
      spawnChild: (childStart, extra = {}) =>
        spawnWalkerInto(itp, childStart, { ...params, ...extra }),
    };
    const walker = itp.behavior.createWalker(graph, stats, params, startNodeId, ctx);
    const id = nextWalkerId++;
    itp.walkers.push({ id, walker, acc: 0 });
    return id;
  }

  /**
   * Launch an interprete of `behavior` starting at `startNodeId`.
   * `params` is captured by reference; callers pass a snapshot.
   * @returns {number} interpreteId
   */
  function launch(behavior, startNodeId, params = {}) {
    const itp = {
      id: nextInterpreteId++,
      startNodeId,
      behavior,
      params,
      maxWalkers: behavior.maxWalkers ?? 1,
      walkers: [],
    };
    spawnWalkerInto(itp, startNodeId, params);
    interpretes.push(itp);
    revision++;
    return itp.id;
  }

  /** Subscribe a sink; returns an unsubscribe function. */
  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  /** Advance all walkers by dtMs, collect events, emit them to subscribers. */
  function update(dtMs) {
    clock += dtMs;
    const events = [];

    for (let i = interpretes.length - 1; i >= 0; i--) {
      const itp = interpretes[i];
      const ws = itp.walkers;
      // Children spawned during advance() are appended past `len`, so they
      // start next frame rather than mid-iteration.
      for (let j = ws.length - 1; j >= 0; j--) {
        const w = ws[j];
        w.acc += dtMs;
        const hop = w.walker.hopIntervalMs;
        let steps = 0;
        while (w.acc >= hop && w.walker.alive && steps < MAX_STEPS_PER_FRAME) {
          w.acc -= hop;
          steps++;
          const ev = w.walker.advance();
          if (ev) {
            ev.walkerId = w.id;
            ev.interpreteId = itp.id;
            ev.behavior = itp.behavior;
            ev.params = itp.params;
            ev.tStart = clock - w.acc; // engine time at which this step fired
            ev.duration = hop;
            events.push(ev);
          }
        }
        if (!w.walker.alive) { ws.splice(j, 1); disposeWalker(w); }
      }
      if (ws.length === 0) { interpretes.splice(i, 1); revision++; } // interprete finished
    }

    if (events.length) for (const fn of subscribers) fn(events);
    return events;
  }

  /** Release a walker's external resources (best-effort, once, on purge). */
  function disposeWalker(w) {
    try { w.walker.dispose?.(); } catch (_) {}
  }

  /** Kill all interpretes/walkers immediately (does not clear sink state). */
  function clear() {
    if (interpretes.length) revision++;
    for (const itp of interpretes) for (const w of itp.walkers) disposeWalker(w);
    interpretes.length = 0;
  }

  /** Kill a single interprete by id. @returns {boolean} whether one was removed. */
  function remove(id) {
    const i = interpretes.findIndex((itp) => itp.id === id);
    if (i < 0) return false;
    for (const w of interpretes[i].walkers) disposeWalker(w);
    interpretes.splice(i, 1);
    revision++;
    return true;
  }

  /** Lightweight projection of the live interpretes (for the UI walker list). */
  function getInterpretes() {
    return interpretes.map((itp) => ({
      id: itp.id, startNodeId: itp.startNodeId, behavior: itp.behavior, params: itp.params,
    }));
  }

  return {
    launch,
    subscribe,
    update,
    clear,
    remove,
    getInterpretes,
    get walkerCount() {
      let n = 0;
      for (const itp of interpretes) n += itp.walkers.length;
      return n;
    },
    get interpreteCount() { return interpretes.length; },
    get revision() { return revision; },
    get clock() { return clock; },
  };
}
