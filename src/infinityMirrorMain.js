import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Pane } from 'tweakpane';
import { InfinityMirrorCube } from './infinityMirror/InfinityMirrorCube.js';

class InfinityMirrorDemo {
	constructor(viewport) {
		this.viewport = viewport;
		this.clock = new THREE.Clock();
		this.frameSamples = [];
		this.lastHudUpdate = 0;
		this.params = {
			shaderMode: 'chromatic',
			sampleCount: 8,
			farDistance: 20,
			rodRadius: 0.025,
			coreIntensity: 1.5,
			glowIntensity: 0.5,
			glowFalloff: 15,
			absorption: 0.12,
			reflectivity: 0.9,
			exposure: 1,
			colorX: '#54f1ff',
			colorY: '#ff53bd',
			colorZ: '#ffb443',
			singleColor: false,
			fresnelEnabled: true,
			fresnelPower: 3,
			debugMode: 0,
			gridSampleCount: 24,
			gridDepth: 26,
			gridBarRadius: 0.022,
			gridIntensity: 1.8,
			gridGlow: 0.34,
			gridDecay: 0.085,
			gridExposure: 1.1,
			gridBarColor: '#b8edff',
			autoRotate: true,
		};
		this.init();
	}

	init() {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x050709);
		this.scene.fog = new THREE.FogExp2(0x050709, 0.045);

		this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
		this.camera.position.set(3.7, 2.6, 4.5);
		this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.05;
		this.viewport.appendChild(this.renderer.domElement);

		const environment = new RoomEnvironment();
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		this.scene.environment = pmrem.fromScene(environment).texture;
		environment.dispose();
		pmrem.dispose();

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.055;
		this.controls.minDistance = 3.25;
		this.controls.maxDistance = 9;
		this.controls.autoRotate = true;
		this.controls.autoRotateSpeed = 0.48;

		this.cube = new InfinityMirrorCube({
			size: 2.35,
			frameThickness: 0.085,
			materialOptions: this.params,
			gridMaterialOptions: {
				sampleCount: this.params.gridSampleCount,
				depth: this.params.gridDepth,
				barRadius: this.params.gridBarRadius,
				intensity: this.params.gridIntensity,
				glow: this.params.gridGlow,
				decay: this.params.gridDecay,
				exposure: this.params.gridExposure,
				barColor: this.params.gridBarColor,
			},
		});
		this.cube.rotation.set(-0.09, 0.2, 0.04);
		this.scene.add(this.cube);
		this.scene.add(new THREE.HemisphereLight(0xc7f8ff, 0x181016, 1.25));
		const rim = new THREE.DirectionalLight(0x8cecff, 2.6);
		rim.position.set(-3, 4, 5);
		this.scene.add(rim);

		const ground = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), new THREE.MeshBasicMaterial({ color: 0x080b0d, transparent: true, opacity: 0.7 }));
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -1.7;
		this.scene.add(ground);

		this.buildPanel();
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(this.viewport);
		this.resize();
		this.renderer.setAnimationLoop(() => this.render());
	}

	buildPanel() {
		this.pane = new Pane({ container: document.getElementById('mirrorPanel'), title: 'Optical controls', expanded: true });
		const bind = (folder, sourceKey, options = {}, materialKey = sourceKey, mode = 'chromatic') => folder.addBinding(this.params, sourceKey, options).on('change', ({ value }) => {
			this.cube.materials[mode].setParameter(materialKey, value);
		});

		const shaderSelector = this.pane.addBinding(this.params, 'shaderMode', {
			label: 'Shader',
			options: { 'Chromatic mirror': 'chromatic', 'White grid': 'grid' },
		});
		const chromatic = this.pane.addFolder({ title: 'Chromatic mirror', expanded: true });
		const grid = this.pane.addFolder({ title: 'White grid', expanded: true });
		grid.hidden = true;
		shaderSelector.on('change', ({ value }) => {
			this.cube.setShaderMode(value);
			chromatic.hidden = value !== 'chromatic';
			grid.hidden = value !== 'grid';
		});

		const depth = chromatic.addFolder({ title: 'Depth' });
		bind(depth, 'sampleCount', { label: 'Samples', options: { '4 / low': 4, '8 / balanced': 8, '12 / high': 12, '16 / ultra': 16 } });
		bind(depth, 'farDistance', { label: 'Far distance', min: 4, max: 32, step: 0.5 });
		bind(depth, 'absorption', { min: 0.01, max: 0.35, step: 0.005 });
		bind(depth, 'reflectivity', { min: 0.65, max: 1, step: 0.005 });

		const light = chromatic.addFolder({ title: 'Light rods' });
		bind(light, 'rodRadius', { label: 'Radius', min: 0.006, max: 0.08, step: 0.001 });
		bind(light, 'coreIntensity', { label: 'Core', min: 0, max: 4, step: 0.05 });
		bind(light, 'glowIntensity', { label: 'Glow', min: 0, max: 2, step: 0.025 });
		bind(light, 'glowFalloff', { label: 'Falloff', min: 3, max: 40, step: 0.5 });
		bind(light, 'exposure', { min: 0.2, max: 3, step: 0.05 });
		bind(light, 'singleColor', { label: 'Single color' });
		bind(light, 'colorX', { label: 'X axis' });
		bind(light, 'colorY', { label: 'Y axis' });
		bind(light, 'colorZ', { label: 'Z axis' });

		const surface = chromatic.addFolder({ title: 'Surface & debug' });
		bind(surface, 'fresnelEnabled', { label: 'Fresnel' });
		bind(surface, 'fresnelPower', { label: 'Fresnel power', min: 1, max: 8, step: 0.1 });
		bind(surface, 'debugMode', { label: 'View', options: { Final: 0, 'Local position': 1, 'Mirror repeat': 2, 'Edge distance': 3, 'Core only': 4, 'Halo only': 5, Attenuation: 6, 'Cell index': 7 } });

		bind(grid, 'gridSampleCount', { label: 'Reflections', options: { '8 / low': 8, '12 / medium': 12, '16 / high': 16, '24 / full': 24 } }, 'sampleCount', 'grid');
		bind(grid, 'gridDepth', { label: 'Grid depth', min: 5, max: 40, step: 0.5 }, 'depth', 'grid');
		bind(grid, 'gridBarRadius', { label: 'Bar radius', min: 0.005, max: 0.07, step: 0.001 }, 'barRadius', 'grid');
		bind(grid, 'gridIntensity', { label: 'White core', min: 0.2, max: 5, step: 0.05 }, 'intensity', 'grid');
		bind(grid, 'gridGlow', { label: 'Glow', min: 0, max: 2, step: 0.02 }, 'glow', 'grid');
		bind(grid, 'gridDecay', { label: 'Distance decay', min: 0.01, max: 0.3, step: 0.005 }, 'decay', 'grid');
		bind(grid, 'gridExposure', { label: 'Exposure', min: 0.2, max: 3, step: 0.05 }, 'exposure', 'grid');
		bind(grid, 'gridBarColor', { label: 'Bar color' }, 'barColor', 'grid');

		this.pane.addBinding(this.params, 'autoRotate', { label: 'Auto rotate' }).on('change', ({ value }) => { this.controls.autoRotate = value; });
	}

	resize() {
		const { clientWidth, clientHeight } = this.viewport;
		if (!clientWidth || !clientHeight) return;
		this.camera.aspect = clientWidth / clientHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(clientWidth, clientHeight, false);
	}

	updateHud(now, delta) {
		this.frameSamples.push(delta * 1000);
		if (this.frameSamples.length > 45) this.frameSamples.shift();
		if (now - this.lastHudUpdate < 250) return;
		const average = this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length;
		document.getElementById('fpsValue').textContent = Math.round(1000 / average);
		document.getElementById('frameValue').textContent = `${average.toFixed(1)} ms`;
		document.getElementById('callsValue').textContent = this.renderer.info.render.calls;
		document.getElementById('trianglesValue').textContent = this.renderer.info.render.triangles.toLocaleString();
		this.lastHudUpdate = now;
	}

	render() {
		const delta = Math.min(this.clock.getDelta(), 0.1);
		const time = this.clock.elapsedTime;
		this.controls.update();
		this.cube.update({ camera: this.camera, time, delta });
		this.renderer.render(this.scene, this.camera);
		this.updateHud(performance.now(), delta);
	}
}

try {
	new InfinityMirrorDemo(document.getElementById('mirrorViewport'));
} catch (error) {
	const target = document.getElementById('mirrorError');
	target.hidden = false;
	target.textContent = `Unable to start the shader experiment: ${error.message}`;
	console.error(error);
}
