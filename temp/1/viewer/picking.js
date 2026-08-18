/**
 * picking.js – device-agnostic picking over the spatial index (spatialIndex.js).
 *
 * Two primitives cover the three planned input modalities. They take plain
 * Vector3s so the same code serves mouse, VR controller and VR hand without
 * touching the camera or framebuffer:
 *
 *   pickFromRay(origin, dir)  → nodeId | null
 *     • Mouse: Raycaster.setFromCamera(ndc, camera), pass raycaster.ray.
 *     • VR controller: origin/dir from the controller's targetRaySpace.
 *
 *   pickFromPoint(p)          → nodeId | null
 *     • VR hand: world position of the fingertip (XRHand joint).
 *
 * Both are O(log N) amortised via the BVH and independent of N.
 */

import { Raycaster, Vector2, Vector3, Matrix4 } from 'three';

/**
 * Build a picker bound to a loaded graph (with graph.spatial).
 * @param {object} graph
 */
export function createPicker(graph) {
  const spatial = graph.spatial;

  /**
   * @param {import('three').Vector3} origin
   * @param {import('three').Vector3} dir   (need not be unit length)
   * @returns {number|null} nodeId
   */
  function pickFromRay(origin, dir) {
    const id = spatial.queryRay(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z);
    return id < 0 ? null : id;
  }

  /**
   * @param {import('three').Vector3} p world-space point
   * @returns {number|null} nodeId
   */
  function pickFromPoint(p) {
    const id = spatial.queryPoint(p.x, p.y, p.z);
    return id < 0 ? null : id;
  }

  /**
   * Nearest node center within radius R of world-space point p — a tolerance
   * pick for the VR controller (fires the closest node within reach even when
   * the tip is not exactly inside the node sphere).
   * @param {import('three').Vector3} p
   * @param {number} R search radius (same units as graph.positions)
   * @returns {number|null} nodeId
   */
  function pickNearPoint(p, R) {
    const id = spatial.queryNearestWithinRadius(p.x, p.y, p.z, R);
    return id < 0 ? null : id;
  }

  return { pickFromRay, pickFromPoint, pickNearPoint };
}

// ── Mouse helper: NDC from a pointer event over a canvas, into a Raycaster ──
const _ndc = new Vector2();
const _ray = new Raycaster();
const _invMat = new Matrix4();
const _origin = new Vector3();
const _dir = new Vector3();

/**
 * Convenience for the desktop mouse path: convert a pointer event to a camera
 * ray and pick. Keeps main.js free of raycaster boilerplate.
 *
 * The BVH lives in graph-local space. When the graph is parented under a
 * transformed group (e.g. the AR scale group), pass that `group` so the
 * world-space camera ray is transformed into graph-local space before querying;
 * otherwise (identity transform) the world ray is used directly.
 *
 * @param {object} picker            from createPicker
 * @param {PointerEvent} ev
 * @param {HTMLCanvasElement} canvas
 * @param {import('three').Camera} camera
 * @param {import('three').Object3D|null} [group] graph parent group, if transformed
 * @returns {number|null} nodeId
 */
export function pickFromPointerEvent(picker, ev, canvas, camera, group = null) {
  const rect = canvas.getBoundingClientRect();
  _ndc.x =  ((ev.clientX - rect.left) / rect.width)  * 2 - 1;
  _ndc.y = -((ev.clientY - rect.top)  / rect.height) * 2 + 1;
  _ray.setFromCamera(_ndc, camera);

  let origin = _ray.ray.origin;
  let dir = _ray.ray.direction;
  if (group) {
    group.updateWorldMatrix(true, false);
    _invMat.copy(group.matrixWorld).invert();
    origin = _origin.copy(_ray.ray.origin).applyMatrix4(_invMat);
    dir = _dir.copy(_ray.ray.direction).transformDirection(_invMat);
  }
  return picker.pickFromRay(origin, dir);
}
