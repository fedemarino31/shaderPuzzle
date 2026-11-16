import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ControllersManager, XRTeleportMoveControl } from '../vendor/xrComponents.js';
import { computePuzzleScale, createAssemblyMatrix, ensurePuzzleTextureUVs } from './gameCore.js';
import { createGamePuzzleMaterial, setGameMaterialCamera, setGameMaterialTime } from './GameMaterials.js';
import { GAME_MATERIAL_PARAMS, GAME_MENU_MATERIALS, GAME_MENU_PREVIEW, GAME_SESSION, PIECE_COLOR } from './materialParams.js';
import { loadPuzzleAssets, PUZZLE_SET_BY_ID } from './PuzzleAssets.js';
import { PuzzleAssembly } from './PuzzleAssembly.js';
import { SnapFeedback } from './SnapFeedback.js';
import { createPuzzlePieceMap, createWhiteGridParticleData, updateWhiteGridParticleData } from './WhiteGridParticles.js';
import { WhiteGridParticleAudio } from './WhiteGridParticleAudio.js';
import { createXRSessionInit, getXRModeConfig } from './xrSessionConfig.js';

const STORAGE_KEY = 'shaderspuzzle.game.material';
const PARTICLES_ID = 'white-grid-particles';

function readStoredMaterial() {
	try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function storeMaterial(id) {
	try { localStorage.setItem(STORAGE_KEY, id); } catch { /* Storage can be unavailable. */ }
}

function addLights(scene) {
	const hemisphere = new THREE.HemisphereLight(0xa9d9ff, 0x152035, 1.8);
	const key = new THREE.DirectionalLight(0xffffff, 2.5);
	key.position.set(2, 5, 1);
	scene.add(hemisphere, key);
}

export class ARGameApp {
	constructor({ viewport, menu, grid, enterButton, status, error }) {
		this.viewport = viewport;
		this.menu = menu;
		this.grid = grid;
		this.enterButton = enterButton;
		this.statusElement = status;
		this.errorElement = error;
		this.selected = GAME_MENU_MATERIALS.some((m) => m.id === readStoredMaterial()) ? readStoredMaterial() : GAME_MENU_MATERIALS[0].id;
		this.shaderTime = 0;
		this.lastFrame = performance.now();
		this.cards = new Map();
		this.previewGroups = new Map();
		this.previewMaterials = [];
		this.arSupported = false;
		this.starting = false;
		this.session = null;
		this.assembly = null;
		this.gameStartedAt = null;
		this.completedAt = null;
		this.xrStartAlignmentPending = false;
		this.particleData = createWhiteGridParticleData();
	}

	async init() {
		try {
			this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
			this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
			this.renderer.outputColorSpace = THREE.SRGBColorSpace;
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = 1.2;
			this.renderer.xr.enabled = true;
			this.renderer.xr.setReferenceSpaceType('local');
			this.viewport.appendChild(this.renderer.domElement);

			const environmentScene = new RoomEnvironment();
			const pmrem = new THREE.PMREMGenerator(this.renderer);
			this.environmentTarget = pmrem.fromScene(environmentScene, 0.035);
			environmentScene.dispose();
			pmrem.dispose();

			// Game scene (AR session).
			this.scene = new THREE.Scene();
			this.scene.environment = this.environmentTarget.texture;
			addLights(this.scene);
			this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 80);
			this.audioListener = new THREE.AudioListener();
			this.camera.add(this.audioListener);
			this.snapFeedback = new SnapFeedback({ camera: this.camera, scene: this.scene, listener: this.audioListener, getXRSession: () => this.renderer.xr.getSession() });
			this.particleAudio = new WhiteGridParticleAudio({ scene: this.scene, listener: this.audioListener, volume: GAME_MATERIAL_PARAMS[PARTICLES_ID].sound?.volume ?? 0.22 });

			// Menu preview scene.
			this.previewScene = new THREE.Scene();
			this.previewScene.background = new THREE.Color(GAME_MENU_PREVIEW.background);
			this.previewScene.environment = this.environmentTarget.texture;
			addLights(this.previewScene);
			this.previewCamera = new THREE.PerspectiveCamera(GAME_MENU_PREVIEW.fov, 1, 0.05, 20);

			this.setupXR();
			this.buildMenu();
			this.setMenuStatus('Loading puzzle…');

			window.addEventListener('resize', () => this.resize());
			this.resize();

			const puzzleSet = PUZZLE_SET_BY_ID.get(GAME_SESSION.puzzleSetId);
			if (!puzzleSet) throw new Error(`Unknown puzzle set: ${GAME_SESSION.puzzleSetId}`);
			this.puzzle = await loadPuzzleAssets(puzzleSet);
			this.preparePuzzle();
			this.buildPreviews();
			this.renderer.setAnimationLoop((time) => this.animate(time));
			window.addEventListener('pagehide', () => { this.particleAudio?.dispose(); this.puzzlePieceMap?.dispose(); }, { once: true });
			await this.checkARSupport();
		} catch (error) {
			this.showFatalError(`The game could not start. ${error.message}`);
			console.error(error);
		}
	}

	// ---------------------------------------------------------------- puzzle data

	preparePuzzle() {
		const { data } = this.puzzle;
		this.unitScale = computePuzzleScale(data.bounds, 0.5);
		const maxCellId = Math.max(...data.pieces.flatMap((piece) => piece.cellIds));
		this.gridSize = Math.round(Math.cbrt(maxCellId + 1));
		const ownership = createPuzzlePieceMap(data, this.gridSize);
		this.ownership = ownership;
		this.puzzlePieceMap = ownership.texture;
		const extent = Math.max(...data.bounds.max.map((value, axis) => value - data.bounds.min[axis]));
		this.voxelSize = (extent / this.gridSize) * this.unitScale;
		this.localToUVW = new THREE.Vector3(...data.bounds.max.map((value, axis) => 1 / Math.max((value - data.bounds.min[axis]) * this.unitScale, 1e-6)));
		this.pieceColors = new Map();
		for (const piece of data.pieces) {
			const [s0, s1] = PIECE_COLOR.saturation;
			const [l0, l1] = PIECE_COLOR.lightness;
			this.pieceColors.set(piece.id, new THREE.Color().setHSL(Math.random(), s0 + Math.random() * (s1 - s0), l0 + Math.random() * (l1 - l0)));
		}
	}

	createMaterial(piece, geometry, preset) {
		const material = createGamePuzzleMaterial({
			preset,
			barColor: this.pieceColors.get(piece.id),
			gridOrigin: geometry.boundingBox.min.clone(),
			voxelSize: this.voxelSize,
			pieceMap: this.puzzlePieceMap,
			gridSize: this.gridSize,
			pieceToken: this.ownership.pieceTokens.get(piece.id),
			localToUVW: this.localToUVW,
			particleData: this.particleData,
		});
		setGameMaterialTime(material, this.shaderTime);
		return material;
	}

	// ------------------------------------------------------------------- menu UI

	buildMenu() {
		GAME_MENU_MATERIALS.forEach((entry, index) => {
			const card = document.createElement('button');
			card.type = 'button';
			card.className = 'material-card';
			card.setAttribute('role', 'radio');
			card.innerHTML = '<div class="card-preview"></div><div class="card-label"><i></i><span></span></div>';
			card.querySelector('i').textContent = String(index + 1);
			card.querySelector('span').textContent = entry.label;
			card.addEventListener('click', () => this.selectMaterial(entry.id));
			this.grid.appendChild(card);
			this.cards.set(entry.id, card);
		});
		this.selectMaterial(this.selected, false);
		this.enterButton.addEventListener('click', () => this.enterAR());
	}

	selectMaterial(id, persist = true) {
		this.selected = id;
		for (const [cardId, card] of this.cards) card.setAttribute('aria-checked', String(cardId === id));
		if (persist) storeMaterial(id);
	}

	setMenuStatus(message) { this.statusElement.textContent = message; }

	updateEnterButton() {
		if (this.session || this.starting) {
			this.enterButton.disabled = true;
			this.enterButton.textContent = this.starting ? 'Starting AR…' : 'In AR';
		} else if (!this.puzzle) {
			this.enterButton.disabled = true;
			this.enterButton.textContent = 'Loading…';
		} else if (this.arSupported) {
			this.enterButton.disabled = false;
			this.enterButton.textContent = 'Enter AR';
		} else {
			this.enterButton.disabled = true;
			this.enterButton.textContent = window.isSecureContext ? 'AR not supported' : 'AR needs HTTPS';
		}
	}

	// ------------------------------------------------------------------- previews

	buildPreviews() {
		const { data, meshes } = this.puzzle;
		const unit = this.unitScale;
		const center = new THREE.Vector3(...data.bounds.min.map((min, axis) => (min + data.bounds.max[axis]) / 2)).multiplyScalar(unit);
		// Geometry is shared by all six previews; only materials differ.
		const geometries = new Map(data.pieces.map((piece) => {
			const geometry = meshes.get(piece.meshRef).geometry.clone();
			geometry.scale(unit, unit, unit);
			ensurePuzzleTextureUVs(geometry);
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
			return [piece.id, geometry];
		}));
		this.previewGeometries = [...geometries.values()];
		for (const { id } of GAME_MENU_MATERIALS) {
			const group = new THREE.Group();
			group.visible = false;
			for (const piece of data.pieces) {
				const geometry = geometries.get(piece.id);
				const material = this.createMaterial(piece, geometry, id);
				this.previewMaterials.push(material);
				const mesh = new THREE.Mesh(geometry, material);
				mesh.onBeforeRender = (_renderer, _scene, camera) => setGameMaterialCamera(material, mesh, camera);
				const holder = new THREE.Group();
				const matrix = createAssemblyMatrix(piece, unit);
				matrix.decompose(holder.position, holder.quaternion, holder.scale);
				holder.position.sub(center);
				holder.position.addScaledVector(holder.position.clone(), GAME_MENU_PREVIEW.explode);
				holder.add(mesh);
				group.add(holder);
			}
			this.previewScene.add(group);
			this.previewGroups.set(id, group);
		}
	}

	renderMenu(time) {
		const renderer = this.renderer;
		const width = window.innerWidth;
		const height = window.innerHeight;
		renderer.setScissorTest(false);
		renderer.setViewport(0, 0, width, height);
		renderer.setClearColor(0x000000, 0);
		renderer.clear();
		renderer.setScissorTest(true);
		const spin = time * GAME_MENU_PREVIEW.rotationSpeed;
		for (const [id, card] of this.cards) {
			const group = this.previewGroups.get(id);
			if (!group) continue;
			const rect = card.querySelector('.card-preview').getBoundingClientRect();
			if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) continue;
			const x = Math.max(0, rect.left);
			const right = Math.min(width, rect.right);
			const top = Math.max(0, rect.top);
			const bottom = Math.min(height, rect.bottom);
			if (right <= x || bottom <= top) continue;
			// Keep the full-card framing even when the card is clipped by scrolling.
			renderer.setViewport(rect.left, height - rect.bottom, rect.width, rect.height);
			renderer.setScissor(x, height - bottom, right - x, bottom - top);
			this.previewCamera.aspect = rect.width / rect.height;
			const distance = GAME_MENU_PREVIEW.cameraDistance;
			this.previewCamera.position.set(0, Math.sin(GAME_MENU_PREVIEW.tilt) * distance, Math.cos(GAME_MENU_PREVIEW.tilt) * distance);
			this.previewCamera.lookAt(0, 0, 0);
			this.previewCamera.updateProjectionMatrix();
			group.rotation.y = spin;
			group.visible = true;
			renderer.render(this.previewScene, this.previewCamera);
			group.visible = false;
		}
		renderer.setScissorTest(false);
		renderer.setViewport(0, 0, width, height);
	}

	// ------------------------------------------------------------------------ XR

	setupXR() {
		this.controllers = new ControllersManager(this.renderer.xr, this.scene);
		this.controllers.enableHandTracking();
		this.locomotion = new XRTeleportMoveControl(this.renderer.xr, this.controllers, this.scene, {
			enabledHands: 'right', enableContinousMotion: false, enableControllerTeleport: false,
			restrictVerticalMovement: false, showTeleportArc: false,
		});
		this.locomotion.enabledHands = [];
		this.renderer.xr.addEventListener('sessionstart', () => this.handleSessionStart());
		this.renderer.xr.addEventListener('sessionend', () => this.handleSessionEnd());
	}

	async checkARSupport() {
		const config = getXRModeConfig('ar');
		try {
			this.arSupported = Boolean(navigator.xr) && await navigator.xr.isSessionSupported(config.sessionMode);
		} catch (error) {
			console.warn('Could not check AR support.', error);
			this.arSupported = false;
		}
		this.updateEnterButton();
		this.setMenuStatus(this.arSupported ? '' : (navigator.xr
			? 'Immersive AR is not available on this device or browser.'
			: (window.isSecureContext ? 'WebXR is not available in this browser.' : 'WebXR needs HTTPS.')));
	}

	async enterAR() {
		if (!this.arSupported || this.session || this.starting || !this.puzzle) return;
		this.starting = true;
		this.updateEnterButton();
		this.setMenuStatus('');
		// Audio contexts must be unlocked from this click.
		this.snapFeedback.unlock();
		this.particleAudio.setEnabled(this.selected === PARTICLES_ID);
		this.particleAudio.unlockAndStart();
		const config = getXRModeConfig('ar');
		let session = null;
		try {
			session = await navigator.xr.requestSession(config.sessionMode, createXRSessionInit('ar'));
			this.session = session;
			this.renderer.xr.setReferenceSpaceType(config.referenceSpaceType);
			await this.renderer.xr.setSession(session);
		} catch (error) {
			console.error('Could not enter AR.', error);
			this.setMenuStatus(`AR start failed · ${error.message}`);
			if (session) try { await session.end(); } catch { /* Session may already be closed. */ }
			this.session = null;
			this.starting = false;
			this.updateEnterButton();
		}
	}

	handleSessionStart() {
		this.starting = false;
		this.session = this.renderer.xr.getSession();
		this.locomotion.worldOffset.set(0, 0, 0);
		this.locomotion.worldYRotation = 0;
		this.xrStartAlignmentPending = true;
		document.body.classList.add('xr-session', 'ar-session');
		this.renderer.setClearAlpha(0);
		this.startPuzzle();
		this.updateEnterButton();
	}

	handleSessionEnd() {
		this.xrStartAlignmentPending = false;
		this.session = null;
		this.starting = false;
		const finished = this.completedAt != null && this.gameStartedAt != null;
		const time = this.formattedTime();
		this.stopPuzzle();
		document.body.classList.remove('xr-session', 'ar-session');
		this.renderer.xr.setReferenceSpaceType('local');
		this.resize();
		this.updateEnterButton();
		this.setMenuStatus(finished ? `Puzzle complete · ${time}` : '');
	}

	startPuzzle() {
		const { data, meshes } = this.puzzle;
		this.stopPuzzle();
		this.gameStartedAt = null;
		this.completedAt = null;
		const preset = this.selected;
		this.assembly = new PuzzleAssembly({
			scene: this.scene, data, sourceMeshes: meshes, unitScale: this.unitScale,
			materialFactory: (piece, _index, geometry) => this.createMaterial(piece, geometry, preset),
			scatterOptions: GAME_SESSION.scatter,
			onChange: (progress) => {
				if (progress.complete && this.completedAt == null && this.gameStartedAt != null) this.completedAt = performance.now();
			},
			onInteraction: () => {
				this.snapFeedback.unlock();
				if (this.gameStartedAt == null && this.completedAt == null) this.gameStartedAt = performance.now();
			},
			onSnap: ({ position, controller }) => this.snapFeedback.playSnap(position, controller),
		});
		this.particleAudio.setPuzzle({ assembly: this.assembly, data, gridSize: this.gridSize });
		this.particleAudio.setEnabled(preset === PARTICLES_ID);
	}

	stopPuzzle() {
		if (!this.assembly) return;
		this.particleAudio.setPuzzle({ assembly: null, data: this.puzzle.data, gridSize: this.gridSize });
		this.particleAudio.setEnabled(false);
		this.assembly.dispose();
		this.assembly = null;
	}

	formattedTime() {
		if (this.gameStartedAt == null) return '00:00.0';
		const elapsed = Math.max(0, (this.completedAt ?? performance.now()) - this.gameStartedAt) / 1000;
		const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
		const seconds = (elapsed % 60).toFixed(1).padStart(4, '0');
		return `${minutes}:${seconds}`;
	}

	alignXRStartPosition() {
		if (!this.xrStartAlignmentPending || !this.renderer.xr.isPresenting) return;
		const xrCamera = this.renderer.xr.getCamera();
		if (!xrCamera?.cameras?.length) return;
		const { x, y, z } = xrCamera.position;
		if (![x, y, z].every(Number.isFinite)) return;
		// Same convention as the Game Tester: map the first viewer pose to the
		// puzzle's 1.55 m presentation height in the guaranteed `local` space.
		this.locomotion.worldOffset.set(x, y - 1.55, z);
		this.xrStartAlignmentPending = false;
	}

	// ----------------------------------------------------------------- main loop

	animate(time) {
		const now = performance.now();
		const delta = Math.min(0.1, (now - this.lastFrame) / 1000);
		this.lastFrame = now;
		// Materials always animate.
		this.shaderTime = (this.shaderTime + delta + 120) % 120;
		updateWhiteGridParticleData(this.particleData, this.shaderTime);
		for (const material of this.previewMaterials) setGameMaterialTime(material, this.shaderTime);

		if (this.renderer.xr.isPresenting) {
			for (const material of this.assembly?.getMaterials() ?? []) setGameMaterialTime(material, this.shaderTime);
			if (this.selected === PARTICLES_ID) this.particleAudio.update(this.particleData);
			this.controllers.update(time / 1000, delta);
			this.assembly?.update(time / 1000);
			this.alignXRStartPosition();
			this.locomotion.update(delta);
			this.renderer.render(this.scene, this.camera);
		} else if (this.previewGroups.size) {
			this.renderMenu(time / 1000);
		}
	}

	resize() {
		this.renderer.setSize(window.innerWidth, window.innerHeight, false);
	}

	showFatalError(message) {
		this.errorElement.hidden = false;
		this.errorElement.textContent = message;
		this.enterButton.disabled = true;
		this.enterButton.textContent = 'Unavailable';
	}
}
