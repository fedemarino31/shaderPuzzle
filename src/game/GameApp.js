import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Pane } from 'tweakpane';
import { CMEventTypes, ControllersManager, XRTeleportMoveControl } from '../vendor/xrComponents.js';
import { computePuzzleScale } from './gameCore.js';
import { createGamePuzzleMaterial, GAME_MATERIAL_PRESETS, setGameMaterialPreset, setGameMaterialPulseOrigin, setGameMaterialTime, setGameMaterialVolumeOptions } from './GameMaterials.js';
import { DEFAULT_PUZZLE_SET_ID, loadPuzzleAssets, PUZZLE_SET_BY_ID, PUZZLE_SETS } from './PuzzleAssets.js';
import { PuzzleAssembly } from './PuzzleAssembly.js';
import { createXRSessionInit, getXRModeConfig } from './xrSessionConfig.js';
import { interpolateIntersectionAttribute } from './gameCore.js';
import { disposePulseWaveAssets, loadPulseWaveAssets } from '../material/pulseWaveAssets.js';
import { SnapFeedback } from './SnapFeedback.js';
import { createPuzzlePieceMap, createWhiteGridParticleData, updateWhiteGridParticleData } from './WhiteGridParticles.js';
import { WhiteGridParticleAudio } from './WhiteGridParticleAudio.js';

export class GameApp {
	constructor(container) {
		this.container = container;
		this.state = {
			flySpeed: 1.5,
			shaderPlaying: true,
			shaderPreset: 'volumetric-cloud-grid',
			puzzleSet: DEFAULT_PUZZLE_SET_ID,
			ambientVolume: 0.22,
			volumeColor: '#8edcff',
			volumeDensity: 0.62,
			volumeScale: 5.5,
			volumeSpeed: 0.12,
			volumeSteps: 10,
			volumeBlend: 'additive',
		};
		this.shaderTime = 0;
		this.pulseTime = 0;
		this.pulseOrigin = new THREE.Vector3(0.5, 0.5, 0.5);
		this.pulseRaycaster = new THREE.Raycaster();
		this.lastFrame = performance.now();
		this.gameStartedAt = null;
		this.completedAt = null;
		this.xrStartAlignmentPending = false;
		this.activeXRMode = null;
		this.requestedXRMode = null;
		this.currentXRSession = null;
		this.xrSupport = { vr: null, ar: null };
		this.xrButtons = new Map();
		this.puzzleLoadGeneration = 0;
		this.loadedPuzzleSet = null;
	}

	async init() {
		try {
			this.setStatus('Initializing renderer…');
			// Use the native WebGL renderer expected by real headsets and desktop
			// WebXR emulators. WebGPURenderer's WebGL backend uses a different XR
			// framebuffer integration that Immersive Web Emulator cannot present.
			this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
			this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
			this.renderer.outputColorSpace = THREE.SRGBColorSpace;
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = 1.2;
			this.renderer.xr.enabled = true;
			this.renderer.xr.setReferenceSpaceType('local-floor');
			this.container.appendChild(this.renderer.domElement);
			this.setupScene();
			this.audioListener = new THREE.AudioListener();
			this.camera.add(this.audioListener);
			this.snapFeedback = new SnapFeedback({ camera: this.camera, scene: this.scene, listener: this.audioListener, getXRSession: () => this.renderer.xr.getSession() });
			this.particleAudio = new WhiteGridParticleAudio({ scene: this.scene, listener: this.audioListener, volume: this.state.ambientVolume });
			this.pulseAssets = await loadPulseWaveAssets(THREE, this.renderer, this.environmentTarget.texture);
			this.setupXR();
			this.setupPanel();
			this.updateBackendBadge();
			this.resizeObserver = new ResizeObserver(() => this.resize());
			this.resizeObserver.observe(this.container);
			this.resize();

			this.setStatus('Loading puzzle model and connectivity…');
			await this.loadPuzzleSet(this.state.puzzleSet);
			this.renderer.setAnimationLoop((time) => this.animate(time));
			window.addEventListener('pagehide', () => { disposePulseWaveAssets(this.pulseAssets); this.puzzlePieceMap?.dispose(); this.particleAudio?.dispose(); }, { once: true });
		} catch (error) {
			this.showFatalError(`The game could not start. ${error.message}`);
			console.error(error);
		}
	}

	setupScene() {
		this.scene = new THREE.Scene();
		this.desktopBackground = new THREE.Color(0x060910);
		this.scene.background = this.desktopBackground;
		this.renderer.setClearAlpha(1);
		const environmentScene = new RoomEnvironment();
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		this.environmentTarget = pmrem.fromScene(environmentScene, 0.035);
		this.scene.environment = this.environmentTarget.texture;
		environmentScene.dispose();
		pmrem.dispose();

		this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 80);
		this.camera.position.set(2.5, 2.2, 2.8);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.075;
		this.controls.target.set(0, 1.45, -2);
		this.controls.minDistance = 0.5;
		this.controls.maxDistance = 12;

		this.grid = new THREE.GridHelper(12, 24, 0x33445b, 0x172131);
		this.grid.material.transparent = true;
		this.grid.material.opacity = 0.42;
		this.scene.add(this.grid);

		const hemisphere = new THREE.HemisphereLight(0xa9d9ff, 0x152035, 1.8);
		const key = new THREE.DirectionalLight(0xffffff, 2.5);
		key.position.set(2, 5, 1);
		this.scene.add(hemisphere, key);
	}

	setupXR() {
		// Let Three.js select XRProjectionLayer or XRWebGLLayer according to what
		// the real headset or emulator exposes. Avoid overriding private flags.
		this.controllers = new ControllersManager(this.renderer.xr, this.scene);
		this.controllers.enableHandTracking();
		this.locomotion = new XRTeleportMoveControl(this.renderer.xr, this.controllers, this.scene, {
			enabledHands: 'right', enableContinousMotion: false, enableControllerTeleport: false,
			restrictVerticalMovement: false, showTeleportArc: false,
		});
		this.flyHandler = (event) => {
			if (this.activeXRMode !== 'vr' || event.handedness !== 'right' || !event.ray) return;
			const amount = event.stickPosition.y * (this.state.flySpeed / 10);
			this.locomotion.moveInDirectionFromRay(event.ray, amount, event.deltaTime || 0);
		};
		this.controllers.addEventListener(CMEventTypes.ON_AXIS_Y_NOT_ZERO, this.flyHandler);
		this.controllers.addEventListener(CMEventTypes.ON_RAY_STARTED, (event) => this.handlePulseOriginRay(event));
		this.renderer.xr.addEventListener('sessionstart', () => this.handleXRSessionStart());
		this.renderer.xr.addEventListener('sessionend', () => this.handleXRSessionEnd());

		const buttonContainer = document.createElement('div');
		buttonContainer.id = 'XRButtons';
		for (const mode of ['vr', 'ar']) {
			const button = this.createXRButton(mode);
			this.xrButtons.set(mode, button);
			buttonContainer.appendChild(button);
		}
		document.body.appendChild(buttonContainer);
		this.checkXRSupport();
	}

	createXRButton(mode) {
		const config = getXRModeConfig(mode);
		const button = document.createElement('button');
		button.id = `${config.label}Button`;
		button.className = 'xr-button';
		button.textContent = `CHECKING ${config.label}…`;
		button.disabled = true;
		button.addEventListener('click', () => {
			if (this.activeXRMode === mode && this.currentXRSession) {
				this.currentXRSession.end().catch((error) => console.warn(`Could not end ${config.label} session.`, error));
			} else this.startXRSession(mode);
		});
		return button;
	}

	async checkXRSupport() {
		if (!navigator.xr) {
			for (const mode of ['vr', 'ar']) this.xrSupport[mode] = false;
			this.updateXRButtons();
			this.setXRStatus(window.isSecureContext ? 'WebXR unavailable · desktop spectator' : 'WebXR needs HTTPS');
			return;
		}
		await Promise.all(['vr', 'ar'].map(async (mode) => {
			const config = getXRModeConfig(mode);
			try {
				this.xrSupport[mode] = await navigator.xr.isSessionSupported(config.sessionMode);
			} catch (error) {
				console.warn(`Could not check ${config.sessionMode} support.`, error);
				this.xrSupport[mode] = false;
			}
		}));
		this.updateXRButtons();
		this.updateXRReadyStatus();
	}

	updateXRReadyStatus() {
		if (this.activeXRMode || this.requestedXRMode) return;
		const available = ['vr', 'ar'].filter((mode) => this.xrSupport[mode]).map((mode) => getXRModeConfig(mode).label);
		this.setXRStatus(available.length ? `${available.join(' + ')} ready` : 'WebXR unavailable · desktop spectator');
	}

	updateXRButtons() {
		for (const mode of ['vr', 'ar']) {
			const button = this.xrButtons.get(mode);
			if (!button) continue;
			const { label } = getXRModeConfig(mode);
			if (this.activeXRMode) {
				button.textContent = this.activeXRMode === mode ? `EXIT ${label}` : `ENTER ${label}`;
				button.disabled = this.activeXRMode !== mode;
			} else if (this.requestedXRMode) {
				button.textContent = this.requestedXRMode === mode ? `STARTING ${label}…` : `ENTER ${label}`;
				button.disabled = true;
			} else if (this.xrSupport[mode]) {
				button.textContent = `ENTER ${label}`;
				button.disabled = false;
			} else {
				button.textContent = window.isSecureContext ? `${label} NOT SUPPORTED` : `${label} NEEDS HTTPS`;
				button.disabled = true;
			}
		}
	}

	async startXRSession(mode) {
		if (!navigator.xr || this.currentXRSession || this.requestedXRMode || !this.xrSupport[mode]) return;
		const config = getXRModeConfig(mode);
		this.requestedXRMode = mode;
		this.updateXRButtons();
		this.setXRStatus(`Starting ${config.label}…`);
		let session = null;
		try {
			session = await navigator.xr.requestSession(config.sessionMode, createXRSessionInit(mode));
			this.currentXRSession = session;
			this.renderer.xr.setReferenceSpaceType(config.referenceSpaceType);
			await this.renderer.xr.setSession(session);
		} catch (error) {
			console.error(`Could not enter ${config.label}.`, error);
			this.setXRStatus(`${config.label} start failed · ${error.message}`);
			if (session) try { await session.end(); } catch { /* Session may already be closed. */ }
			this.currentXRSession = null;
			this.requestedXRMode = null;
			this.updateXRButtons();
		}
	}

	handleXRSessionStart() {
		const session = this.renderer.xr.getSession();
		const inferredMode = session?.environmentBlendMode && session.environmentBlendMode !== 'opaque' ? 'ar' : 'vr';
		this.activeXRMode = this.requestedXRMode || inferredMode;
		this.requestedXRMode = null;
		this.currentXRSession = session;
		// Reset the offset before sampling the first viewer pose. VR compensates
		// guardian origins; AR uses the same stable reference-space mechanism once.
		this.locomotion.worldOffset.set(0, 0, 0);
		this.locomotion.worldYRotation = 0;
		this.locomotion.enabledHands = this.activeXRMode === 'vr' ? ['right'] : [];
		this.xrStartAlignmentPending = true;
		this.applyPresentationMode(this.activeXRMode);
		this.updateXRButtons();
		this.setXRStatus(`${getXRModeConfig(this.activeXRMode).label} active · positioning play area`);
	}

	handleXRSessionEnd() {
		this.xrStartAlignmentPending = false;
		this.activeXRMode = null;
		this.requestedXRMode = null;
		this.currentXRSession = null;
		this.locomotion.enabledHands = ['right'];
		this.applyPresentationMode(null);
		this.renderer.xr.setReferenceSpaceType('local-floor');
		this.updateXRButtons();
		this.updateXRReadyStatus();
	}

	applyPresentationMode(mode) {
		const isAR = mode === 'ar';
		this.scene.background = isAR ? null : this.desktopBackground;
		this.renderer.setClearAlpha(isAR ? 0 : 1);
		this.grid.visible = !isAR;
		document.body.classList.toggle('ar-session', isAR);
	}

	async loadPuzzleSet(setId) {
		const puzzleSet = PUZZLE_SET_BY_ID.get(setId);
		if (!puzzleSet) throw new Error(`Unknown puzzle set: ${setId}`);
		const generation = ++this.puzzleLoadGeneration;
		this.setStatus(`Loading ${puzzleSet.name}...`);
		const assets = await loadPuzzleAssets(puzzleSet);
		if (generation !== this.puzzleLoadGeneration) return false;
		this.setupPuzzle(assets, puzzleSet);
		this.loadedPuzzleSet = setId;
		return true;
	}

	async changePuzzleSet(setId) {
		const previousSet = this.loadedPuzzleSet;
		try {
			await this.loadPuzzleSet(setId);
		} catch (error) {
			console.error(`Could not load puzzle set ${setId}.`, error);
			if (previousSet) {
				this.state.puzzleSet = previousSet;
				this.puzzleSetBinding?.refresh();
			}
			this.setStatus(`Could not load puzzle set - ${error.message}`);
		}
	}

	setupPuzzle({ data, meshes }, puzzleSet) {
		this.assembly?.dispose();
		this.puzzlePieceMap?.dispose();
		this.material = null;
		this.resetGameProgress();
		const unitScale = computePuzzleScale(data.bounds, 0.5);
		const maxCellId = Math.max(...data.pieces.flatMap((piece) => piece.cellIds));
		const gridSize = Math.round(Math.cbrt(maxCellId + 1));
		const ownership = createPuzzlePieceMap(data, gridSize);
		this.puzzlePieceMap = ownership.texture;
		this.whiteGridParticleData ||= createWhiteGridParticleData();
		const puzzleExtent = Math.max(...data.bounds.max.map((value, axis) => value - data.bounds.min[axis]));
		const voxelSize = (puzzleExtent / gridSize) * unitScale;
		const localToUVW = new THREE.Vector3(...data.bounds.max.map((value, axis) => 1 / Math.max((value - data.bounds.min[axis]) * unitScale, 1e-6)));
		const pieceColors = new Map();
		const materialFactory = (piece, _index, geometry) => {
			if (!pieceColors.has(piece.id)) {
				const hue = Math.random();
				const saturation = 0.9 + Math.random() * 0.1;
				const lightness = 0.52 + Math.random() * 0.08;
				pieceColors.set(piece.id, new THREE.Color().setHSL(hue, saturation, lightness));
			}
			const gridOrigin = geometry.boundingBox.min.clone();
			const material = createGamePuzzleMaterial({
				preset: this.state.shaderPreset,
				pulseWaveAssets: this.pulseAssets,
				pulseOrigin: this.pulseOrigin,
				barColor: pieceColors.get(piece.id),
				gridOrigin,
				voxelSize,
				pieceMap: ownership.texture,
				gridSize,
				pieceToken: ownership.pieceTokens.get(piece.id),
				localToUVW,
				particleData: this.whiteGridParticleData,
				volumeColor: this.state.volumeColor,
				volumeDensity: this.state.volumeDensity,
				volumeScale: this.state.volumeScale,
				volumeSpeed: this.state.volumeSpeed,
				volumeSteps: this.state.volumeSteps,
				volumeBlend: this.state.volumeBlend,
			});
			setGameMaterialTime(material, this.shaderTime, this.pulseTime);
			return material;
		};
		this.assembly = new PuzzleAssembly({
			scene: this.scene, data, sourceMeshes: meshes, unitScale, materialFactory,
			onChange: (progress) => this.updateProgress(progress),
			onStatus: (message) => this.setStatus(message),
			onInteraction: () => {
				this.snapFeedback.unlock();
				if (this.state.shaderPreset === 'white-grid-particles') this.particleAudio.unlockAndStart();
				this.startTimer();
			},
			onSnap: ({ position, controller }) => this.snapFeedback.playSnap(position, controller),
		});
		this.particleAudio.setPuzzle({ assembly: this.assembly, data, gridSize });
		this.particleAudio.setEnabled(this.state.shaderPreset === 'white-grid-particles');
		this.material = this.assembly.getMaterials()[0] ?? null;
		document.getElementById('scaleValue').textContent = `${(unitScale * 100).toFixed(2)} cm / model unit`;
		this.setStatus(`${puzzleSet.name} loaded - final cube 0.50 m`);
	}

	setupPanel() {
		this.pane = new Pane({ container: document.getElementById('gamePanel'), title: 'Game debug', expanded: true });
		const movement = this.pane.addFolder({ title: 'XR Movement' });
		movement.addBinding(this.state, 'flySpeed', { label: 'VR fly speed', min: 0.25, max: 4, step: 0.05 });
		const shader = this.pane.addFolder({ title: 'Shader' });
		this.particleAudioBinding = shader.addBinding(this.state, 'ambientVolume', { label: 'Particle audio', min: 0, max: 0.6, step: 0.01 })
			.on('change', ({ value }) => this.particleAudio.setVolume(value));
		this.particleAudioBinding.hidden = this.state.shaderPreset !== 'white-grid-particles';
		const presetOptions = Object.fromEntries(GAME_MATERIAL_PRESETS.map((preset) => [preset.name, preset.id]));
		shader.addBinding(this.state, 'shaderPreset', { label: 'Material', options: presetOptions })
			.on('change', ({ value }) => this.changeShaderPreset(value));
		shader.addBinding(this.state, 'shaderPlaying', { label: 'Animate material' });
		const volume = shader.addFolder({ title: 'Volumetric cloud' });
		const updateVolume = () => {
			for (const material of this.assembly?.getMaterials() ?? []) setGameMaterialVolumeOptions(material, {
				color: this.state.volumeColor, density: this.state.volumeDensity, scale: this.state.volumeScale,
				speed: this.state.volumeSpeed, steps: this.state.volumeSteps, blend: this.state.volumeBlend,
			});
		};
		volume.addBinding(this.state, 'volumeColor', { label: 'Cloud color' }).on('change', updateVolume);
		volume.addBinding(this.state, 'volumeDensity', { label: 'Density', min: 0, max: 2, step: 0.01 }).on('change', updateVolume);
		volume.addBinding(this.state, 'volumeScale', { label: 'Noise scale', min: 1, max: 14, step: 0.1 }).on('change', updateVolume);
		volume.addBinding(this.state, 'volumeSpeed', { label: 'Drift speed', min: 0, max: 0.6, step: 0.01 }).on('change', updateVolume);
		volume.addBinding(this.state, 'volumeSteps', { label: 'Ray steps', min: 4, max: 16, step: 1 }).on('change', updateVolume);
		volume.addBinding(this.state, 'volumeBlend', { label: 'Blend', options: { Additive: 'additive', Subtractive: 'subtractive' } }).on('change', updateVolume);
		const puzzle = this.pane.addFolder({ title: 'Puzzle' });
		const puzzleSetOptions = Object.fromEntries(PUZZLE_SETS.map((set) => [set.name, set.id]));
		this.puzzleSetBinding = puzzle.addBinding(this.state, 'puzzleSet', { label: 'Piece set', options: puzzleSetOptions })
			.on('change', ({ value }) => this.changePuzzleSet(value));
		puzzle.addButton({ title: 'Restart same layout' }).on('click', () => this.resetPuzzle(false));
		puzzle.addButton({ title: 'New random scatter' }).on('click', () => this.resetPuzzle(true));
	}

	changeShaderPreset(value) {
		const particlesActive = value === 'white-grid-particles';
		this.particleAudio.setEnabled(particlesActive);
		if (this.particleAudioBinding) this.particleAudioBinding.hidden = !particlesActive;
		// Changing a Tweakpane control is itself a user gesture, so this is also
		// the correct moment to unlock Web Audio when the audio preset is chosen.
		if (particlesActive) this.particleAudio.unlockAndStart();
		const materials = this.assembly?.getMaterials() ?? [];
		if (!materials.length) return;
		for (const material of materials) setGameMaterialPreset(material, value);
		if (value === 'pulse-wave-train') {
			this.pulseTime = 0;
			for (const material of materials) setGameMaterialPulseOrigin(material, this.pulseOrigin);
			this.setStatus('Pulse Wave Train active - point at a piece and press either trigger.');
		}
		if (value === 'volumetric-cloud-grid') this.setStatus('Volumetric Cloud Grid active - tune density, noise and VR ray steps in the panel.');
	}

	handlePulseOriginRay(event) {
		if (this.state.shaderPreset !== 'pulse-wave-train' || !event.ray || !this.assembly) return;
		this.pulseRaycaster.ray.copy(event.ray);
		const [intersection] = this.pulseRaycaster.intersectObjects(this.assembly.getRaycastTargets(), false);
		if (!intersection) return;
		const uvw = interpolateIntersectionAttribute(intersection, '_uvw');
		if (!uvw) return;
		uvw.clampScalar(0, 1);
		this.pulseOrigin.copy(uvw);
		this.pulseTime = 0;
		for (const material of this.assembly.getMaterials()) setGameMaterialPulseOrigin(material, uvw);
		event.controller?.pulse?.(0.35, 55);
		this.startTimer();
		this.setStatus(`Pulse emitted from UVW ${uvw.x.toFixed(2)}, ${uvw.y.toFixed(2)}, ${uvw.z.toFixed(2)}.`);
	}

	resetPuzzle(newScatter) {
		if (!this.assembly) return;
		if (newScatter) this.assembly.newScatter(); else this.assembly.restart();
		this.resetGameProgress();
	}

	resetGameProgress() {
		this.gameStartedAt = null;
		this.completedAt = null;
		document.getElementById('completeMessage').hidden = true;
		document.getElementById('timerValue').textContent = '00:00.0';
	}

	startTimer() {
		if (this.gameStartedAt == null && this.completedAt == null) this.gameStartedAt = performance.now();
	}

	updateProgress(progress) {
		document.getElementById('blocksValue').textContent = `${progress.blocks} / ${progress.pieces}`;
		document.getElementById('connectionsValue').textContent = `${progress.resolved} / ${progress.connections}`;
		if (progress.complete && this.completedAt == null) {
			this.completedAt = performance.now();
			const message = document.getElementById('completeMessage');
			message.hidden = false;
			message.querySelector('span').textContent = `Completed in ${this.formattedTime()}`;
		}
	}

	formattedTime() {
		if (this.gameStartedAt == null) return '00:00.0';
		const elapsed = Math.max(0, (this.completedAt ?? performance.now()) - this.gameStartedAt) / 1000;
		const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
		const seconds = (elapsed % 60).toFixed(1).padStart(4, '0');
		return `${minutes}:${seconds}`;
	}

	updateBackendBadge() {
		const badge = document.getElementById('backendBadge');
		badge.textContent = 'WebGL 2 · WebXR VR + AR';
		badge.classList.add('webgl');
	}

	animate(time) {
		const now = performance.now();
		const delta = Math.min(0.1, (now - this.lastFrame) / 1000);
		this.lastFrame = now;
		if (this.state.shaderPlaying && this.assembly) {
			this.shaderTime = (this.shaderTime + delta + 120) % 120;
			this.pulseTime += delta;
			updateWhiteGridParticleData(this.whiteGridParticleData, this.shaderTime);
			for (const material of this.assembly.getMaterials()) setGameMaterialTime(material, this.shaderTime, this.pulseTime);
		}
		if (this.state.shaderPreset === 'white-grid-particles') this.particleAudio?.update(this.whiteGridParticleData);
		this.controls.enabled = !this.renderer.xr.isPresenting;
		this.controls.update();
		this.controllers.update(time / 1000, delta);
		this.alignXRStartPosition();
		this.locomotion.update(delta);
		if (this.gameStartedAt != null) document.getElementById('timerValue').textContent = this.formattedTime();
		this.renderer.render(this.scene, this.camera);
	}

	alignXRStartPosition() {
		if (!this.xrStartAlignmentPending || !this.renderer.xr.isPresenting) return;
		const xrCamera = this.renderer.xr.getCamera();
		if (!xrCamera?.cameras?.length) return;
		const { x, y, z } = xrCamera.position;
		if (![x, y, z].every(Number.isFinite) || (this.activeXRMode === 'vr' && y < 0.2)) return;

		// XRTeleportMoveControl uses the reference-space offset convention. VR
		// preserves floor-relative height. AR uses a guaranteed `local` space and
		// maps its initial viewer pose to the puzzle's 1.55 m presentation height.
		const verticalOffset = this.activeXRMode === 'ar' ? y - 1.55 : 0;
		this.locomotion.worldOffset.set(x, verticalOffset, z);
		this.xrStartAlignmentPending = false;
		this.setXRStatus(this.activeXRMode === 'ar'
			? 'AR active · move physically · pinch or grip to grab'
			: 'VR active · right stick fly · pinch or grip to grab');
	}

	resize() {
		const width = this.container.clientWidth || 1;
		const height = this.container.clientHeight || 1;
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	setStatus(message) { document.getElementById('gameStatus').textContent = message; }
	setXRStatus(message) { document.getElementById('xrStatus').textContent = message; }
	showFatalError(message) {
		const error = document.getElementById('gameError');
		error.hidden = false;
		error.textContent = message;
		document.getElementById('backendBadge').textContent = 'Renderer unavailable';
		this.setStatus('Game unavailable');
	}
}
