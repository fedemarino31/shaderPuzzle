import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import {
	ControllersManager,
	CMEventTypes,
	XRControllerLabelHelper,
	XRTeleportMoveControl,
	InfoSignPanel,
	VRConsole,
} from 'threexr-toolkit';
import { injectExampleInfo } from './sharedModules/exampleInfo.js';
import { createVRWorldStage } from './sharedModules/vrWorldStage.js';
import leftControllerLabelLayout from './in-01/meta-quest-touch-plus-left-controller-label-layout.json';
import rightControllerLabelLayout from './in-01/meta-quest-touch-plus-right-controller-label-layout.json';

import { XRDevice, metaQuest3 } from 'iwer';

const xrDevice = new XRDevice(metaQuest3);
xrDevice.installRuntime();

const EXAMPLE_INFO = `
# in-01 - Toolkit Controllers And Teleportation

Moves from hand-written controller code to the project modules: ControllersManager for input events, XRTeleportMoveControl for locomotion, explicit teleport surfaces, and controller button labels in a larger scene.

## Toolkit Layer

Compared with test te-08, controller setup, rays, button events, and locomotion wiring are no longer scattered through the example. The app registers behavior against ControllersManager and lets XRTeleportMoveControl own the movement interaction.

## Scene Validation

The shared floor stage and spiral stairs make orientation and movement easier to judge than in a small test scene. Teleport targets are declared explicitly, so the locomotion system does not treat every mesh as walkable by accident.

## Controller Labels

XRControllerLabelHelper adds readable labels for trigger, squeeze, thumbstick, and face buttons. That turns the demo into both an interaction test and a quick reference for how the current controller mapping is being interpreted.
`;

let renderer;
let scene;
let camera;

let clock = new THREE.Clock();
let floor;

let controllersManager;
let xrTeleportMoveControl;
let staircase;
let vrConsole;
let controllerLabelsVisible = false;
let controllerLabelHelpers = new Map();

const CONTROLLER_LABELS = {
	'xr-standard-trigger': 'Disparar\narma',
	'xr-standard-squeeze': 'Agarrar\nobjetos',
	'xr-standard-thumbstick': 'Mover',
	'a-button': 'Desplegar\nmapa',
	'b-button': 'Labels\non/off',
	'x-button': 'Inventario',
	'y-button': 'Labels\non/off',
	menu: 'Menu',
	thumbrest: false,
};

const CONTROLLER_PROFILES_LIST_URL =
	'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/profilesList.json';
const MANUAL_CONTROLLER_LABEL_PROFILE = 'meta-quest-touch-plus';
const MANUAL_CONTROLLER_LABEL_LAYOUTS = {
	left: leftControllerLabelLayout,
	right: rightControllerLabelLayout,
};

function setupThreejs() {
	// Make a renderer that fills the screen
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);

	renderer.xr.addEventListener('sessionstart', function (event) {
		//baseReferenceSpace = renderer.xr.getReferenceSpace();
	});

	renderer.xr.addEventListener('sessionend', function (event) {});
	renderer.xr.enabled = true;
	renderer.setClearColor(0x000033, 1);

	// Add canvas to the page
	document.body.appendChild(renderer.domElement);

	// Add a button to enter/exit vr to the page
	document.body.appendChild(VRButton.createButton(renderer));

	// Make a new scene
	scene = new THREE.Scene();

	// Make a camera. note that far is set to 100, which is better for realworld sized environments
	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10000);
	camera.position.set(0, 3, 3);

	scene.add(camera);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(0, 1.6, -1);
	controls.update();

	// Add some lights
	var light = new THREE.DirectionalLight(0xffffff, 2);
	light.position.set(2, 1, 4).normalize();
	scene.add(light);

	let ambientLight = new THREE.AmbientLight(0xffffff, 1);
	scene.add(ambientLight);

	// Handle browser resize
	window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupXR() {
	// https://developer.mozilla.org/en-US/docs/Web/API/XRReferenceSpace
	renderer.xr.setReferenceSpaceType('local-floor');

	controllersManager = new ControllersManager(renderer.xr, scene);
	//setupVrConsole();

	controllersManager.addEventListener(CMEventTypes.ON_RAY_STARTED, (event) => {
		console.log('ON_RAY_STARTED', event);
	});

	controllersManager.addEventListener(CMEventTypes.ON_RAY_UPDATED, (event) => {
		console.log('ON_RAY_UPDATED', event);
	});

	controllersManager.addEventListener(CMEventTypes.ON_RAY_ENDED, (event) => {
		console.log('ON_RAY_ENDED', event);
	});

	controllersManager.addEventListener(CMEventTypes.ON_LEFT_CONTROLLER_CONNECTED, ({ controller }) => {
		setupControllerLabels(controller);
	});

	controllersManager.addEventListener(CMEventTypes.ON_RIGHT_CONTROLLER_CONNECTED, ({ controller }) => {
		setupControllerLabels(controller);
	});

	controllersManager.addEventListener(CMEventTypes.ON_DOUBLE_SQUEEZE_STARTED, (event) => {
		console.log('ON_DOUBLE_SQUEEZE_STARTED', event);
	});

	controllersManager.addEventListener(CMEventTypes.ON_DOUBLE_SQUEEZE_ENDED, (event) => {
		console.log('ON_DOUBLE_SQUEEZE_ENDED', event);
	});

	controllersManager.addEventListener(CMEventTypes.ON_AXIS_RIGHT_CLICK, (event) => {
		console.log('ON_AXIS_RIGHT_CLICK', event);
	});

	controllersManager.addEventListener(CMEventTypes.ON_BUTTON_DOWN, (event) => {
		console.log('ON_BUTTON_DOWN', {
			handedness: event.handedness,
			button: event.button,
			index: event.index,
		});

		if (event.button === 'ButtonB' || event.button === 'ButtonY') {
			toggleControllerLabels();
		}
	});

	xrTeleportMoveControl = new XRTeleportMoveControl(renderer.xr, controllersManager, scene);

	floor.updateWorldMatrix(true, false);
	staircase.updateWorldMatrix(true, false);

	const floorGeometry = floor.geometry.clone().applyMatrix4(floor.matrixWorld);
	const staircaseGeometry = staircase.geometry.clone().applyMatrix4(staircase.matrixWorld);
	const geo = BufferGeometryUtils.mergeGeometries([floorGeometry, staircaseGeometry]);

	floorGeometry.dispose();
	staircaseGeometry.dispose();

	xrTeleportMoveControl.setTeleportSurfaces(geo);
}

function setupVrConsole() {
	vrConsole = new VRConsole(document.body, scene, controllersManager, {
		debugLevel: 1,
		size: 2.2,
		width: 900,
		height: 560,
	});
	vrConsole.createMap();
	vrConsole.mesh.position.set(2.3, 1.9, -2.7);
	vrConsole.mesh.rotation.y = -Math.PI / 8;
	scene.add(vrConsole.mesh);

	console.log('VRConsole ready. Waiting for XR controllers.');
	probeControllerProfilesEndpoint();
}

async function probeControllerProfilesEndpoint() {
	try {
		const response = await fetch(CONTROLLER_PROFILES_LIST_URL, { cache: 'no-store' });
		console.info(`Profiles CDN: HTTP ${response.status} (${response.ok ? 'OK' : 'FAILED'})`);
	} catch (error) {
		console.error(`Profiles CDN failed: ${error?.message ?? String(error)}`);
	}
}

function setupControllerLabels(controller) {
	const previousHelper = controllerLabelHelpers.get(controller.handedness);

	if (previousHelper) {
		previousHelper.dispose();
	}

	const hand = controller.handedness;
	const profiles = Array.from(controller.inputSource?.profiles ?? []);
	const manualLayout = profiles.includes(MANUAL_CONTROLLER_LABEL_PROFILE)
		? MANUAL_CONTROLLER_LABEL_LAYOUTS[hand]
		: null;
	const layout = manualLayout
		? {
				mode: 'manual',
				manualLayout,
			}
		: {
				mode: 'radial',
				planarity: 1,
				minDistance: 0.07,
				minGap: 0.02,
			};

	const labelHelper = new XRControllerLabelHelper({
		handController: controller,
		labels: CONTROLLER_LABELS,
		includeUnknownLabels: true,
		visible: controllerLabelsVisible,
		debug: true,
		style: {
			labelWidth: 0.12,
			labelHeight: 0.04,
		},
		layout,
	});

	controllerLabelHelpers.set(controller.handedness, labelHelper);

	console.log(`[labels:${hand}] initialization started`);
	console.log(
		`[labels:${hand}] layout: ${manualLayout ? `manual (${MANUAL_CONTROLLER_LABEL_PROFILE})` : 'radial'}`
	);
	console.log(`[labels:${hand}] targetRayMode: ${controller.inputSource?.targetRayMode ?? 'unavailable'}`);
	console.log(
		`[labels:${hand}] gamepad: ${controller.gamepad?.mapping ?? 'unavailable'}, ${controller.gamepad?.buttons?.length ?? 0} buttons`
	);
	if (profiles.length === 0) {
		console.warn(`[labels:${hand}] input profiles: none`);
	} else {
		profiles.forEach((profile, index) => console.log(`[labels:${hand}] input profile ${index}: ${profile}`));
	}
	logControllerLabelProgress(controller, labelHelper, 3000);
	logControllerLabelProgress(controller, labelHelper, 12000);

	labelHelper
		.init()
		.then(() => {
			if (controllerLabelHelpers.get(controller.handedness) !== labelHelper) {
				console.info(`[labels:${hand}] initialization superseded`);
				return;
			}

			const motionController = labelHelper.controllerModel?.motionController;
			const anchors = labelHelper.getAnchors();

			console.log(`[labels:${hand}] initialized`);
			console.log(`[labels:${hand}] resolved profile: ${motionController?.id ?? 'unavailable'}`);
			console.log(`[labels:${hand}] components: ${Object.keys(motionController?.components ?? {}).length}`);
			console.log(`[labels:${hand}] anchors: ${Object.keys(anchors).length}`);
			console.log(`[labels:${hand}] group children: ${labelHelper.group.children.length}`);
			console.log(`[labels:${hand}] visible: ${labelHelper.group.visible}`);
		})
		.catch((error) => {
			const motionController = labelHelper.controllerModel?.motionController;

			console.error(`[labels:${hand}] initialization failed`);
			console.error(`[labels:${hand}] ${error?.message ?? String(error)}`);
			console.error(`[labels:${hand}] resolved profile: ${motionController?.id ?? 'unavailable'}`);
		});
}

function logControllerLabelProgress(controller, labelHelper, delay) {
	setTimeout(() => {
		if (controllerLabelHelpers.get(controller.handedness) !== labelHelper) return;

		const motionController = labelHelper.controllerModel?.motionController;
		const components = motionController?.components ?? {};
		const usableNodeComponents = Object.entries(components)
			.filter(([, component]) => {
				if (component.touchPointNode) return true;
				return Object.values(component.visualResponses ?? {}).some(
					(response) => response.valueNode || (response.minNode && response.maxNode)
				);
			})
			.map(([componentId]) => componentId);

		const hand = controller.handedness;
		console.info(`[labels:${hand} @${delay}ms] profile: ${motionController?.id ?? 'unavailable'}`);
		console.info(`[labels:${hand} @${delay}ms] components: ${Object.keys(components).length}`);
		console.info(`[labels:${hand} @${delay}ms] usable nodes: ${usableNodeComponents.length}`);
		console.info(
			`[labels:${hand} @${delay}ms] model children: ${labelHelper.controllerModel?.children.length ?? 0}`
		);
	}, delay);
}

function toggleControllerLabels() {
	controllerLabelsVisible = !controllerLabelsVisible;

	for (const labelHelper of controllerLabelHelpers.values()) {
		labelHelper.setVisible(controllerLabelsVisible);
	}

	console.log('Controller labels visible:', controllerLabelsVisible);
}

function buildScene() {
	const stage = createVRWorldStage(scene);
	floor = stage.floor;

	staircase = getHelixStaircase();
	staircase.position.set(0, 0, -10);
	staircase.rotation.y = Math.PI;
	scene.add(staircase);

	createInstructionSign();

	let marker = new THREE.Mesh(
		new THREE.CylinderGeometry(0, 0.2, 1, 32),
		new THREE.MeshPhongMaterial({ color: 0xff0000 })
	);

	let markerX = marker.clone();
	markerX.position.set(10, 0, 0);
	scene.add(markerX);

	let markerZ = marker.clone();
	markerZ.material = markerX.material.clone();
	markerZ.material.color.set(0x0000ff);
	markerZ.position.set(0, 0, 10);
	scene.add(markerZ);
}

function createInstructionSign() {
	const sign = new InfoSignPanel({
		title: 'Controllers And Teleportation',
		lines: [
			'Use the thumbstick to teleport across the floor.',
			'B/Y button: show or hide the controller labels.',
			'The labels show what each controller button does.',
		],
		width: 1.7,
		height: 0.82,
	});
	sign.object3D.position.set(0, 2.1, -2.5);
	scene.add(sign.object3D);
}

function getHelixStaircase() {
	const totalSteps = 60;
	const stepHeight = 1;
	const helixRadius = 5;

	const stairMaterial = new THREE.MeshPhongMaterial({
		color: 0x665544,
		side: THREE.DoubleSide,
		shininess: 32,
	});
	const stepGeometry = new THREE.BoxGeometry(6, 2, 0.2);
	stepGeometry.rotateX(0.4 * Math.PI);

	let steps = [];
	for (let i = 0; i < totalSteps; i++) {
		const angle = (i * Math.PI) / 8;
		const x = Math.cos(angle) * helixRadius;
		const y = i * stepHeight + 0.3;
		const z = Math.sin(angle) * helixRadius;

		let geo = stepGeometry.clone();
		geo.rotateY(-angle);
		geo.translate(x, y, z);

		steps.push(geo);
	}

	let stairGeometry = BufferGeometryUtils.mergeGeometries(steps);
	let stair = new THREE.Mesh(stairGeometry, stairMaterial);
	return stair;
}

function animate() {
	renderer.setAnimationLoop(render);
}

function render(time) {
	const delta = clock.getDelta();

	controllersManager.update(time, delta);
	xrTeleportMoveControl.update(delta);

	renderer.render(scene, camera);
}

injectExampleInfo(EXAMPLE_INFO);
setupThreejs();
buildScene();
setupXR();
animate();
