import * as THREE from 'three';
// Classic WebGL renderer, pulled straight from three's source entry. The
// project aliases bare `three` -> `three/webgpu` (vite.config.js), and that
// build does NOT ship the legacy WebGLRenderer — only WebGPURenderer's
// WebGLBackend. The alias is an exact `^three$` match and three exposes
// `./src/*`, so this deep import resolves to the real classic renderer (which
// brings its own WebXRManager) without touching the alias. Everything else on
// this page keeps using the webgpu-build THREE; the classic renderer renders
// those scene objects fine because it dispatches on property flags
// (material.type / object.isInstancedMesh) and reads geometry by attribute.
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
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

// Classic-WebGL VR playback app — parallel variant of src/demolitionPlayerVR/main.js.
// Same recordings library/backend as src/player.js, viewed from inside the scene with a
// headset. Recordings are pre-baked (metric units, matching the classicGrid recipe's slab
// size), so the world is walked/teleported at real scale — no extra scaling between desktop
// and VR.
//
// WHY A SEPARATE PLAYER: the WebGPU page (src/demolitionPlayerVR/main.js) can't enter VR on
// three.js 0.184. Its WebGPURenderer (even with forceWebGL) routes every material through the
// TSL node system, and the stereo ArrayCamera crashes the cameraPosition node's
// UniformArrayNode.setup() on the first XR shader compile
// ("Cannot destructure property 'camera' of 'undefined'"). The classic WebGLRenderer used here
// has its own GLSL pipeline and no node system, so that crash can't occur and WebXR works.
// Because the whole playback path (BakedPlayerCPU -> InstancedMesh + MeshStandard/Physical
// material) is already renderer-agnostic, this file is a near-verbatim copy of the WebGPU page
// with only the renderer and VR-button wiring changed. See docs/vr-blocker-threejs.md.

const PLAYBACK_SPEEDS = [1, 0.5, 0.25, 0.2, 0.1];
let speedIndex = 0;

let renderer, scene, camera, controls;
let player = null;
let activeId = null;
let recordingsList = [];

let controllersManager, teleportControl, dynamicMenuVR, menu;
let recordingSelectItem;

const playerSettings = { materialSource: 'recording' };
const playbackMenuState = {
	recordingId: 'none',
	playing: false,
	timeline: 0,
	speed: `${PLAYBACK_SPEEDS[speedIndex]}x`,
	loop: true,
	materialSource: playerSettings.materialSource,
};
let recordingStyleResolver = null;
const unifiedStyleResolver = (geomType, matIndex) => getMaterialStyle(geomType, matIndex);

const directionalLight = new THREE.DirectionalLight(0xffffff, 10);
const timer = new THREE.Timer();

let groundMesh;
let suppressTimelineScrub = false;
let suppressTimelineTimer = null;
let lastTimelineMenuSyncMs = 0;

async function main() {
	await initScene();
	setupXR();
	await setupMenu();
	await refreshList();
	renderer.setAnimationLoop(animate);
}

async function initScene() {
	THREE.ColorManagement.enabled = true;

	// Force three's WebXRManager onto the legacy XRWebGLLayer path (instead of the
	// WebXR Layers / XRProjectionLayer path). The manager picks the layer path when
	// the XRWebGLBinding *class* merely exists — it does NOT check whether the session
	// actually granted the 'layers' feature (WebXRManager.js: supportsGlBinding is read
	// once in the ctor, ~line 56; supportsLayers ~line 426). On environments that expose
	// the class but can't grant 'layers' (the WebXR polyfill/emulator, and some headset
	// browsers), `new XRWebGLBinding(session, gl)` then throws
	// "parameter 1 is not of type 'XRSession'". Requiring 'layers' instead just makes
	// requestSession reject ("does not support some required features"). Removing the
	// class BEFORE the renderer (which builds renderer.xr) is constructed makes
	// supportsGlBinding false, so the manager uses XRWebGLLayer — the path that works
	// everywhere (we don't need projection-layer foveation here).
	// See docs/known-issues/xrwebglbinding-layers-quest.md
	try {
		delete globalThis.XRWebGLBinding;
	} catch (e) {
		/* non-configurable (unlikely) — nothing else we can safely do */
	}

	// Classic WebGLRenderer (real WebGL 2.0). No forceWebGL / no await renderer.init()
	// (those were WebGPURenderer-only).
	renderer = new WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ReinhardToneMapping;
	renderer.toneMappingExposure = 2.0;
	renderer.xr.enabled = true;

	document.getElementById('container3D').appendChild(renderer.domElement);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xaabbff);

	const envTexture = await new THREE.TextureLoader().loadAsync('/maps/sky.jpg');
	envTexture.mapping = THREE.EquirectangularReflectionMapping;
	envTexture.colorSpace = THREE.SRGBColorSpace;
	scene.environment = envTexture;
	scene.environmentIntensity = 1.0;

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
	camera.position.set(15, 20, 30);

	const groundGeometry = new THREE.CircleGeometry(500, 96).rotateX(-Math.PI / 2);
	groundMesh = new THREE.Mesh(
		groundGeometry,
		new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.0 })
	);
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

	document.body.appendChild(createVRButton(renderer));
}

// Custom VR button instead of three's addons/webxr/VRButton.js. We deliberately do
// NOT request the 'layers' feature: the XRProjectionLayer path is already disabled in
// initScene (delete globalThis.XRWebGLBinding) so the legacy XRWebGLLayer path is used,
// and requesting 'layers' (optional or required) on environments that can't grant it
// only causes failures — see docs/known-issues/xrwebglbinding-layers-quest.md.
//
// We also call setReferenceSpaceType('local-floor') BEFORE setSession so the scene
// origin sits on the physical floor (matching the baked metric scale) and so
// XRTeleportMoveControl — which reads getReferenceSpace() synchronously in its
// 'sessionstart' listener — sees the right reference space.
function createVRButton(renderer) {
	const button = document.createElement('button');

	const sessionInit = {
		requiredFeatures: ['local-floor'],
		optionalFeatures: ['bounded-floor', 'hand-tracking'],
	};

	let currentSession = null;

	async function onSessionStarted(session) {
		session.addEventListener('end', onSessionEnded);
		renderer.xr.setReferenceSpaceType('local-floor');
		await renderer.xr.setSession(session);
		button.textContent = 'EXIT VR';
		currentSession = session;
	}

	function onSessionEnded() {
		currentSession.removeEventListener('end', onSessionEnded);
		button.textContent = 'ENTER VR';
		currentSession = null;
	}

	button.textContent = 'ENTER VR';
	button.style.cssText =
		'position:absolute;bottom:20px;left:calc(50% - 50px);width:100px;padding:12px 6px;' +
		'border:1px solid #fff;border-radius:4px;background:rgba(0,0,0,0.1);color:#fff;' +
		'font:normal 13px sans-serif;text-align:center;outline:none;z-index:999;cursor:pointer;';

	button.onclick = () => {
		if (currentSession === null) {
			navigator.xr.requestSession('immersive-vr', sessionInit).then(onSessionStarted);
		} else {
			currentSession.end();
		}
	};

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
		enableControllerTeleport: true,
		enableContinousMotion: true,
		restrictVerticalMovement: false,
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

function onXRSessionStart() {
	dynamicMenuVR = new DynamicMenuVR(menu, scene, controllersManager, {
		mode: 'panel',
		rendererScale: 2,
		rendererMode: 'commitOnly',
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
	menu = await createMenu(uiDomElement, { focusNavigation: true });

	const tLibrary = menu.addTab('Recordings', 'fa-film');
	recordingSelectItem = tLibrary
		.addItem(playbackMenuState, 'recordingId', {
			type: 'select',
			label: 'Recording',
			options: { none: 'Loading...' },
		})
		.onChange((id) => {
			if (id != null && id !== 'none') selectRecording(id);
		});

	tLibrary.addItem({ type: 'button', buttons: ['Refresh list'], action: () => refreshList() });

	const tPlayback = menu.addTab('Playback', 'fa-play');
	tPlayback.addItem(playbackMenuState, 'playing', { type: 'switch', label: 'Playing' }).listen().onChange((v) => {
		if (!player) return;
		player.playing = v;
		playbackMenuState.playing = player.playing;
	});

	tPlayback
		.addItem(playbackMenuState, 'timeline', {
			type: 'slider',
			label: 'Timeline',
			min: 0,
			max: 1000,
			step: 1,
		})
		.listen()
		.onChange((v) => {
			if (suppressTimelineScrub) return;
			scrubPlaybackToTimeline(v);
		});

	tPlayback.addItem({ type: 'button', buttons: ['Restart'], action: () => restartPlayback() });

	tPlayback
		.addItem(playbackMenuState, 'speed', {
			type: 'select',
			label: 'Speed',
			options: PLAYBACK_SPEEDS.map((s) => `${s}x`),
		})
		.listen()
		.onChange((v) => {
			const s = parseFloat(v);
			const nextIndex = PLAYBACK_SPEEDS.indexOf(s);
			if (nextIndex === -1) return;
			speedIndex = nextIndex;
			playbackMenuState.speed = `${PLAYBACK_SPEEDS[speedIndex]}x`;
			if (player) player.speed = s;
		});

	tPlayback
		.addItem(playbackMenuState, 'loop', { type: 'switch', label: 'Loop' })
		.listen()
		.onChange((v) => {
			playbackMenuState.loop = v;
			if (player) player.loop = v;
		});

	tPlayback
		.addItem(playbackMenuState, 'materialSource', {
			type: 'select',
			label: 'Materials',
			options: { recording: 'Recording (frozen)', library: 'Unified library (live)' },
		})
		.listen()
		.onChange((v) => {
			playerSettings.materialSource = v === 'library' ? 'library' : 'recording';
			playbackMenuState.materialSource = playerSettings.materialSource;
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
		console.warn('[demolitionPlayerWebGL] could not reach the library API:', err);
		recordingsList = [];
	}

	const options = {};
	for (const rec of recordingsList) {
		const dur = formatTimecode(rec.duration || 0);
		options[rec.id] = `${rec.title} (${dur}, ${rec.bodyCount} bodies)`;
	}
	if (!Object.keys(options).length) options.none = 'No recordings';
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
		player.loop = playbackMenuState.loop;

		applySceneSettings(sceneObj.scene || {});
		activeId = id;
		playbackMenuState.recordingId = id;
		syncPlaybackMenuFromPlayer(true);
		timer.update();
	} catch (err) {
		console.error('[demolitionPlayerWebGL] failed to load recording:', err);
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
	syncPlaybackMenuFromPlayer(true);
}

function restartPlayback() {
	if (!player) return;
	player.time = 0;
	player.update(0);
	syncPlaybackMenuFromPlayer(true);
}

function scrubPlaybackToTimeline(value) {
	if (!player) return;
	const timeline = Math.max(0, Math.min(1000, Number(value) || 0));
	player.playing = false;
	player.time = (timeline / 1000) * player.duration;
	player.update(0);
	syncPlaybackMenuFromPlayer(true);
}

function syncPlaybackMenuFromPlayer(force = false, nowMs = performance.now()) {
	if (!player || !menu) return;
	if (!force && nowMs - lastTimelineMenuSyncMs < 250) return;

	playbackMenuState.playing = player.playing;
	playbackMenuState.timeline = player.duration > 0 ? Math.max(0, Math.min(1000, (player.time / player.duration) * 1000)) : 0;
	playbackMenuState.speed = `${player.speed}x`;
	playbackMenuState.loop = player.loop;
	playbackMenuState.materialSource = playerSettings.materialSource;
	lastTimelineMenuSyncMs = nowMs;
	syncMenuFromState();
}

function syncMenuFromState() {
	if (!menu) return;
	suppressTimelineScrub = true;
	menu.sync();
	if (suppressTimelineTimer != null) window.clearTimeout(suppressTimelineTimer);
	suppressTimelineTimer = window.setTimeout(() => {
		suppressTimelineScrub = false;
		suppressTimelineTimer = null;
	}, 50);
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
	if (player) {
		player.update(dt);
		if (player.playing) syncPlaybackMenuFromPlayer(false, typeof time === 'number' ? time : performance.now());
	}
	if (!renderer.xr.isPresenting) controls.update();
	renderer.render(scene, camera);
}

main();
