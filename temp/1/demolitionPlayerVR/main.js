import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
	ControllersManager,
	CMEventTypes,
	DynamicMenuVR,
	XRTeleportMoveControl,
	createMenu,
} from '../vendor/xrComponents.js';

import { BakedPlayerCPU } from '../recordingPipeline/playback/PlayerCPU.js';
import { loadRecording, makeStyleResolver } from '../recordingPipeline/recording/recording.js';
import { getMaterialStyle } from '../towerSim/tower/recipes/materials.js';
import { fitDirectionalShadow } from '../shadowFit.js';

// VR playback app: same recordings library/backend as src/player.js, but viewed from
// inside the scene with a headset. Recordings are pre-baked (metric units, matching the
// classicGrid recipe's slab size), so the world is walked/teleported at real scale —
// no extra scaling needed between desktop and VR.
//
// KNOWN BLOCKER (three.js 0.184, the latest release as of writing): entering an XR
// session crashes during the first shader compile against the stereo ArrayCamera —
//   THREE.TSL: TypeError: Cannot destructure property 'camera' of 'undefined'
//   at UniformArrayNode.<anonymous> ... cameraPosition's onRenderUpdate callback
// three.js's built-in `cameraPosition` node (used by any standard/physical
// material — not just shadows) lazily builds a per-eye uniform array the first
// time it's compiled against an `ArrayCamera` (camera.isArrayCamera with >0
// sub-cameras, i.e. WebXR stereo). That lazy `setup()` calls `this.update()` with
// no `frame` argument, but the registered callback destructures `{ camera }` from
// it — so it throws on `undefined`. This reproduced with forceWebGL (required
// here since WebXR isn't supported on a real WebGPU backend in this version) and
// with shadow maps both off and on, so it isn't specific to this app's shaders or
// to shadows — it's three.js's stereo-camera node path itself. No workaround
// found that doesn't mean patching three.js internals at runtime; entering VR is
// disabled below (the button explains why) until a future three.js release fixes
// this. Everything else in this file (menu, teleport, recordings, CPU playback)
// works — only the actual XR session is blocked.

const PLAYBACK_SPEEDS = [1, 0.5, 0.25, 0.2, 0.1];
let speedIndex = 0;

let renderer, scene, camera, controls;
let player = null;
let activeId = null;
let recordingsList = [];

let controllersManager, teleportControl, dynamicMenuVR, menu;
let recordingSelectItem;

const playerSettings = { materialSource: 'recording' };
let recordingStyleResolver = null;
const unifiedStyleResolver = (geomType, matIndex) => getMaterialStyle(geomType, matIndex);

const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
const timer = new THREE.Timer();

let groundMesh;

async function main() {
	await initScene();
	setupXR();
	await setupMenu();
	await refreshList();
	renderer.setAnimationLoop(animate);
}

async function initScene() {
	THREE.ColorManagement.enabled = true;
	// WebXR isn't supported on the WebGPU backend yet (three.js throws from
	// XRManager.setSession if backend.isWebGPUBackend) — force the WebGL2
	// backend so renderer.xr works. This is also why this app uses BakedPlayerCPU
	// instead of BakedPlayer: BakedPlayer's decode is a real GPU compute pass
	// (TSL storage buffers + instancedArray), and WebGL2's transform-feedback
	// emulation of compute breaks past a handful of buffers/instances (errors
	// like "too many varyings" / "bindBufferBase: index out of range" with a
	// few thousand bodies). See PlayerCPU.js.
	renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ReinhardToneMapping;
	renderer.toneMappingExposure = 2.0;
	renderer.xr.enabled = true;
	// Force the plain WebGLLayer path instead of XRManager's default
	// XRProjectionLayer path. The default path calls getBinding(), which builds a
	// `new XRWebGLBinding(this._session, this._gl)` — on some browser/headset
	// combos under forceWebGL this throws "Failed to construct 'XRWebGLBinding':
	// parameter 1 is not of type 'XRSession'" even though session is valid
	// (gl.makeXRCompatible() on an already-created WebGL2 context doesn't always
	// leave it XR-compatible the way the binding constructor expects). Not
	// requesting the 'layers' feature doesn't avoid this — XRManager takes the
	// XRProjectionLayer branch whenever the browser merely supports
	// XRWebGLBinding, regardless of session features — so disable the capability
	// flag directly. This app doesn't need projection layers/foveation anyway.
	renderer.xr._supportsLayers = false;

	document.getElementById('container3D').appendChild(renderer.domElement);
	await renderer.init();

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xaabbff);

	const envTexture = await new THREE.TextureLoader().loadAsync('/maps/sky.jpg');
	envTexture.mapping = THREE.EquirectangularReflectionMapping;
	envTexture.colorSpace = THREE.SRGBColorSpace;
	scene.environment = envTexture;
	scene.environmentIntensity = 1.0;

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
	camera.position.set(15, 20, 30);

	groundMesh = new THREE.Mesh(
		new THREE.CircleGeometry(500, 96),
		new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.0 })
	);
	groundMesh.rotation.x = -Math.PI / 2;
	groundMesh.receiveShadow = true;
	scene.add(groundMesh);

	scene.add(new THREE.HemisphereLight(0xeeeeff, 0x443322, 1.0));

	directionalLight.castShadow = true;
	directionalLight.shadow.camera.top = 30;
	directionalLight.shadow.camera.bottom = -30;
	directionalLight.shadow.camera.left = -30;
	directionalLight.shadow.camera.right = 30;
	directionalLight.shadow.camera.near = 0.1;
	directionalLight.shadow.camera.far = 200;
	directionalLight.shadow.mapSize.set(4096, 4096);
	directionalLight.shadow.normalBias = 0.5;
	scene.add(directionalLight);
	scene.add(directionalLight.target);
	applyLightDirection(45, 50);

	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.target.set(0, 10, 0);

	window.addEventListener('resize', () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	window.addEventListener('keydown', (event) => {
		if (event.code === 'Space') {
			event.preventDefault();
			togglePlayPause();
		}
	});

	document.body.appendChild(createVRButton());
}

// VR button. Disabled with an explanatory label instead of wiring up
// requestSession()/setSession() — see the KNOWN BLOCKER note at the top of this
// file: actually entering a session reliably crashes on this three.js version's
// stereo-camera node path, so there is currently no working VR session to start.
// The setReferenceSpaceType('local-floor')-before-setSession ordering and
// renderer.xr._supportsLayers=false workaround (see initScene) are kept ready
// for when the underlying three.js bug is fixed and this button is re-enabled.
function createVRButton() {
	const button = document.createElement('button');
	button.textContent = 'VR BLOCKED (three.js bug)';
	button.title =
		'Entering VR currently crashes on this three.js version ' +
		"(TSL: cameraPosition's onRenderUpdate runs without a frame against the " +
		'stereo ArrayCamera). See the comment at the top of main.js.';
	button.disabled = true;
	button.style.cssText =
		'position:absolute;bottom:20px;left:calc(50% - 110px);width:220px;padding:12px 6px;' +
		'border:1px solid #fff;border-radius:4px;background:rgba(0,0,0,0.1);color:#fff;' +
		'font:normal 13px sans-serif;text-align:center;outline:none;z-index:999;cursor:not-allowed;opacity:0.6;';
	return button;
}

function applyLightDirection(azimuthDeg, elevationDeg) {
	const az = (azimuthDeg * Math.PI) / 180;
	const el = (elevationDeg * Math.PI) / 180;
	const d = 60;
	directionalLight.position.set(d * Math.cos(el) * Math.cos(az), d * Math.sin(el), d * Math.cos(el) * Math.sin(az));
	directionalLight.target.position.set(0, 0, 0);
	directionalLight.target.updateMatrixWorld();
}

// ----- XR setup -----------------------------------------------------------

function setupXR() {
	controllersManager = new ControllersManager(renderer.xr, scene);

	teleportControl = new XRTeleportMoveControl(renderer.xr, controllersManager, scene, {
		enabledHands: 'right',
	});
	teleportControl.setTeleportSurfaces(groundMesh.geometry);

	controllersManager.addEventListener(CMEventTypes.ON_BUTTON_UP, (e) => {
		if (e.button === 'ButtonX') {
			if (dynamicMenuVR) dynamicMenuVR.toggleVisibility();
			return false;
		}
		return true;
	});

	renderer.xr.addEventListener('sessionstart', onXRSessionStart);
	renderer.xr.addEventListener('sessionend', onXRSessionEnd);
}

// Not currently reachable — see the KNOWN BLOCKER note at the top of this file —
// but kept wired up (and the VR button code that would call setSession() too)
// so re-enabling VR once the three.js bug is fixed is a one-line change.
function onXRSessionStart() {
	dynamicMenuVR = new DynamicMenuVR(menu, scene, controllersManager, {
		mode: 'panel',
		debugLevel: 0,
	});
}

function onXRSessionEnd() {
	if (dynamicMenuVR) {
		dynamicMenuVR.dispose();
		dynamicMenuVR = null;
	}
}

// ----- Menu (works both flat-screen and in VR via DynamicMenuVR) ----------

async function setupMenu() {
	const uiDomElement = document.getElementById('ui');
	menu = await createMenu(uiDomElement);

	const tLibrary = menu.addTab('Recordings', 'fa-film');
	recordingSelectItem = tLibrary
		.addItem({ type: 'select', label: 'Recording', options: { none: 'Loading…' }, initialValue: 'none' })
		.onChange((id) => {
			if (id != null && id !== 'none') selectRecording(id);
		});

	tLibrary.addItem({ type: 'button', label: 'Refresh list', action: () => refreshList() });

	const tPlayback = menu.addTab('Playback', 'fa-play');
	tPlayback.addItem({ type: 'switch', label: 'Playing', initialValue: false }).onChange((v) => {
		if (!player) return;
		player.playing = v;
	});

	tPlayback
		.addItem({
			type: 'select',
			label: 'Speed',
			options: PLAYBACK_SPEEDS.map((s) => `${s}x`),
			initialValue: `${PLAYBACK_SPEEDS[speedIndex]}x`,
		})
		.onChange((v) => {
			const s = parseFloat(v);
			speedIndex = PLAYBACK_SPEEDS.indexOf(s);
			if (player) player.speed = s;
		});

	tPlayback
		.addItem({
			type: 'select',
			label: 'Materials',
			options: ['Recording (frozen)', 'Unified library (live)'],
			initialValue: 'Recording (frozen)',
		})
		.onChange((v) => {
			playerSettings.materialSource = v === 'Unified library (live)' ? 'library' : 'recording';
			applyMaterialSource();
		});
}

function applyMaterialSource() {
	if (!player) return;
	const resolver = playerSettings.materialSource === 'library' ? unifiedStyleResolver : recordingStyleResolver;
	player.setStyleResolver(resolver);
}

// ----- Library list ---------------------------------------------------------

async function refreshList() {
	try {
		const res = await fetch('/api/recordings');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		recordingsList = await res.json();
	} catch (err) {
		console.warn('[demolitionPlayerVR] could not reach the library API:', err);
		recordingsList = [];
	}

	const options = {};
	for (const rec of recordingsList) {
		const dur = formatTimecode(rec.duration || 0);
		options[rec.id] = `${rec.title} (${dur}, ${rec.bodyCount} bodies)`;
	}
	recordingSelectItem.updateOptions(options);
}

async function selectRecording(id) {
	try {
		const [sceneRes, clipRes] = await Promise.all([
			fetch(`/api/recordings/${id}/scene.json`),
			fetch(`/api/recordings/${id}/clip.bin`),
		]);
		if (!sceneRes.ok || !clipRes.ok) throw new Error('fetch failed');
		const sceneObj = await sceneRes.json();
		const clipBuffer = await clipRes.arrayBuffer();

		const clip = loadRecording(sceneObj, clipBuffer);

		recordingStyleResolver = makeStyleResolver(sceneObj);
		if (player) player.dispose();
		player = new BakedPlayerCPU(
			scene,
			clip,
			playerSettings.materialSource === 'library' ? unifiedStyleResolver : recordingStyleResolver
		);
		speedIndex = 0;
		player.speed = PLAYBACK_SPEEDS[speedIndex];
		player.time = 0;
		player.playing = true;

		applySceneSettings(sceneObj.scene || {});
		activeId = id;
		timer.update();
	} catch (err) {
		console.error('[demolitionPlayerVR] failed to load recording:', err);
	}
}

function applySceneSettings(s) {
	if (Array.isArray(s.background)) scene.background = new THREE.Color(s.background[0], s.background[1], s.background[2]);
	if (typeof s.environmentIntensity === 'number') scene.environmentIntensity = s.environmentIntensity;
	if (typeof s.exposure === 'number') renderer.toneMappingExposure = s.exposure;
	if (s.light) {
		if (typeof s.light.intensity === 'number') directionalLight.intensity = s.light.intensity;
		applyLightDirection(s.light.azimuth ?? 45, s.light.elevation ?? 50);
	}
	if (s.shadowBounds && Array.isArray(s.shadowBounds.center)) {
		fitDirectionalShadow(directionalLight, s.shadowBounds.center, s.shadowBounds.radius);
	}
	if (s.camera) {
		if (Array.isArray(s.camera.position)) camera.position.fromArray(s.camera.position);
		if (Array.isArray(s.camera.target)) controls.target.fromArray(s.camera.target);
		controls.update();
	}
}

function togglePlayPause() {
	if (!player) return;
	player.playing = !player.playing;
}

function formatTimecode(seconds, rate = 60) {
	const totalFrames = Math.round(seconds * rate);
	const min = Math.floor(totalFrames / (60 * rate));
	const sec = Math.floor(totalFrames / rate) % 60;
	const frame = totalFrames % rate;
	const pad = (n) => String(n).padStart(2, '0');
	return `${pad(min)}:${pad(sec)}:${pad(frame)}`;
}

function animate(time, frame) {
	timer.update();
	const dt = timer.getDelta();
	if (controllersManager) controllersManager.update(time, dt);
	if (teleportControl) teleportControl.update(dt);
	if (player) player.update(dt);
	if (!renderer.xr.isPresenting) controls.update();
	renderer.render(scene, camera);
}

main();
