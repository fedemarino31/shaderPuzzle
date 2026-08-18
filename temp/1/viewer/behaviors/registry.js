/**
 * registry.js – registry of behaviours ("comportamientos"). A behaviour is the
 * blueprint selected from the menu: it bundles a traversal strategy, a
 * sonification strategy, default params and a label/icon. Add a new behaviour by
 * importing its module and listing it here; the menu's behaviour selector and
 * the engine pick it up automatically.
 *
 * Vocabulary: Comportamiento (blueprint) → Intérprete (instance spawned on a
 * click, owns its walkers) → Walker (the moving token).
 */

import { classic } from './classic.js';
import { angular } from './angular.js';
import { reproductor } from './reproductor.js';
import { ambient } from './ambient.js';

const BEHAVIORS = {
  [classic.id]: classic,
  [angular.id]: angular,
  [reproductor.id]: reproductor,
  [ambient.id]: ambient,
};

/** All registered behaviours (for the menu selector). */
export function listBehaviors() {
  return Object.values(BEHAVIORS);
}

/** Resolve a behaviour by id, falling back to the classic one. */
export function getBehavior(id) {
  return BEHAVIORS[id] ?? classic;
}
