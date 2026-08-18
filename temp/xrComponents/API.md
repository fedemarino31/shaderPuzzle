# XRComponents - API

Reusable WebXR components for [Three.js](https://threejs.org/): controller
management, locomotion, grabbable objects, interactive VR surfaces, VR menus,
and AR-ready helpers.

> This file is generated from source-code JSDoc comments (`npm run docs`).
> The **Getting Started** section below is maintained manually in
> `scripts/api-intro.md`; the rest is generated from the exported classes.
>
> A navigable HTML version is also generated in `docs-html/`.

## Getting Started

### Installation

The library bundle externalizes `three`, so your application must provide it as
a peer dependency:

```bash
npm install three
```

Then import the generated bundle from `dist-lib/xrComponents.js`.

### Import

All public classes, events, helpers, and options are imported from the bundle.
The detailed reference below is generated from the source code.

```js
import {
  ControllersManager,
  CMEventTypes,
  XRTeleportMoveControl,
} from './dist-lib/xrComponents.js';
```

### Minimal Example

```js
import * as THREE from 'three';
import { ControllersManager, CMEventTypes } from './dist-lib/xrComponents.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
// Add your XR session button, for example Three.js VRButton.

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);

// 1) Create the controller manager singleton.
const controllers = new ControllersManager(renderer.xr, scene);

// 2) Listen to unified events from both hands.
controllers.addEventListener(CMEventTypes.ON_SELECT_START, (e) => {
  console.log('trigger pressed by', e.handedness, 'ray:', e.ray);
});

// 3) Call update() on every XR render-loop frame.
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const deltaTime = clock.getDelta();
  const time = clock.elapsedTime;
  controllers.update(time, deltaTime);
  renderer.render(scene, camera);
});
```

For locomotion, instantiate `XRTeleportMoveControl`, register walkable surfaces
with `setTeleportSurfaces(...)`, and call its `update()` method inside the same
render loop. For grabbable objects, wrap a `THREE.Object3D` with
`GrabbableVRObject`. Each class and method is documented in detail below.

---

## Modules

<dl>
<dt><a href="#module_ControllersManager">ControllersManager</a></dt>
<dd><p>Provides the main entry point for WebXR controller input. The module exports
<a href="ControllersManager">ControllersManager</a>, a singleton that creates the two hand controllers,
normalizes their low-level WebXR events, and re-emits them through a single
event dispatcher.</p>
</dd>
<dt><a href="#module_HandController">HandController</a></dt>
<dd><p>Low-level wrapper around one WebXR hand controller. Most applications should
use <a href="ControllersManager">ControllersManager</a>, which creates and coordinates two
<code>HandController</code> instances.</p>
</dd>
<dt><a href="#module_HandTrackingManager">HandTrackingManager</a></dt>
<dd><p>Adds WebXR hand-tracking support on top of Three.js hand helpers, including
pinch events, pointer rays, optional hand-flight gestures, and triangle or
single-hand pinch-aim teleport gestures.</p>
</dd>
<dt><a href="#module_XRControllerLabelHelper">XRControllerLabelHelper</a></dt>
<dd><p>Builds floating text labels and leader lines for WebXR controller model
components such as triggers, grips, thumbsticks, and face buttons.</p>
</dd>
<dt><a href="#module_XRTeleportMoveControl">XRTeleportMoveControl</a></dt>
<dd><p>Handles headset locomotion for WebXR scenes: controller teleportation,
snap rotation, and optional thumbstick-driven continuous movement.</p>
</dd>
<dt><a href="#module_GrabbableVRObject">GrabbableVRObject</a></dt>
<dd><p>Makes application-owned Three.js objects grabbable in VR, with contact grab,
remote grab, snap targets, return behavior, and release intent events.</p>
</dd>
<dt><a href="#module_HtmlMenuVR">HtmlMenuVR</a></dt>
<dd><p>Renders an existing HTML element into a VR menu panel by rasterizing the DOM
into a Three.js texture.</p>
</dd>
<dt><a href="#module_UILMenuVR">UILMenuVR</a></dt>
<dd><p>Renders a UIL canvas UI into a VR menu panel and forwards VR pointer events
back to the UIL interaction layer.</p>
</dd>
<dt><a href="#module_VRMenu">VRMenu</a></dt>
<dd><p>Base class for rectangular VR menu panels that can be shown in front of the
user or attached to a controller, with optional direct manipulation.</p>
</dd>
<dt><a href="#module_VRButtonControl">VRButtonControl</a></dt>
<dd><p>Adds direct-touch button behavior to app-owned Three.js objects.</p>
</dd>
<dt><a href="#module_VRRotaryControl">VRRotaryControl</a></dt>
<dd><p>Adds constrained rotary/knob behavior to app-owned Three.js objects.</p>
</dd>
<dt><a href="#module_VRLeverControl">VRLeverControl</a></dt>
<dd><p>Semantic one-axis lever built on top of <a href="VRRotaryControl">VRRotaryControl</a>.</p>
</dd>
<dt><a href="#module_VRInteractiveSurface">VRInteractiveSurface</a></dt>
<dd><p>Provides geometry-agnostic controller ray interaction for app-owned
UV-mapped meshes.</p>
</dd>
<dt><a href="#module_CanvasInteractiveSurface">CanvasInteractiveSurface</a></dt>
<dd><p>Maps controller ray hits on a UV-mapped mesh into canvas pixel coordinates and
optional command hit zones.</p>
</dd>
<dt><a href="#module_VRGuidePanel">VRGuidePanel</a></dt>
<dd><p>Provides a canvas-rendered tutorial/wizard panel for XR scenes, with step
navigation, command hit zones, audio, language changes, and completion flow.</p>
</dd>
<dt><a href="#module_DynamicMenuVR">DynamicMenuVR</a></dt>
<dd><p>Renders a DynamicMenu instance directly to a canvas texture for fast,
frequently-updated VR menus.</p>
</dd>
<dt><a href="#module_XRSessionModeButton">XRSessionModeButton</a></dt>
<dd><p>Provides a small DOM button that starts and ends WebXR immersive VR or AR
sessions using a Three.js renderer.</p>
</dd>
<dt><a href="#module_ARRealWorldHitTestManager">ARRealWorldHitTestManager</a></dt>
<dd><p>Provides an event-driven wrapper around WebXR real-world hit testing. Use it
in immersive AR sessions to convert raw <code>XRHitTestResult</code> objects into
normalized Three.js-friendly placement data.</p>
</dd>
<dt><a href="#module_ARPlacementReticle">ARPlacementReticle</a></dt>
<dd><p>Exports a lightweight Three.js reticle for previewing where AR content will
be placed on a real-world hit-test result.</p>
</dd>
<dt><a href="#module_ARWorldSurfaceProvider">ARWorldSurfaceProvider</a></dt>
<dd><p>Converts AR hit-test events into a stable &quot;current surface&quot; object that can
be consumed by placement, anchoring, or UI systems.</p>
</dd>
<dt><a href="#module_XRAnchorManager">XRAnchorManager</a></dt>
<dd><p>Maintains WebXR anchors and optionally keeps attached Three.js objects aligned
with those anchors as tracking updates.</p>
</dd>
<dt><a href="#module_ARDepthOcclusionManager">ARDepthOcclusionManager</a></dt>
<dd><p>Wraps WebXR depth-sensing access and exposes a small state/event API for AR
scenes that need real-world depth awareness.</p>
</dd>
<dt><a href="#module_XRInteractionModeAdapter">XRInteractionModeAdapter</a></dt>
<dd><p>Detects whether the current XR session is using world-space controllers,
screen-space input, or pointer fallback input, then exposes consistent select
events and ray helpers.</p>
</dd>
</dl>

## Objects

<dl>
<dt><a href="#UIL">UIL</a> : <code>object</code></dt>
<dd><p>Re-export of the vendored UIL library used by <a href="UILMenuVR">UILMenuVR</a>. Consumers that
build UIL panels for UILMenuVR must use this same instance.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#createMenu">createMenu(menuContainer, [options])</a> ⇒ <code>object</code></dt>
<dd><p>Factory function that creates a DynamicMenu instance and mounts it into the
provided container element. The returned object is passed to <a href="DynamicMenuVR">DynamicMenuVR</a>
to render the menu inside a WebXR scene.</p>
</dd>
</dl>

<a name="module_ControllersManager"></a>

## ControllersManager
Provides the main entry point for WebXR controller input. The module exports[ControllersManager](ControllersManager), a singleton that creates the two hand controllers,normalizes their low-level WebXR events, and re-emits them through a singleevent dispatcher.


* [ControllersManager](#module_ControllersManager)
    * [.ControllersManager](#module_ControllersManager.ControllersManager) ⇐ <code>EventsDispatcher</code>
        * [new exports.ControllersManager(xr, parentContainer, options)](#new_module_ControllersManager.ControllersManager_new)
        * [.xr](#module_ControllersManager.ControllersManager+xr) : <code>THREE.WebXRManager</code>
        * [.controller0](#module_ControllersManager.ControllersManager+controller0) : <code>HandController</code>
        * [.controller1](#module_ControllersManager.ControllersManager+controller1) : <code>HandController</code>
        * [.handTrackingManager](#module_ControllersManager.ControllersManager+handTrackingManager) : <code>HandTrackingManager</code> \| <code>null</code>
        * [.userHandedness](#module_ControllersManager.ControllersManager+userHandedness)
        * [.parentContainer](#module_ControllersManager.ControllersManager+parentContainer)
        * [.options](#module_ControllersManager.ControllersManager+options) : <code>object</code>
        * [.connected](#module_ControllersManager.ControllersManager+connected) : <code>boolean</code>
        * [.skilledHand](#module_ControllersManager.ControllersManager+skilledHand) : <code>HandController</code>
        * [.otherHand](#module_ControllersManager.ControllersManager+otherHand) : <code>HandController</code>
        * [.right](#module_ControllersManager.ControllersManager+right) : <code>HandController</code> \| <code>null</code>
        * [.left](#module_ControllersManager.ControllersManager+left) : <code>HandController</code> \| <code>null</code>
        * [.getController(hand)](#module_ControllersManager.ControllersManager+getController) ⇒ <code>HandController</code> \| <code>undefined</code>
        * [.getDistanceBetweenHands()](#module_ControllersManager.ControllersManager+getDistanceBetweenHands) ⇒ <code>number</code> \| <code>null</code>
        * [.getCenterPointBetweenHands()](#module_ControllersManager.ControllersManager+getCenterPointBetweenHands) ⇒ <code>THREE.Vector3</code> \| <code>null</code>
        * [.update(time, deltaTime)](#module_ControllersManager.ControllersManager+update)
        * [.enableHandTracking([options])](#module_ControllersManager.ControllersManager+enableHandTracking) ⇒ <code>HandTrackingManager</code>
        * [.toggleHandedness([handedness])](#module_ControllersManager.ControllersManager+toggleHandedness)
        * [.getHeadsetTransform()](#module_ControllersManager.ControllersManager+getHeadsetTransform) ⇒ <code>Object</code>
        * [._exportEvent(origin, externalType, internalType)](#module_ControllersManager.ControllersManager+_exportEvent)
        * [._setupEventListeners()](#module_ControllersManager.ControllersManager+_setupEventListeners)
        * [._onControllerConnected(controller, event)](#module_ControllersManager.ControllersManager+_onControllerConnected)
        * [._onControllerDisconnected(controller, event)](#module_ControllersManager.ControllersManager+_onControllerDisconnected)
        * [._onControllerSqueezeStart(hc, event)](#module_ControllersManager.ControllersManager+_onControllerSqueezeStart)
        * [._onControllerSqueezeEnd(controller, event)](#module_ControllersManager.ControllersManager+_onControllerSqueezeEnd)
    * [.EventTypes](#module_ControllersManager.EventTypes) : <code>enum</code>

<a name="module_ControllersManager.ControllersManager"></a>

### ControllersManager.ControllersManager ⇐ <code>EventsDispatcher</code>
Singleton manager that owns both VR hand controllers and aggregates theirevents into a single, uniform event surface.Internally it creates two [HandController](HandController) instances (`controller0` /`controller1`) and proxies all of their events as [EventTypes](EventTypes) valuesso consumers only need to listen to this one object.Because only one headset is ever active at a time the constructor enforces asingleton pattern — calling `new ControllersManager(…)` a second time returnsthe existing instance.

**Kind**: static class of [<code>ControllersManager</code>](#module_ControllersManager)  
**Extends**: <code>EventsDispatcher</code>  

* [.ControllersManager](#module_ControllersManager.ControllersManager) ⇐ <code>EventsDispatcher</code>
    * [new exports.ControllersManager(xr, parentContainer, options)](#new_module_ControllersManager.ControllersManager_new)
    * [.xr](#module_ControllersManager.ControllersManager+xr) : <code>THREE.WebXRManager</code>
    * [.controller0](#module_ControllersManager.ControllersManager+controller0) : <code>HandController</code>
    * [.controller1](#module_ControllersManager.ControllersManager+controller1) : <code>HandController</code>
    * [.handTrackingManager](#module_ControllersManager.ControllersManager+handTrackingManager) : <code>HandTrackingManager</code> \| <code>null</code>
    * [.userHandedness](#module_ControllersManager.ControllersManager+userHandedness)
    * [.parentContainer](#module_ControllersManager.ControllersManager+parentContainer)
    * [.options](#module_ControllersManager.ControllersManager+options) : <code>object</code>
    * [.connected](#module_ControllersManager.ControllersManager+connected) : <code>boolean</code>
    * [.skilledHand](#module_ControllersManager.ControllersManager+skilledHand) : <code>HandController</code>
    * [.otherHand](#module_ControllersManager.ControllersManager+otherHand) : <code>HandController</code>
    * [.right](#module_ControllersManager.ControllersManager+right) : <code>HandController</code> \| <code>null</code>
    * [.left](#module_ControllersManager.ControllersManager+left) : <code>HandController</code> \| <code>null</code>
    * [.getController(hand)](#module_ControllersManager.ControllersManager+getController) ⇒ <code>HandController</code> \| <code>undefined</code>
    * [.getDistanceBetweenHands()](#module_ControllersManager.ControllersManager+getDistanceBetweenHands) ⇒ <code>number</code> \| <code>null</code>
    * [.getCenterPointBetweenHands()](#module_ControllersManager.ControllersManager+getCenterPointBetweenHands) ⇒ <code>THREE.Vector3</code> \| <code>null</code>
    * [.update(time, deltaTime)](#module_ControllersManager.ControllersManager+update)
    * [.enableHandTracking([options])](#module_ControllersManager.ControllersManager+enableHandTracking) ⇒ <code>HandTrackingManager</code>
    * [.toggleHandedness([handedness])](#module_ControllersManager.ControllersManager+toggleHandedness)
    * [.getHeadsetTransform()](#module_ControllersManager.ControllersManager+getHeadsetTransform) ⇒ <code>Object</code>
    * [._exportEvent(origin, externalType, internalType)](#module_ControllersManager.ControllersManager+_exportEvent)
    * [._setupEventListeners()](#module_ControllersManager.ControllersManager+_setupEventListeners)
    * [._onControllerConnected(controller, event)](#module_ControllersManager.ControllersManager+_onControllerConnected)
    * [._onControllerDisconnected(controller, event)](#module_ControllersManager.ControllersManager+_onControllerDisconnected)
    * [._onControllerSqueezeStart(hc, event)](#module_ControllersManager.ControllersManager+_onControllerSqueezeStart)
    * [._onControllerSqueezeEnd(controller, event)](#module_ControllersManager.ControllersManager+_onControllerSqueezeEnd)

<a name="new_module_ControllersManager.ControllersManager_new"></a>

#### new exports.ControllersManager(xr, parentContainer, options)

| Param | Type | Description |
| --- | --- | --- |
| xr | <code>THREE.WebXRManager</code> | The WebXR manager from `renderer.xr`. |
| parentContainer | <code>THREE.Group</code> | Scene node that controller meshes are attached to. |
| options | <code>object</code> | Optional configuration object. |

**Example**  
```js
const cm = new ControllersManager(renderer.xr, scene, {});cm.addEventListener(EventTypes.ON_RAY_STARTED, (e) => {  console.log(e.handedness, e.ray);});
```
<a name="module_ControllersManager.ControllersManager+xr"></a>

#### controllersManager.xr : <code>THREE.WebXRManager</code>
**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+controller0"></a>

#### controllersManager.controller0 : <code>HandController</code>
**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+controller1"></a>

#### controllersManager.controller1 : <code>HandController</code>
**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+handTrackingManager"></a>

#### controllersManager.handTrackingManager : <code>HandTrackingManager</code> \| <code>null</code>
**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+userHandedness"></a>

#### controllersManager.userHandedness
Dominant hand — `'right'` by default. @type {'left'|'right'}

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+parentContainer"></a>

#### controllersManager.parentContainer
THREE.Group that controller meshes are added to. @type {THREE.Group}

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+options"></a>

#### controllersManager.options : <code>object</code>
**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+connected"></a>

#### controllersManager.connected : <code>boolean</code>
`true` when both controllers are physically connected.

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+skilledHand"></a>

#### controllersManager.skilledHand : <code>HandController</code>
The controller assigned to the dominant hand (see [userHandedness](userHandedness)).

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+otherHand"></a>

#### controllersManager.otherHand : <code>HandController</code>
The controller assigned to the non-dominant hand.

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+right"></a>

#### controllersManager.right : <code>HandController</code> \| <code>null</code>
The right-hand controller, or `null` if not yet connected.

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+left"></a>

#### controllersManager.left : <code>HandController</code> \| <code>null</code>
The left-hand controller, or `null` if not yet connected.

**Kind**: instance property of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+getController"></a>

#### controllersManager.getController(hand) ⇒ <code>HandController</code> \| <code>undefined</code>
Returns the controller for the given hand.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type |
| --- | --- |
| hand | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | 

<a name="module_ControllersManager.ControllersManager+getDistanceBetweenHands"></a>

#### controllersManager.getDistanceBetweenHands() ⇒ <code>number</code> \| <code>null</code>
Returns the world-space distance between the two controller grips,or `null` if either controller is missing.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+getCenterPointBetweenHands"></a>

#### controllersManager.getCenterPointBetweenHands() ⇒ <code>THREE.Vector3</code> \| <code>null</code>
Returns the world-space midpoint between the two controller grips,or `null` if either controller is missing.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+update"></a>

#### controllersManager.update(time, deltaTime)
Must be called every animation frame. Forwards the call to bothcontrollers and dispatches [EventTypes.ON_UPDATE](EventTypes.ON_UPDATE).

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type | Description |
| --- | --- | --- |
| time | <code>number</code> | Elapsed time in seconds since session start. |
| deltaTime | <code>number</code> | Time in seconds since the last frame. |

<a name="module_ControllersManager.ControllersManager+enableHandTracking"></a>

#### controllersManager.enableHandTracking([options]) ⇒ <code>HandTrackingManager</code>
Enables native WebXR hand tracking through Three.js helpers.Pinch start/end events are re-emitted as squeeze start/end events soexisting GrabbableVRObject instances can work with hands without changingtheir construction code.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type | Default |
| --- | --- | --- |
| [options] | <code>object</code> | <code>{}</code> | 

<a name="module_ControllersManager.ControllersManager+toggleHandedness"></a>

#### controllersManager.toggleHandedness([handedness])
Switches the dominant hand. Pass `'left'` or `'right'` to set explicitly,or omit the argument to toggle from the current value.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type |
| --- | --- |
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | 

<a name="module_ControllersManager.ControllersManager+getHeadsetTransform"></a>

#### controllersManager.getHeadsetTransform() ⇒ <code>Object</code>
Returns the headset's current position and forward direction in world space.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+_exportEvent"></a>

#### controllersManager.\_exportEvent(origin, externalType, internalType)
Proxies an event from a child dispatcher while preserving the original typein `internalType`.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type | Description |
| --- | --- | --- |
| origin | <code>EventsDispatcher</code> | Source dispatcher to listen to. |
| externalType | <code>string</code> | Event type emitted by this manager. |
| internalType | <code>string</code> | Event type emitted by the child dispatcher. |

<a name="module_ControllersManager.ControllersManager+_setupEventListeners"></a>

#### controllersManager.\_setupEventListeners()
Registers listeners on both HandController instances and re-emits theirevents through the ControllersManager event surface.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  
<a name="module_ControllersManager.ControllersManager+_onControllerConnected"></a>

#### controllersManager.\_onControllerConnected(controller, event)
Handles a hand controller connection and dispatches a left/right specific event.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type |
| --- | --- |
| controller | <code>HandController</code> | 
| event | <code>object</code> | 

<a name="module_ControllersManager.ControllersManager+_onControllerDisconnected"></a>

#### controllersManager.\_onControllerDisconnected(controller, event)
Handles a hand controller disconnection and dispatches a left/right specific event.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type |
| --- | --- |
| controller | <code>HandController</code> | 
| event | <code>object</code> | 

<a name="module_ControllersManager.ControllersManager+_onControllerSqueezeStart"></a>

#### controllersManager.\_onControllerSqueezeStart(hc, event)
Tracks squeeze start and emits the double-squeeze event when both handsare squeezing simultaneously.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type |
| --- | --- |
| hc | <code>HandController</code> | 
| event | <code>object</code> | 

<a name="module_ControllersManager.ControllersManager+_onControllerSqueezeEnd"></a>

#### controllersManager.\_onControllerSqueezeEnd(controller, event)
Tracks squeeze release and emits the double-squeeze end event when thetwo-handed gesture is no longer active.

**Kind**: instance method of [<code>ControllersManager</code>](#module_ControllersManager.ControllersManager)  

| Param | Type |
| --- | --- |
| controller | <code>HandController</code> | 
| event | <code>object</code> | 

<a name="module_ControllersManager.EventTypes"></a>

### ControllersManager.EventTypes : <code>enum</code>
Event type constants dispatched by [ControllersManager](ControllersManager).

**Kind**: static enum of [<code>ControllersManager</code>](#module_ControllersManager)  
<a name="module_HandController"></a>

## HandController
Low-level wrapper around one WebXR hand controller. Most applications shoulduse [ControllersManager](ControllersManager), which creates and coordinates two`HandController` instances.

<a name="module_HandController.EventTypes"></a>

### HandController.EventTypes : <code>enum</code>
Event type constants dispatched by [HandController](HandController).

**Kind**: static enum of [<code>HandController</code>](#module_HandController)  
<a name="module_HandTrackingManager"></a>

## HandTrackingManager
Adds WebXR hand-tracking support on top of Three.js hand helpers, including
pinch events, pointer rays, optional hand-flight gestures, and triangle or
single-hand pinch-aim teleport gestures.


* [HandTrackingManager](#module_HandTrackingManager)
    * [.HandTrackingManager](#module_HandTrackingManager.HandTrackingManager) ⇐ <code>EventsDispatcher</code>
        * [new exports.HandTrackingManager(xr, parentContainer, [options])](#new_module_HandTrackingManager.HandTrackingManager_new)
        * [.xr](#module_HandTrackingManager.HandTrackingManager+xr) : <code>THREE.WebXRManager</code>
        * [.parentContainer](#module_HandTrackingManager.HandTrackingManager+parentContainer) : <code>THREE.Object3D</code>
        * [.options](#module_HandTrackingManager.HandTrackingManager+options) : <code>object</code>
        * [.hand0](#module_HandTrackingManager.HandTrackingManager+hand0) : <code>TrackedHand</code>
        * [.hand1](#module_HandTrackingManager.HandTrackingManager+hand1) : <code>TrackedHand</code>
        * [.hands](#module_HandTrackingManager.HandTrackingManager+hands) : <code>Array.&lt;TrackedHand&gt;</code>
        * [.left](#module_HandTrackingManager.HandTrackingManager+left) : <code>TrackedHand</code> \| <code>null</code>
        * [.right](#module_HandTrackingManager.HandTrackingManager+right) : <code>TrackedHand</code> \| <code>null</code>
        * [.teleportIsActive](#module_HandTrackingManager.HandTrackingManager+teleportIsActive)
        * [.getHand(handedness)](#module_HandTrackingManager.HandTrackingManager+getHand) ⇒ <code>TrackedHand</code> \| <code>null</code>
        * [.update(time, [deltaTime])](#module_HandTrackingManager.HandTrackingManager+update) ⇒ <code>void</code>
        * [.setTeleportGestureMode(mode)](#module_HandTrackingManager.HandTrackingManager+setTeleportGestureMode)
        * [.setLocomotionMode(mode)](#module_HandTrackingManager.HandTrackingManager+setLocomotionMode)
    * [.EventTypes](#module_HandTrackingManager.EventTypes) : <code>enum</code>
    * [.HAND_TELEPORT_PREVIEW_DELAY](#module_HandTrackingManager.HAND_TELEPORT_PREVIEW_DELAY)

<a name="module_HandTrackingManager.HandTrackingManager"></a>

### HandTrackingManager.HandTrackingManager ⇐ <code>EventsDispatcher</code>
Wraps Three.js WebXR hand tracking helpers and exposes hand events through
the same object shape used by GrabbableVRObject controller interactions.

Three.js owns the low-level joint tracking and pinch detection. This class
adds a project-level event surface and a stable holding point positioned at
the thumb/index midpoint.

**Kind**: static class of [<code>HandTrackingManager</code>](#module_HandTrackingManager)  
**Extends**: <code>EventsDispatcher</code>  

* [.HandTrackingManager](#module_HandTrackingManager.HandTrackingManager) ⇐ <code>EventsDispatcher</code>
    * [new exports.HandTrackingManager(xr, parentContainer, [options])](#new_module_HandTrackingManager.HandTrackingManager_new)
    * [.xr](#module_HandTrackingManager.HandTrackingManager+xr) : <code>THREE.WebXRManager</code>
    * [.parentContainer](#module_HandTrackingManager.HandTrackingManager+parentContainer) : <code>THREE.Object3D</code>
    * [.options](#module_HandTrackingManager.HandTrackingManager+options) : <code>object</code>
    * [.hand0](#module_HandTrackingManager.HandTrackingManager+hand0) : <code>TrackedHand</code>
    * [.hand1](#module_HandTrackingManager.HandTrackingManager+hand1) : <code>TrackedHand</code>
    * [.hands](#module_HandTrackingManager.HandTrackingManager+hands) : <code>Array.&lt;TrackedHand&gt;</code>
    * [.left](#module_HandTrackingManager.HandTrackingManager+left) : <code>TrackedHand</code> \| <code>null</code>
    * [.right](#module_HandTrackingManager.HandTrackingManager+right) : <code>TrackedHand</code> \| <code>null</code>
    * [.teleportIsActive](#module_HandTrackingManager.HandTrackingManager+teleportIsActive)
    * [.getHand(handedness)](#module_HandTrackingManager.HandTrackingManager+getHand) ⇒ <code>TrackedHand</code> \| <code>null</code>
    * [.update(time, [deltaTime])](#module_HandTrackingManager.HandTrackingManager+update) ⇒ <code>void</code>
    * [.setTeleportGestureMode(mode)](#module_HandTrackingManager.HandTrackingManager+setTeleportGestureMode)
    * [.setLocomotionMode(mode)](#module_HandTrackingManager.HandTrackingManager+setLocomotionMode)

<a name="new_module_HandTrackingManager.HandTrackingManager_new"></a>

#### new exports.HandTrackingManager(xr, parentContainer, [options])

| Param | Type | Description |
| --- | --- | --- |
| xr | <code>THREE.WebXRManager</code> | The WebXR manager from `renderer.xr`. |
| parentContainer | <code>THREE.Object3D</code> | Scene node that receives hand models and pointer helpers. |
| [options] | <code>object</code> | Hand tracking, gesture, and visualization options. |

**Example**  
```js
const handTracking = controllers.enableHandTracking({
  pinchGestures: { startDistance: 0.035, endDistance: 0.055 },
});

handTracking.addEventListener(EventTypes.ON_PINCH_START, ({ hand }) => {
  console.log('pinch from', hand.handedness);
});
```
<a name="module_HandTrackingManager.HandTrackingManager+xr"></a>

#### handTrackingManager.xr : <code>THREE.WebXRManager</code>
**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+parentContainer"></a>

#### handTrackingManager.parentContainer : <code>THREE.Object3D</code>
**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+options"></a>

#### handTrackingManager.options : <code>object</code>
**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+hand0"></a>

#### handTrackingManager.hand0 : <code>TrackedHand</code>
**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+hand1"></a>

#### handTrackingManager.hand1 : <code>TrackedHand</code>
**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+hands"></a>

#### handTrackingManager.hands : <code>Array.&lt;TrackedHand&gt;</code>
Both tracked hand wrappers, regardless of handedness assignment.

**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+left"></a>

#### handTrackingManager.left : <code>TrackedHand</code> \| <code>null</code>
The left tracked hand, or `null` before it connects.

**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+right"></a>

#### handTrackingManager.right : <code>TrackedHand</code> \| <code>null</code>
The right tracked hand, or `null` before it connects.

**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+teleportIsActive"></a>

#### handTrackingManager.teleportIsActive
Whether either teleport gesture is currently active.

**Kind**: instance property of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  
<a name="module_HandTrackingManager.HandTrackingManager+getHand"></a>

#### handTrackingManager.getHand(handedness) ⇒ <code>TrackedHand</code> \| <code>null</code>
Returns a tracked hand by handedness.

**Kind**: instance method of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  

| Param | Type | Description |
| --- | --- | --- |
| handedness | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | Hand to return. |

<a name="module_HandTrackingManager.HandTrackingManager+update"></a>

#### handTrackingManager.update(time, [deltaTime]) ⇒ <code>void</code>
Updates hand poses and gesture state. Call once per XR animation frame.

**Kind**: instance method of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| time | <code>number</code> |  | Elapsed time in seconds. |
| [deltaTime] | <code>number</code> | <code>0</code> | Time in seconds since the previous frame. |

<a name="module_HandTrackingManager.HandTrackingManager+setTeleportGestureMode"></a>

#### handTrackingManager.setTeleportGestureMode(mode)
Selects the teleport gesture while preserving all configured thresholds.

**Kind**: instance method of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  

| Param | Type |
| --- | --- |
| mode | <code>&#x27;triangle&#x27;</code> \| <code>&#x27;pinch-aim&#x27;</code> | 

<a name="module_HandTrackingManager.HandTrackingManager+setLocomotionMode"></a>

#### handTrackingManager.setLocomotionMode(mode)
Selects one mutually exclusive hand locomotion mode.

**Kind**: instance method of [<code>HandTrackingManager</code>](#module_HandTrackingManager.HandTrackingManager)  

| Param | Type |
| --- | --- |
| mode | <code>&#x27;triangle&#x27;</code> \| <code>&#x27;pinch-aim&#x27;</code> \| <code>&#x27;hand-flight&#x27;</code> | 

<a name="module_HandTrackingManager.EventTypes"></a>

### HandTrackingManager.EventTypes : <code>enum</code>
Event type constants dispatched by [HandTrackingManager](HandTrackingManager).

**Kind**: static enum of [<code>HandTrackingManager</code>](#module_HandTrackingManager)  
<a name="module_HandTrackingManager.HAND_TELEPORT_PREVIEW_DELAY"></a>

### HandTrackingManager.HAND\_TELEPORT\_PREVIEW\_DELAY
Seconds to wait before emitting hand-teleport preview updates.

**Kind**: static constant of [<code>HandTrackingManager</code>](#module_HandTrackingManager)  
<a name="module_XRControllerLabelHelper"></a>

## XRControllerLabelHelper
Builds floating text labels and leader lines for WebXR controller modelcomponents such as triggers, grips, thumbsticks, and face buttons.


* [XRControllerLabelHelper](#module_XRControllerLabelHelper)
    * [.XRControllerLabelHelper](#module_XRControllerLabelHelper.XRControllerLabelHelper)
        * [new exports.XRControllerLabelHelper(options)](#new_module_XRControllerLabelHelper.XRControllerLabelHelper_new)
        * [.init()](#module_XRControllerLabelHelper.XRControllerLabelHelper+init) ⇒ <code>Promise.&lt;XRControllerLabelHelper&gt;</code>
        * [.refresh()](#module_XRControllerLabelHelper.XRControllerLabelHelper+refresh)
        * [.setLabels(labels, [options])](#module_XRControllerLabelHelper.XRControllerLabelHelper+setLabels)
        * [.setVisible(value)](#module_XRControllerLabelHelper.XRControllerLabelHelper+setVisible)
        * [.toggleVisible([force])](#module_XRControllerLabelHelper.XRControllerLabelHelper+toggleVisible) ⇒ <code>boolean</code>
        * [.waitForModel()](#module_XRControllerLabelHelper.XRControllerLabelHelper+waitForModel) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.build()](#module_XRControllerLabelHelper.XRControllerLabelHelper+build)
        * [.clear()](#module_XRControllerLabelHelper.XRControllerLabelHelper+clear)
        * [.dispose()](#module_XRControllerLabelHelper.XRControllerLabelHelper+dispose)
        * [.getAnchors()](#module_XRControllerLabelHelper.XRControllerLabelHelper+getAnchors) ⇒ <code>Object.&lt;string, {type: string, local: THREE.Vector3, world: THREE.Vector3}&gt;</code>
        * [.getOffset(componentId, [label])](#module_XRControllerLabelHelper.XRControllerLabelHelper+getOffset) ⇒ <code>THREE.Vector3</code>
        * [.dumpAnchors()](#module_XRControllerLabelHelper.XRControllerLabelHelper+dumpAnchors)
    * [.DEFAULT_CONTROLLER_LABELS](#module_XRControllerLabelHelper.DEFAULT_CONTROLLER_LABELS) : <code>Object.&lt;string, string&gt;</code>
    * [.DEFAULT_CONTROLLER_LABEL_OFFSETS](#module_XRControllerLabelHelper.DEFAULT_CONTROLLER_LABEL_OFFSETS) : <code>Object.&lt;string, Object.&lt;string, Object.&lt;string, THREE.Vector3&gt;&gt;&gt;</code>

<a name="module_XRControllerLabelHelper.XRControllerLabelHelper"></a>

### XRControllerLabelHelper.XRControllerLabelHelper
Creates text sprites and leader lines anchored to WebXR controller modelcomponents such as trigger, grip, thumbstick, A/B/X/Y buttons, and menu.

**Kind**: static class of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper)  

* [.XRControllerLabelHelper](#module_XRControllerLabelHelper.XRControllerLabelHelper)
    * [new exports.XRControllerLabelHelper(options)](#new_module_XRControllerLabelHelper.XRControllerLabelHelper_new)
    * [.init()](#module_XRControllerLabelHelper.XRControllerLabelHelper+init) ⇒ <code>Promise.&lt;XRControllerLabelHelper&gt;</code>
    * [.refresh()](#module_XRControllerLabelHelper.XRControllerLabelHelper+refresh)
    * [.setLabels(labels, [options])](#module_XRControllerLabelHelper.XRControllerLabelHelper+setLabels)
    * [.setVisible(value)](#module_XRControllerLabelHelper.XRControllerLabelHelper+setVisible)
    * [.toggleVisible([force])](#module_XRControllerLabelHelper.XRControllerLabelHelper+toggleVisible) ⇒ <code>boolean</code>
    * [.waitForModel()](#module_XRControllerLabelHelper.XRControllerLabelHelper+waitForModel) ⇒ <code>Promise.&lt;void&gt;</code>
    * [.build()](#module_XRControllerLabelHelper.XRControllerLabelHelper+build)
    * [.clear()](#module_XRControllerLabelHelper.XRControllerLabelHelper+clear)
    * [.dispose()](#module_XRControllerLabelHelper.XRControllerLabelHelper+dispose)
    * [.getAnchors()](#module_XRControllerLabelHelper.XRControllerLabelHelper+getAnchors) ⇒ <code>Object.&lt;string, {type: string, local: THREE.Vector3, world: THREE.Vector3}&gt;</code>
    * [.getOffset(componentId, [label])](#module_XRControllerLabelHelper.XRControllerLabelHelper+getOffset) ⇒ <code>THREE.Vector3</code>
    * [.dumpAnchors()](#module_XRControllerLabelHelper.XRControllerLabelHelper+dumpAnchors)

<a name="new_module_XRControllerLabelHelper.XRControllerLabelHelper_new"></a>

#### new exports.XRControllerLabelHelper(options)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>object</code> |  |  |
| [options.controllerGrip] | <code>THREE.Group</code> |  | Grip group returned by `renderer.xr.getControllerGrip(index)`. |
| [options.controllerModel] | <code>THREE.Object3D</code> |  | Controller model created by `XRControllerModelFactory`. |
| [options.handController] | <code>HandController</code> |  | Convenience source for grip/model. |
| [options.labels] | <code>Object.&lt;string, (string\|object\|function())&gt;</code> | <code>DEFAULT_CONTROLLER_LABELS</code> | Component label definitions. |
| [options.profileOffsets] | <code>Object.&lt;string, Object.&lt;string, Object.&lt;string, THREE.Vector3&gt;&gt;&gt;</code> | <code>DEFAULT_CONTROLLER_LABEL_OFFSETS</code> |  |
| [options.includeUnknownLabels] | <code>boolean</code> | <code>false</code> | Render generic labels for components not present in `labels`. |
| [options.visible] | <code>boolean</code> | <code>true</code> | Initial labels visibility. |
| [options.debug] | <code>boolean</code> | <code>false</code> | Dump anchors to the console after build. |
| [options.style] | <code>object</code> |  | Canvas/sprite/line styling overrides. |
| [options.style.labelWidthMode] | <code>&#x27;uniform&#x27;</code> \| <code>&#x27;content&#x27;</code> | <code>&#x27;uniform&#x27;</code> | Use the widest label for all widths, or fit each label to its text. |
| [options.style.labelHorizontalPadding] | <code>number</code> | <code>0.012</code> | Horizontal padding on each side of fitted label text, in meters. |
| [options.layout] | <code>object</code> \| <code>false</code> |  | Label layout options. Use `false` for raw anchor-relative offsets. |
| [options.layout.mode] | <code>&#x27;split&#x27;</code> \| <code>&#x27;radial&#x27;</code> \| <code>&#x27;hybrid&#x27;</code> | <code>&#x27;split&#x27;</code> | Automatic distribution strategy. |
| [options.layout.minGap] | <code>number</code> | <code>0.008</code> | Minimum gap between labels in meters. |
| [options.layout.sideDistance] | <code>number</code> | <code>0.095</code> | Absolute local X distance used by the split layout. |
| [options.layout.minHorizontalMargin] | <code>number</code> | <code>0</code> | Minimum split-layout gap between the projected controller edge and labels, in meters. |
| [options.layout.planarity] | <code>number</code> | <code>0</code> | Radial direction blend toward the controller-local XZ plane, clamped to 0..1. |
| [options.layout.minDistance] | <code>number</code> | <code>0.095</code> | Minimum radial distance from each component anchor to its label center. |
| [options.layout.angularSpacing] | <code>number</code> | <code>1</code> | Radial angular equalization strength (0 preserves original rays, 1 uses uniform sectors). |
| [options.layout.lockDepthAxis] | <code>boolean</code> | <code>false</code> | Align labels on the same local Z plane. |
| [options.layout.screenSpace] | <code>boolean</code> | <code>true</code> | Keep split-layout rows separated in screen space as the camera moves. |
| [options.layout.sideByComponent] | <code>Object.&lt;string, (&#x27;left&#x27;\|&#x27;right&#x27;)&gt;</code> |  | Per-component side override for split layout. |
| [options.waitTimeout] | <code>number</code> | <code>30000</code> | Max milliseconds to wait for usable component anchors. |

**Example**  
```js
const labels = await new XRControllerLabelHelper({  handController: controllers.right,  labels: {    ...DEFAULT_CONTROLLER_LABELS,    'a-button': 'Jump',  },}).init();labels.setVisible(true);
```
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+init"></a>

#### xrControllerLabelHelper.init() ⇒ <code>Promise.&lt;XRControllerLabelHelper&gt;</code>
Waits for the model profile data and builds the labels.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+refresh"></a>

#### xrControllerLabelHelper.refresh()
Rebuilds the label group using current profile/component anchors.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+setLabels"></a>

#### xrControllerLabelHelper.setLabels(labels, [options])
Replaces the label definitions.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  

| Param | Type | Default |
| --- | --- | --- |
| labels | <code>Object.&lt;string, (string\|object\|function())&gt;</code> |  | 
| [options] | <code>object</code> |  | 
| [options.rebuild] | <code>boolean</code> | <code>true</code> | 

<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+setVisible"></a>

#### xrControllerLabelHelper.setVisible(value)
Shows or hides all generated labels.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  

| Param | Type |
| --- | --- |
| value | <code>boolean</code> | 

<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+toggleVisible"></a>

#### xrControllerLabelHelper.toggleVisible([force]) ⇒ <code>boolean</code>
Toggles all generated labels and returns the new visibility.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  

| Param | Type |
| --- | --- |
| [force] | <code>boolean</code> | 

<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+waitForModel"></a>

#### xrControllerLabelHelper.waitForModel() ⇒ <code>Promise.&lt;void&gt;</code>
Waits until Three.js has attached profile data and visual response nodes.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+build"></a>

#### xrControllerLabelHelper.build()
Creates sprites and leader lines for all labeled anchors.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+clear"></a>

#### xrControllerLabelHelper.clear()
Removes generated labels and disposes their GPU resources.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+dispose"></a>

#### xrControllerLabelHelper.dispose()
Disposes labels and detaches the group from the controller grip.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+getAnchors"></a>

#### xrControllerLabelHelper.getAnchors() ⇒ <code>Object.&lt;string, {type: string, local: THREE.Vector3, world: THREE.Vector3}&gt;</code>
Returns local/world anchors for every component with a usable visual node.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+getOffset"></a>

#### xrControllerLabelHelper.getOffset(componentId, [label]) ⇒ <code>THREE.Vector3</code>
Returns the configured label offset for a component.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  

| Param | Type | Default |
| --- | --- | --- |
| componentId | <code>string</code> |  | 
| [label] | <code>object</code> | <code></code> | 

<a name="module_XRControllerLabelHelper.XRControllerLabelHelper+dumpAnchors"></a>

#### xrControllerLabelHelper.dumpAnchors()
Logs profile, handedness, and local anchors to the browser console.

**Kind**: instance method of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper.XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.DEFAULT_CONTROLLER_LABELS"></a>

### XRControllerLabelHelper.DEFAULT\_CONTROLLER\_LABELS : <code>Object.&lt;string, string&gt;</code>
Default labels for common WebXR input profile component ids.Override these per application through the `labels` constructor option.

**Kind**: static constant of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper)  
<a name="module_XRControllerLabelHelper.DEFAULT_CONTROLLER_LABEL_OFFSETS"></a>

### XRControllerLabelHelper.DEFAULT\_CONTROLLER\_LABEL\_OFFSETS : <code>Object.&lt;string, Object.&lt;string, Object.&lt;string, THREE.Vector3&gt;&gt;&gt;</code>
Initial Quest Touch Plus offsets in controller local coordinates.Values are in meters and can be calibrated per application.

**Kind**: static constant of [<code>XRControllerLabelHelper</code>](#module_XRControllerLabelHelper)  
<a name="module_XRTeleportMoveControl"></a>

## XRTeleportMoveControl
Handles headset locomotion for WebXR scenes: controller teleportation,snap rotation, and optional thumbstick-driven continuous movement.


* [XRTeleportMoveControl](#module_XRTeleportMoveControl)
    * _static_
        * [.XRTeleportMoveControl](#module_XRTeleportMoveControl.XRTeleportMoveControl)
            * [new exports.XRTeleportMoveControl(xrManager, controllersManager, scene, [options])](#new_module_XRTeleportMoveControl.XRTeleportMoveControl_new)
            * [.options](#module_XRTeleportMoveControl.XRTeleportMoveControl+options) : <code>XRTeleportMoveControlOptions</code>
            * [.controllersManager](#module_XRTeleportMoveControl.XRTeleportMoveControl+controllersManager) : <code>ControllersManager</code>
            * [.scene](#module_XRTeleportMoveControl.XRTeleportMoveControl+scene) : <code>THREE.Scene</code>
            * [.xrManager](#module_XRTeleportMoveControl.XRTeleportMoveControl+xrManager) : <code>THREE.WebXRManager</code>
            * [._setupListeners()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_setupListeners)
            * [._isHorizontalSurface(normal)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_isHorizontalSurface) ⇒ <code>boolean</code>
            * [._getTeleportGizmoAngle(stickPos, ray)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_getTeleportGizmoAngle) ⇒ <code>number</code>
            * [._createSpriteLabel([text], [size])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_createSpriteLabel) ⇒ <code>THREE.Sprite</code>
            * [._rotate(degrees)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_rotate)
            * [._buildGizmo()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_buildGizmo)
            * [._buildTeleportArc()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_buildTeleportArc)
            * [._updateTeleportGizmo(pos, stickPosition, ray, [surfaceNormal], [handedness])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_updateTeleportGizmo)
            * [._updateTeleportArc(ray, targetPos, [handedness])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_updateTeleportArc)
            * [.previewTeleportFromRay(ray)](#module_XRTeleportMoveControl.XRTeleportMoveControl+previewTeleportFromRay) ⇒ <code>boolean</code>
            * [.commitTeleportFromRay(ray)](#module_XRTeleportMoveControl.XRTeleportMoveControl+commitTeleportFromRay) ⇒ <code>boolean</code>
            * [.clearTeleportPreview()](#module_XRTeleportMoveControl.XRTeleportMoveControl+clearTeleportPreview)
            * [._hideTeleportPreviewVisuals()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_hideTeleportPreviewVisuals)
            * [._measureUserHeight()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_measureUserHeight)
            * [._teleport(destinationPos, [stickPosition], [ray])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_teleport)
            * [._moveInDirection(ray, stickPositionY, deltaTime)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_moveInDirection)
            * [.moveInDirectionFromRay(ray, amount, deltaTime)](#module_XRTeleportMoveControl.XRTeleportMoveControl+moveInDirectionFromRay)
            * [._applyCurrentTransform()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_applyCurrentTransform)
            * [.getXRRigidTransform()](#module_XRTeleportMoveControl.XRTeleportMoveControl+getXRRigidTransform) ⇒ <code>THREE.Matrix4</code>
            * [.update(deltaTime)](#module_XRTeleportMoveControl.XRTeleportMoveControl+update)
            * [.setTeleportSurfaces(geometry)](#module_XRTeleportMoveControl.XRTeleportMoveControl+setTeleportSurfaces)
            * [._testRayCaster()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_testRayCaster)
    * _inner_
        * [~XRTeleportMoveControlOptions](#module_XRTeleportMoveControl..XRTeleportMoveControlOptions) : <code>object</code>

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl"></a>

### XRTeleportMoveControl.XRTeleportMoveControl
Handles VR locomotion: teleportation, snap rotation, and optionalcontinuous (stick-driven) movement.Set walkable floor geometry with [setTeleportSurfaces](setTeleportSurfaces) and call[update](update) every animation frame to keep the reference-space transformin sync when continuous motion is enabled.

**Kind**: static class of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl)  

* [.XRTeleportMoveControl](#module_XRTeleportMoveControl.XRTeleportMoveControl)
    * [new exports.XRTeleportMoveControl(xrManager, controllersManager, scene, [options])](#new_module_XRTeleportMoveControl.XRTeleportMoveControl_new)
    * [.options](#module_XRTeleportMoveControl.XRTeleportMoveControl+options) : <code>XRTeleportMoveControlOptions</code>
    * [.controllersManager](#module_XRTeleportMoveControl.XRTeleportMoveControl+controllersManager) : <code>ControllersManager</code>
    * [.scene](#module_XRTeleportMoveControl.XRTeleportMoveControl+scene) : <code>THREE.Scene</code>
    * [.xrManager](#module_XRTeleportMoveControl.XRTeleportMoveControl+xrManager) : <code>THREE.WebXRManager</code>
    * [._setupListeners()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_setupListeners)
    * [._isHorizontalSurface(normal)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_isHorizontalSurface) ⇒ <code>boolean</code>
    * [._getTeleportGizmoAngle(stickPos, ray)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_getTeleportGizmoAngle) ⇒ <code>number</code>
    * [._createSpriteLabel([text], [size])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_createSpriteLabel) ⇒ <code>THREE.Sprite</code>
    * [._rotate(degrees)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_rotate)
    * [._buildGizmo()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_buildGizmo)
    * [._buildTeleportArc()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_buildTeleportArc)
    * [._updateTeleportGizmo(pos, stickPosition, ray, [surfaceNormal], [handedness])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_updateTeleportGizmo)
    * [._updateTeleportArc(ray, targetPos, [handedness])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_updateTeleportArc)
    * [.previewTeleportFromRay(ray)](#module_XRTeleportMoveControl.XRTeleportMoveControl+previewTeleportFromRay) ⇒ <code>boolean</code>
    * [.commitTeleportFromRay(ray)](#module_XRTeleportMoveControl.XRTeleportMoveControl+commitTeleportFromRay) ⇒ <code>boolean</code>
    * [.clearTeleportPreview()](#module_XRTeleportMoveControl.XRTeleportMoveControl+clearTeleportPreview)
    * [._hideTeleportPreviewVisuals()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_hideTeleportPreviewVisuals)
    * [._measureUserHeight()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_measureUserHeight)
    * [._teleport(destinationPos, [stickPosition], [ray])](#module_XRTeleportMoveControl.XRTeleportMoveControl+_teleport)
    * [._moveInDirection(ray, stickPositionY, deltaTime)](#module_XRTeleportMoveControl.XRTeleportMoveControl+_moveInDirection)
    * [.moveInDirectionFromRay(ray, amount, deltaTime)](#module_XRTeleportMoveControl.XRTeleportMoveControl+moveInDirectionFromRay)
    * [._applyCurrentTransform()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_applyCurrentTransform)
    * [.getXRRigidTransform()](#module_XRTeleportMoveControl.XRTeleportMoveControl+getXRRigidTransform) ⇒ <code>THREE.Matrix4</code>
    * [.update(deltaTime)](#module_XRTeleportMoveControl.XRTeleportMoveControl+update)
    * [.setTeleportSurfaces(geometry)](#module_XRTeleportMoveControl.XRTeleportMoveControl+setTeleportSurfaces)
    * [._testRayCaster()](#module_XRTeleportMoveControl.XRTeleportMoveControl+_testRayCaster)

<a name="new_module_XRTeleportMoveControl.XRTeleportMoveControl_new"></a>

#### new exports.XRTeleportMoveControl(xrManager, controllersManager, scene, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| xrManager | <code>THREE.WebXRManager</code> |  | The WebXR manager from `renderer.xr`. |
| controllersManager | <code>ControllersManager</code> |  | The shared ControllersManager instance. |
| scene | <code>THREE.Scene</code> |  | The Three.js scene (used to add the teleport gizmo). |
| [options] | <code>XRTeleportMoveControlOptions</code> | <code>{}</code> | Optional configuration merged with [defaultOptions](defaultOptions). |

**Example**  
```js
const move = new XRTeleportMoveControl(renderer.xr, controllersManager, scene, {  enabledHands: 'both',  enableContinousMotion: true,});move.setTeleportSurfaces(floorGeometry);// in the render loop:move.update(deltaTime);
```
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+options"></a>

#### xrTeleportMoveControl.options : <code>XRTeleportMoveControlOptions</code>
**Kind**: instance property of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+controllersManager"></a>

#### xrTeleportMoveControl.controllersManager : <code>ControllersManager</code>
**Kind**: instance property of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+scene"></a>

#### xrTeleportMoveControl.scene : <code>THREE.Scene</code>
**Kind**: instance property of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+xrManager"></a>

#### xrTeleportMoveControl.xrManager : <code>THREE.WebXRManager</code>
**Kind**: instance property of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_setupListeners"></a>

#### xrTeleportMoveControl.\_setupListeners()
Registers XR session lifecycle, teleport, rotation, and continuous-motion listeners.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_isHorizontalSurface"></a>

#### xrTeleportMoveControl.\_isHorizontalSurface(normal) ⇒ <code>boolean</code>
Returns whether a hit face normal is close enough to world-up to be walkable.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Description |
| --- | --- | --- |
| normal | <code>THREE.Vector3</code> | Face normal in the teleport surface's local space. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_getTeleportGizmoAngle"></a>

#### xrTeleportMoveControl.\_getTeleportGizmoAngle(stickPos, ray) ⇒ <code>number</code>
Computes the orientation for the teleport landing arrow from stick direction and ray heading.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
**Returns**: <code>number</code> - Arrow angle in radians.  

| Param | Type | Description |
| --- | --- | --- |
| stickPos | <code>THREE.Vector2</code> | Current thumbstick position. |
| ray | <code>THREE.Ray</code> | Controller ray in world space. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_createSpriteLabel"></a>

#### xrTeleportMoveControl.\_createSpriteLabel([text], [size]) ⇒ <code>THREE.Sprite</code>
Creates a text sprite used by reference/world-space debug helpers.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [text] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | Label text. |
| [size] | <code>number</code> | <code>1</code> | Sprite scale in scene units. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_rotate"></a>

#### xrTeleportMoveControl.\_rotate(degrees)
Applies snap rotation around the viewer's current XZ position.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Description |
| --- | --- | --- |
| degrees | <code>number</code> | Rotation delta in degrees. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_buildGizmo"></a>

#### xrTeleportMoveControl.\_buildGizmo()
Builds the teleport target ring and orientation arrow.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_buildTeleportArc"></a>

#### xrTeleportMoveControl.\_buildTeleportArc()
Builds the dynamic ribbon used to preview the teleport arc.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_updateTeleportGizmo"></a>

#### xrTeleportMoveControl.\_updateTeleportGizmo(pos, stickPosition, ray, [surfaceNormal], [handedness])
Positions and orients the teleport gizmo at the current valid target point.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| pos | <code>THREE.Vector3</code> |  | World-space destination point. |
| stickPosition | <code>THREE.Vector2</code> |  | Current thumbstick position. |
| ray | <code>THREE.Ray</code> |  | Controller ray in world space. |
| [surfaceNormal] | <code>THREE.Vector3</code> | <code></code> | Hit face normal in teleport-surface local space. |
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | <code></code> | Controller hand used to mirror the visual start correction. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_updateTeleportArc"></a>

#### xrTeleportMoveControl.\_updateTeleportArc(ray, targetPos, [handedness])
Updates the dynamic teleport preview arc from the controller ray origin to the target.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| ray | <code>THREE.Ray</code> |  | Controller ray in world space. |
| targetPos | <code>THREE.Vector3</code> |  | World-space destination point, including any surface offset. |
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | <code></code> | Controller hand used to mirror the visual start correction. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+previewTeleportFromRay"></a>

#### xrTeleportMoveControl.previewTeleportFromRay(ray) ⇒ <code>boolean</code>
Shows the teleport target gizmo for an arbitrary world-space ray.Useful for non-controller gestures such as hand-tracking aim poses.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
**Returns**: <code>boolean</code> - Whether a valid teleport target was found.  

| Param | Type | Description |
| --- | --- | --- |
| ray | <code>THREE.Ray</code> | World-space ray to test against teleport surfaces. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+commitTeleportFromRay"></a>

#### xrTeleportMoveControl.commitTeleportFromRay(ray) ⇒ <code>boolean</code>
Commits a teleport to the current hit point for an arbitrary world-space ray.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
**Returns**: <code>boolean</code> - Whether teleportation was executed.  

| Param | Type | Description |
| --- | --- | --- |
| ray | <code>THREE.Ray</code> | World-space ray to test against teleport surfaces. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+clearTeleportPreview"></a>

#### xrTeleportMoveControl.clearTeleportPreview()
Hides the teleport target preview.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_hideTeleportPreviewVisuals"></a>

#### xrTeleportMoveControl.\_hideTeleportPreviewVisuals()
Hides teleport preview meshes without changing gesture state.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_measureUserHeight"></a>

#### xrTeleportMoveControl.\_measureUserHeight()
Measures the user's current headset height once after entering XR.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_teleport"></a>

#### xrTeleportMoveControl.\_teleport(destinationPos, [stickPosition], [ray])
Applies the world offset/rotation needed to move the viewer to a destination.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Description |
| --- | --- | --- |
| destinationPos | <code>THREE.Vector3</code> | Destination in world-space coordinates. |
| [stickPosition] | <code>THREE.Vector2</code> | Optional thumbstick direction for landing orientation. |
| [ray] | <code>THREE.Ray</code> | Optional controller ray used for landing orientation. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_moveInDirection"></a>

#### xrTeleportMoveControl.\_moveInDirection(ray, stickPositionY, deltaTime)
Accumulates continuous movement in the controller ray direction.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Description |
| --- | --- | --- |
| ray | <code>THREE.Ray</code> | Controller ray in world space. |
| stickPositionY | <code>number</code> | Dead-zone-adjusted Y axis value. |
| deltaTime | <code>number</code> | Time in seconds since the last frame. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+moveInDirectionFromRay"></a>

#### xrTeleportMoveControl.moveInDirectionFromRay(ray, amount, deltaTime)
Accumulates continuous movement from an arbitrary world-space ray.Useful for hand-tracking gestures that do not have thumbstick axes.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Description |
| --- | --- | --- |
| ray | <code>THREE.Ray</code> | World-space movement ray. |
| amount | <code>number</code> | Signed movement amount, usually normalized from -1 to 1. |
| deltaTime | <code>number</code> | Time in seconds since the last frame. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_applyCurrentTransform"></a>

#### xrTeleportMoveControl.\_applyCurrentTransform()
Applies the current world offset and yaw rotation to the XR reference space.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+getXRRigidTransform"></a>

#### xrTeleportMoveControl.getXRRigidTransform() ⇒ <code>THREE.Matrix4</code>
Returns the current world-to-reference-space transform as a `THREE.Matrix4`.Useful for converting world-space positions into XR reference space.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+update"></a>

#### xrTeleportMoveControl.update(deltaTime)
Must be called every animation frame when continuous motion is enabled.Re-applies the current world offset/rotation to the XR reference space.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| deltaTime | <code>number</code> | <code></code> | Time in seconds since the last frame. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+setTeleportSurfaces"></a>

#### xrTeleportMoveControl.setTeleportSurfaces(geometry)
Registers the walkable floor geometry for teleportation hit-testing.Uses `three-mesh-bvh` for accelerated raycasting.Call this once after the floor mesh geometry is ready.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  

| Param | Type | Description |
| --- | --- | --- |
| geometry | <code>THREE.BufferGeometry</code> | The floor or walkable surface geometry. |

<a name="module_XRTeleportMoveControl.XRTeleportMoveControl+_testRayCaster"></a>

#### xrTeleportMoveControl.\_testRayCaster()
Debug helper that casts a vertical test ray against the teleport surface.

**Kind**: instance method of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl.XRTeleportMoveControl)  
<a name="module_XRTeleportMoveControl..XRTeleportMoveControlOptions"></a>

### XRTeleportMoveControl~XRTeleportMoveControlOptions : <code>object</code>
Default configuration for [XRTeleportMoveControl](XRTeleportMoveControl).

**Kind**: inner typedef of [<code>XRTeleportMoveControl</code>](#module_XRTeleportMoveControl)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [showHelpers] | <code>boolean</code> | <code>false</code> | Render debug axes helpers for the reference and world spaces. |
| [enableContinousMotion] | <code>boolean</code> | <code>true</code> | Enable smooth stick-driven translation in the ray direction. |
| [enableControllerTeleport] | <code>boolean</code> | <code>true</code> | Enable select/ray teleport from controller-style inputs. |
| [restrictVerticalMovement] | <code>boolean</code> | <code>false</code> | When `true`, continuous motion is constrained to the XZ plane. |
| [enabledHands] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> \| <code>&#x27;both&#x27;</code> | <code>&#x27;right&#x27;</code> | Which hand(s) can trigger teleport, rotation, and continuous motion. |
| [showTeleportArc] | <code>boolean</code> | <code>true</code> | Render a curved ribbon from the controller ray origin to the teleport target. |
| [teleportArcWidth] | <code>number</code> | <code>0.06</code> | Width of the teleport preview ribbon in meters. |
| [teleportArcHeight] | <code>number</code> | <code>1.25</code> | Height added to the midpoint of the teleport preview curve in meters. |
| [teleportArcSegments] | <code>number</code> | <code>24</code> | Number of segments used to approximate the teleport preview curve. |
| [teleportArcStartForwardOffset] | <code>number</code> | <code>0.1</code> | Distance in meters from the target-ray origin to the visible ribbon start. |
| [teleportArcStartHorizontalOffset] | <code>number</code> | <code>0.02</code> | Mirrored horizontal correction in meters used to center the ribbon on controller models. |

<a name="module_GrabbableVRObject"></a>

## GrabbableVRObject
Makes application-owned Three.js objects grabbable in VR, with contact grab,
remote grab, snap targets, return behavior, and release intent events.


* [GrabbableVRObject](#module_GrabbableVRObject)
    * _static_
        * [.GrabbableVRObject](#module_GrabbableVRObject.GrabbableVRObject) ⇐ <code>EventsDispatcher</code>
            * [new exports.GrabbableVRObject(targetObject, scene, [options])](#new_module_GrabbableVRObject.GrabbableVRObject_new)
            * [._onUpdate](#module_GrabbableVRObject.GrabbableVRObject+_onUpdate)
            * [.distanceToRightController](#module_GrabbableVRObject.GrabbableVRObject+distanceToRightController) : <code>number</code> \| <code>null</code>
            * [._onSqueezeStart](#module_GrabbableVRObject.GrabbableVRObject+_onSqueezeStart) ⇒ <code>false</code> \| <code>undefined</code>
            * [._onSqueezeEnd](#module_GrabbableVRObject.GrabbableVRObject+_onSqueezeEnd)
            * [.setSnapTargets(targets)](#module_GrabbableVRObject.GrabbableVRObject+setSnapTargets)
            * [.addSnapTarget(target)](#module_GrabbableVRObject.GrabbableVRObject+addSnapTarget)
            * [.clearSnapTargets()](#module_GrabbableVRObject.GrabbableVRObject+clearSnapTargets)
            * [.getNearestSnapTarget()](#module_GrabbableVRObject.GrabbableVRObject+getNearestSnapTarget) ⇒ <code>Object</code> \| <code>null</code>
            * [.setPlacementMode(mode)](#module_GrabbableVRObject.GrabbableVRObject+setPlacementMode)
            * [.release([reason], [releaseData])](#module_GrabbableVRObject.GrabbableVRObject+release) ⇒ <code>boolean</code>
            * [.cancelGrab([options])](#module_GrabbableVRObject.GrabbableVRObject+cancelGrab) ⇒ <code>boolean</code>
            * [.setEnabled(enabled)](#module_GrabbableVRObject.GrabbableVRObject+setEnabled)
            * [._getControllerDistanceToBBox(which)](#module_GrabbableVRObject.GrabbableVRObject+_getControllerDistanceToBBox) ⇒ <code>number</code> \| <code>null</code>
            * [.getControllerDistanceToContactBounds(which)](#module_GrabbableVRObject.GrabbableVRObject+getControllerDistanceToContactBounds) ⇒ <code>number</code> \| <code>null</code>
            * [.dispose()](#module_GrabbableVRObject.GrabbableVRObject+dispose)
        * [.EventTypes](#module_GrabbableVRObject.EventTypes) : <code>enum</code>
    * _inner_
        * [~GrabbableVRObjectOptions](#module_GrabbableVRObject..GrabbableVRObjectOptions) : <code>object</code>

<a name="module_GrabbableVRObject.GrabbableVRObject"></a>

### GrabbableVRObject.GrabbableVRObject ⇐ <code>EventsDispatcher</code>
Makes a Three.js object grabbable in a WebXR scene.

Supports contact grabbing, remote grabbing, optional rotation constraints,
snap targets, placement previews, return-to-origin, and gesture-based release.
It intentionally does not simulate physics; consumers receive release data and
can apply application-specific motion, gravity, or collisions outside this class.

**Kind**: static class of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject)  
**Extends**: <code>EventsDispatcher</code>  

* [.GrabbableVRObject](#module_GrabbableVRObject.GrabbableVRObject) ⇐ <code>EventsDispatcher</code>
    * [new exports.GrabbableVRObject(targetObject, scene, [options])](#new_module_GrabbableVRObject.GrabbableVRObject_new)
    * [._onUpdate](#module_GrabbableVRObject.GrabbableVRObject+_onUpdate)
    * [.distanceToRightController](#module_GrabbableVRObject.GrabbableVRObject+distanceToRightController) : <code>number</code> \| <code>null</code>
    * [._onSqueezeStart](#module_GrabbableVRObject.GrabbableVRObject+_onSqueezeStart) ⇒ <code>false</code> \| <code>undefined</code>
    * [._onSqueezeEnd](#module_GrabbableVRObject.GrabbableVRObject+_onSqueezeEnd)
    * [.setSnapTargets(targets)](#module_GrabbableVRObject.GrabbableVRObject+setSnapTargets)
    * [.addSnapTarget(target)](#module_GrabbableVRObject.GrabbableVRObject+addSnapTarget)
    * [.clearSnapTargets()](#module_GrabbableVRObject.GrabbableVRObject+clearSnapTargets)
    * [.getNearestSnapTarget()](#module_GrabbableVRObject.GrabbableVRObject+getNearestSnapTarget) ⇒ <code>Object</code> \| <code>null</code>
    * [.setPlacementMode(mode)](#module_GrabbableVRObject.GrabbableVRObject+setPlacementMode)
    * [.release([reason], [releaseData])](#module_GrabbableVRObject.GrabbableVRObject+release) ⇒ <code>boolean</code>
    * [.cancelGrab([options])](#module_GrabbableVRObject.GrabbableVRObject+cancelGrab) ⇒ <code>boolean</code>
    * [.setEnabled(enabled)](#module_GrabbableVRObject.GrabbableVRObject+setEnabled)
    * [._getControllerDistanceToBBox(which)](#module_GrabbableVRObject.GrabbableVRObject+_getControllerDistanceToBBox) ⇒ <code>number</code> \| <code>null</code>
    * [.getControllerDistanceToContactBounds(which)](#module_GrabbableVRObject.GrabbableVRObject+getControllerDistanceToContactBounds) ⇒ <code>number</code> \| <code>null</code>
    * [.dispose()](#module_GrabbableVRObject.GrabbableVRObject+dispose)

<a name="new_module_GrabbableVRObject.GrabbableVRObject_new"></a>

#### new exports.GrabbableVRObject(targetObject, scene, [options])
**Throws**:

- <code>Error</code> If `targetObject` is not a `THREE.Object3D` instance.


| Param | Type | Description |
| --- | --- | --- |
| targetObject | <code>THREE.Object3D</code> | The scene object to make grabbable. |
| scene | <code>THREE.Scene</code> | The Three.js scene. |
| [options] | <code>GrabbableVRObjectOptions</code> | Configuration merged with [defaultOptions](defaultOptions). |

**Example**  
```js
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const grabbable = new GrabbableVRObject(cube, scene, {
  contactGrabbing: { enabled: true, distanceThreshold: 0.04 },
  remoteGrabbing: { enabled: true },
  follow: { mode: 'manual', keepWorldUp: true },
});

grabbable.addEventListener(EventTypes.ON_GRAB_START, ({ controller }) => {
  console.log('grabbed by', controller.handedness);
});
```
<a name="module_GrabbableVRObject.GrabbableVRObject+_onUpdate"></a>

#### grabbableVRObject.\_onUpdate
Updates animations, fly-to-grip, constrained follow, snap preview, and gesture detection.

**Kind**: instance property of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type |
| --- | --- |
| e | <code>Object</code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+distanceToRightController"></a>

#### grabbableVRObject.distanceToRightController : <code>number</code> \| <code>null</code>
Distance in metres from the right controller grip to the nearest point on
the object's contact bounds. Returns `null` if the right controller is not connected.

**Kind**: instance property of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
<a name="module_GrabbableVRObject.GrabbableVRObject+_onSqueezeStart"></a>

#### grabbableVRObject.\_onSqueezeStart ⇒ <code>false</code> \| <code>undefined</code>
Starts contact or remote grabbing when a squeeze begins near or over the object.

**Kind**: instance property of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
**Returns**: <code>false</code> \| <code>undefined</code> - `false` stops event propagation when a grab starts.  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>object</code> | ControllersManager squeeze event. |

<a name="module_GrabbableVRObject.GrabbableVRObject+_onSqueezeEnd"></a>

#### grabbableVRObject.\_onSqueezeEnd
Releases the object when the active grabbing controller stops squeezing.

**Kind**: instance property of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>object</code> | ControllersManager squeeze event. |

<a name="module_GrabbableVRObject.GrabbableVRObject+setSnapTargets"></a>

#### grabbableVRObject.setSnapTargets(targets)
Replaces all snap targets.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type |
| --- | --- |
| targets | <code>Array.&lt;(object\|THREE.Object3D)&gt;</code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+addSnapTarget"></a>

#### grabbableVRObject.addSnapTarget(target)
Adds one snap target.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type |
| --- | --- |
| target | <code>object</code> \| <code>THREE.Object3D</code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+clearSnapTargets"></a>

#### grabbableVRObject.clearSnapTargets()
Clears all snap targets and visible placeholders.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
<a name="module_GrabbableVRObject.GrabbableVRObject+getNearestSnapTarget"></a>

#### grabbableVRObject.getNearestSnapTarget() ⇒ <code>Object</code> \| <code>null</code>
Returns the current nearest snap target descriptor, or computes one on demand.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
<a name="module_GrabbableVRObject.GrabbableVRObject+setPlacementMode"></a>

#### grabbableVRObject.setPlacementMode(mode)
Sets placement mode.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type |
| --- | --- |
| mode | <code>&#x27;free&#x27;</code> \| <code>&#x27;snap&#x27;</code> \| <code>&#x27;return&#x27;</code> \| <code>&#x27;snap-or-return&#x27;</code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+release"></a>

#### grabbableVRObject.release([reason], [releaseData]) ⇒ <code>boolean</code>
Releases the object if it is currently grabbed.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
**Returns**: <code>boolean</code> - Whether a grabbed object was released.  

| Param | Type | Default |
| --- | --- | --- |
| [reason] | <code>string</code> | <code>&quot;&#x27;manual&#x27;&quot;</code> | 
| [releaseData] | <code>object</code> \| <code>null</code> | <code></code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+cancelGrab"></a>

#### grabbableVRObject.cancelGrab([options]) ⇒ <code>boolean</code>
Cancels the active grab without applying placement rules.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
**Returns**: <code>boolean</code> - Whether a grabbed object was cancelled.  

| Param | Type | Default |
| --- | --- | --- |
| [options] | <code>object</code> |  | 
| [options.restore] | <code>boolean</code> | <code>false</code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+setEnabled"></a>

#### grabbableVRObject.setEnabled(enabled)
Enables or disables this grabbable object.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type |
| --- | --- |
| enabled | <code>boolean</code> | 

<a name="module_GrabbableVRObject.GrabbableVRObject+_getControllerDistanceToBBox"></a>

#### grabbableVRObject.\_getControllerDistanceToBBox(which) ⇒ <code>number</code> \| <code>null</code>
Computes the distance from a controller grip to the configured contact bounds.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type | Description |
| --- | --- | --- |
| which | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | Controller hand. |

<a name="module_GrabbableVRObject.GrabbableVRObject+getControllerDistanceToContactBounds"></a>

#### grabbableVRObject.getControllerDistanceToContactBounds(which) ⇒ <code>number</code> \| <code>null</code>
Computes the world-space distance from a controller grip to the local oriented
bounds used for contact grabbing.

The contact bounds are aligned with `contactGrabbing.boundsObject` local axes,
or with the target object's local axes when no bounds object is configured.
This avoids the inflated contact area produced by a world-axis-aligned AABB
when the object is rotated.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  

| Param | Type | Description |
| --- | --- | --- |
| which | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | Controller hand. |

<a name="module_GrabbableVRObject.GrabbableVRObject+dispose"></a>

#### grabbableVRObject.dispose()
Removes all internal event listeners from the ControllersManager.
Call this when the grabbable object is removed from the scene.

**Kind**: instance method of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject.GrabbableVRObject)  
<a name="module_GrabbableVRObject.EventTypes"></a>

### GrabbableVRObject.EventTypes : <code>enum</code>
Event type constants dispatched by [GrabbableVRObject](GrabbableVRObject).

**Kind**: static enum of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject)  
<a name="module_GrabbableVRObject..GrabbableVRObjectOptions"></a>

### GrabbableVRObject~GrabbableVRObjectOptions : <code>object</code>
Default options for [GrabbableVRObject](GrabbableVRObject).

**Kind**: inner typedef of [<code>GrabbableVRObject</code>](#module_GrabbableVRObject)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [contactGrabbing] | <code>object</code> |  | Contact-grab settings. When `enabled`, squeezing while the controller grip is   within `distanceThreshold` metres of the object's local oriented bounds will grab it.   `boundsObject` can point to a child mesh or group when only part of the target object   should define the contact volume. |
| [contactGrabbing.enabled] | <code>boolean</code> | <code>true</code> |  |
| [contactGrabbing.distanceThreshold] | <code>number</code> | <code>0.03</code> |  |
| [contactGrabbing.boundsObject] | <code>THREE.Object3D</code> \| <code>null</code> | <code></code> |  |
| [remoteGrabbing] | <code>Object</code> |  | Remote-grab settings. When `enabled`, squeezing while the controller ray   intersects the object's bounding box will fly the object to the grip. |
| [showHelpers] | <code>boolean</code> | <code>true</code> | Show bounding-box debug helpers. |
| [restrictRotationX] | <code>boolean</code> | <code>false</code> | Lock object X rotation to its value at grab time. |
| [restrictRotationY] | <code>boolean</code> | <code>false</code> | Lock object Y rotation to its value at grab time. |
| [restrictRotationZ] | <code>boolean</code> | <code>false</code> | Lock object Z rotation to its value at grab time. |
| [follow] | <code>object</code> |  | Follow behavior used after a contact or remote grab reaches the controller.   `mode: 'manual'` keeps the object in world space and applies controller deltas without reparenting.   `keepWorldUp` removes roll while still allowing yaw and pitch, so the held object's local up axis   remains aligned with world-up as closely as possible.   `snapDegrees` quantizes manual-follow rotation; `snapRelativeToGrab` makes those snap steps relative   to the object's orientation at grab start. |

<a name="module_HtmlMenuVR"></a>

## HtmlMenuVR
Renders an existing HTML element into a VR menu panel by rasterizing the DOM
into a Three.js texture.


* [HtmlMenuVR](#module_HtmlMenuVR)
    * [.HtmlMenuVR](#module_HtmlMenuVR.HtmlMenuVR) ⇐ <code>VRMenu</code>
        * [new exports.HtmlMenuVR(domElement, worldContainer, controllersManager, [options])](#new_module_HtmlMenuVR.HtmlMenuVR_new)
        * [.domElement](#module_HtmlMenuVR.HtmlMenuVR+domElement) : <code>HTMLElement</code>
        * [.map](#module_HtmlMenuVR.HtmlMenuVR+map) : <code>HTMLTexture</code>
        * [.update()](#module_HtmlMenuVR.HtmlMenuVR+update)
        * [.dispose()](#module_HtmlMenuVR.HtmlMenuVR+dispose)

<a name="module_HtmlMenuVR.HtmlMenuVR"></a>

### HtmlMenuVR.HtmlMenuVR ⇐ <code>VRMenu</code>
A VR menu panel that renders a live HTML DOM element as a Three.js texture.Uses [HTMLTexture](HTMLTexture) (html-to-image under the hood) to rasterise the DOMelement and map it onto a quad in world space. Call [update](update) wheneverthe DOM content changes to refresh the texture.

**Kind**: static class of [<code>HtmlMenuVR</code>](#module_HtmlMenuVR)  
**Extends**: <code>VRMenu</code>  

* [.HtmlMenuVR](#module_HtmlMenuVR.HtmlMenuVR) ⇐ <code>VRMenu</code>
    * [new exports.HtmlMenuVR(domElement, worldContainer, controllersManager, [options])](#new_module_HtmlMenuVR.HtmlMenuVR_new)
    * [.domElement](#module_HtmlMenuVR.HtmlMenuVR+domElement) : <code>HTMLElement</code>
    * [.map](#module_HtmlMenuVR.HtmlMenuVR+map) : <code>HTMLTexture</code>
    * [.update()](#module_HtmlMenuVR.HtmlMenuVR+update)
    * [.dispose()](#module_HtmlMenuVR.HtmlMenuVR+dispose)

<a name="new_module_HtmlMenuVR.HtmlMenuVR_new"></a>

#### new exports.HtmlMenuVR(domElement, worldContainer, controllersManager, [options])

| Param | Type | Description |
| --- | --- | --- |
| domElement | <code>HTMLElement</code> | The DOM element to render as the menu surface. |
| worldContainer | <code>THREE.Group</code> | Scene node the menu panel is attached to. |
| controllersManager | <code>ControllersManager</code> | The shared ControllersManager instance. |
| [options] | <code>object</code> | Options merged with VRMenu defaults. Supports `canvasOutputScale` (default `1`). |

**Example**  
```js
const menu = new HtmlMenuVR(document.getElementById('my-menu'), scene, controllersManager, {  mode: 'panel',});
```
<a name="module_HtmlMenuVR.HtmlMenuVR+domElement"></a>

#### htmlMenuVR.domElement : <code>HTMLElement</code>
The HTML element being rendered as the menu surface.

**Kind**: instance property of [<code>HtmlMenuVR</code>](#module_HtmlMenuVR.HtmlMenuVR)  
<a name="module_HtmlMenuVR.HtmlMenuVR+map"></a>

#### htmlMenuVR.map : <code>HTMLTexture</code>
The HTMLTexture wrapping the DOM element.

**Kind**: instance property of [<code>HtmlMenuVR</code>](#module_HtmlMenuVR.HtmlMenuVR)  
<a name="module_HtmlMenuVR.HtmlMenuVR+update"></a>

#### htmlMenuVR.update()
Refreshes the menu texture from the current DOM element state.Call this whenever the HTML content changes and the VR panel should reflect it.

**Kind**: instance method of [<code>HtmlMenuVR</code>](#module_HtmlMenuVR.HtmlMenuVR)  
<a name="module_HtmlMenuVR.HtmlMenuVR+dispose"></a>

#### htmlMenuVR.dispose()
Disposes of resources used by HtmlMenuVR, including the HTMLTexture and materials.

**Kind**: instance method of [<code>HtmlMenuVR</code>](#module_HtmlMenuVR.HtmlMenuVR)  
<a name="module_UILMenuVR"></a>

## UILMenuVR
Renders a UIL canvas UI into a VR menu panel and forwards VR pointer events
back to the UIL interaction layer.


* [UILMenuVR](#module_UILMenuVR)
    * [.UILMenuVR](#module_UILMenuVR.UILMenuVR) ⇐ <code>VRMenu</code>
        * [new exports.UILMenuVR(ui, worldContainer, controllersManager, [options])](#new_module_UILMenuVR.UILMenuVR_new)
        * [.lastCanvasSize](#module_UILMenuVR.UILMenuVR+lastCanvasSize)
        * [.ui](#module_UILMenuVR.UILMenuVR+ui) : <code>object</code>
        * [.dispose()](#module_UILMenuVR.UILMenuVR+dispose)

<a name="module_UILMenuVR.UILMenuVR"></a>

### UILMenuVR.UILMenuVR ⇐ <code>VRMenu</code>
A VR menu panel that renders a UIL (uil.module.js) canvas as a Three.js texture.Automatically syncs the texture whenever the UIL library redraws its canvas viathe `ui.onDraw` hook, and correctly maps the canvas aspect ratio to the quad meshso there is no blank space or distortion.

**Kind**: static class of [<code>UILMenuVR</code>](#module_UILMenuVR)  
**Extends**: <code>VRMenu</code>  

* [.UILMenuVR](#module_UILMenuVR.UILMenuVR) ⇐ <code>VRMenu</code>
    * [new exports.UILMenuVR(ui, worldContainer, controllersManager, [options])](#new_module_UILMenuVR.UILMenuVR_new)
    * [.lastCanvasSize](#module_UILMenuVR.UILMenuVR+lastCanvasSize)
    * [.ui](#module_UILMenuVR.UILMenuVR+ui) : <code>object</code>
    * [.dispose()](#module_UILMenuVR.UILMenuVR+dispose)

<a name="new_module_UILMenuVR.UILMenuVR_new"></a>

#### new exports.UILMenuVR(ui, worldContainer, controllersManager, [options])

| Param | Type | Description |
| --- | --- | --- |
| ui | <code>object</code> | A UIL Gui/Panel instance that exposes `ui.canvas`, `ui.zone`, and `ui.onDraw`. |
| worldContainer | <code>THREE.Group</code> | Scene node the menu panel is attached to. |
| controllersManager | <code>ControllersManager</code> | The shared ControllersManager instance. |
| [options] | <code>object</code> | Options forwarded to VRMenu. |

**Example**  
```js
const ui = new UIL.Gui({ w: 300 });const menu = new UILMenuVR(ui, scene, controllersManager, { mode: 'swatch' });
```
<a name="module_UILMenuVR.UILMenuVR+lastCanvasSize"></a>

#### uilMenuVR.lastCanvasSize
Tracks canvas dimensions to detect resize and rebuild the texture. @type {{ w: number, h: number }}

**Kind**: instance property of [<code>UILMenuVR</code>](#module_UILMenuVR.UILMenuVR)  
<a name="module_UILMenuVR.UILMenuVR+ui"></a>

#### uilMenuVR.ui : <code>object</code>
The underlying UIL instance.

**Kind**: instance property of [<code>UILMenuVR</code>](#module_UILMenuVR.UILMenuVR)  
<a name="module_UILMenuVR.UILMenuVR+dispose"></a>

#### uilMenuVR.dispose()
Disposes of the UIL instance and calls the parent VRMenu dispose.

**Kind**: instance method of [<code>UILMenuVR</code>](#module_UILMenuVR.UILMenuVR)  
<a name="module_VRMenu"></a>

## VRMenu
Base class for rectangular VR menu panels that can be shown in front of theuser or attached to a controller, with optional direct manipulation.


* [VRMenu](#module_VRMenu)
    * [.VRMenu](#module_VRMenu.VRMenu) ⇐ <code>VRInteractivePanel</code>
        * [new exports.VRMenu(worldContainer, controllersManager, [options])](#new_module_VRMenu.VRMenu_new)
        * [.setVisible(visible)](#module_VRMenu.VRMenu+setVisible)
        * [._updateAspectRatio(canvasWidthPx, canvasHeightPx, uiHeightPx)](#module_VRMenu.VRMenu+_updateAspectRatio)
        * [._repositionPanel()](#module_VRMenu.VRMenu+_repositionPanel)
        * [._setupEventListeners()](#module_VRMenu.VRMenu+_setupEventListeners)
        * [._onLeftControllerConnected(e)](#module_VRMenu.VRMenu+_onLeftControllerConnected)
        * [._onLeftControllerDisconnected(e)](#module_VRMenu.VRMenu+_onLeftControllerDisconnected)
        * [.dispose()](#module_VRMenu.VRMenu+dispose)
    * [.EventTypes](#module_VRMenu.EventTypes) : <code>enum</code>
    * [.defaultOptions](#module_VRMenu.defaultOptions) : <code>object</code>

<a name="module_VRMenu.VRMenu"></a>

### VRMenu.VRMenu ⇐ <code>VRInteractivePanel</code>
This class represents a VR menu in a 2D panel that can be attached to a controller ("swatch" mode)or positioned in front of the user ("panel" mode) in a WebXR environment. It manages itsposition, orientation, and visibility based on the selected mode and headset/controller state.VRMenu extends VRInteractivePanel and handles controller connection events to attach or detachthe menu from the appropriate scene node.

**Kind**: static class of [<code>VRMenu</code>](#module_VRMenu)  
**Extends**: <code>VRInteractivePanel</code>  

* [.VRMenu](#module_VRMenu.VRMenu) ⇐ <code>VRInteractivePanel</code>
    * [new exports.VRMenu(worldContainer, controllersManager, [options])](#new_module_VRMenu.VRMenu_new)
    * [.setVisible(visible)](#module_VRMenu.VRMenu+setVisible)
    * [._updateAspectRatio(canvasWidthPx, canvasHeightPx, uiHeightPx)](#module_VRMenu.VRMenu+_updateAspectRatio)
    * [._repositionPanel()](#module_VRMenu.VRMenu+_repositionPanel)
    * [._setupEventListeners()](#module_VRMenu.VRMenu+_setupEventListeners)
    * [._onLeftControllerConnected(e)](#module_VRMenu.VRMenu+_onLeftControllerConnected)
    * [._onLeftControllerDisconnected(e)](#module_VRMenu.VRMenu+_onLeftControllerDisconnected)
    * [.dispose()](#module_VRMenu.VRMenu+dispose)

<a name="new_module_VRMenu.VRMenu_new"></a>

#### new exports.VRMenu(worldContainer, controllersManager, [options])

| Param | Type | Description |
| --- | --- | --- |
| worldContainer | <code>THREE.Group</code> | Scene node the menu panel is attached to. |
| controllersManager | <code>ControllersManager</code> | Shared ControllersManager instance. |
| [options] | <code>object</code> | Options merged with VRInteractivePanel and VRMenu defaults. |

**Example**  
```js
const menu = new VRMenu(scene, controllersManager, {  mode: 'panel',  panel: { distance: 0.75, verticalOffset: -0.25 },  manipulation: { enabled: true },});menu.setVisible(true);
```
<a name="module_VRMenu.VRMenu+setVisible"></a>

#### vrMenu.setVisible(visible)
Sets menu visibility and repositions panel-mode menus when becoming visible.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  

| Param | Type |
| --- | --- |
| visible | <code>boolean</code> | 

<a name="module_VRMenu.VRMenu+_updateAspectRatio"></a>

#### vrMenu.\_updateAspectRatio(canvasWidthPx, canvasHeightPx, uiHeightPx)
Updates the aspect ratio and vertical mapping of the UI mesh to ensureit maps all the UI pixels without blank space and deformation.This method recalculates the scaling and offset values for the UI texture mapping and mesh transformation,based on the provided canvas and UI dimensions. It ensures that the UI content is properly scaled and centeredvertically within the canvas, regardless of the canvas or UI height in pixels.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| canvasWidthPx | <code>number</code> |  | The width of the rendering canvas in pixels. |
| canvasHeightPx | <code>number</code> |  | The height of the rendering canvas in pixels. |
| uiHeightPx | <code>number</code> | <code></code> | The height of the UI in pixels, which determines the vertical mapping range. The method performs the following steps: 1. Calculates the aspect ratio using the canvas width and the UI height, which is used to adjust the mesh's vertical scale. 2. Computes the vertical scaling factor (`yScale`) to map the UI's pixel height to the canvas height, ensuring the UI covers the intended area. 3. Determines the vertical offset (`yOffset`) to center the UI mapping within the canvas. 4. Updates the texture mapping (`offset` and `repeat`) to apply the calculated scale and offset, so the UI texture fills the mesh appropriately. 5. Adjusts the mesh's vertical scale and position to maintain the correct aspect ratio and vertical alignment. 6. Stores the computed `yOffset` and `yScale` for potential later use. This function is typically used in WebXR or VR/AR UI rendering scenarios where the UI must dynamically adapt to varying display resolutions and aspect ratios. |

<a name="module_VRMenu.VRMenu+_repositionPanel"></a>

#### vrMenu.\_repositionPanel()
Repositions the menu panel in front of the user based on headset orientation.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  
<a name="module_VRMenu.VRMenu+_setupEventListeners"></a>

#### vrMenu.\_setupEventListeners()
Sets up controller connection/disconnection listeners used by swatch and panel modes.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  
<a name="module_VRMenu.VRMenu+_onLeftControllerConnected"></a>

#### vrMenu.\_onLeftControllerConnected(e)
Attaches the menu to the left controller in swatch mode, or to the world in panel mode.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>object</code> | Controller connection event. |

<a name="module_VRMenu.VRMenu+_onLeftControllerDisconnected"></a>

#### vrMenu.\_onLeftControllerDisconnected(e)
Detaches the menu when the left controller disconnects and cancels any active pointer gesture.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>object</code> | Controller disconnection event. |

<a name="module_VRMenu.VRMenu+dispose"></a>

#### vrMenu.dispose()
Cleans up event listeners and removes the menu from the scene or controller.

**Kind**: instance method of [<code>VRMenu</code>](#module_VRMenu.VRMenu)  
<a name="module_VRMenu.EventTypes"></a>

### VRMenu.EventTypes : <code>enum</code>
Event type constants dispatched by [VRMenu](VRMenu).

**Kind**: static enum of [<code>VRMenu</code>](#module_VRMenu)  
<a name="module_VRMenu.defaultOptions"></a>

### VRMenu.defaultOptions : <code>object</code>
Default menu options, merged with [VRInteractivePanel](VRInteractivePanel) defaults.

**Kind**: static constant of [<code>VRMenu</code>](#module_VRMenu)  
<a name="module_VRButtonControl"></a>

## VRButtonControl
Adds direct-touch button behavior to app-owned Three.js objects.


* [VRButtonControl](#module_VRButtonControl)
    * [.VRButtonControl](#module_VRButtonControl.VRButtonControl) ⇐ <code>EventsDispatcher</code>
        * [new exports.VRButtonControl(movingObject, [options])](#new_module_VRButtonControl.VRButtonControl_new)
        * [.value](#module_VRButtonControl.VRButtonControl+value) : <code>number</code>
        * [.pressed](#module_VRButtonControl.VRButtonControl+pressed) : <code>boolean</code>
        * [.toggled](#module_VRButtonControl.VRButtonControl+toggled) : <code>boolean</code>
        * [.setEnabled(enabled)](#module_VRButtonControl.VRButtonControl+setEnabled) ⇒ <code>void</code>
        * [.setValue(value, [dispatch])](#module_VRButtonControl.VRButtonControl+setValue) ⇒ <code>void</code>
        * [.dispose()](#module_VRButtonControl.VRButtonControl+dispose) ⇒ <code>void</code>

<a name="module_VRButtonControl.VRButtonControl"></a>

### VRButtonControl.VRButtonControl ⇐ <code>EventsDispatcher</code>
Adds direct physical button behavior to any Object3D supplied by the app.
The class creates no production mesh; it only moves `movingObject` along a
configurable local axis and dispatches state/value events.

**Kind**: static class of [<code>VRButtonControl</code>](#module_VRButtonControl)  
**Extends**: <code>EventsDispatcher</code>  

* [.VRButtonControl](#module_VRButtonControl.VRButtonControl) ⇐ <code>EventsDispatcher</code>
    * [new exports.VRButtonControl(movingObject, [options])](#new_module_VRButtonControl.VRButtonControl_new)
    * [.value](#module_VRButtonControl.VRButtonControl+value) : <code>number</code>
    * [.pressed](#module_VRButtonControl.VRButtonControl+pressed) : <code>boolean</code>
    * [.toggled](#module_VRButtonControl.VRButtonControl+toggled) : <code>boolean</code>
    * [.setEnabled(enabled)](#module_VRButtonControl.VRButtonControl+setEnabled) ⇒ <code>void</code>
    * [.setValue(value, [dispatch])](#module_VRButtonControl.VRButtonControl+setValue) ⇒ <code>void</code>
    * [.dispose()](#module_VRButtonControl.VRButtonControl+dispose) ⇒ <code>void</code>

<a name="new_module_VRButtonControl.VRButtonControl_new"></a>

#### new exports.VRButtonControl(movingObject, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| movingObject | <code>THREE.Object3D</code> |  | Object that moves along the button travel axis. |
| [options] | <code>object</code> |  | Button interaction options. |
| [options.enabled] | <code>boolean</code> | <code>true</code> | Whether the control reacts to controller contact. |
| [options.mode] | <code>&#x27;momentary&#x27;</code> \| <code>&#x27;toggle&#x27;</code> | <code>&#x27;momentary&#x27;</code> | Momentary press or persistent toggle behavior. |
| [options.interactionObject] | <code>THREE.Object3D</code> \| <code>null</code> | <code></code> | Object used for hit/contact testing; defaults to `movingObject`. |
| [options.controllersManager] | <code>ControllersManager</code> \| <code>null</code> | <code></code> | Controller source; resolved automatically when possible. |
| [options.axis] | <code>THREE.Vector3</code> |  | Local axis along which the button moves. |
| [options.travel] | <code>number</code> | <code>0.045</code> | Maximum travel distance in meters. |
| [options.contactDistance] | <code>number</code> | <code>0.025</code> | Contact distance threshold in meters. |
| [options.responseSpeed] | <code>number</code> | <code>22</code> | Interpolation speed used when animating the button value. |
| [options.initialValue] | <code>number</code> | <code>0</code> | Initial normalized travel value from 0 to 1. |
| [options.initialToggled] | <code>boolean</code> | <code>false</code> | Initial toggle state when `mode` is `'toggle'`. |

**Example**  
```js
const button = new VRButtonControl(buttonMesh, {
  controllersManager,
  mode: 'toggle',
  axis: new THREE.Vector3(0, -1, 0),
  travel: 0.04,
});

button.addEventListener(EventTypes.ON_TOGGLE, ({ toggled }) => {
  console.log('button toggled:', toggled);
});
```
<a name="module_VRButtonControl.VRButtonControl+value"></a>

#### vrButtonControl.value : <code>number</code>
Current normalized travel value from 0 to 1.

**Kind**: instance property of [<code>VRButtonControl</code>](#module_VRButtonControl.VRButtonControl)  
<a name="module_VRButtonControl.VRButtonControl+pressed"></a>

#### vrButtonControl.pressed : <code>boolean</code>
Whether the control is currently being pressed.

**Kind**: instance property of [<code>VRButtonControl</code>](#module_VRButtonControl.VRButtonControl)  
<a name="module_VRButtonControl.VRButtonControl+toggled"></a>

#### vrButtonControl.toggled : <code>boolean</code>
Current toggle state.

**Kind**: instance property of [<code>VRButtonControl</code>](#module_VRButtonControl.VRButtonControl)  
<a name="module_VRButtonControl.VRButtonControl+setEnabled"></a>

#### vrButtonControl.setEnabled(enabled) ⇒ <code>void</code>
Enables or disables contact handling.

**Kind**: instance method of [<code>VRButtonControl</code>](#module_VRButtonControl.VRButtonControl)  

| Param | Type |
| --- | --- |
| enabled | <code>boolean</code> | 

<a name="module_VRButtonControl.VRButtonControl+setValue"></a>

#### vrButtonControl.setValue(value, [dispatch]) ⇒ <code>void</code>
Sets the normalized button travel value directly.

**Kind**: instance method of [<code>VRButtonControl</code>](#module_VRButtonControl.VRButtonControl)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| value | <code>number</code> |  | Normalized value from 0 to 1. |
| [dispatch] | <code>boolean</code> | <code>true</code> | Whether to emit `ON_VALUE_CHANGE`. |

<a name="module_VRButtonControl.VRButtonControl+dispose"></a>

#### vrButtonControl.dispose() ⇒ <code>void</code>
Removes event listeners registered on the controller manager.

**Kind**: instance method of [<code>VRButtonControl</code>](#module_VRButtonControl.VRButtonControl)  
<a name="module_VRRotaryControl"></a>

## VRRotaryControl
Adds constrained rotary/knob behavior to app-owned Three.js objects.


* [VRRotaryControl](#module_VRRotaryControl)
    * [.VRRotaryControl](#module_VRRotaryControl.VRRotaryControl) ⇐ <code>EventsDispatcher</code>
        * [new exports.VRRotaryControl(movingObject, [options])](#new_module_VRRotaryControl.VRRotaryControl_new)
        * [.angle](#module_VRRotaryControl.VRRotaryControl+angle) : <code>number</code>
        * [.value](#module_VRRotaryControl.VRRotaryControl+value) : <code>number</code>
        * [.dragging](#module_VRRotaryControl.VRRotaryControl+dragging) : <code>boolean</code>
        * [.setEnabled(enabled)](#module_VRRotaryControl.VRRotaryControl+setEnabled) ⇒ <code>void</code>
        * [.setAngle(angle, [dispatch])](#module_VRRotaryControl.VRRotaryControl+setAngle) ⇒ <code>void</code>
        * [.dispose()](#module_VRRotaryControl.VRRotaryControl+dispose) ⇒ <code>void</code>

<a name="module_VRRotaryControl.VRRotaryControl"></a>

### VRRotaryControl.VRRotaryControl ⇐ <code>EventsDispatcher</code>
Adds constrained rotary behavior to an app-owned Object3D. The object must
provide its own visual shape and pivot; this class only computes angle,
clamps limits, applies rotation, and emits interaction events.

**Kind**: static class of [<code>VRRotaryControl</code>](#module_VRRotaryControl)  
**Extends**: <code>EventsDispatcher</code>  

* [.VRRotaryControl](#module_VRRotaryControl.VRRotaryControl) ⇐ <code>EventsDispatcher</code>
    * [new exports.VRRotaryControl(movingObject, [options])](#new_module_VRRotaryControl.VRRotaryControl_new)
    * [.angle](#module_VRRotaryControl.VRRotaryControl+angle) : <code>number</code>
    * [.value](#module_VRRotaryControl.VRRotaryControl+value) : <code>number</code>
    * [.dragging](#module_VRRotaryControl.VRRotaryControl+dragging) : <code>boolean</code>
    * [.setEnabled(enabled)](#module_VRRotaryControl.VRRotaryControl+setEnabled) ⇒ <code>void</code>
    * [.setAngle(angle, [dispatch])](#module_VRRotaryControl.VRRotaryControl+setAngle) ⇒ <code>void</code>
    * [.dispose()](#module_VRRotaryControl.VRRotaryControl+dispose) ⇒ <code>void</code>

<a name="new_module_VRRotaryControl.VRRotaryControl_new"></a>

#### new exports.VRRotaryControl(movingObject, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| movingObject | <code>THREE.Object3D</code> |  | Object rotated by the control. |
| [options] | <code>object</code> |  | Rotary interaction options. |
| [options.enabled] | <code>boolean</code> | <code>true</code> | Whether the control reacts to squeeze/drag input. |
| [options.interactionObject] | <code>THREE.Object3D</code> \| <code>null</code> | <code></code> | Object used for grab-distance testing. |
| [options.controllersManager] | <code>ControllersManager</code> \| <code>null</code> | <code></code> | Controller source; resolved automatically when possible. |
| [options.axis] | <code>THREE.Vector3</code> |  | Local rotation axis. |
| [options.minAngle] | <code>number</code> | <code>0</code> | Minimum rotation angle in radians. |
| [options.maxAngle] | <code>number</code> | <code>Math.PI*2</code> | Maximum rotation angle in radians. |
| [options.initialAngle] | <code>number</code> | <code>0</code> | Initial angle in radians. |
| [options.grabDistance] | <code>number</code> | <code>0.075</code> | Distance threshold for starting a drag. |
| [options.translationInput] | <code>object</code> |  | Translation-based drag contribution options. |
| [options.twistInput] | <code>object</code> |  | Controller-twist contribution options. |
| [options.haptics] | <code>object</code> |  | Haptic detent feedback options. |

**Example**  
```js
const knob = new VRRotaryControl(knobMesh, {
  controllersManager,
  axis: new THREE.Vector3(0, 0, 1),
  minAngle: 0,
  maxAngle: Math.PI,
});

knob.addEventListener(EventTypes.ON_VALUE_CHANGE, ({ value, angle }) => {
  console.log(value, angle);
});
```
<a name="module_VRRotaryControl.VRRotaryControl+angle"></a>

#### vrRotaryControl.angle : <code>number</code>
Current angle in radians.

**Kind**: instance property of [<code>VRRotaryControl</code>](#module_VRRotaryControl.VRRotaryControl)  
<a name="module_VRRotaryControl.VRRotaryControl+value"></a>

#### vrRotaryControl.value : <code>number</code>
Current normalized value from 0 to 1 across the configured angle range.

**Kind**: instance property of [<code>VRRotaryControl</code>](#module_VRRotaryControl.VRRotaryControl)  
<a name="module_VRRotaryControl.VRRotaryControl+dragging"></a>

#### vrRotaryControl.dragging : <code>boolean</code>
Whether a controller is currently dragging the control.

**Kind**: instance property of [<code>VRRotaryControl</code>](#module_VRRotaryControl.VRRotaryControl)  
<a name="module_VRRotaryControl.VRRotaryControl+setEnabled"></a>

#### vrRotaryControl.setEnabled(enabled) ⇒ <code>void</code>
Enables or disables drag handling.

**Kind**: instance method of [<code>VRRotaryControl</code>](#module_VRRotaryControl.VRRotaryControl)  

| Param | Type |
| --- | --- |
| enabled | <code>boolean</code> | 

<a name="module_VRRotaryControl.VRRotaryControl+setAngle"></a>

#### vrRotaryControl.setAngle(angle, [dispatch]) ⇒ <code>void</code>
Sets the control angle directly.

**Kind**: instance method of [<code>VRRotaryControl</code>](#module_VRRotaryControl.VRRotaryControl)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| angle | <code>number</code> |  | Target angle in radians. |
| [dispatch] | <code>boolean</code> | <code>true</code> | Whether to emit `ON_VALUE_CHANGE`. |

<a name="module_VRRotaryControl.VRRotaryControl+dispose"></a>

#### vrRotaryControl.dispose() ⇒ <code>void</code>
Removes event listeners registered on the controller manager.

**Kind**: instance method of [<code>VRRotaryControl</code>](#module_VRRotaryControl.VRRotaryControl)  
<a name="module_VRLeverControl"></a>

## VRLeverControl
Semantic one-axis lever built on top of [VRRotaryControl](VRRotaryControl).


* [VRLeverControl](#module_VRLeverControl)
    * [.VRLeverControl](#module_VRLeverControl.VRLeverControl) ⇐ <code>VRRotaryControl</code>
        * [new exports.VRLeverControl(movingObject, [options])](#new_module_VRLeverControl.VRLeverControl_new)

<a name="module_VRLeverControl.VRLeverControl"></a>

### VRLeverControl.VRLeverControl ⇐ <code>VRRotaryControl</code>
Semantic wrapper for one-axis lever behavior. Visual shape, handle length,
base, and pivot are supplied by the app through `movingObject`.

**Kind**: static class of [<code>VRLeverControl</code>](#module_VRLeverControl)  
**Extends**: <code>VRRotaryControl</code>  
<a name="new_module_VRLeverControl.VRLeverControl_new"></a>

#### new exports.VRLeverControl(movingObject, [options])

| Param | Type | Description |
| --- | --- | --- |
| movingObject | <code>THREE.Object3D</code> | Object rotated by the lever. |
| [options] | <code>object</code> | Lever options; same shape as [VRRotaryControl](VRRotaryControl) options. |

**Example**  
```js
const lever = new VRLeverControl(leverMesh, {
  controllersManager,
  minAngle: -Math.PI / 4,
  maxAngle: Math.PI / 4,
});
```
<a name="module_VRInteractiveSurface"></a>

## VRInteractiveSurface
Provides geometry-agnostic controller ray interaction for app-owned
UV-mapped meshes.


* [VRInteractiveSurface](#module_VRInteractiveSurface)
    * _static_
        * [.VRInteractiveSurface](#module_VRInteractiveSurface.VRInteractiveSurface) ⇐ <code>EventsDispatcher</code>
            * [new exports.VRInteractiveSurface(mesh, worldContainer, controllersManager, [options])](#new_module_VRInteractiveSurface.VRInteractiveSurface_new)
            * [._mesh](#module_VRInteractiveSurface.VRInteractiveSurface+_mesh) : <code>THREE.Mesh</code>
            * [._interactive](#module_VRInteractiveSurface.VRInteractiveSurface+_interactive) : <code>InteractiveVRObject</code>
            * [._enabled](#module_VRInteractiveSurface.VRInteractiveSurface+_enabled) : <code>boolean</code>
            * [._onPointerEvent](#module_VRInteractiveSurface.VRInteractiveSurface+_onPointerEvent)
            * [.mesh](#module_VRInteractiveSurface.VRInteractiveSurface+mesh) : <code>THREE.Mesh</code>
            * [.getIntersectionMesh()](#module_VRInteractiveSurface.VRInteractiveSurface+getIntersectionMesh) ⇒ <code>THREE.Mesh</code>
            * [.shouldTestRayEvents()](#module_VRInteractiveSurface.VRInteractiveSurface+shouldTestRayEvents) ⇒ <code>boolean</code>
            * [.onRayStarted(intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+onRayStarted)
            * [.onRayUpdated(intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+onRayUpdated)
            * [.onRayEnded(intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+onRayEnded)
            * [._emitPointer(type, intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+_emitPointer)
            * [._buildPointerUV(intersection)](#module_VRInteractiveSurface.VRInteractiveSurface+_buildPointerUV) ⇒ <code>THREE.Vector2</code> \| <code>undefined</code>
            * [.setEnabled(enabled)](#module_VRInteractiveSurface.VRInteractiveSurface+setEnabled)
            * [.refitBoundsTree()](#module_VRInteractiveSurface.VRInteractiveSurface+refitBoundsTree)
            * [.rebuildBoundsTree()](#module_VRInteractiveSurface.VRInteractiveSurface+rebuildBoundsTree)
            * [.dispose()](#module_VRInteractiveSurface.VRInteractiveSurface+dispose)
        * [.EventTypes](#module_VRInteractiveSurface.EventTypes) : <code>enum</code>
    * _inner_
        * [~VRInteractiveSurfaceOptions](#module_VRInteractiveSurface..VRInteractiveSurfaceOptions) : <code>object</code>

<a name="module_VRInteractiveSurface.VRInteractiveSurface"></a>

### VRInteractiveSurface.VRInteractiveSurface ⇐ <code>EventsDispatcher</code>
Geometry-agnostic interactive surface: attaches VR controller ray interaction to **any**
app-owned mesh and emits mouse-like pointer events carrying the **normalized UV coordinate**
(0..1) of the hit, so whatever renders the mesh texture (a 2D canvas, a curved screen,
an exotic shape) knows exactly where it was touched.

It does NOT create geometry, textures, materials, visibility containers, or add anything to
the scene: the caller owns the mesh. It only needs a mesh whose geometry has a `uv` attribute.
For both faces to be hittable, the material should use `side: THREE.DoubleSide` (the raycaster
ignores back-faces otherwise).

Use this class directly when the interactive surface is supplied by the application: curved
screens, domes, control consoles, mesh-mounted canvases, or any custom UV-mapped object.
Use [VRInteractivePanel](VRInteractivePanel) when the component should own a standard flat rectangular
panel, its materials, aspect-ratio fitting, and panel visibility semantics.

Consume events either via [EventsDispatcher](EventsDispatcher) listeners (the common case for new code) or
by subclassing and overriding [_onPointerEvent](_onPointerEvent) (used internally by [VRInteractivePanel](VRInteractivePanel)).

**Kind**: static class of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface)  
**Extends**: <code>EventsDispatcher</code>  

* [.VRInteractiveSurface](#module_VRInteractiveSurface.VRInteractiveSurface) ⇐ <code>EventsDispatcher</code>
    * [new exports.VRInteractiveSurface(mesh, worldContainer, controllersManager, [options])](#new_module_VRInteractiveSurface.VRInteractiveSurface_new)
    * [._mesh](#module_VRInteractiveSurface.VRInteractiveSurface+_mesh) : <code>THREE.Mesh</code>
    * [._interactive](#module_VRInteractiveSurface.VRInteractiveSurface+_interactive) : <code>InteractiveVRObject</code>
    * [._enabled](#module_VRInteractiveSurface.VRInteractiveSurface+_enabled) : <code>boolean</code>
    * [._onPointerEvent](#module_VRInteractiveSurface.VRInteractiveSurface+_onPointerEvent)
    * [.mesh](#module_VRInteractiveSurface.VRInteractiveSurface+mesh) : <code>THREE.Mesh</code>
    * [.getIntersectionMesh()](#module_VRInteractiveSurface.VRInteractiveSurface+getIntersectionMesh) ⇒ <code>THREE.Mesh</code>
    * [.shouldTestRayEvents()](#module_VRInteractiveSurface.VRInteractiveSurface+shouldTestRayEvents) ⇒ <code>boolean</code>
    * [.onRayStarted(intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+onRayStarted)
    * [.onRayUpdated(intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+onRayUpdated)
    * [.onRayEnded(intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+onRayEnded)
    * [._emitPointer(type, intersection, [handedness])](#module_VRInteractiveSurface.VRInteractiveSurface+_emitPointer)
    * [._buildPointerUV(intersection)](#module_VRInteractiveSurface.VRInteractiveSurface+_buildPointerUV) ⇒ <code>THREE.Vector2</code> \| <code>undefined</code>
    * [.setEnabled(enabled)](#module_VRInteractiveSurface.VRInteractiveSurface+setEnabled)
    * [.refitBoundsTree()](#module_VRInteractiveSurface.VRInteractiveSurface+refitBoundsTree)
    * [.rebuildBoundsTree()](#module_VRInteractiveSurface.VRInteractiveSurface+rebuildBoundsTree)
    * [.dispose()](#module_VRInteractiveSurface.VRInteractiveSurface+dispose)

<a name="new_module_VRInteractiveSurface.VRInteractiveSurface_new"></a>

#### new exports.VRInteractiveSurface(mesh, worldContainer, controllersManager, [options])

| Param | Type | Description |
| --- | --- | --- |
| mesh | <code>THREE.Mesh</code> | Any mesh with a `uv` attribute to make interactive. |
| worldContainer | <code>THREE.Group</code> | Scene node used to host optional debug hit markers. |
| controllersManager | <code>ControllersManager</code> | Shared ControllersManager instance. |
| [options] | <code>VRInteractiveSurfaceOptions</code> | Options merged with [defaultOptions](defaultOptions). |

**Example**  
```js
const surface = new VRInteractiveSurface(myMesh, scene, controllersManager, { useBVH: true });
surface.addEventListener(EventTypes.POINTER_DOWN, (e) => {
  // e.uv: THREE.Vector2 in [0,1]; e.point: world-space hit; e.handedness: 'left' | 'right'
  drawCursor(e.uv.x * canvas.width, (1 - e.uv.y) * canvas.height);
});
```
<a name="module_VRInteractiveSurface.VRInteractiveSurface+_mesh"></a>

#### vrInteractiveSurface.\_mesh : <code>THREE.Mesh</code>
The mesh used for ray hit-testing, provided by the caller.

**Kind**: instance property of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+_interactive"></a>

#### vrInteractiveSurface.\_interactive : <code>InteractiveVRObject</code>
**Kind**: instance property of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+_enabled"></a>

#### vrInteractiveSurface.\_enabled : <code>boolean</code>
Whether ray events are currently tested against this surface.

**Kind**: instance property of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+_onPointerEvent"></a>

#### vrInteractiveSurface.\_onPointerEvent
Template method for subclasses that drive a UI backend (e.g. dispatching to a DOM element).
Default is a no-op: external consumers should use `addEventListener(EventTypes.*)`.

**Kind**: instance property of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type |
| --- | --- |
| e | <code>object</code> | 
| e.type | <code>string</code> | 
| [e.uv] | <code>THREE.Vector2</code> | 
| [e.data] | <code>THREE.Vector2</code> | 
| e.point | <code>THREE.Vector3</code> \| <code>null</code> | 
| [e.handedness] | <code>string</code> | 

<a name="module_VRInteractiveSurface.VRInteractiveSurface+mesh"></a>

#### vrInteractiveSurface.mesh : <code>THREE.Mesh</code>
The interactive mesh.

**Kind**: instance property of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+getIntersectionMesh"></a>

#### vrInteractiveSurface.getIntersectionMesh() ⇒ <code>THREE.Mesh</code>
**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
**Returns**: <code>THREE.Mesh</code> - The mesh InteractiveVRObject raycasts against.  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+shouldTestRayEvents"></a>

#### vrInteractiveSurface.shouldTestRayEvents() ⇒ <code>boolean</code>
**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
**Returns**: <code>boolean</code> - Whether controller rays should currently be tested against this surface.  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+onRayStarted"></a>

#### vrInteractiveSurface.onRayStarted(intersection, [handedness])
**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type |
| --- | --- |
| intersection | <code>THREE.Intersection</code> | 
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | 

<a name="module_VRInteractiveSurface.VRInteractiveSurface+onRayUpdated"></a>

#### vrInteractiveSurface.onRayUpdated(intersection, [handedness])
**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type |
| --- | --- |
| intersection | <code>THREE.Intersection</code> | 
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | 

<a name="module_VRInteractiveSurface.VRInteractiveSurface+onRayEnded"></a>

#### vrInteractiveSurface.onRayEnded(intersection, [handedness])
**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type |
| --- | --- |
| intersection | <code>THREE.Intersection</code> \| <code>null</code> | 
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> | 

<a name="module_VRInteractiveSurface.VRInteractiveSurface+_emitPointer"></a>

#### vrInteractiveSurface.\_emitPointer(type, intersection, [handedness])
Builds a normalized pointer event and delivers it both to the [_onPointerEvent](_onPointerEvent)
template method (for subclass backends) and to [EventsDispatcher](EventsDispatcher) listeners.

**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | One of [EventTypes](EventTypes). |
| intersection | <code>THREE.Intersection</code> \| <code>null</code> |  |
| [handedness] | <code>&#x27;left&#x27;</code> \| <code>&#x27;right&#x27;</code> |  |

<a name="module_VRInteractiveSurface.VRInteractiveSurface+_buildPointerUV"></a>

#### vrInteractiveSurface.\_buildPointerUV(intersection) ⇒ <code>THREE.Vector2</code> \| <code>undefined</code>
Hook to transform the raw intersection UV before it is emitted. Default: the raw UV.
[VRInteractivePanel](VRInteractivePanel) overrides it to apply its aspect-ratio remap.

**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type |
| --- | --- |
| intersection | <code>THREE.Intersection</code> \| <code>null</code> | 

<a name="module_VRInteractiveSurface.VRInteractiveSurface+setEnabled"></a>

#### vrInteractiveSurface.setEnabled(enabled)
Enables or disables ray testing without changing mesh visibility.

**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  

| Param | Type |
| --- | --- |
| enabled | <code>boolean</code> | 

<a name="module_VRInteractiveSurface.VRInteractiveSurface+refitBoundsTree"></a>

#### vrInteractiveSurface.refitBoundsTree()
Refits the BVH after the geometry was deformed in place (same topology). No-op without BVH.

**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+rebuildBoundsTree"></a>

#### vrInteractiveSurface.rebuildBoundsTree()
Rebuilds the BVH from scratch (topology changed). No-op without BVH.

**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.VRInteractiveSurface+dispose"></a>

#### vrInteractiveSurface.dispose()
Removes controller listeners and releases interaction resources.

**Kind**: instance method of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface.VRInteractiveSurface)  
<a name="module_VRInteractiveSurface.EventTypes"></a>

### VRInteractiveSurface.EventTypes : <code>enum</code>
Pointer event types dispatched by [VRInteractiveSurface](VRInteractiveSurface).
The string values mirror the DOM-like names already used across the panel family.

**Kind**: static enum of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface)  
<a name="module_VRInteractiveSurface..VRInteractiveSurfaceOptions"></a>

### VRInteractiveSurface~VRInteractiveSurfaceOptions : <code>object</code>
Default options for [VRInteractiveSurface](VRInteractiveSurface).

**Kind**: inner typedef of [<code>VRInteractiveSurface</code>](#module_VRInteractiveSurface)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [debugLevel] | <code>number</code> | <code>0</code> | Forwarded to [InteractiveVRObject](InteractiveVRObject) (hit markers). |
| [useBVH] | <code>boolean</code> | <code>false</code> | Forwarded to [InteractiveVRObject](InteractiveVRObject): build a BVH and   use accelerated raycasting. Recommended for dense / high-poly / curved surfaces. |

<a name="module_CanvasInteractiveSurface"></a>

## CanvasInteractiveSurface
Maps controller ray hits on a UV-mapped mesh into canvas pixel coordinates and
optional command hit zones.


* [CanvasInteractiveSurface](#module_CanvasInteractiveSurface)
    * [.CanvasInteractiveSurface](#module_CanvasInteractiveSurface.CanvasInteractiveSurface) ⇐ <code>EventsDispatcher</code>
        * [new exports.CanvasInteractiveSurface(mesh, worldContainer, controllersManager, [options])](#new_module_CanvasInteractiveSurface.CanvasInteractiveSurface_new)
    * [.EventTypes](#module_CanvasInteractiveSurface.EventTypes) : <code>enum</code>
    * [.defaultOptions](#module_CanvasInteractiveSurface.defaultOptions) : <code>object</code>
    * [.uvToCanvasPoint(uv, width, height, [options])](#module_CanvasInteractiveSurface.uvToCanvasPoint) ⇒ <code>Object</code>
    * [.normalizeHitZoneRect(zone, width, height)](#module_CanvasInteractiveSurface.normalizeHitZoneRect) ⇒ <code>Object</code> \| <code>null</code>
    * [.hitTestZones(hitZones, point, width, height)](#module_CanvasInteractiveSurface.hitTestZones) ⇒ <code>object</code> \| <code>null</code>

<a name="module_CanvasInteractiveSurface.CanvasInteractiveSurface"></a>

### CanvasInteractiveSurface.CanvasInteractiveSurface ⇐ <code>EventsDispatcher</code>
Canvas-backed adapter for an application-owned UV-mapped mesh.

The class owns only the canvas texture and pointer/hit-zone translation. The
caller still owns the mesh shape, placement, material choice, and drawing.

**Kind**: static class of [<code>CanvasInteractiveSurface</code>](#module_CanvasInteractiveSurface)  
**Extends**: <code>EventsDispatcher</code>  
<a name="new_module_CanvasInteractiveSurface.CanvasInteractiveSurface_new"></a>

#### new exports.CanvasInteractiveSurface(mesh, worldContainer, controllersManager, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| mesh | <code>THREE.Mesh</code> |  | UV-mapped mesh that receives the canvas texture and pointer hits. |
| worldContainer | <code>THREE.Group</code> \| <code>THREE.Scene</code> |  | Scene node used by the underlying interactive surface. |
| controllersManager | <code>ControllersManager</code> |  | Controller manager used for ray input. |
| [options] | <code>object</code> |  | Canvas surface options. |
| [options.width] | <code>number</code> | <code>1024</code> | Canvas width in pixels. |
| [options.height] | <code>number</code> | <code>512</code> | Canvas height in pixels. |
| [options.canvas] | <code>HTMLCanvasElement</code> \| <code>null</code> | <code></code> | Existing canvas to use instead of creating one. |
| [options.context] | <code>CanvasRenderingContext2D</code> \| <code>null</code> | <code></code> | Existing 2D context. |
| [options.hitZones] | <code>Array.&lt;object&gt;</code> |  | Command zones in normalized or pixel coordinates. |

**Example**  
```js
const surface = new CanvasInteractiveSurface(panelMesh, scene, controllersManager, {
  width: 512,
  height: 256,
  hitZones: [
    { id: 'ok', command: 'confirm', rect: { x: 0.7, y: 0.75, w: 0.25, h: 0.18 } },
  ],
});

surface.context.fillText('Confirm', 360, 210);
surface.updateTexture();
surface.addEventListener(EventTypes.COMMAND, ({ command }) => runCommand(command));
```
<a name="module_CanvasInteractiveSurface.EventTypes"></a>

### CanvasInteractiveSurface.EventTypes : <code>enum</code>
Event type constants dispatched by [CanvasInteractiveSurface](CanvasInteractiveSurface).

**Kind**: static enum of [<code>CanvasInteractiveSurface</code>](#module_CanvasInteractiveSurface)  
<a name="module_CanvasInteractiveSurface.defaultOptions"></a>

### CanvasInteractiveSurface.defaultOptions : <code>object</code>
Default canvas surface options.

**Kind**: static constant of [<code>CanvasInteractiveSurface</code>](#module_CanvasInteractiveSurface)  
<a name="module_CanvasInteractiveSurface.uvToCanvasPoint"></a>

### CanvasInteractiveSurface.uvToCanvasPoint(uv, width, height, [options]) ⇒ <code>Object</code>
Converts normalized UV coordinates into canvas pixel coordinates.

**Kind**: static method of [<code>CanvasInteractiveSurface</code>](#module_CanvasInteractiveSurface)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| uv | <code>THREE.Vector2</code> |  | Mesh UV coordinate. |
| width | <code>number</code> |  | Canvas width in pixels. |
| height | <code>number</code> |  | Canvas height in pixels. |
| [options] | <code>object</code> |  | Conversion options. |
| [options.flipU] | <code>boolean</code> | <code>false</code> | Whether to mirror the U coordinate. |

<a name="module_CanvasInteractiveSurface.normalizeHitZoneRect"></a>

### CanvasInteractiveSurface.normalizeHitZoneRect(zone, width, height) ⇒ <code>Object</code> \| <code>null</code>
Converts a hit-zone rectangle to pixel coordinates.

**Kind**: static method of [<code>CanvasInteractiveSurface</code>](#module_CanvasInteractiveSurface)  

| Param | Type | Description |
| --- | --- | --- |
| zone | <code>object</code> | Hit-zone descriptor. |
| [zone.rect] | <code>Array.&lt;number&gt;</code> \| <code>object</code> | Normalized rect as `[x,y,w,h]` or object. |
| [zone.pixelRect] | <code>Array.&lt;number&gt;</code> \| <code>object</code> | Pixel rect as `[x,y,w,h]` or object. |
| width | <code>number</code> | Canvas width in pixels. |
| height | <code>number</code> | Canvas height in pixels. |

<a name="module_CanvasInteractiveSurface.hitTestZones"></a>

### CanvasInteractiveSurface.hitTestZones(hitZones, point, width, height) ⇒ <code>object</code> \| <code>null</code>
Finds the top-most active hit zone containing a canvas point.

**Kind**: static method of [<code>CanvasInteractiveSurface</code>](#module_CanvasInteractiveSurface)  

| Param | Type | Description |
| --- | --- | --- |
| hitZones | <code>Array.&lt;object&gt;</code> | Hit-zone descriptors. |
| point | <code>Object</code> \| <code>null</code> | Canvas point. |
| width | <code>number</code> | Canvas width in pixels. |
| height | <code>number</code> | Canvas height in pixels. |

<a name="module_VRGuidePanel"></a>

## VRGuidePanel
Provides a canvas-rendered tutorial/wizard panel for XR scenes, with step
navigation, command hit zones, audio, language changes, and completion flow.


* [VRGuidePanel](#module_VRGuidePanel)
    * [.VRGuidePanel](#module_VRGuidePanel.VRGuidePanel) ⇐ <code>VRMenu</code>
        * [new exports.VRGuidePanel(stepsOrWorldContainer, worldOrControllers, controllersOrOptions, [maybeOptions])](#new_module_VRGuidePanel.VRGuidePanel_new)
    * [.EventTypes](#module_VRGuidePanel.EventTypes) : <code>enum</code>

<a name="module_VRGuidePanel.VRGuidePanel"></a>

### VRGuidePanel.VRGuidePanel ⇐ <code>VRMenu</code>
Floating tutorial/wizard panel for XR applications.

Steps provide their own canvas renderer and optional validation event. The
guide only owns flow, hit-zone commands, audio, and lifecycle events.

**Kind**: static class of [<code>VRGuidePanel</code>](#module_VRGuidePanel)  
**Extends**: <code>VRMenu</code>  
<a name="new_module_VRGuidePanel.VRGuidePanel_new"></a>

#### new exports.VRGuidePanel(stepsOrWorldContainer, worldOrControllers, controllersOrOptions, [maybeOptions])
Creates a guide panel. Supports either `(steps, worldContainer, controllersManager, options)`
or `(worldContainer, controllersManager, optionsWithSteps)`.


| Param | Type | Description |
| --- | --- | --- |
| stepsOrWorldContainer | <code>Array.&lt;object&gt;</code> \| <code>THREE.Group</code> | Steps array or world container. |
| worldOrControllers | <code>THREE.Group</code> \| <code>ControllersManager</code> | World container or controllers manager. |
| controllersOrOptions | <code>ControllersManager</code> \| <code>object</code> | Controllers manager or options object. |
| [maybeOptions] | <code>object</code> | Options when the first argument is a steps array. |

**Example**  
```js
const guide = new VRGuidePanel(scene, controllersManager, {
  steps: [
    {
      id: 'welcome',
      render(ctx, guide) {
        ctx.fillText('Welcome', 64, 96);
      },
      hitZones: [{ command: 'next', rect: { x: 0.72, y: 0.78, w: 0.2, h: 0.12 } }],
    },
  ],
});
guide.addEventListener(EventTypes.COMPLETE, () => guide.setVisible(false));
```
<a name="module_VRGuidePanel.EventTypes"></a>

### VRGuidePanel.EventTypes : <code>enum</code>
Event type constants dispatched by [VRGuidePanel](VRGuidePanel).

**Kind**: static enum of [<code>VRGuidePanel</code>](#module_VRGuidePanel)  
<a name="module_DynamicMenuVR"></a>

## DynamicMenuVR
Renders a DynamicMenu instance directly to a canvas texture for fast,frequently-updated VR menus.


* [DynamicMenuVR](#module_DynamicMenuVR)
    * [.DynamicMenuVR](#module_DynamicMenuVR.DynamicMenuVR) ⇐ <code>VRMenu</code>
        * [new exports.DynamicMenuVR(menu, worldContainer, controllersManager, [options])](#new_module_DynamicMenuVR.DynamicMenuVR_new)
        * [._onPointerEvent](#module_DynamicMenuVR.DynamicMenuVR+_onPointerEvent)
        * [.canvas](#module_DynamicMenuVR.DynamicMenuVR+canvas) : <code>HTMLCanvasElement</code>
        * [.renderer](#module_DynamicMenuVR.DynamicMenuVR+renderer) : <code>CanvasRenderer</code>
        * [._updateTextureAspect()](#module_DynamicMenuVR.DynamicMenuVR+_updateTextureAspect)
        * [.dispose()](#module_DynamicMenuVR.DynamicMenuVR+dispose)

<a name="module_DynamicMenuVR.DynamicMenuVR"></a>

### DynamicMenuVR.DynamicMenuVR ⇐ <code>VRMenu</code>
A VR menu panel that renders a [DynamicMenu](#createMenu) directly to aThree.js `CanvasTexture` via `CanvasRenderer`, without going throughhtml-to-image. This makes it significantly faster than [HtmlMenuVR](HtmlMenuVR) fordynamic, frequently-updated menus.The panel subscribes to menu state changes and updates the texture automatically.VR ray pointer events are forwarded to the renderer so buttons and inputs workinside VR.Supports `rendererScale` to control canvas resolution, `rendererMode`(`'commitOnly'` | `'live'`) to control when the renderer redraws, and optionaldiscrete focus navigation and continuous focused-slider adjustment from the left XR thumbstick.

**Kind**: static class of [<code>DynamicMenuVR</code>](#module_DynamicMenuVR)  
**Extends**: <code>VRMenu</code>  

* [.DynamicMenuVR](#module_DynamicMenuVR.DynamicMenuVR) ⇐ <code>VRMenu</code>
    * [new exports.DynamicMenuVR(menu, worldContainer, controllersManager, [options])](#new_module_DynamicMenuVR.DynamicMenuVR_new)
    * [._onPointerEvent](#module_DynamicMenuVR.DynamicMenuVR+_onPointerEvent)
    * [.canvas](#module_DynamicMenuVR.DynamicMenuVR+canvas) : <code>HTMLCanvasElement</code>
    * [.renderer](#module_DynamicMenuVR.DynamicMenuVR+renderer) : <code>CanvasRenderer</code>
    * [._updateTextureAspect()](#module_DynamicMenuVR.DynamicMenuVR+_updateTextureAspect)
    * [.dispose()](#module_DynamicMenuVR.DynamicMenuVR+dispose)

<a name="new_module_DynamicMenuVR.DynamicMenuVR_new"></a>

#### new exports.DynamicMenuVR(menu, worldContainer, controllersManager, [options])

| Param | Type | Description |
| --- | --- | --- |
| menu | <code>object</code> | DynamicMenu instance returned by [createMenu](#createMenu). |
| worldContainer | <code>THREE.Group</code> | Scene node the menu panel is attached to. |
| controllersManager | <code>ControllersManager</code> | The shared ControllersManager instance. |
| [options] | <code>object</code> | Options merged with VRMenu defaults.   Additional properties: `rendererScale` (default `2`), `rendererMode`   (default `'commitOnly'`), `thumbstickNavigation` (default `false`), and   `thumbstickAdjustment` speed-curve settings. |

**Example**  
```js
const menu = createMenu(document.getElementById('menu-root'));const vrMenu = new DynamicMenuVR(menu, scene, controllersManager, {  mode: 'panel',  rendererScale: 2,});
```
<a name="module_DynamicMenuVR.DynamicMenuVR+_onPointerEvent"></a>

#### dynamicMenuVR.\_onPointerEvent
Forwards VR ray pointer events to CanvasRenderer.Y-axis is flipped: Three.js UV has V=0 at bottom; canvas has y=0 at top.

**Kind**: instance property of [<code>DynamicMenuVR</code>](#module_DynamicMenuVR.DynamicMenuVR)  
<a name="module_DynamicMenuVR.DynamicMenuVR+canvas"></a>

#### dynamicMenuVR.canvas : <code>HTMLCanvasElement</code>
The offscreen canvas that the renderer draws into.

**Kind**: instance property of [<code>DynamicMenuVR</code>](#module_DynamicMenuVR.DynamicMenuVR)  
<a name="module_DynamicMenuVR.DynamicMenuVR+renderer"></a>

#### dynamicMenuVR.renderer : <code>CanvasRenderer</code>
The CanvasRenderer responsible for drawing menu state onto the canvas.

**Kind**: instance property of [<code>DynamicMenuVR</code>](#module_DynamicMenuVR.DynamicMenuVR)  
<a name="module_DynamicMenuVR.DynamicMenuVR+_updateTextureAspect"></a>

#### dynamicMenuVR.\_updateTextureAspect()
Reads the complete backing-canvas dimensions and updates the mesh aspect ratioso the panel fits the menu exactly without blank space or distortion.

**Kind**: instance method of [<code>DynamicMenuVR</code>](#module_DynamicMenuVR.DynamicMenuVR)  
<a name="module_DynamicMenuVR.DynamicMenuVR+dispose"></a>

#### dynamicMenuVR.dispose()
Unsubscribes from menu state updates, destroys the renderer, and disposesof all Three.js textures and materials. Call when removing the menu from the scene.

**Kind**: instance method of [<code>DynamicMenuVR</code>](#module_DynamicMenuVR.DynamicMenuVR)  
<a name="module_XRSessionModeButton"></a>

## XRSessionModeButton
Provides a small DOM button that starts and ends WebXR immersive VR or AR
sessions using a Three.js renderer.


* [XRSessionModeButton](#module_XRSessionModeButton)
    * [.XRSessionModeButton](#module_XRSessionModeButton.XRSessionModeButton) ⇐ <code>EventsDispatcher</code>
        * [new exports.XRSessionModeButton(renderer, [options])](#new_module_XRSessionModeButton.XRSessionModeButton_new)
    * [.EventTypes](#module_XRSessionModeButton.EventTypes) : <code>enum</code>
    * [.defaultOptions](#module_XRSessionModeButton.defaultOptions) : <code>object</code>

<a name="module_XRSessionModeButton.XRSessionModeButton"></a>

### XRSessionModeButton.XRSessionModeButton ⇐ <code>EventsDispatcher</code>
DOM button for starting and ending an immersive WebXR session.

The button is created but not appended automatically. Append `button.button`
wherever your application keeps its session controls.

**Kind**: static class of [<code>XRSessionModeButton</code>](#module_XRSessionModeButton)  
**Extends**: <code>EventsDispatcher</code>  
<a name="new_module_XRSessionModeButton.XRSessionModeButton_new"></a>

#### new exports.XRSessionModeButton(renderer, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| renderer | <code>THREE.WebGLRenderer</code> |  | Renderer whose `renderer.xr` will receive the started session. |
| [options] | <code>object</code> |  | Button and session options. |
| [options.mode] | <code>&#x27;immersive-vr&#x27;</code> \| <code>&#x27;immersive-ar&#x27;</code> | <code>&#x27;immersive-vr&#x27;</code> | Session mode requested from WebXR. |
| [options.label] | <code>string</code> \| <code>null</code> | <code>null</code> | Button text before a session starts. |
| [options.activeLabel] | <code>string</code> \| <code>null</code> | <code>null</code> | Button text while a session is active. |
| [options.unsupportedLabel] | <code>string</code> \| <code>null</code> | <code>null</code> | Button text when the mode is unsupported. |
| [options.requiredFeatures] | <code>Array.&lt;string&gt;</code> |  | Required WebXR session features. |
| [options.optionalFeatures] | <code>Array.&lt;string&gt;</code> |  | Optional WebXR session features. |
| [options.sessionInit] | <code>object</code> |  | Extra options merged into `navigator.xr.requestSession`. |
| [options.className] | <code>string</code> | <code>&quot;&#x27;xr-session-mode-button&#x27;&quot;</code> | CSS class applied to the button. |

**Example**  
```js
const xrButton = new XRSessionModeButton(renderer, {
  mode: 'immersive-ar',
  requiredFeatures: ['hit-test'],
  optionalFeatures: ['dom-overlay'],
});
document.body.appendChild(xrButton.button);
```
<a name="module_XRSessionModeButton.EventTypes"></a>

### XRSessionModeButton.EventTypes : <code>enum</code>
Event type constants dispatched by [XRSessionModeButton](XRSessionModeButton).

**Kind**: static enum of [<code>XRSessionModeButton</code>](#module_XRSessionModeButton)  
<a name="module_XRSessionModeButton.defaultOptions"></a>

### XRSessionModeButton.defaultOptions : <code>object</code>
Default DOM button and session options.

**Kind**: static constant of [<code>XRSessionModeButton</code>](#module_XRSessionModeButton)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| mode | <code>&#x27;immersive-vr&#x27;</code> \| <code>&#x27;immersive-ar&#x27;</code> | WebXR session mode. |
| label | <code>string</code> \| <code>null</code> | Button text before a session starts. |
| activeLabel | <code>string</code> \| <code>null</code> | Button text while a session is active. |
| unsupportedLabel | <code>string</code> \| <code>null</code> | Button text when the mode is unsupported. |
| requiredFeatures | <code>Array.&lt;string&gt;</code> | Required WebXR session features. |
| optionalFeatures | <code>Array.&lt;string&gt;</code> | Optional WebXR session features. |
| sessionInit | <code>object</code> | Extra options merged into `navigator.xr.requestSession`. |
| className | <code>string</code> | CSS class applied to the button. |

<a name="module_ARRealWorldHitTestManager"></a>

## ARRealWorldHitTestManager
Provides an event-driven wrapper around WebXR real-world hit testing. Use it
in immersive AR sessions to convert raw `XRHitTestResult` objects into
normalized Three.js-friendly placement data.


* [ARRealWorldHitTestManager](#module_ARRealWorldHitTestManager)
    * [.ARRealWorldHitTestManager](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager) ⇐ <code>EventsDispatcher</code>
        * [new exports.ARRealWorldHitTestManager(rendererOrXRManager, [options])](#new_module_ARRealWorldHitTestManager.ARRealWorldHitTestManager_new)
        * [.start([session])](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+start) ⇒ <code>Promise.&lt;boolean&gt;</code>
        * [.stop()](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+stop) ⇒ <code>void</code>
        * [.update(frame, [referenceSpace])](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+update) ⇒ <code>object</code> \| <code>null</code>
        * [.updateTransient(frame, [referenceSpace])](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+updateTransient) ⇒ <code>Array.&lt;object&gt;</code>
    * [.EventTypes](#module_ARRealWorldHitTestManager.EventTypes) : <code>enum</code>
    * [.defaultOptions](#module_ARRealWorldHitTestManager.defaultOptions) : <code>object</code>

<a name="module_ARRealWorldHitTestManager.ARRealWorldHitTestManager"></a>

### ARRealWorldHitTestManager.ARRealWorldHitTestManager ⇐ <code>EventsDispatcher</code>
Manages WebXR AR hit-test sources and exposes normalized hit data.

The manager accepts either a `THREE.WebGLRenderer` or a `THREE.WebXRManager`.
Call [ARRealWorldHitTestManager#update](ARRealWorldHitTestManager#update) from the XR animation loop with
the current `XRFrame`. Events include a normalized `hit` object with
`matrix`, `position`, `quaternion`, `normal`, and `alignment` fields.

**Kind**: static class of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager)  
**Extends**: <code>EventsDispatcher</code>  

* [.ARRealWorldHitTestManager](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager) ⇐ <code>EventsDispatcher</code>
    * [new exports.ARRealWorldHitTestManager(rendererOrXRManager, [options])](#new_module_ARRealWorldHitTestManager.ARRealWorldHitTestManager_new)
    * [.start([session])](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+start) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.stop()](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+stop) ⇒ <code>void</code>
    * [.update(frame, [referenceSpace])](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+update) ⇒ <code>object</code> \| <code>null</code>
    * [.updateTransient(frame, [referenceSpace])](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+updateTransient) ⇒ <code>Array.&lt;object&gt;</code>

<a name="new_module_ARRealWorldHitTestManager.ARRealWorldHitTestManager_new"></a>

#### new exports.ARRealWorldHitTestManager(rendererOrXRManager, [options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| rendererOrXRManager | <code>THREE.WebGLRenderer</code> \| <code>THREE.WebXRManager</code> |  | Renderer or XR manager used to access the active XR session. |
| [options] | <code>object</code> |  | Hit-test source options. |
| [options.entityTypes] | <code>Array.&lt;string&gt;</code> \| <code>null</code> |  | Optional WebXR entity types requested from the runtime. |
| [options.transientInputProfile] | <code>string</code> \| <code>null</code> |  | Optional profile passed to transient input hit testing. |
| [options.autoStart] | <code>boolean</code> | <code>true</code> | Automatically start and stop with XR session events. |

**Example**  
```js
const hitTest = new ARRealWorldHitTestManager(renderer, {
  entityTypes: ['plane'],
});

hitTest.addEventListener(EventTypes.HIT_UPDATE, ({ hit }) => {
  reticle.updateFromHit(hit);
});

renderer.setAnimationLoop((time, frame) => {
  hitTest.update(frame);
  renderer.render(scene, camera);
});
```
<a name="module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+start"></a>

#### arRealWorldHitTestManager.start([session]) ⇒ <code>Promise.&lt;boolean&gt;</code>
Creates the WebXR hit-test source for the active AR session.

**Kind**: instance method of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - `true` when hit testing was started.  

| Param | Type | Description |
| --- | --- | --- |
| [session] | <code>XRSession</code> | Session to use; defaults to the current renderer XR session. |

<a name="module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+stop"></a>

#### arRealWorldHitTestManager.stop() ⇒ <code>void</code>
Cancels active hit-test sources and clears current hit state.

**Kind**: instance method of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager)  
<a name="module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+update"></a>

#### arRealWorldHitTestManager.update(frame, [referenceSpace]) ⇒ <code>object</code> \| <code>null</code>
Updates hit testing for the current XR frame.

**Kind**: instance method of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager)  
**Returns**: <code>object</code> \| <code>null</code> - Normalized hit information, or `null` when no hit is available.  

| Param | Type | Description |
| --- | --- | --- |
| frame | <code>XRFrame</code> | Current XR frame from `renderer.setAnimationLoop`. |
| [referenceSpace] | <code>XRReferenceSpace</code> | Reference space used to resolve hit poses. |

<a name="module_ARRealWorldHitTestManager.ARRealWorldHitTestManager+updateTransient"></a>

#### arRealWorldHitTestManager.updateTransient(frame, [referenceSpace]) ⇒ <code>Array.&lt;object&gt;</code>
Updates transient input hit testing, usually for touch-screen or pointer based AR input.

**Kind**: instance method of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager.ARRealWorldHitTestManager)  
**Returns**: <code>Array.&lt;object&gt;</code> - Normalized transient hits.  

| Param | Type | Description |
| --- | --- | --- |
| frame | <code>XRFrame</code> | Current XR frame. |
| [referenceSpace] | <code>XRReferenceSpace</code> | Reference space used to resolve hit poses. |

<a name="module_ARRealWorldHitTestManager.EventTypes"></a>

### ARRealWorldHitTestManager.EventTypes : <code>enum</code>
Event type constants dispatched by [ARRealWorldHitTestManager](ARRealWorldHitTestManager).

**Kind**: static enum of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager)  
<a name="module_ARRealWorldHitTestManager.defaultOptions"></a>

### ARRealWorldHitTestManager.defaultOptions : <code>object</code>
Default hit-test source options.

**Kind**: static constant of [<code>ARRealWorldHitTestManager</code>](#module_ARRealWorldHitTestManager)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| entityTypes | <code>Array.&lt;string&gt;</code> \| <code>null</code> | Optional WebXR entity types such as `['plane']`. |
| transientInputProfile | <code>string</code> \| <code>null</code> | Optional profile for transient input hit testing. |
| autoStart | <code>boolean</code> | Whether to start and stop with renderer XR session events. |

<a name="module_ARPlacementReticle"></a>

## ARPlacementReticle
Exports a lightweight Three.js reticle for previewing where AR content will
be placed on a real-world hit-test result.


* [ARPlacementReticle](#module_ARPlacementReticle)
    * [.ARPlacementReticle](#module_ARPlacementReticle.ARPlacementReticle) ⇐ <code>THREE.Group</code>
        * [new exports.ARPlacementReticle([options])](#new_module_ARPlacementReticle.ARPlacementReticle_new)
        * [.setValid(valid)](#module_ARPlacementReticle.ARPlacementReticle+setValid) ⇒ <code>void</code>
        * [.updateFromHit(hit)](#module_ARPlacementReticle.ARPlacementReticle+updateFromHit) ⇒ <code>void</code>
        * [.dispose()](#module_ARPlacementReticle.ARPlacementReticle+dispose) ⇒ <code>void</code>
    * [.defaultOptions](#module_ARPlacementReticle.defaultOptions) : <code>object</code>

<a name="module_ARPlacementReticle.ARPlacementReticle"></a>

### ARPlacementReticle.ARPlacementReticle ⇐ <code>THREE.Group</code>
Visual marker that follows an AR hit-test pose.

Add it to the scene once, then call [ARPlacementReticle#updateFromHit](ARPlacementReticle#updateFromHit)
with hits returned by [ARRealWorldHitTestManager](ARRealWorldHitTestManager). The reticle hides
itself when no hit is available.

**Kind**: static class of [<code>ARPlacementReticle</code>](#module_ARPlacementReticle)  
**Extends**: <code>THREE.Group</code>  

* [.ARPlacementReticle](#module_ARPlacementReticle.ARPlacementReticle) ⇐ <code>THREE.Group</code>
    * [new exports.ARPlacementReticle([options])](#new_module_ARPlacementReticle.ARPlacementReticle_new)
    * [.setValid(valid)](#module_ARPlacementReticle.ARPlacementReticle+setValid) ⇒ <code>void</code>
    * [.updateFromHit(hit)](#module_ARPlacementReticle.ARPlacementReticle+updateFromHit) ⇒ <code>void</code>
    * [.dispose()](#module_ARPlacementReticle.ARPlacementReticle+dispose) ⇒ <code>void</code>

<a name="new_module_ARPlacementReticle.ARPlacementReticle_new"></a>

#### new exports.ARPlacementReticle([options])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>object</code> |  | Visual reticle options. |
| [options.radius] | <code>number</code> | <code>0.18</code> | Reticle radius in meters. |
| [options.color] | <code>number</code> | <code>0x32d583</code> | Valid placement color. |
| [options.invalidColor] | <code>number</code> | <code>0xffb020</code> | Invalid placement color. |
| [options.opacity] | <code>number</code> | <code>0.9</code> | Reticle opacity. |
| [options.previewObject] | <code>THREE.Object3D</code> \| <code>null</code> | <code></code> | Optional preview object cloned into the reticle. |

**Example**  
```js
const reticle = new ARPlacementReticle({ radius: 0.2 });
scene.add(reticle);

hitTest.addEventListener(HitTestEventTypes.HIT_UPDATE, ({ hit }) => {
  reticle.updateFromHit(hit);
});
```
<a name="module_ARPlacementReticle.ARPlacementReticle+setValid"></a>

#### arPlacementReticle.setValid(valid) ⇒ <code>void</code>
Switches the reticle between valid and invalid visual states.

**Kind**: instance method of [<code>ARPlacementReticle</code>](#module_ARPlacementReticle.ARPlacementReticle)  

| Param | Type | Description |
| --- | --- | --- |
| valid | <code>boolean</code> | Whether the current placement is valid. |

<a name="module_ARPlacementReticle.ARPlacementReticle+updateFromHit"></a>

#### arPlacementReticle.updateFromHit(hit) ⇒ <code>void</code>
Copies a normalized AR hit matrix into the reticle and toggles visibility.

**Kind**: instance method of [<code>ARPlacementReticle</code>](#module_ARPlacementReticle.ARPlacementReticle)  

| Param | Type | Description |
| --- | --- | --- |
| hit | <code>object</code> \| <code>null</code> | Normalized hit returned by [ARRealWorldHitTestManager#update](ARRealWorldHitTestManager#update). |

<a name="module_ARPlacementReticle.ARPlacementReticle+dispose"></a>

#### arPlacementReticle.dispose() ⇒ <code>void</code>
Disposes geometries and materials owned by the reticle.

**Kind**: instance method of [<code>ARPlacementReticle</code>](#module_ARPlacementReticle.ARPlacementReticle)  
<a name="module_ARPlacementReticle.defaultOptions"></a>

### ARPlacementReticle.defaultOptions : <code>object</code>
Default visual options for [ARPlacementReticle](ARPlacementReticle).

**Kind**: static constant of [<code>ARPlacementReticle</code>](#module_ARPlacementReticle)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| radius | <code>number</code> | Reticle radius in meters. |
| color | <code>number</code> | Hex color used for valid placement hits. |
| invalidColor | <code>number</code> | Hex color used when placement is invalid. |
| opacity | <code>number</code> | Material opacity. |
| previewObject | <code>THREE.Object3D</code> \| <code>null</code> | Optional object cloned into the reticle. |

<a name="module_ARWorldSurfaceProvider"></a>

## ARWorldSurfaceProvider
Converts AR hit-test events into a stable "current surface" object that can
be consumed by placement, anchoring, or UI systems.


* [ARWorldSurfaceProvider](#module_ARWorldSurfaceProvider)
    * [.ARWorldSurfaceProvider](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider) ⇐ <code>EventsDispatcher</code>
        * [new exports.ARWorldSurfaceProvider([hitTestManager])](#new_module_ARWorldSurfaceProvider.ARWorldSurfaceProvider_new)
        * [.connect(hitTestManager)](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+connect) ⇒ <code>void</code>
        * [.updateFromHit(hit)](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+updateFromHit) ⇒ <code>void</code>
        * [.clear()](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+clear) ⇒ <code>void</code>
        * [.getCurrentSurface()](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+getCurrentSurface) ⇒ <code>object</code> \| <code>null</code>
    * [.EventTypes](#module_ARWorldSurfaceProvider.EventTypes) : <code>enum</code>

<a name="module_ARWorldSurfaceProvider.ARWorldSurfaceProvider"></a>

### ARWorldSurfaceProvider.ARWorldSurfaceProvider ⇐ <code>EventsDispatcher</code>
Tracks the most recent AR world surface from a hit-test manager.

The provider stores a compact surface object with `id`, `entityType`,
`alignment`, `matrix`, `position`, `normal`, and the original `hit`.

**Kind**: static class of [<code>ARWorldSurfaceProvider</code>](#module_ARWorldSurfaceProvider)  
**Extends**: <code>EventsDispatcher</code>  

* [.ARWorldSurfaceProvider](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider) ⇐ <code>EventsDispatcher</code>
    * [new exports.ARWorldSurfaceProvider([hitTestManager])](#new_module_ARWorldSurfaceProvider.ARWorldSurfaceProvider_new)
    * [.connect(hitTestManager)](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+connect) ⇒ <code>void</code>
    * [.updateFromHit(hit)](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+updateFromHit) ⇒ <code>void</code>
    * [.clear()](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+clear) ⇒ <code>void</code>
    * [.getCurrentSurface()](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+getCurrentSurface) ⇒ <code>object</code> \| <code>null</code>

<a name="new_module_ARWorldSurfaceProvider.ARWorldSurfaceProvider_new"></a>

#### new exports.ARWorldSurfaceProvider([hitTestManager])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [hitTestManager] | <code>ARRealWorldHitTestManager</code> \| <code>null</code> | <code></code> | Optional manager to connect immediately. |

**Example**  
```js
const surfaces = new ARWorldSurfaceProvider(hitTestManager);
surfaces.addEventListener(EventTypes.SURFACE_UPDATE, ({ surface }) => {
  placementPreview.matrix.copy(surface.matrix);
});
```
<a name="module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+connect"></a>

#### arWorldSurfaceProvider.connect(hitTestManager) ⇒ <code>void</code>
Subscribes to hit-test events and keeps this provider synchronized.

**Kind**: instance method of [<code>ARWorldSurfaceProvider</code>](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider)  

| Param | Type | Description |
| --- | --- | --- |
| hitTestManager | <code>ARRealWorldHitTestManager</code> | Source hit-test manager. |

<a name="module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+updateFromHit"></a>

#### arWorldSurfaceProvider.updateFromHit(hit) ⇒ <code>void</code>
Updates the current surface from a normalized AR hit.

**Kind**: instance method of [<code>ARWorldSurfaceProvider</code>](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider)  

| Param | Type | Description |
| --- | --- | --- |
| hit | <code>object</code> \| <code>null</code> | Normalized hit data, or `null` to clear. |

<a name="module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+clear"></a>

#### arWorldSurfaceProvider.clear() ⇒ <code>void</code>
Clears the current surface and dispatches [EventTypes.SURFACE_LOST](EventTypes.SURFACE_LOST).

**Kind**: instance method of [<code>ARWorldSurfaceProvider</code>](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider)  
<a name="module_ARWorldSurfaceProvider.ARWorldSurfaceProvider+getCurrentSurface"></a>

#### arWorldSurfaceProvider.getCurrentSurface() ⇒ <code>object</code> \| <code>null</code>
Returns the last known AR surface.

**Kind**: instance method of [<code>ARWorldSurfaceProvider</code>](#module_ARWorldSurfaceProvider.ARWorldSurfaceProvider)  
<a name="module_ARWorldSurfaceProvider.EventTypes"></a>

### ARWorldSurfaceProvider.EventTypes : <code>enum</code>
Event type constants dispatched by [ARWorldSurfaceProvider](ARWorldSurfaceProvider).

**Kind**: static enum of [<code>ARWorldSurfaceProvider</code>](#module_ARWorldSurfaceProvider)  
<a name="module_XRAnchorManager"></a>

## XRAnchorManager
Maintains WebXR anchors and optionally keeps attached Three.js objects aligned
with those anchors as tracking updates.


* [XRAnchorManager](#module_XRAnchorManager)
    * [.XRAnchorManager](#module_XRAnchorManager.XRAnchorManager) ⇐ <code>EventsDispatcher</code>
        * [new exports.XRAnchorManager()](#new_module_XRAnchorManager.XRAnchorManager_new)
        * [.isTrackingAnchors](#module_XRAnchorManager.XRAnchorManager+isTrackingAnchors) : <code>boolean</code>
        * [.createAnchorFromHit(hit, [object])](#module_XRAnchorManager.XRAnchorManager+createAnchorFromHit) ⇒ <code>Promise.&lt;(object\|null)&gt;</code>
        * [.update(frame, referenceSpace)](#module_XRAnchorManager.XRAnchorManager+update) ⇒ <code>void</code>
        * [.remove(entryOrAnchor)](#module_XRAnchorManager.XRAnchorManager+remove) ⇒ <code>void</code>
        * [.clear()](#module_XRAnchorManager.XRAnchorManager+clear) ⇒ <code>void</code>
    * [.EventTypes](#module_XRAnchorManager.EventTypes) : <code>enum</code>

<a name="module_XRAnchorManager.XRAnchorManager"></a>

### XRAnchorManager.XRAnchorManager ⇐ <code>EventsDispatcher</code>
Tracks WebXR anchors created from AR hit-test results.

If an object is passed to [XRAnchorManager#createAnchorFromHit](XRAnchorManager#createAnchorFromHit), the
manager updates that object's transform every frame while the anchor is
tracked.

**Kind**: static class of [<code>XRAnchorManager</code>](#module_XRAnchorManager)  
**Extends**: <code>EventsDispatcher</code>  

* [.XRAnchorManager](#module_XRAnchorManager.XRAnchorManager) ⇐ <code>EventsDispatcher</code>
    * [new exports.XRAnchorManager()](#new_module_XRAnchorManager.XRAnchorManager_new)
    * [.isTrackingAnchors](#module_XRAnchorManager.XRAnchorManager+isTrackingAnchors) : <code>boolean</code>
    * [.createAnchorFromHit(hit, [object])](#module_XRAnchorManager.XRAnchorManager+createAnchorFromHit) ⇒ <code>Promise.&lt;(object\|null)&gt;</code>
    * [.update(frame, referenceSpace)](#module_XRAnchorManager.XRAnchorManager+update) ⇒ <code>void</code>
    * [.remove(entryOrAnchor)](#module_XRAnchorManager.XRAnchorManager+remove) ⇒ <code>void</code>
    * [.clear()](#module_XRAnchorManager.XRAnchorManager+clear) ⇒ <code>void</code>

<a name="new_module_XRAnchorManager.XRAnchorManager_new"></a>

#### new exports.XRAnchorManager()
Creates an empty anchor manager.

**Example**  
```js
const anchors = new XRAnchorManager();
const entry = await anchors.createAnchorFromHit(hit, placedObject);

renderer.setAnimationLoop((time, frame) => {
  anchors.update(frame, renderer.xr.getReferenceSpace());
});
```
<a name="module_XRAnchorManager.XRAnchorManager+isTrackingAnchors"></a>

#### xrAnchorManager.isTrackingAnchors : <code>boolean</code>
Whether at least one anchor is currently tracked by this manager.

**Kind**: instance property of [<code>XRAnchorManager</code>](#module_XRAnchorManager.XRAnchorManager)  
<a name="module_XRAnchorManager.XRAnchorManager+createAnchorFromHit"></a>

#### xrAnchorManager.createAnchorFromHit(hit, [object]) ⇒ <code>Promise.&lt;(object\|null)&gt;</code>
Creates a WebXR anchor from a normalized AR hit-test result.

**Kind**: instance method of [<code>XRAnchorManager</code>](#module_XRAnchorManager.XRAnchorManager)  
**Returns**: <code>Promise.&lt;(object\|null)&gt;</code> - Anchor entry, or `null` when unavailable or rejected.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| hit | <code>object</code> |  | Normalized hit returned by [ARRealWorldHitTestManager](ARRealWorldHitTestManager). |
| [object] | <code>THREE.Object3D</code> \| <code>null</code> | <code></code> | Optional object whose transform should follow the anchor. |

<a name="module_XRAnchorManager.XRAnchorManager+update"></a>

#### xrAnchorManager.update(frame, referenceSpace) ⇒ <code>void</code>
Updates tracked anchors and attached objects for the current XR frame.

**Kind**: instance method of [<code>XRAnchorManager</code>](#module_XRAnchorManager.XRAnchorManager)  

| Param | Type | Description |
| --- | --- | --- |
| frame | <code>XRFrame</code> | Current XR frame. |
| referenceSpace | <code>XRReferenceSpace</code> | Reference space used to resolve anchor poses. |

<a name="module_XRAnchorManager.XRAnchorManager+remove"></a>

#### xrAnchorManager.remove(entryOrAnchor) ⇒ <code>void</code>
Removes one anchor entry or raw `XRAnchor` from the manager.

**Kind**: instance method of [<code>XRAnchorManager</code>](#module_XRAnchorManager.XRAnchorManager)  

| Param | Type | Description |
| --- | --- | --- |
| entryOrAnchor | <code>object</code> \| <code>XRAnchor</code> | Entry returned by `createAnchorFromHit`, or the raw anchor. |

<a name="module_XRAnchorManager.XRAnchorManager+clear"></a>

#### xrAnchorManager.clear() ⇒ <code>void</code>
Removes all tracked anchors.

**Kind**: instance method of [<code>XRAnchorManager</code>](#module_XRAnchorManager.XRAnchorManager)  
<a name="module_XRAnchorManager.EventTypes"></a>

### XRAnchorManager.EventTypes : <code>enum</code>
Event type constants dispatched by [XRAnchorManager](XRAnchorManager).

**Kind**: static enum of [<code>XRAnchorManager</code>](#module_XRAnchorManager)  
<a name="module_ARDepthOcclusionManager"></a>

## ARDepthOcclusionManager
Wraps WebXR depth-sensing access and exposes a small state/event API for AR
scenes that need real-world depth awareness.


* [ARDepthOcclusionManager](#module_ARDepthOcclusionManager)
    * [.ARDepthOcclusionManager](#module_ARDepthOcclusionManager.ARDepthOcclusionManager) ⇐ <code>EventsDispatcher</code>
        * [new exports.ARDepthOcclusionManager([renderer])](#new_module_ARDepthOcclusionManager.ARDepthOcclusionManager_new)
        * [.update(frame)](#module_ARDepthOcclusionManager.ARDepthOcclusionManager+update) ⇒ <code>object</code> \| <code>null</code>
        * [.createDepthMaskMaterial([options])](#module_ARDepthOcclusionManager.ARDepthOcclusionManager+createDepthMaskMaterial) ⇒ <code>THREE.MeshBasicMaterial</code>
        * [.getState()](#module_ARDepthOcclusionManager.ARDepthOcclusionManager+getState) ⇒ <code>Object</code>
    * [.EventTypes](#module_ARDepthOcclusionManager.EventTypes) : <code>enum</code>

<a name="module_ARDepthOcclusionManager.ARDepthOcclusionManager"></a>

### ARDepthOcclusionManager.ARDepthOcclusionManager ⇐ <code>EventsDispatcher</code>
Reads WebXR depth information from the active XR frame.

This class does not implement a complete occlusion shader by itself. It
centralizes depth availability checks, stores the last depth-information
object, and provides helper material creation for simple depth-mask meshes.

**Kind**: static class of [<code>ARDepthOcclusionManager</code>](#module_ARDepthOcclusionManager)  
**Extends**: <code>EventsDispatcher</code>  

* [.ARDepthOcclusionManager](#module_ARDepthOcclusionManager.ARDepthOcclusionManager) ⇐ <code>EventsDispatcher</code>
    * [new exports.ARDepthOcclusionManager([renderer])](#new_module_ARDepthOcclusionManager.ARDepthOcclusionManager_new)
    * [.update(frame)](#module_ARDepthOcclusionManager.ARDepthOcclusionManager+update) ⇒ <code>object</code> \| <code>null</code>
    * [.createDepthMaskMaterial([options])](#module_ARDepthOcclusionManager.ARDepthOcclusionManager+createDepthMaskMaterial) ⇒ <code>THREE.MeshBasicMaterial</code>
    * [.getState()](#module_ARDepthOcclusionManager.ARDepthOcclusionManager+getState) ⇒ <code>Object</code>

<a name="new_module_ARDepthOcclusionManager.ARDepthOcclusionManager_new"></a>

#### new exports.ARDepthOcclusionManager([renderer])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [renderer] | <code>THREE.WebGLRenderer</code> \| <code>null</code> | <code></code> | Renderer used to access the XR camera. |

**Example**  
```js
const depth = new ARDepthOcclusionManager(renderer);
depth.addEventListener(EventTypes.DEPTH_UNAVAILABLE, ({ reason }) => {
  console.warn(reason);
});

renderer.setAnimationLoop((time, frame) => {
  depth.update(frame);
});
```
<a name="module_ARDepthOcclusionManager.ARDepthOcclusionManager+update"></a>

#### arDepthOcclusionManager.update(frame) ⇒ <code>object</code> \| <code>null</code>
Reads depth information for the current XR frame.

**Kind**: instance method of [<code>ARDepthOcclusionManager</code>](#module_ARDepthOcclusionManager.ARDepthOcclusionManager)  
**Returns**: <code>object</code> \| <code>null</code> - Depth information, or `null` when unavailable.  

| Param | Type | Description |
| --- | --- | --- |
| frame | <code>XRFrame</code> | Current XR frame. |

<a name="module_ARDepthOcclusionManager.ARDepthOcclusionManager+createDepthMaskMaterial"></a>

#### arDepthOcclusionManager.createDepthMaskMaterial([options]) ⇒ <code>THREE.MeshBasicMaterial</code>
Creates a material suitable for invisible depth-mask geometry.

**Kind**: instance method of [<code>ARDepthOcclusionManager</code>](#module_ARDepthOcclusionManager.ARDepthOcclusionManager)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>object</code> |  | Material options. |
| [options.color] | <code>number</code> | <code>0x000000</code> | Debug color; color writes are disabled. |
| [options.side] | <code>THREE.Side</code> | <code>THREE.DoubleSide</code> | Render side for the mask. |

<a name="module_ARDepthOcclusionManager.ARDepthOcclusionManager+getState"></a>

#### arDepthOcclusionManager.getState() ⇒ <code>Object</code>
Returns the latest depth availability state.

**Kind**: instance method of [<code>ARDepthOcclusionManager</code>](#module_ARDepthOcclusionManager.ARDepthOcclusionManager)  
<a name="module_ARDepthOcclusionManager.EventTypes"></a>

### ARDepthOcclusionManager.EventTypes : <code>enum</code>
Event type constants dispatched by [ARDepthOcclusionManager](ARDepthOcclusionManager).

**Kind**: static enum of [<code>ARDepthOcclusionManager</code>](#module_ARDepthOcclusionManager)  
<a name="module_XRInteractionModeAdapter"></a>

## XRInteractionModeAdapter
Detects whether the current XR session is using world-space controllers,
screen-space input, or pointer fallback input, then exposes consistent select
events and ray helpers.


* [XRInteractionModeAdapter](#module_XRInteractionModeAdapter)
    * [.XRInteractionModeAdapter](#module_XRInteractionModeAdapter.XRInteractionModeAdapter) ⇐ <code>EventsDispatcher</code>
        * [new exports.XRInteractionModeAdapter(rendererOrXRManager, [options])](#new_module_XRInteractionModeAdapter.XRInteractionModeAdapter_new)
        * [.connectSession(session)](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+connectSession) ⇒ <code>void</code>
        * [.disconnectSession()](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+disconnectSession) ⇒ <code>void</code>
        * [.update([session])](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+update) ⇒ <code>string</code>
        * [.getMode()](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+getMode) ⇒ <code>string</code>
        * [.getRayFromSelectEvent(event, referenceSpace)](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+getRayFromSelectEvent) ⇒ <code>THREE.Ray</code> \| <code>null</code>
        * [.getViewerRay(camera)](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+getViewerRay) ⇒ <code>THREE.Ray</code>
    * [.InteractionModes](#module_XRInteractionModeAdapter.InteractionModes) : <code>enum</code>
    * [.EventTypes](#module_XRInteractionModeAdapter.EventTypes) : <code>enum</code>

<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter"></a>

### XRInteractionModeAdapter.XRInteractionModeAdapter ⇐ <code>EventsDispatcher</code>
Normalizes AR/VR input mode detection and select events.

Use this when the same placement or interaction feature should work with
Quest controllers, AR screen taps, and regular pointer fallback input.

**Kind**: static class of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter)  
**Extends**: <code>EventsDispatcher</code>  

* [.XRInteractionModeAdapter](#module_XRInteractionModeAdapter.XRInteractionModeAdapter) ⇐ <code>EventsDispatcher</code>
    * [new exports.XRInteractionModeAdapter(rendererOrXRManager, [options])](#new_module_XRInteractionModeAdapter.XRInteractionModeAdapter_new)
    * [.connectSession(session)](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+connectSession) ⇒ <code>void</code>
    * [.disconnectSession()](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+disconnectSession) ⇒ <code>void</code>
    * [.update([session])](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+update) ⇒ <code>string</code>
    * [.getMode()](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+getMode) ⇒ <code>string</code>
    * [.getRayFromSelectEvent(event, referenceSpace)](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+getRayFromSelectEvent) ⇒ <code>THREE.Ray</code> \| <code>null</code>
    * [.getViewerRay(camera)](#module_XRInteractionModeAdapter.XRInteractionModeAdapter+getViewerRay) ⇒ <code>THREE.Ray</code>

<a name="new_module_XRInteractionModeAdapter.XRInteractionModeAdapter_new"></a>

#### new exports.XRInteractionModeAdapter(rendererOrXRManager, [options])

| Param | Type | Description |
| --- | --- | --- |
| rendererOrXRManager | <code>THREE.WebGLRenderer</code> \| <code>THREE.WebXRManager</code> | Renderer or XR manager that owns the session. |
| [options] | <code>object</code> | Adapter options. |
| [options.mode] | <code>string</code> | Optional forced mode from [InteractionModes](InteractionModes). |

**Example**  
```js
const modes = new XRInteractionModeAdapter(renderer);
modes.addEventListener(EventTypes.SELECT, (event) => {
  const ray = modes.getRayFromSelectEvent(event.originalEvent, renderer.xr.getReferenceSpace());
});
```
<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter+connectSession"></a>

#### xrInteractionModeAdapter.connectSession(session) ⇒ <code>void</code>
Connects the adapter to an XR session and subscribes to select events.

**Kind**: instance method of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter.XRInteractionModeAdapter)  

| Param | Type | Description |
| --- | --- | --- |
| session | <code>XRSession</code> \| <code>null</code> | Session to observe. |

<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter+disconnectSession"></a>

#### xrInteractionModeAdapter.disconnectSession() ⇒ <code>void</code>
Removes listeners from the current XR session.

**Kind**: instance method of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter.XRInteractionModeAdapter)  
<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter+update"></a>

#### xrInteractionModeAdapter.update([session]) ⇒ <code>string</code>
Re-detects the current interaction mode.

**Kind**: instance method of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter.XRInteractionModeAdapter)  
**Returns**: <code>string</code> - Current value from [InteractionModes](InteractionModes).  

| Param | Type | Description |
| --- | --- | --- |
| [session] | <code>XRSession</code> \| <code>null</code> | Session to inspect. |

<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter+getMode"></a>

#### xrInteractionModeAdapter.getMode() ⇒ <code>string</code>
Returns the current interaction mode.

**Kind**: instance method of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter.XRInteractionModeAdapter)  
<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter+getRayFromSelectEvent"></a>

#### xrInteractionModeAdapter.getRayFromSelectEvent(event, referenceSpace) ⇒ <code>THREE.Ray</code> \| <code>null</code>
Builds a Three.js ray from an XR `select` event.

**Kind**: instance method of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter.XRInteractionModeAdapter)  

| Param | Type | Description |
| --- | --- | --- |
| event | <code>XRInputSourceEvent</code> | Original WebXR select event. |
| referenceSpace | <code>XRReferenceSpace</code> | Reference space used to resolve the target ray pose. |

<a name="module_XRInteractionModeAdapter.XRInteractionModeAdapter+getViewerRay"></a>

#### xrInteractionModeAdapter.getViewerRay(camera) ⇒ <code>THREE.Ray</code>
Builds a forward ray from a camera for non-XR or pointer fallback selection.

**Kind**: instance method of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter.XRInteractionModeAdapter)  

| Param | Type | Description |
| --- | --- | --- |
| camera | <code>THREE.Camera</code> | Camera used as ray origin and direction source. |

<a name="module_XRInteractionModeAdapter.InteractionModes"></a>

### XRInteractionModeAdapter.InteractionModes : <code>enum</code>
Supported high-level interaction modes.

**Kind**: static enum of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter)  
<a name="module_XRInteractionModeAdapter.EventTypes"></a>

### XRInteractionModeAdapter.EventTypes : <code>enum</code>
Event type constants dispatched by [XRInteractionModeAdapter](XRInteractionModeAdapter).

**Kind**: static enum of [<code>XRInteractionModeAdapter</code>](#module_XRInteractionModeAdapter)  
<a name="UIL"></a>

## UIL : <code>object</code>
Re-export of the vendored UIL library used by [UILMenuVR](UILMenuVR). Consumers thatbuild UIL panels for UILMenuVR must use this same instance.

**Kind**: global namespace  
<a name="createMenu"></a>

## createMenu(menuContainer, [options]) ⇒ <code>object</code>
Factory function that creates a DynamicMenu instance and mounts it into theprovided container element. The returned object is passed to [DynamicMenuVR](DynamicMenuVR)to render the menu inside a WebXR scene.

**Kind**: global function  
**Returns**: <code>object</code> - A DynamicMenu instance with `subscribe`, `getMenuState`, and `executeCommand` methods.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| menuContainer | <code>HTMLElement</code> |  | The DOM element that hosts the menu React app. |
| [options] | <code>object</code> | <code>{}</code> | Optional configuration forwarded to the DynamicMenu. |

**Example**  
```js
const menu = createMenu(document.getElementById('menu-root'));const vrMenu = new DynamicMenuVR(menu, scene, controllersManager);
```
