/**
 * xr.js – WebXR Augmented + Virtual Reality sessions for the hypergraph viewer.
 *
 * Ported (and trimmed) from the ShapeMusic VR app (src/viewer/vrExample.js):
 * keeps AR/VR session start/stop, the VR controllers, thumbstick teleportation
 * over an invisible floor plane, and controller-driven node picking. The same
 * DynamicMenu instance that drives the desktop 2D panel is also rendered in 3D
 * as a DynamicMenuVR panel (attached via `attachMenu`), toggled with the X / A
 * face button — so the menu is usable both in VR and in AR.
 *
 * Two buttons are shown: START AR (immersive-ar passthrough — no scene
 * background) and START VR (immersive-vr — keeps the configured scene background,
 * solid colour or 360 image). Neither mode draws a visible grid; the teleport
 * floor stays invisible but raycastable.
 *
 * Node firing: on trigger press (ON_RAY_STARTED) we first try the controller ray
 * against the graph BVH; if it misses, we fall back to a proximity pick around
 * the controller tip. Both queries run in graph-local space, so the world-space
 * ray/point is transformed by the inverse of the scaled graphGroup matrix first
 * — the BVH (in baked GLB units) never has to change.
 *
 * Usage:
 *   const xr = initXR({ renderer, scene, camera, getPicker, getGraphGroup, onPick });
 *   xr.attachMenu(menu);   // once the DynamicMenu instance exists (async)
 *   // inside the render loop: xr.update(time, delta);
 *
 * ───────────────────────────────────────────────────────────────────────────
 * KNOWN ISSUE — "XRWebGLBinding: parameter 1 is not of type XRSession" on START AR
 * ───────────────────────────────────────────────────────────────────────────
 * Symptom (thrown from renderer.xr.setSession, inside onSessionStarted):
 *     Uncaught (in promise) TypeError: Failed to construct 'XRWebGLBinding':
 *     parameter 1 is not of type 'XRSession'.
 *
 * Cause: this happens when testing AR on the DESKTOP with the **Immersive Web
 * Emulator** browser extension (you can't run immersive-ar on a Windows desktop
 * without it). The emulator polyfills `navigator.xr` and hands back a FAKE
 * XRSession object. But Chrome's native `XRWebGLBinding` is still present, so
 * three.js (v0.184+) takes its preferred WebXR-*layers* path and does
 * `new XRWebGLBinding(session, gl)` — and the native binding rejects the
 * emulated (non-native) session with exactly this error.
 *
 * It is NOT a bug in our AR code: three's own ARButton uses the identical
 * request→setReferenceSpaceType→setSession flow and fails the same way under the
 * emulator. On a REAL headset (Quest, etc.) the session is native and it all works.
 *
 * Fix (see `maybeDisableXRLayers` below): before setSession, if the session is
 * detected as emulated, we REPLACE the global `XRWebGLBinding` with a stub whose
 * prototype lacks `createProjectionLayer`. three computes `supportsLayers =
 * supportsGlBinding && 'createProjectionLayer' in XRWebGLBinding.prototype` at
 * setSession time, so the stub makes it false and three falls back to the older
 * `XRWebGLLayer` path, which the emulator DOES support — and the throwing
 * constructor is never reached. On real hardware the session is native, so this
 * is a no-op and the optimal layers path is preserved.
 *
 * Two earlier attempts that did NOT work (don't repeat them):
 *   1. `delete XRWebGLBinding.prototype.createProjectionLayer` — the delete can
 *      fail silently on a native prototype, so the layers path stayed active.
 *      Replacing the whole global is reliable.
 *   2. Detecting the emulator via `session instanceof XRSession` alone — some
 *      emulator builds also override the `XRSession` global, so the instanceof
 *      check passes and the session looks "native". We now also check that the
 *      `XRSession` global is itself native (`toString` contains "[native code]").
 *      Any non-native signal ⇒ treat as emulated.
 *
 * Escape hatch: if detection ever misfires again, set `FORCE_XR_WEBGL_LAYER` to
 * true to always use the XRWebGLLayer path (harmless on real hardware — it's the
 * legacy default three used for years; you only lose the projection-layers perf).
 *
 * If you see this error again: you're on the emulator (or another XR polyfill).
 * Test on a real device, flip the escape hatch, or extend the detection — do NOT
 * "fix" it by changing the session-start flow, that part is already correct.
 * ───────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

import {
  ControllersManager,
  CMEventTypes,
  XRTeleportMoveControl,
  DynamicMenuVR,
} from '../vendor/xrComponents.js';

// World-space tolerance (metres) for the proximity (contact) pick.
const PROXIMITY_RADIUS_M = 0.05;

// Background restored when an AR session ends (matches viewer.html / main.js).
const DESKTOP_BG = 0x0d0d0f;

/**
 * Wire up AR for the viewer.
 * @param {object} ctx
 * @param {THREE.WebGLRenderer} ctx.renderer
 * @param {THREE.Scene} ctx.scene
 * @param {THREE.Camera} ctx.camera
 * @param {() => (object|null)} ctx.getPicker        current picker (createPicker) or null
 * @param {() => (THREE.Group|null)} ctx.getGraphGroup scaled group holding the graph, or null
 * @param {(nodeId:number) => void} ctx.onPick       called with the fired node id
 * @param {() => void} [ctx.restoreBackground]       restore desktop background on session end
 * @returns {{ update(time:number, delta:number):void }}
 */
export function initXR(ctx) {
  const { renderer, scene } = ctx;

  renderer.xr.enabled = true;

  const env = buildXREnvironment(scene);

  // Which immersive mode the live session was started in ('immersive-ar' |
  // 'immersive-vr' | null). Set by the button before setSession so the
  // 'sessionstart' handler below can branch (AR = passthrough, VR = keep bg).
  let activeMode = null;

  let controllersManager = null;
  let xrTeleportMoveControl = null;

  // ── AR + VR buttons (own implementation: forces 'local-floor' before setSession) ──
  if (navigator.xr) {
    const onModeStart = (mode) => { activeMode = mode; };
    document.body.appendChild(createXRButton(renderer, {
      mode: 'immersive-ar', label: 'AR', left: 'calc(50% - 110px)', onModeStart,
    }));
    document.body.appendChild(createXRButton(renderer, {
      mode: 'immersive-vr', label: 'VR', left: 'calc(50% + 10px)', onModeStart,
    }));
  } else {
    console.warn('[xr] navigator.xr unavailable — AR/VR buttons not shown');
  }

  // ── Controllers + teleport (created once; survive across sessions) ──
  controllersManager = new ControllersManager(renderer.xr, scene);
  xrTeleportMoveControl = new XRTeleportMoveControl(renderer.xr, controllersManager, scene);
  xrTeleportMoveControl.setTeleportSurfaces(env.floor.geometry);

  // ── VR/AR menu panel: the SAME DynamicMenu that drives the desktop 2D panel is
  // rendered here as a 3D panel via DynamicMenuVR (CanvasRenderer → CanvasTexture).
  // State and pointer interaction are shared, so configuring it in VR/AR also
  // updates the desktop view and vice-versa. Attached lazily because the menu is
  // created asynchronously (createMenu) after initXR runs.
  let vrMenu = null;

  function attachMenu(menu) {
    if (vrMenu || !menu) return;
    // 'panel' mode floats the menu in front of the headset; rendererScale=2 keeps
    // the canvas text crisp at reading distance.
    vrMenu = new DynamicMenuVR(menu, scene, controllersManager, {
      mode: 'panel',
      rendererScale: 2,
    });
    // VRMenu unconditionally adds a small debug AxesHelper to its container — drop it.
    for (const c of [...vrMenu.mesh.children]) {
      if (c.type === 'AxesHelper') vrMenu.mesh.remove(c);
    }
    // VRMenu only parents its container on left-controller-connect; add it now too
    // so the panel exists in the graph regardless of which controllers connect.
    scene.add(vrMenu.mesh);
    vrMenu.setVisible(false);   // hidden until the user opens it with X / A
  }

  // X (left) / A (right) face button toggles the menu, repositioning it in front
  // of the headset on each open.
  controllersManager.addEventListener(CMEventTypes.ON_BUTTON_DOWN, (e) => {
    if (vrMenu && (e.button === 'ButtonX' || e.button === 'ButtonA')) {
      vrMenu.toggleVisibility();
    }
  });

  // ── Trigger → node pick ──
  const _invMat = new THREE.Matrix4();
  const _origin = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _ctrlPos = new THREE.Vector3();

  controllersManager.addEventListener(CMEventTypes.ON_RAY_STARTED, (e) => {
    const picker = ctx.getPicker?.();
    const group = ctx.getGraphGroup?.();
    if (!picker || !group) return;

    group.updateWorldMatrix(true, false);
    _invMat.copy(group.matrixWorld).invert();

    // 1) Ray pick: world ray → graph-local space.
    _origin.copy(e.ray.origin).applyMatrix4(_invMat);
    _dir.copy(e.ray.direction).transformDirection(_invMat);
    let id = picker.pickFromRay(_origin, _dir);

    // 2) Proximity fallback: controller tip world position → graph-local space.
    if (id == null) {
      const ctrl = controllersManager.getController(e.handedness);
      if (ctrl) {
        ctrl.controller.getWorldPosition(_ctrlPos).applyMatrix4(_invMat);
        // Convert the world-space tolerance into local units (group is uniformly scaled).
        const localR = PROXIMITY_RADIUS_M / (group.scale.x || 1);
        id = picker.pickNearPoint(_ctrlPos, localR);
      }
    }

    if (id != null) ctx.onPick(id);
  });

  // ── Session lifecycle: teleport floor visible only in-session ──
  // AR  → passthrough: clear the background so the camera feed shows through.
  // VR  → keep whatever background is configured (solid colour or 360 image),
  //       so the scene has the same backdrop the desktop view does.
  renderer.xr.addEventListener('sessionstart', () => {
    if (activeMode === 'immersive-ar') {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    } else {
      // VR: leave scene.background as configured (set by the viewer's
      // applyBackground — solid colour or loaded PNG/equirect at this moment).
      renderer.setClearColor(0x000000, 1);
    }
    env.setVisible(true);
  });
  renderer.xr.addEventListener('sessionend', () => {
    // Restore the desktop backdrop. Prefer the viewer's own restore (keeps the
    // configured background/IBL); fall back to the flat desktop colour.
    if (ctx.restoreBackground) {
      ctx.restoreBackground();
    } else {
      scene.background = new THREE.Color(DESKTOP_BG);
    }
    renderer.setClearColor(DESKTOP_BG, 1);
    env.setVisible(false);
    vrMenu?.setVisible(false);   // don't leave the panel open into the next session
    activeMode = null;
  });

  return {
    attachMenu,
    update(time, delta) {
      controllersManager.update(time, delta);
      xrTeleportMoveControl.update(delta);
    },
  };
}

// ─── XR environment (invisible teleport floor + lights) ───────────────────────
// Hidden until a session starts so the desktop view is untouched. No visible grid
// is drawn (it looks bad in AR/VR); the floor stays invisible but is real geometry
// so XRTeleportMoveControl can raycast against it for teleportation.
function buildXREnvironment(scene) {
  // Invisible plane: XRTeleportMoveControl needs real geometry to raycast.
  const floorGeo = new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ visible: false }));
  floor.name = 'floor';

  const hemi = new THREE.HemisphereLight(0xaaccff, 0x442244, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(2, 4, 3);

  const objects = [floor, hemi, dir];
  for (const o of objects) {
    o.visible = false;
    scene.add(o);
  }

  return {
    floor,
    setVisible(v) {
      for (const o of objects) o.visible = v;
    },
  };
}

// ─── AR / VR button ────────────────────────────────────────────────────────────
// three's ARButton forces setReferenceSpaceType('local'); we want 'local-floor'
// (origin at the physical floor) and it must be set BEFORE setSession because
// XRTeleportMoveControl reads getReferenceSpace() synchronously on sessionstart.
// Generalised so the same flow drives both 'immersive-ar' and 'immersive-vr';
// `onModeStart(mode)` lets initXR record which mode the live session is in.
function createXRButton(renderer, { mode, label, left, onModeStart }) {
  const button = document.createElement('button');
  const overlay = document.createElement('div');
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  // dom-overlay only matters for AR passthrough UI; harmless to omit for VR.
  const sessionInit = mode === 'immersive-ar'
    ? {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking', 'dom-overlay'],
        domOverlay: { root: overlay },
      }
    : {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking'],
      };

  let currentSession = null;

  async function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);
    onModeStart?.(mode);                       // tell initXR which mode is live
    renderer.xr.setReferenceSpaceType('local-floor');
    maybeDisableXRLayers(session);
    await renderer.xr.setSession(session);
    button.textContent = `STOP ${label}`;
    overlay.style.display = '';
    currentSession = session;
  }

  function onSessionEnded() {
    currentSession?.removeEventListener('end', onSessionEnded);
    button.textContent = `START ${label}`;
    overlay.style.display = 'none';
    currentSession = null;
  }

  button.textContent = `START ${label}`;
  button.style.cssText =
    `position:fixed;bottom:20px;left:${left};width:100px;padding:12px 6px;` +
    'border:1px solid #fff;border-radius:4px;background:rgba(0,0,0,0.1);color:#fff;' +
    'font:normal 13px sans-serif;text-align:center;outline:none;z-index:999;cursor:pointer;';

  // Disable the button if this immersive mode isn't supported on this device.
  navigator.xr.isSessionSupported?.(mode).then((ok) => {
    if (!ok) {
      button.disabled = true;
      button.title = `${label} not supported on this device`;
      button.style.opacity = '0.4';
      button.style.cursor = 'not-allowed';
    }
  }).catch(() => {});

  button.onclick = () => {
    if (currentSession === null) {
      navigator.xr.requestSession(mode, sessionInit).then(onSessionStarted);
    } else {
      currentSession.end();
    }
  };

  return button;
}

// Set to true to ALWAYS use the XRWebGLLayer path (skip auto-detection). Harmless
// on real hardware — it's the legacy path three used by default for years — and a
// guaranteed escape hatch if the emulator detection below ever misfires again.
const FORCE_XR_WEBGL_LAYER = false;

// Is `fn` a native (browser-implemented) constructor/function? Native functions
// stringify with "[native code]"; a polyfill/emulator's JS function does not.
function isNativeFn(fn) {
  return typeof fn === 'function' && /\[native code\]/.test(Function.prototype.toString.call(fn));
}

// When testing with the Immersive Web Emulator (desktop), `navigator.xr` returns a
// *polyfilled* session that the NATIVE `XRWebGLBinding` rejects. three's preferred
// WebXR-layers path does `new XRWebGLBinding(session, gl)` → it throws
// "parameter 1 is not of type XRSession" inside renderer.xr.setSession.
//
// Fix: force three onto the older `XRWebGLLayer` path (which the emulator supports)
// by replacing the global `XRWebGLBinding` with a stub whose prototype lacks
// `createProjectionLayer`. three computes `supportsLayers = supportsGlBinding &&
// 'createProjectionLayer' in XRWebGLBinding.prototype` at setSession time, so the
// stub makes it false and the layers branch (and the throwing constructor) is
// skipped entirely. We replace the global rather than `delete`-ing the method
// because the prototype delete proved unreliable.
//
// Detection must catch BOTH emulator variants: some override the `XRSession`
// global (so it's non-native), others keep the native global but hand back a
// session that isn't an instance of it. Either signal ⇒ treat as emulated. On a
// real headset both checks pass ⇒ no-op, optimal layers path preserved.
function maybeDisableXRLayers(session) {
  let emulated = FORCE_XR_WEBGL_LAYER;
  if (!emulated) {
    const hasXRSession = typeof XRSession !== 'undefined';
    emulated = !hasXRSession || !isNativeFn(XRSession) || !(session instanceof XRSession);
  }
  if (!emulated) return;                                   // real device — keep layers path
  if (typeof XRWebGLBinding === 'undefined') return;       // no native binding ⇒ nothing to dodge
  if (!('createProjectionLayer' in XRWebGLBinding.prototype)) return; // already neutralised

  const Stub = function XRWebGLBindingStub() {};           // prototype has no createProjectionLayer
  try {
    // eslint-disable-next-line no-global-assign
    window.XRWebGLBinding = Stub;
    console.warn('[xr] emulated/forced XRSession — using XRWebGLLayer fallback (no projection layers)');
  } catch (err) {
    console.error('[xr] could not install XRWebGLLayer fallback:', err);
  }
}
