import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LAB_CONFIG, PERSONALITIES, STATE_COLORS } from './config.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { PhysicalSensors } from './PhysicalSensors.js';
import { CharacterStateMachine } from './CharacterStateMachine.js';
import { CharacterRig } from './CharacterRig.js';
import { CharacterAnimator } from './CharacterAnimator.js';
import { ContainerVisual } from './ContainerVisual.js';
import { SCENARIOS, evaluateScenario, sampleScenario } from './scenarios.js';

const DEG = THREE.MathUtils.DEG2RAD;
const TMP_EULER = new THREE.Euler(0, 0, 0, 'XYZ');

export class CharacterLabApp {
	constructor(viewport) {
		this.viewport = viewport;
		this.clock = new THREE.Clock();
		this.personalityKey = 'normal';
		this.personality = PERSONALITIES.normal;
		this.rotation = { x: 0, z: 0, speed: 45 };
		this.containerQuaternion = new THREE.Quaternion();
		this.previousContainerQuaternion = new THREE.Quaternion();
		this.angularSpeed = 0;
		this.timeline = [];
		this.sampleAccumulator = 0;
		this.elapsed = 0;
		this.lastUiUpdate = 0;
		this.activeScenario = null;
		this.scenarioElapsed = 0;
		this.suddenSpeedTimer = 0;
	}

	async init() {
		this.setupRenderer();
		this.setupScene();
		this.setupUi();
		this.physics = new PhysicsWorld();
		await this.physics.init();
		this.sensors = new PhysicalSensors();
		this.stateMachine = new CharacterStateMachine(LAB_CONFIG.state, this.personality);
		this.animator = new CharacterAnimator(this.characterRig, LAB_CONFIG.state, this.personality);
		this.stateMachine.onChange = (state, previous) => this.animator.setState(state, previous);
		this.physics.reset(this.containerQuaternion);
		document.getElementById('engineBadge').classList.add('ready');
		document.querySelector('#engineBadge span').textContent = 'Rapier · WebGL';
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.viewport);
		this.resize();
		this.renderer.setAnimationLoop(() => this.render());
	}

	setupRenderer() {
		this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.12;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.viewport.appendChild(this.renderer.domElement);
	}

	setupScene() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x090c0e);
		this.scene.fog = new THREE.FogExp2(0x090c0e, 0.046);
		this.camera = new THREE.PerspectiveCamera(44, 1, 0.05, 80);
		this.camera.position.set(6.1, 4.2, 6.4);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.07;
		this.controls.target.set(0, 1.35, 0);
		this.controls.minDistance = 4;
		this.controls.maxDistance = 12;
		this.controls.maxPolarAngle = Math.PI * 0.82;

		const environment = new RoomEnvironment();
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		this.environmentTarget = pmrem.fromScene(environment, 0.03);
		this.scene.environment = this.environmentTarget.texture;
		environment.dispose(); pmrem.dispose();
		this.scene.add(new THREE.HemisphereLight(0xd5f4ef, 0x171a22, 1.5));
		const key = new THREE.DirectionalLight(0xfff2df, 3.2);
		key.position.set(2.8, 6, 4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); this.scene.add(key);
		const rim = new THREE.DirectionalLight(0x63cfe7, 1.7); rim.position.set(-4, 2, -3); this.scene.add(rim);

		const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0x111619, roughness: 0.93, metalness: 0.02 }));
		ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; this.scene.add(ground);
		const grid = new THREE.GridHelper(20, 40, 0x31413f, 0x1b2424); grid.position.y = 0; grid.material.transparent = true; grid.material.opacity = 0.42; this.scene.add(grid);

		this.containerVisual = new ContainerVisual(); this.scene.add(this.containerVisual);
		this.characterRig = new CharacterRig(); this.scene.add(this.characterRig.group);
		this.proxyVisual = new THREE.Mesh(
			new THREE.CapsuleGeometry(LAB_CONFIG.proxy.radius, LAB_CONFIG.proxy.halfHeight * 2, 5, 12),
			new THREE.MeshBasicMaterial({ color: 0xff4f74, wireframe: true, transparent: true, opacity: 0.7, depthTest: false }),
		);
		this.proxyVisual.visible = false; this.proxyVisual.renderOrder = 9; this.scene.add(this.proxyVisual);
		this.setupDebugVectors();
	}

	setupDebugVectors() {
		this.debugGroup = new THREE.Group();
		this.gravityArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.9, 0xffcb64, 0.18, 0.1);
		this.normalArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.65, 0x67e3c1, 0.15, 0.08);
		this.velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.01, 0x70c8ff, 0.15, 0.08);
		this.contactMarker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0x67e3c1, depthTest: false }));
		this.contactMarker.renderOrder = 10;
		this.debugGroup.add(this.gravityArrow, this.normalArrow, this.velocityArrow, this.contactMarker);
		this.scene.add(this.debugGroup);
	}

	setupUi() {
		const byId = (id) => document.getElementById(id);
		this.ui = {
			rotationX: byId('rotationX'), rotationZ: byId('rotationZ'), speed: byId('transitionSpeed'),
			rotationXValue: byId('rotationXValue'), rotationZValue: byId('rotationZValue'), speedValue: byId('transitionSpeedValue'),
			state: byId('stateValue'), stability: byId('stabilityValue'), stabilityBar: byId('stabilityBar'), scenario: byId('scenarioValue'),
			gravity: byId('gravityValue'), orientation: byId('orientationValue'), angular: byId('angularValue'), velocity: byId('velocityValue'), floor: byId('floorValue'), normal: byId('normalValue'), impact: byId('impactValue'), substate: byId('substateValue'), stateTime: byId('stateTimeValue'), support: byId('supportValue'),
			scenarioSelect: byId('scenarioSelect'), scenarioTime: byId('scenarioTime'), scenarioScore: byId('scenarioScore'), timeline: byId('timelineValue'),
		};
		const syncRotation = () => {
			this.stopScenario();
			this.rotation.x = Number(this.ui.rotationX.value); this.rotation.z = Number(this.ui.rotationZ.value);
			this.ui.rotationXValue.textContent = `${this.rotation.x}°`; this.ui.rotationZValue.textContent = `${this.rotation.z}°`;
		};
		this.ui.rotationX.addEventListener('input', syncRotation);
		this.ui.rotationZ.addEventListener('input', syncRotation);
		this.ui.speed.addEventListener('input', () => { this.rotation.speed = Number(this.ui.speed.value); this.ui.speedValue.textContent = `${this.rotation.speed}°/s`; });
		for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click', () => {
			const presets = { level: [0, 0], soft: [15, 0], steep: [40, 0], vertical: [90, 0] };
			const [x, z] = presets[button.dataset.preset]; this.setRotationControls(x, z); this.stopScenario();
		});
		byId('suddenButton').addEventListener('click', () => { this.stopScenario(); this.setRotationControls(this.rotation.x + 90, this.rotation.z); this.suddenSpeedTimer = 0.3; });
		byId('impactButton').addEventListener('click', () => this.applyTestImpact());
		byId('shakeButton').addEventListener('click', () => this.startScenario(SCENARIOS.find((scenario) => scenario.id === 'shake')));
		byId('resetButton').addEventListener('click', () => this.reset());
		byId('personalitySelect').addEventListener('change', (event) => this.setPersonality(event.target.value));
		byId('debugToggle').addEventListener('change', (event) => { this.debugGroup.visible = event.target.checked; });
		byId('proxyToggle').addEventListener('change', (event) => { this.proxyVisual.visible = event.target.checked; });
		byId('panelToggle').addEventListener('click', (event) => {
			const panel = document.querySelector('.control-panel'); const collapsed = panel.classList.toggle('collapsed');
			event.currentTarget.textContent = collapsed ? '+' : '−'; event.currentTarget.title = collapsed ? 'Expandir panel' : 'Contraer panel';
		});
		for (const scenario of SCENARIOS) {
			const option = document.createElement('option'); option.value = scenario.id; option.textContent = scenario.label; this.ui.scenarioSelect.appendChild(option);
		}
		byId('playScenarioButton').addEventListener('click', () => this.startScenario(SCENARIOS.find((scenario) => scenario.id === this.ui.scenarioSelect.value)));
		byId('stopScenarioButton').addEventListener('click', () => this.stopScenario());
	}

	setRotationControls(x, z) {
		this.rotation.x = THREE.MathUtils.clamp(x, -180, 180); this.rotation.z = THREE.MathUtils.clamp(z, -180, 180);
		this.ui.rotationX.value = this.rotation.x; this.ui.rotationZ.value = this.rotation.z;
		this.ui.rotationXValue.textContent = `${Math.round(this.rotation.x)}°`; this.ui.rotationZValue.textContent = `${Math.round(this.rotation.z)}°`;
	}

	setPersonality(key) {
		this.personalityKey = key; this.personality = PERSONALITIES[key] || PERSONALITIES.normal;
		this.stateMachine.setPersonality(this.personality); this.animator.setPersonality(this.personality);
	}

	reset() {
		this.stopScenario(); this.setRotationControls(0, 0); this.containerQuaternion.identity(); this.previousContainerQuaternion.identity();
		this.containerVisual.quaternion.identity(); this.physics.reset(this.containerQuaternion); this.sensors.reset(); this.stateMachine.reset(); this.animator.reset();
		this.timeline = []; this.elapsed = 0; this.updateUi(true);
	}

	applyTestImpact() {
		const direction = new THREE.Vector3(1, 0.32, -0.25).normalize().multiplyScalar(3.7 * this.personality.impactSensitivity);
		this.physics.applyImpulse(direction);
	}

	startScenario(scenario) {
		if (!scenario) return;
		this.activeScenario = scenario; this.scenarioElapsed = 0; this.timeline = []; this.ui.scenarioScore.hidden = true;
		this.containerQuaternion.identity(); this.previousContainerQuaternion.identity(); this.setRotationControls(0, 0);
		this.physics.reset(this.containerQuaternion); this.sensors.reset(); this.stateMachine.reset(); this.animator.reset();
		this.ui.scenario.textContent = scenario.label.replace(/^[A-G] · /, '');
	}

	stopScenario() {
		if (!this.activeScenario) return;
		this.activeScenario = null; this.scenarioElapsed = 0; this.ui.scenario.textContent = 'Manual'; this.ui.scenarioTime.textContent = '0.0 s';
	}

	updateContainer(delta) {
		if (this.activeScenario) {
			this.scenarioElapsed += delta;
			const sample = sampleScenario(this.activeScenario, this.scenarioElapsed);
			this.setRotationControls(sample.x, sample.z);
		}
		TMP_EULER.set(this.rotation.x * DEG, 0, this.rotation.z * DEG);
		const target = new THREE.Quaternion().setFromEuler(TMP_EULER);
		this.previousContainerQuaternion.copy(this.containerQuaternion);
		if (this.activeScenario) this.containerQuaternion.copy(target);
		else {
			const speed = (this.suddenSpeedTimer > 0 ? 720 : this.rotation.speed) * DEG;
			const angle = this.containerQuaternion.angleTo(target);
			this.containerQuaternion.slerp(target, angle < 1e-5 ? 1 : Math.min(1, speed * delta / angle));
		}
		this.suddenSpeedTimer = Math.max(0, this.suddenSpeedTimer - delta);
		this.angularSpeed = this.previousContainerQuaternion.angleTo(this.containerQuaternion) / Math.max(delta, 1 / 120);
		this.containerVisual.quaternion.copy(this.containerQuaternion);
	}

	applyCharacterIntent(fixedDelta) {
		const velocity = this.physics.getCharacterVelocity();
		const horizontal = velocity.clone().setY(0);
		if (this.stateMachine.state === 'WALKING') this.physics.applyImpulse(this.sensors.fallDirection.clone().multiplyScalar(0.42 * fixedDelta * this.personality.movementEnergy));
		else if (this.stateMachine.state === 'BALANCING') this.physics.applyImpulse(horizontal.multiplyScalar(-0.38 * fixedDelta * this.personality.balanceSkill));
		else if (this.stateMachine.state === 'IDLE') this.physics.applyImpulse(horizontal.multiplyScalar(-0.55 * fixedDelta));
	}

	updateDebug() {
		const position = this.physics.getCharacterPosition(); const velocity = this.physics.getCharacterVelocity();
		this.proxyVisual.position.copy(position);
		this.gravityArrow.position.copy(position).add(new THREE.Vector3(0.35, 0.45, 0));
		this.gravityArrow.setDirection(new THREE.Vector3(0, -1, 0));
		this.normalArrow.position.copy(this.sensors.supportPoint); this.normalArrow.setDirection(this.sensors.contactNormal);
		this.normalArrow.visible = this.sensors.support; this.contactMarker.position.copy(this.sensors.supportPoint); this.contactMarker.visible = this.sensors.support;
		this.velocityArrow.position.copy(position);
		if (velocity.lengthSq() > 0.0001) { this.velocityArrow.setDirection(velocity.clone().normalize()); this.velocityArrow.setLength(Math.min(1.2, Math.max(0.08, velocity.length() * 0.35)), 0.15, 0.08); }
		else this.velocityArrow.setLength(0.01, 0.01, 0.01);
	}

	recordSample(delta) {
		this.sampleAccumulator += delta;
		if (this.sampleAccumulator < 0.1) return;
		this.sampleAccumulator = 0;
		const position = this.physics.getCharacterPosition(); const velocity = this.physics.getCharacterVelocity();
		this.timeline.push({
			time: this.activeScenario ? this.scenarioElapsed : this.elapsed,
			rotation: [this.rotation.x, 0, this.rotation.z], localGravity: this.sensors.localGravity.toArray(),
			position: position.toArray(), velocity: velocity.toArray(), angularVelocity: this.angularSpeed,
			support: this.sensors.support, stability: this.sensors.stability, state: this.stateMachine.state, impactStrength: this.sensors.impactStrength,
		});
		if (this.timeline.length > 1200) this.timeline.shift();
	}

	completeScenario() {
		const scenario = this.activeScenario; const result = evaluateScenario(scenario, this.timeline);
		this.activeScenario = null; this.ui.scenarioTime.textContent = `${scenario.duration.toFixed(1)} s`;
		this.ui.scenarioScore.hidden = false; this.ui.scenarioScore.querySelector('strong').textContent = result.score; this.ui.scenarioScore.querySelector('small').textContent = result.summary;
	}

	formatVector(vector) { return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`; }

	updateUi(force = false) {
		const now = performance.now(); if (!force && now - this.lastUiUpdate < 100) return; this.lastUiUpdate = now;
		const color = STATE_COLORS[this.stateMachine.state] || '#dce5e7';
		this.ui.state.textContent = this.stateMachine.state; this.ui.state.style.color = color;
		const stabilityPercent = Math.round(this.sensors.stability * 100); this.ui.stability.textContent = `${stabilityPercent}%`; this.ui.stabilityBar.style.width = `${stabilityPercent}%`; this.ui.stabilityBar.style.background = color;
		this.ui.gravity.textContent = this.formatVector(this.sensors.localGravity); this.ui.orientation.textContent = `X ${Math.round(this.rotation.x)}° / Z ${Math.round(this.rotation.z)}°`;
		this.ui.angular.textContent = `${this.angularSpeed.toFixed(2)} rad/s`; this.ui.velocity.textContent = `${this.sensors.speed.toFixed(2)} m/s`; this.ui.floor.textContent = this.sensors.surface;
		this.ui.normal.textContent = this.formatVector(this.sensors.contactNormal); this.ui.impact.textContent = `${this.sensors.impactStrength.toFixed(1)} N`; this.ui.substate.textContent = this.stateMachine.substate;
		this.ui.stateTime.textContent = `${this.stateMachine.timeInState.toFixed(1)} s`; this.ui.support.textContent = this.sensors.support ? 'SÍ' : 'NO'; this.ui.support.style.color = this.sensors.support ? '#70e0c2' : '#f27e73';
		this.ui.scenarioTime.textContent = `${this.scenarioElapsed.toFixed(1)} s`; this.ui.timeline.textContent = `${this.timeline.length} muestras registradas`;
	}

	render() {
		const delta = Math.min(this.clock.getDelta(), 0.05); this.elapsed += delta;
		this.updateContainer(delta);
		this.physics.step(delta, this.containerQuaternion, (fixedDelta) => this.applyCharacterIntent(fixedDelta));
		this.sensors.update(delta, this.physics, this.containerQuaternion, this.angularSpeed, this.personality);
		this.stateMachine.update(delta, this.sensors);
		this.animator.update(delta, this.stateMachine, this.sensors, this.physics);
		this.updateDebug(); this.recordSample(delta); this.updateUi();
		if (this.activeScenario && this.scenarioElapsed >= this.activeScenario.duration) this.completeScenario();
		this.controls.update(); this.renderer.render(this.scene, this.camera);
	}

	resize() {
		const width = this.viewport.clientWidth || 1; const height = this.viewport.clientHeight || 1;
		this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
	}
}
