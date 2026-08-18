import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Pane } from 'tweakpane';
import { clampSliceToDomain, sliceRange } from './domain.js';
import { createDefaultSources, PRESET_BY_ID, SHADER_PRESETS } from './presets.js';
import { ShaderRuntime } from './ShaderRuntime.js';
import { disposePulseWaveAssets, loadPulseWaveAssets } from '../material/pulseWaveAssets.js';

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

export class ShaderEditorApp {
	constructor(container) {
		this.container = container;
		const query = new URLSearchParams(location.search);
		const requestedPreset = PRESET_BY_ID.has(query.get('preset')) ? query.get('preset') : SHADER_PRESETS[0].id;
		const requestedView = query.get('view') === '2D' ? '2D' : '3D';
		this.state = {
			view: requestedView,
			shader: { preset: requestedPreset },
			domain: { scale: { x: 2, y: 2, z: 2 }, offset: { x: 0, y: 0, z: 0 } },
			slice: { plane: 'UV', coordinate: 0 },
			animation: { playing: true, speed: 1, time: 0, pulseTime: 0 },
			pbr: { metalness: 0.88, roughness: 0.2, environmentIntensity: 2.2, exposure: 1.25 },
			pulsePbr: { metalness: 0.97, roughness: 0.17, environmentIntensity: 3, exposure: 1.25 },
			sources: createDefaultSources(),
		};
		this.presetStates = Object.fromEntries(SHADER_PRESETS.map((preset) => [preset.id, clone(preset.defaults)]));
		this.lastFrame = performance.now();
		this.frameCount = 0;
	}

	async init() {
		try {
			this.renderer = new THREE.WebGPURenderer({ antialias: true });
			this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = this.state.pbr.exposure;
			this.container.appendChild(this.renderer.domElement);
			await this.renderer.init();
			await this.setupScene();
			this.buildPanel();
			this.bindUI();
			this.setView(this.state.view);
			this.updateBackendBadge();
			this.resizeObserver = new ResizeObserver(() => this.resize());
			this.resizeObserver.observe(this.container);
			this.resize();
			this.renderer.setAnimationLoop(() => this.animate());
			window.addEventListener('pagehide', () => disposePulseWaveAssets(this.pulseAssets), { once: true });
			this.setStatus(`${PRESET_BY_ID.get(this.state.shader.preset).name} · animated UVW field`);
		} catch (error) {
			this.showFatalError(`The Shader Editor requires WebGPU or WebGL 2. ${error.message}`);
			console.error(error);
		}
	}

	async setupScene() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x080c12);
		const environmentScene = new RoomEnvironment();
		const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
		this.environmentTarget = pmremGenerator.fromScene(environmentScene, 0.03);
		this.scene.environment = this.environmentTarget.texture;
		environmentScene.dispose();
		pmremGenerator.dispose();
		this.pulseAssets = await loadPulseWaveAssets(THREE, this.renderer, this.environmentTarget.texture);
		const keyLight = new THREE.PointLight(0xc9e8ff, 12, 0, 2);
		keyLight.position.set(2.5, 3, 3.5);
		const rimLight = new THREE.PointLight(0xd497ff, 8, 0, 2);
		rimLight.position.set(-3, 0.5, -2.5);
		this.scene.add(keyLight, rimLight);

		this.camera3D = new THREE.PerspectiveCamera(42, 1, 0.02, 100);
		this.camera3D.position.set(2.25, 1.7, 2.55);
		this.camera2D = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.01, 10);
		this.camera2D.position.set(0, 0, 3);
		this.camera = this.camera3D;

		this.controls3D = new OrbitControls(this.camera3D, this.renderer.domElement);
		this.controls3D.enableDamping = true;
		this.controls3D.dampingFactor = 0.075;
		this.controls3D.minDistance = 1.35;
		this.controls3D.maxDistance = 9;
		this.controls2D = new OrbitControls(this.camera2D, this.renderer.domElement);
		this.controls2D.enableRotate = false;
		this.controls2D.enableDamping = true;
		this.controls2D.mouseButtons.LEFT = THREE.MOUSE.PAN;
		this.controls2D.mouseButtons.RIGHT = THREE.MOUSE.PAN;
		this.controls2D.enabled = false;

		this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
		this.box.rotation.set(-0.08, 0.12, 0);
		this.plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
		this.plane.visible = false;
		this.scene.add(this.box, this.plane);
		this.rebuildMaterials();
	}

	buildPanel() {
		this.pane = new Pane({ container: document.getElementById('shaderPanel'), title: 'Shader controls', expanded: true });
		const shaderFolder = this.pane.addFolder({ title: 'Shader' });
		const presetOptions = Object.fromEntries(SHADER_PRESETS.map((preset) => [preset.name, preset.id]));
		shaderFolder.addBinding(this.state.shader, 'preset', { label: 'Preset', options: presetOptions }).on('change', ({ value }) => this.changePreset(value));

		const domainFolder = this.pane.addFolder({ title: 'UVW Domain' });
		this.addVectorBindings(domainFolder, 'Scale', this.state.domain.scale, 0.05, 10, 0.05, () => this.domainChanged());
		this.addVectorBindings(domainFolder, 'Center offset', this.state.domain.offset, -5, 5, 0.05, () => this.domainChanged());

		const animationFolder = this.pane.addFolder({ title: 'Animation' });
		this.playBinding = animationFolder.addBinding(this.state.animation, 'playing', { label: 'Play' }).on('change', ({ value }) => { this.timeBinding.disabled = value; this.lastFrame = performance.now(); });
		animationFolder.addBinding(this.state.animation, 'speed', { label: 'Global speed', min: -3, max: 3, step: 0.05 });
		this.timeBinding = animationFolder.addBinding(this.state.animation, 'time', { label: 'Time', min: 0, max: 120, step: 0.01 }).on('change', ({ value }) => {
			if (!this.state.animation.playing) {
				this.state.animation.pulseTime = value;
				this.runtime.setTime(value);
				this.runtime.setPulseTime(value);
			}
		});
		this.timeBinding.disabled = this.state.animation.playing;
		animationFolder.addButton({ title: 'Reset time' }).on('click', () => {
			this.state.animation.time = 0;
			this.resetPulseTime();
			this.runtime.setTime(0);
			this.timeBinding.refresh();
		});

		this.rebuildSliceFolder();

		this.rebuildPbrFolder();
		this.rebuildPresetFolder();
	}

	activePbrState() {
		return this.state.shader.preset === 'pulse-wave-train' ? this.state.pulsePbr : this.state.pbr;
	}

	rebuildPbrFolder() {
		this.pbrFolder?.dispose();
		const pbr = this.activePbrState();
		this.pbrFolder = this.pane.addFolder({ title: this.state.shader.preset === 'pulse-wave-train' ? 'PBR Material · Chrome' : 'PBR Material' });
		this.pbrFolder.addBinding(pbr, 'metalness', { min: 0, max: 1, step: 0.01 }).on('change', ({ value }) => { this.material3D.metalness = value; });
		this.pbrFolder.addBinding(pbr, 'roughness', { min: 0.02, max: 1, step: 0.01 }).on('change', ({ value }) => { this.material3D.roughness = value; });
		this.pbrFolder.addBinding(pbr, 'environmentIntensity', { label: 'Environment', min: 0, max: 4, step: 0.05 }).on('change', ({ value }) => { this.material3D.envMapIntensity = value; });
		this.pbrFolder.addBinding(pbr, 'exposure', { min: 0.2, max: 2.5, step: 0.05 }).on('change', ({ value }) => { this.renderer.toneMappingExposure = value; });
		this.renderer.toneMappingExposure = pbr.exposure;
	}

	addVectorBindings(parent, title, target, min, max, step, callback) {
		const folder = parent.addFolder({ title });
		for (const axis of ['x', 'y', 'z']) folder.addBinding(target, axis, { label: axis.toUpperCase(), min, max, step }).on('change', callback);
		return folder;
	}

	rebuildSliceFolder() {
		this.sliceFolder?.dispose();
		this.sliceFolder = this.pane.addFolder({ title: '2D Slice' });
		this.sliceFolder.addBinding(this.state.slice, 'plane', { label: 'Plane', options: { UV: 'UV', UW: 'UW', VW: 'VW' } }).on('change', ({ value }) => {
			const range = sliceRange(this.state.domain, value);
			this.state.slice.coordinate = this.state.domain.offset[range.axis];
			this.rebuildMaterials();
			this.updateViewLabels();
			setTimeout(() => this.rebuildSliceFolder());
		});
		const range = sliceRange(this.state.domain, this.state.slice.plane);
		this.state.slice.coordinate = clampSliceToDomain(this.state.domain, this.state.slice.plane, this.state.slice.coordinate);
		this.sliceFolder.addBinding(this.state.slice, 'coordinate', { label: `${range.axis.toUpperCase()} coordinate`, min: range.min, max: range.max, step: Math.max(0.001, (range.max - range.min) / 400) }).on('change', ({ value }) => { this.runtime.setSlice(value); this.updateViewLabels(); });
	}

	rebuildPresetFolder() {
		this.presetFolder?.dispose();
		const preset = PRESET_BY_ID.get(this.state.shader.preset);
		const state = this.presetStates[preset.id];
		this.presetFolder = this.pane.addFolder({ title: preset.name });
		if (preset.id === 'pulse-wave-train') this.buildPulseWaveTrainControls(this.presetFolder, state, preset.controls);
		else {
			for (const [key, descriptor] of Object.entries(preset.controls)) this.addParameterBinding(this.presetFolder, state, key, descriptor);
			if (preset.id === 'spherical-waves') this.buildWaveControls(this.presetFolder, state);
		}
	}

	addParameterBinding(parent, target, key, descriptor) {
		const sync = () => this.runtime.syncParameter(key, target[key]);
		if (descriptor.type === 'vec3') return this.addVectorBindings(parent, descriptor.label, target[key], descriptor.min, descriptor.max, descriptor.step, sync);
		const options = { label: descriptor.label };
		if (descriptor.type === 'number') Object.assign(options, { min: descriptor.min, max: descriptor.max, step: descriptor.step });
		if (descriptor.type === 'color') options.view = 'color';
		return parent.addBinding(target, key, options).on('change', sync);
	}

	buildWaveControls(parent, presetState) {
		parent.addBinding(presetState, 'blendMode', { label: 'Color mixing', options: { Additive: 'additive', 'Nearest source': 'nearest-source' } }).on('change', ({ value }) => this.runtime.syncParameter('blendMode', value));
		parent.addBinding(presetState, 'sourceCount', { label: 'Source count', min: 1, max: 4, step: 1 }).on('change', ({ last }) => {
			this.runtime.syncSources(this.state.sources, presetState.sourceCount);
			if (last) setTimeout(() => this.rebuildPresetFolder());
		});
		const sourcesFolder = parent.addFolder({ title: 'Wave sources' });
		for (let i = 0; i < presetState.sourceCount; i++) {
			const source = this.state.sources[i];
			const folder = sourcesFolder.addFolder({ title: `Source ${i + 1}` });
			const sync = () => this.runtime.syncSources(this.state.sources, presetState.sourceCount);
			folder.addBinding(source, 'enabled').on('change', sync);
			this.addVectorBindings(folder, 'Position', source.position, -5, 5, 0.02, sync);
			folder.addBinding(source, 'color', { view: 'color' }).on('change', sync);
			folder.addBinding(source, 'frequency', { min: 0.1, max: 30, step: 0.1 }).on('change', sync);
			folder.addBinding(source, 'speed', { min: -6, max: 6, step: 0.05 }).on('change', sync);
			folder.addBinding(source, 'phase', { min: -6.28, max: 6.28, step: 0.02 }).on('change', sync);
		}
	}

	buildPulseWaveTrainControls(parent, presetState, controls) {
		const origin = controls.origin;
		this.addVectorBindings(parent, origin.label, presetState.origin, origin.min, origin.max, origin.step, () => {
			this.runtime.syncParameter('origin', presetState.origin);
			this.resetPulseTime();
		});
		for (const key of ['baseColor', 'waveColor', 'propagationSpeed']) this.addParameterBinding(parent, presetState, key, controls[key]);

		let intervalBinding;
		let durationBinding;
		const syncTiming = (changedKey) => {
			if (presetState.pulseInterval <= presetState.trainDuration) {
				if (changedKey === 'pulseInterval') presetState.trainDuration = Math.max(0.1, presetState.pulseInterval - 0.05);
				else presetState.pulseInterval = Math.min(15, presetState.trainDuration + 0.05);
				intervalBinding.refresh();
				durationBinding.refresh();
			}
			this.runtime.syncParameter('pulseInterval', presetState.pulseInterval);
			this.runtime.syncParameter('trainDuration', presetState.trainDuration);
		};
		intervalBinding = parent.addBinding(presetState, 'pulseInterval', { label: controls.pulseInterval.label, min: controls.pulseInterval.min, max: controls.pulseInterval.max, step: controls.pulseInterval.step })
			.on('change', () => syncTiming('pulseInterval'));
		durationBinding = parent.addBinding(presetState, 'trainDuration', { label: controls.trainDuration.label, min: controls.trainDuration.min, max: controls.trainDuration.max, step: controls.trainDuration.step })
			.on('change', () => syncTiming('trainDuration'));
		for (const key of ['cycles', 'bandWidth', 'softness', 'emission']) this.addParameterBinding(parent, presetState, key, controls[key]);
		parent.addButton({ title: 'Emit pulse now' }).on('click', () => this.resetPulseTime());
	}

	resetPulseTime() {
		this.state.animation.pulseTime = 0;
		this.runtime?.setPulseTime(0);
	}

	bindUI() {
		for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => this.setView(button.dataset.view));
	}

	changePreset(id) {
		this.state.shader.preset = id;
		if (id === 'pulse-wave-train') this.resetPulseTime();
		this.rebuildMaterials();
		this.rebuildPbrFolder();
		this.rebuildPresetFolder();
		const preset = PRESET_BY_ID.get(id);
		this.setStatus(`${preset.name} · ${preset.description}`);
	}

	domainChanged(event) {
		this.runtime.syncDomain(this.state.domain);
		const clamped = clampSliceToDomain(this.state.domain, this.state.slice.plane, this.state.slice.coordinate);
		this.state.slice.coordinate = clamped;
		this.runtime.setSlice(clamped);
		this.updateViewLabels();
		if (event?.last) setTimeout(() => this.rebuildSliceFolder());
	}

	rebuildMaterials() {
		const preset = PRESET_BY_ID.get(this.state.shader.preset);
		const presetState = this.presetStates[preset.id];
		this.runtime = new ShaderRuntime(preset, presetState, this.state.domain, this.state.sources, this.state.animation.time);
		this.runtime.setSlice(this.state.slice.coordinate);
		this.runtime.setPulseTime(this.state.animation.pulseTime);
		const pbr = this.activePbrState();
		const material3D = new THREE.MeshStandardNodeMaterial({ metalness: pbr.metalness, roughness: pbr.roughness });
		material3D.colorNode = this.runtime.create3DColorNode();
		material3D.emissiveNode = this.runtime.create3DEmissionNode();
		material3D.envMapIntensity = pbr.environmentIntensity;
		if (preset.id === 'pulse-wave-train') {
			material3D.normalMap = this.pulseAssets?.normalMap ?? null;
			material3D.normalScale.set(0.12, 0.12);
			material3D.roughnessMap = this.pulseAssets?.roughnessMap ?? null;
			material3D.envMap = this.pulseAssets?.environmentMap ?? null;
		}
		const material2D = new THREE.MeshBasicNodeMaterial();
		material2D.colorNode = this.runtime.create2DColorNode(this.state.slice.plane);
		material2D.toneMapped = false;
		this.material3D?.dispose(); this.material2D?.dispose();
		this.material3D = material3D; this.material2D = material2D;
		if (this.box) this.box.material = material3D;
		if (this.plane) this.plane.material = material2D;
	}

	setView(view) {
		this.state.view = view;
		const is2D = view === '2D';
		this.box.visible = !is2D; this.plane.visible = is2D;
		this.camera = is2D ? this.camera2D : this.camera3D;
		this.controls2D.enabled = is2D; this.controls3D.enabled = !is2D;
		for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('active', button.dataset.view === view);
		this.resize(); this.updateViewLabels();
	}

	updateViewLabels() {
		const is2D = this.state.view === '2D';
		document.getElementById('viewLabel').textContent = is2D ? `${this.state.slice.plane} albedo slice` : '3D PBR surface';
		const range = sliceRange(this.state.domain, this.state.slice.plane);
		document.getElementById('coordinateLabel').textContent = is2D ? `${range.axis.toUpperCase()} = ${this.state.slice.coordinate.toFixed(3)}` : 'UVW domain · albedo only';
	}

	updateBackendBadge() {
		const isWebGPU = this.renderer.backend?.isWebGPUBackend === true;
		const badge = document.getElementById('backendBadge');
		badge.textContent = isWebGPU ? 'WebGPU · TSL' : 'WebGL 2 fallback · TSL';
		badge.classList.add(isWebGPU ? 'webgpu' : 'webgl');
	}

	resize() {
		if (!this.renderer) return;
		const width = this.container.clientWidth || 1; const height = this.container.clientHeight || 1;
		this.renderer.setSize(width, height, false);
		this.camera3D.aspect = width / height; this.camera3D.updateProjectionMatrix();
		const aspect = width / height;
		this.camera2D.left = -1.15 * aspect; this.camera2D.right = 1.15 * aspect; this.camera2D.top = 1.15; this.camera2D.bottom = -1.15; this.camera2D.updateProjectionMatrix();
	}

	animate() {
		const now = performance.now();
		const delta = Math.min(0.1, (now - this.lastFrame) / 1000);
		this.lastFrame = now;
		if (this.state.animation.playing) {
			this.state.animation.time = (this.state.animation.time + delta * this.state.animation.speed + 120) % 120;
			this.state.animation.pulseTime = Math.max(0, this.state.animation.pulseTime + delta * this.state.animation.speed);
			this.runtime.setTime(this.state.animation.time);
			this.runtime.setPulseTime(this.state.animation.pulseTime);
			if (++this.frameCount % 15 === 0) this.timeBinding.refresh();
		}
		this.controls3D.update(); this.controls2D.update();
		this.renderer.render(this.scene, this.camera);
	}

	setStatus(message) { document.getElementById('shaderStatus').textContent = message; }
	showFatalError(message) { const error = document.getElementById('shaderError'); error.hidden = false; error.textContent = message; document.getElementById('backendBadge').textContent = 'Renderer unavailable'; }
}
