/*
    ShapeMusic VR App

    Escena musical en WebXR. Reutiliza SceneManager, ProbeManager, paths,
    instrumentos y AdditiveSynth de la app principal.
    Menú VR con DynamicMenuVR (botón X para abrir/cerrar).
    El path es un objeto agarrable con GrabbableVRObject.
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
	ControllersManager,
	CMEventTypes,
	DynamicMenuVR,
	GrabbableVRObject,
	XRTeleportMoveControl,
} from '../../vendor/xrComponents.js';
import { createMenu } from '../../vendor/dynamicMenu.js';

import { SceneManager } from '../main/scene/SceneManager.js';
import { Probe } from '../../probe/Probe.js';
import { ProbeManager } from '../../probe/ProbeManager.js';
import { LinearArrangement } from '../../probe/arrangements/LinearArrangement.js';
import { RadialArrangement } from '../../probe/arrangements/RadialArrangement.js';
import { CirclePath } from '../../paths/CirclePath.js';
import { LinearPath } from '../../paths/LinearPath.js';
import { HelixPath } from '../../paths/HelixPath.js';
import { RectPath } from '../../paths/RectPath.js';

import { AdditiveSynth } from '../../synth/AdditiveSynth.js';
import { SampleLibrary } from '../../synth/SampleLibrary.js';
import { fetchSampleManifest, preloadSamples } from '../../synth/sampleManifest.js';
import { Scheduler } from '../../conductor/Scheduler.js';
import { OperatorGraph } from '../../operators/OperatorGraph.js';
import { withGraph, probeProxy } from '../../operators/builders.js';

import NormVelocityInstrument from '../main/logic/NormVelocityInstrument.js';
import AccelTriggerInstrument from '../main/logic/AccelTriggerInstrument.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { buildUI } from './buildUI.js';
import modelsJson from './models.json';

// ─── Carga dinámica de instrumentos (mismo patrón que main.js) ───────────────
const instrumentModules = import.meta.glob('../main/logic/*Instrument.js', { eager: true });
export const instrumentClasses = {};
for (const [path, mod] of Object.entries(instrumentModules)) {
	if (!mod?.default) continue;
	const name = mod.default.name || path.split('/').pop().replace(/\.js$/, '');
	instrumentClasses[name] = mod.default;
}

// ─── Timbre map ───────────────────────────────────────────────────────────────
export const TIMBRE_MAP = {
	Sine: { source: 'sine' },
	Square: { source: 'square' },
	Sawtooth: { source: 'sawtooth' },
	Triangle: { source: 'triangle' },
};
export const sampledNames = new Set();

// ─── Globals Three.js ─────────────────────────────────────────────────────────
let renderer, scene, camera, clock;
let orbitControls;

// ─── XR ──────────────────────────────────────────────────────────────────────
let controllersManager;
let xrTeleportMoveControl;
let dynamicMenuVR;
let menu;

// ─── Escena musical ───────────────────────────────────────────────────────────
export let sceneRoot;
export let sceneManager;
export let probeManager;
export let currentPath = null;
let pathLine = null;

// Handle agarrable del path:
// pathHandleGroup (Group) es child de sceneRoot y contiene pathLine + wireframe bbox.
// GrabbableVRObject hace attachObject → Three.js mueve/rota el group instantáneamente.
// makeWorldProxy lee puntos desde pathHandleGroup.localToWorld → probe sigue en tiempo real.
let pathHandleGroup = null; // Group: parent de pathLine + bbox wireframe
let pathHandleWire = null; // LineSegments wireframe del bbox
let pathHandleGrabbable = null;

// ─── Audio ────────────────────────────────────────────────────────────────────
export let audioCtx = null;
export let synth = null;
let sampleLibrary = null;
export let scheduler = null;

// ─── Lógica ───────────────────────────────────────────────────────────────────
export let graph = null;
export let instrument = null;
export let InstrumentClass = AccelTriggerInstrument;
let elapsed = 0;

// ─── Estado UI ────────────────────────────────────────────────────────────────
export const uiState = {
	// Audio
	masterGain: 0.5,
	muted: false,
	timbre: 'Sine',
	instrumentName: AccelTriggerInstrument.name,
	// Escena
	recipe: 'regularGrid',
	autoscale: true,
	overrideMaterials: false,
	selectedModel: null,
	// Sonda
	probeSpeed: 0.2,
	arrangement: 'linear',
	arrangementAxis: 'xz',
	sensorCount: 5,
	sensorSeparation: 0.03,
	sensorAngle: Math.PI / 2,
	sensorFov: Math.PI / 3,
	sensorRadialAngle: 0,
	rayLength: 1.2,
	// Path (position/rotation via VR grab — no menu controls)
	pathType: 'circle',
	circleRadius: 0.7,
	lineLength: 1.2,
	lineAxis: 'x',
	helixRadius: 0.5,
	helixHeight: 1.0,
	helixTurns: 3,
	rectWidth: 1.2,
	rectHeight: 0.8,
};

// ─── Three.js setup ──────────────────────────────────────────────────────────
function setupThreejs() {
	clock = new THREE.Clock();

	renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.xr.enabled = true;
	renderer.setClearColor(0x555555, 1);

	document.body.appendChild(renderer.domElement);
	document.body.appendChild(createARButton(renderer));

	scene = new THREE.Scene();
	// Sin background para que el passthrough sea visible en AR
	scene.background = null;

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
	camera.position.set(2, 3, 2);
	scene.add(camera);

	const grid = new THREE.GridHelper(2, 10, 0x444466, 0x333344);
	scene.add(grid);

	const redBox = new THREE.Mesh(
		new THREE.BoxGeometry(0.1, 0.1, 0.1),
		new THREE.MeshBasicMaterial({ color: 0xff9900 })
	);

	scene.add(redBox);

	orbitControls = new OrbitControls(camera, renderer.domElement);
	orbitControls.target.set(0, 0, -1.5);
	orbitControls.update();

	window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

// Botón AR propio. El ARButton de three.js fuerza setReferenceSpaceType('local')
// (origen a la altura de los ojos, ~1.5m del piso). Acá pedimos 'local-floor' antes
// de setSession para que el origen de la escena coincida con el piso físico, igual
// que VRButton. Importante: el reference space debe quedar definido antes de
// setSession, porque XRTeleportMoveControl lee getReferenceSpace() de forma síncrona
// en su listener de 'sessionstart'.
function createARButton(renderer) {
	const button = document.createElement('button');
	const overlay = document.createElement('div');
	overlay.style.display = 'none';
	document.body.appendChild(overlay);

	const sessionInit = {
		requiredFeatures: ['local-floor'],
		optionalFeatures: ['bounded-floor', 'hand-tracking', 'dom-overlay'],
		domOverlay: { root: overlay },
	};

	let currentSession = null;

	async function onSessionStarted(session) {
		session.addEventListener('end', onSessionEnded);
		renderer.xr.setReferenceSpaceType('local-floor');
		await renderer.xr.setSession(session);
		button.textContent = 'STOP AR';
		overlay.style.display = '';
		currentSession = session;
	}

	function onSessionEnded() {
		currentSession.removeEventListener('end', onSessionEnded);
		button.textContent = 'START AR';
		overlay.style.display = 'none';
		currentSession = null;
	}

	button.textContent = 'START AR';
	button.style.cssText =
		'position:absolute;bottom:20px;left:calc(50% - 50px);width:100px;padding:12px 6px;' +
		'border:1px solid #fff;border-radius:4px;background:rgba(0,0,0,0.1);color:#fff;' +
		'font:normal 13px sans-serif;text-align:center;outline:none;z-index:999;cursor:pointer;';

	button.onclick = () => {
		if (currentSession === null) {
			navigator.xr.requestSession('immersive-ar', sessionInit).then(onSessionStarted);
		} else {
			currentSession.end();
		}
	};

	return button;
}

// ─── Entorno VR ───────────────────────────────────────────────────────────────
function buildEnvironment() {
	// Grid visible — referencia visual del suelo
	const grid = new THREE.GridHelper(20, 20, 0x444466, 0x333344);
	//scene.add(grid);
	const axes = new THREE.AxesHelper(1);
	scene.add(axes);

	// Plano invisible para XRTeleportMoveControl (necesita geometría para raycast)
	const floorGeo = new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2);
	const floor = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ visible: false }));
	floor.name = 'floor';
	scene.add(floor);

	// Iluminación
	const hemi = new THREE.HemisphereLight(0xaaccff, 0x442244, 0.6);
	scene.add(hemi);
	const dir = new THREE.DirectionalLight(0xffffff, 1.2);
	dir.position.set(2, 4, 3);
	scene.add(dir);

	return floor;
}

// ─── Escena musical ───────────────────────────────────────────────────────────
function buildMusicScene() {
	// sceneRoot es el nodo padre de todos los objetos relacionados con la sonda y el path.
	// cambiar la posición/rotación de sceneRoot mueve/rota todo el sistema de la sonda + path, manteniendo sus posiciones relativas.
	sceneRoot = new THREE.Group();
	sceneRoot.position.set(0, 1.3, -1.5);
	scene.add(sceneRoot);

	sceneManager = new SceneManager(sceneRoot, {
		recipe: uiState.recipe,
		params: { gridSize: 3, separation: 0.15, primitive: 'cube', size: 0.1 },
	});

	const arrangement = buildArrangement();
	const probe = new Probe({ arrangement, bodyRadius: 0.02, axesSize: 0.1 });

	probeManager = new ProbeManager({
		scene, // world scene — hitMarkers y probe visuals en world space
		probe,
		path: null,
		sceneManager,
		speed: uiState.probeSpeed,
		hitMarkerRadius: 0.005,
	});

	setPath(buildPath(uiState.pathType));
}

// ─── Path helpers ─────────────────────────────────────────────────────────────
function buildPath(type) {
	switch (type) {
		case 'linear':
			return new LinearPath({ axis: uiState.lineAxis, length: uiState.lineLength });
		case 'helix':
			return new HelixPath({
				radius: uiState.helixRadius,
				axis: uiState.helixAxis ?? 'y',
				height: uiState.helixHeight,
				turns: uiState.helixTurns,
			});
		case 'rectangle':
			return new RectPath({ width: uiState.rectWidth, height: uiState.rectHeight });
		case 'circle':
		default:
			return new CirclePath({ radius: uiState.circleRadius });
	}
}

// Path points are in pathHandleGroup-local space (same as sceneRoot-local before any grab).
// After grabbing, pathHandleGroup is re-parented by GrabbableVRObject so its matrixWorld
// reflects the controller's transform — makeWorldProxy picks this up every frame automatically.
function makeWorldProxy(path) {
	if (!path) return null;
	return {
		getPointAt: (t) => pathHandleGroup.localToWorld(path.getPointAt(t).clone()),
		getTangentAt: (t) => path.getTangentAt(t).clone().transformDirection(pathHandleGroup.matrixWorld),
		getLength: () => path.getLength(),
		getCurve: () => path.getCurve?.(),
		getReferenceUp: () =>
			path.getReferenceUp?.().clone().transformDirection(pathHandleGroup.matrixWorld).normalize(),
		addEventListener: (...a) => path.addEventListener?.(...a),
		removeEventListener: (...a) => path.removeEventListener?.(...a),
	};
}

export function setPath(newPath) {
	if (currentPath?.removeEventListener) {
		currentPath.removeEventListener('change', onPathChanged);
	}
	currentPath = newPath;
	if (currentPath?.addEventListener) {
		currentPath.addEventListener('change', onPathChanged);
	}
	rebuildHandle();
	sceneRoot.updateWorldMatrix(true, true);
	probeManager.setPath(makeWorldProxy(currentPath));
}

function onPathChanged() {
	rebuildHandle();
	probeManager.setPath(makeWorldProxy(currentPath));
}

// Rebuilds pathHandleGroup: a Group containing the path line and a wireframe bbox.
// The group is positioned at the path's bounding center so the bbox wraps it tightly.
function rebuildHandle() {
	if (pathHandleGrabbable) {
		// If currently grabbed, force-release before dispose so the object
		// gets detached from the controller and removed cleanly.
		if (pathHandleGrabbable._grabbingController) {
			pathHandleGrabbable._grabbingController.detachObject();
			pathHandleGrabbable._grabbingController = null;
			pathHandleGrabbable._targetState = null;
		}
		pathHandleGrabbable.dispose();
		pathHandleGrabbable = null;
	}
	if (pathHandleWire) {
		pathHandleWire.geometry.dispose();
		pathHandleWire.material.dispose();
		pathHandleWire = null;
	}
	if (pathLine) {
		pathLine.geometry.dispose();
		pathLine.material.dispose();
		pathLine = null;
	}
	if (pathHandleGroup) {
		pathHandleGroup.parent?.remove(pathHandleGroup);
		pathHandleGroup = null;
	}
	if (!currentPath) return;

	const curve = currentPath.getCurve?.();
	if (!curve) return;

	// Compute bounding box of all path points (in path-local / sceneRoot-local space)
	const pts = curve.getPoints(200);
	const bbox = new THREE.Box3();
	for (const p of pts) bbox.expandByPoint(p);
	const center = new THREE.Vector3();
	bbox.getCenter(center);
	const size = new THREE.Vector3();
	bbox.getSize(size);

	const MARGIN = 0.02;

	// Group centered at bbox center — path points are offset by -center inside the group
	pathHandleGroup = new THREE.Group();
	pathHandleGroup.position.copy(center);
	sceneRoot.add(pathHandleGroup);

	// Path line — points offset so they're centered in the group
	const offsetPts = pts.map((p) => p.clone().sub(center));
	const lineGeo = new THREE.BufferGeometry().setFromPoints(offsetPts);
	pathLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x00ff66 }));
	pathHandleGroup.add(pathLine);

	// Wireframe bbox with margin — EdgesGeometry draws only the 12 box edges
	const boxGeo = new THREE.BoxGeometry(size.x + MARGIN * 2, size.y + MARGIN * 2, size.z + MARGIN * 2);
	const edgesGeo = new THREE.EdgesGeometry(boxGeo);
	boxGeo.dispose();
	const wireMat = new THREE.LineBasicMaterial({
		color: 0x00ff44,
		transparent: true,
		opacity: 0.3,
	});
	pathHandleWire = new THREE.LineSegments(edgesGeo, wireMat);
	pathHandleGroup.add(pathHandleWire);

	if (ControllersManager.instance) attachPathGrabbable();
}

function attachPathGrabbable() {
	if (!pathHandleGroup || !ControllersManager.instance) return;
	if (pathHandleGrabbable) {
		pathHandleGrabbable.dispose();
		pathHandleGrabbable = null;
	}

	pathHandleGrabbable = new GrabbableVRObject(pathHandleGroup, scene, {
		contactGrabbing: { enabled: true, distanceThreshold: 0.12 },
		remoteGrabbing: { enabled: true },
		showHelpers: false,
	});

	pathHandleGrabbable.addEventListener('onGrabStart', () => {
		pathHandleWire.material.opacity = 0.7;
	});

	pathHandleGrabbable.addEventListener('onGrabEnd', () => {
		pathHandleWire.material.opacity = 0.3;
	});
}

// ─── Arrangement helper ───────────────────────────────────────────────────────
function buildArrangement() {
	if (uiState.arrangement === 'radial') {
		return new RadialArrangement({
			count: uiState.sensorCount,
			fov: uiState.sensorFov,
			angle: uiState.sensorRadialAngle,
			plane: uiState.arrangementAxis,
			rayLength: uiState.rayLength,
		});
	}
	return new LinearArrangement({
		count: uiState.sensorCount,
		separation: uiState.sensorSeparation,
		angle: uiState.sensorAngle,
		plane: uiState.arrangementAxis,
		rayLength: uiState.rayLength,
	});
}

export function rebuildArrangement() {
	probeManager.probe.setArrangement(buildArrangement());
}

// ─── Audio ────────────────────────────────────────────────────────────────────
// ─── GLB loading ─────────────────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();

export function loadGLB(modelName) {
	if (!modelName) {
		console.warn('[vr] loadGLB: no model selected');
		return;
	}
	const entry = modelsJson.models.find((m) => m.name === modelName);
	if (!entry) {
		console.warn('[vr] loadGLB: model not found:', modelName);
		return;
	}
	const url = `/models/${entry.file}`;
	console.log('[vr] loading', url);
	gltfLoader.load(
		url,
		(gltf) => {
			console.log('[vr] GLB loaded:', entry.file);
			sceneManager.loadObject(gltf.scene, {
				autoscale: uiState.autoscale,
				targetSize: 1.5,
				overrideMaterials: uiState.overrideMaterials,
			});
			probeManager.setupBVH();
		},
		undefined,
		(err) => console.error('[vr] GLB error:', url, err)
	);
}

export function buildAudioStack() {
	if (audioCtx) return;
	audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	sampleLibrary = new SampleLibrary();
	synth = new AdditiveSynth(audioCtx, { masterGain: uiState.masterGain, sampleLibrary });
	scheduler = new Scheduler(audioCtx);
	rebuildLogic();
	loadSampleInstruments();
}

async function loadSampleInstruments() {
	try {
		const manifest = await fetchSampleManifest();
		const loaded = await preloadSamples({ audioCtx, sampleLibrary, manifest });
		sampledNames.clear();
		for (const name of loaded) sampledNames.add(name);
	} catch (err) {
		console.warn('[vr] no se pudieron cargar samples:', err);
	}
}

export function setMuted(value) {
	uiState.muted = value;
	synth?.setMasterGain(value ? 0 : uiState.masterGain);
}

// ─── Lógica (instrument + graph) ─────────────────────────────────────────────
export function rebuildLogic() {
	if (!synth) return;

	if (instrument) {
		try {
			instrument.onTeardown();
		} catch (_) {}
	}
	if (graph) {
		try {
			graph.dispose();
		} catch (_) {}
	}
	if (scheduler) scheduler.clear();

	const prevParams = instrument?.params;
	instrument = new InstrumentClass(prevParams ?? {});

	graph = new OperatorGraph();
	withGraph(graph, () => {
		const proxy = probeProxy(graph);
		const outputs = instrument.buildGraph({ probe: proxy });
		for (const [name, op] of Object.entries(outputs)) {
			graph.output(op, name);
		}
	});

	instrument.onSetup({ synth, scheduler, audioCtx });
}

export function setInstrumentClass(name) {
	const Cls = instrumentClasses[name];
	if (!Cls || Cls === InstrumentClass) return;
	InstrumentClass = Cls;
	uiState.instrumentName = name;
	rebuildLogic();
}

// ─── XR setup ─────────────────────────────────────────────────────────────────
function setupXR(floor) {
	renderer.xr.addEventListener('sessionstart', onXRSessionStart);
	renderer.xr.addEventListener('sessionend', onXRSessionEnd);

	controllersManager = new ControllersManager(renderer.xr, scene);

	xrTeleportMoveControl = new XRTeleportMoveControl(renderer.xr, controllersManager, scene);
	xrTeleportMoveControl.setTeleportSurfaces(floor.geometry);

	// Botón X (mano izq) abre/cierra el menú
	controllersManager.addEventListener(CMEventTypes.ON_BUTTON_UP, (e) => {
		if (e.button === 'ButtonX') {
			if (dynamicMenuVR) dynamicMenuVR.toggleVisibility();
			return false;
		}
		return true;
	});

	// El handle del path se crea antes que el ControllersManager; ahora que existe,
	// registra el GrabbableVRObject sobre el mesh que ya está en escena.
	if (pathHandleGroup && !pathHandleGrabbable) {
		attachPathGrabbable();
	}
}

function onXRSessionStart() {
	// Inicia audio si no estaba iniciado (el gesto Enter AR cuenta como interacción)
	if (!audioCtx) buildAudioStack();
	scene.background = null;
	renderer.setClearColor(0x000000, 0);

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
	scene.background = new THREE.Color(0x111122);
	renderer.setClearColor(0x111122, 1);
}

// ─── Render loop ──────────────────────────────────────────────────────────────
function animate() {
	renderer.setAnimationLoop(render);
}

function render(time) {
	const delta = Math.min(0.05, clock.getDelta());
	elapsed += delta;

	controllersManager.update(time, delta);
	xrTeleportMoveControl.update(delta);

	sceneRoot.updateWorldMatrix(true, true);

	const audioBase = audioCtx ? audioCtx.currentTime : elapsed;
	const frames = probeManager.update(delta, audioBase, 1);

	if (frames && graph && instrument) {
		for (let j = 0; j < frames.length; j++) {
			const f = frames[j];
			graph.feedProbeFrame(f);
			const graphOutputs = graph.step(f.time);
			const audioTime = audioBase + (j / frames.length) * delta;

			instrument.onFrame({
				time: f.time,
				deltaTime: f.deltaTime,
				graphOutputs,
				synth,
				scheduler,
				audioCtx,
				audioTime,
			});

			scheduler.tick();
		}
	}

	renderer.render(scene, camera);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
	setupThreejs();
	const floor = buildEnvironment();
	buildMusicScene();
	setupXR(floor);

	const uiDomElement = document.getElementById('ui');
	menu = await createMenu(uiDomElement);

	// ctx usa getters para que buildUI.js siempre lea el valor actual de
	// instrument, InstrumentClass y synth aunque cambien después del primer buildUI.
	const ctx = {
		sceneManager,
		probeManager,
		uiState,
		instrumentClasses,
		sampledNames,
		TIMBRE_MAP,
		buildAudioStack,
		setMuted,
		rebuildLogic,
		setInstrumentClass,
		rebuildArrangement,
		setPath,
		buildPath,
		loadGLB,
		glbModels: modelsJson.models,
		get synth() {
			return synth;
		},
		get instrument() {
			return instrument;
		},
		get InstrumentClass() {
			return InstrumentClass;
		},
	};

	buildUI(menu, ctx);

	animate();
}

init();
