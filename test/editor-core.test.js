import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, occupiedCellCount } from '../src/core/grid.js';
import { validateCells } from '../src/core/validator.js';
import { generatePartition, validatePartition } from '../src/core/partition.js';
import { buildAllPieceGeometries, buildConnectivity, buildPieceGeometry } from '../src/core/meshes.js';
import { buildGameData, deserializeProject, sanitizeExportName, serializeProject } from '../src/core/serialization.js';
import { clampSliceToDomain, domainPointFromNormalized, slicePointFromNormalized, sliceRange } from '../src/shader/domain.js';
import { PRESET_BY_ID, SHADER_PRESETS, createDefaultSources } from '../src/shader/presets.js';
import { evaluatePulseWaveTrain, PULSE_WAVE_DEFAULTS } from '../src/shader/pulseWaveCore.js';
import { ShaderRuntime } from '../src/shader/ShaderRuntime.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync, statSync } from 'node:fs';
import { applyWorldDelta, buildConnectionContactGeometry, buildLegacyConnectionContactGeometry, calculateHintStrength, calculateSnapAlignment, collectResolvedConnectionIds, computePuzzleScale, createAssemblyMatrix, ensurePuzzleTextureUVs, interpolateIntersectionAttribute, mergeBlockMembership, scatterTransforms, selectBestSnapCandidate, selectHintCandidate, validateGameData } from '../src/game/gameCore.js';
import { createXRSessionInit, getXRModeConfig } from '../src/game/xrSessionConfig.js';
import { pulseXRControllers } from '../src/game/SnapFeedback.js';
import { createPieceCellLookup, createPuzzlePieceMap, createWhiteGridParticleData, findSpherePieceOverlaps, updateWhiteGridParticleData } from '../src/game/WhiteGridParticles.js';
import { createGamePuzzleMaterial, GAME_MATERIAL_PRESETS, setGameMaterialPreset, setGameMaterialPulseOrigin, setGameMaterialTime, setGameMaterialVolumeOptions } from '../src/game/GameMaterials.js';

test('builds a centered void with shared grid vertices', () => {
	const volume = buildGrid({ gridSize: 8, innerVoidSize: 4, cellSize: 1 });
	assert.equal(volume.vertices.length, 9 ** 3);
	assert.equal(volume.cells.length, 8 ** 3);
	assert.equal(occupiedCellCount(volume), 8 ** 3 - 4 ** 3);
	assert.equal(volume.cells.filter((cell) => !cell.occupied).length, 64);
	assert.equal(volume.cells[0].vertexIds[1], volume.cells[1].vertexIds[0]);
});

test('rejects mismatched parity and invalid cell deformation', () => {
	assert.throws(() => buildGrid({ gridSize: 8, innerVoidSize: 3, cellSize: 1 }), /parity/);
	const volume = buildGrid({ gridSize: 2, innerVoidSize: 0, cellSize: 1 });
	assert.equal(validateCells(volume).valid, true);
	volume.vertices[volume.cells[0].vertexIds[1]].restPosition = [...volume.vertices[volume.cells[0].vertexIds[0]].restPosition];
	assert.equal(validateCells(volume, [0]).valid, false);
});

test('partition is deterministic, connected, and covers every occupied cell', () => {
	const options = { minCellsPerPiece: 4, maxCellsPerPiece: 12, seed: 'repeatable', shapePreference: 'balanced' };
	const firstVolume = buildGrid({ gridSize: 4, innerVoidSize: 2, cellSize: 1 });
	const secondVolume = buildGrid({ gridSize: 4, innerVoidSize: 2, cellSize: 1 });
	const first = generatePartition(firstVolume, options);
	const second = generatePartition(secondVolume, options);
	assert.deepEqual(first.pieces, second.pieces);
	assert.equal(validatePartition(firstVolume, first).valid, true);
	assert.equal(first.pieces.reduce((sum, piece) => sum + piece.cellIds.length, 0), occupiedCellCount(firstVolume));
});

test('piece extraction removes internal faces and preserves interface faces', () => {
	const volume = buildGrid({ gridSize: 2, innerVoidSize: 0, cellSize: 1 });
	const joined = buildPieceGeometry(volume, { id: 0, cellIds: [0, 1] });
	assert.equal(joined.faceCount, 10);
	assert.equal(joined.geometry.getAttribute('position').count, 60);
	volume.cells[0].pieceId = 0;
	volume.cells[1].pieceId = 1;
	const connectivity = buildConnectivity(volume, { pieces: [{ id: 0, cellIds: [0] }, { id: 1, cellIds: [1] }] });
	assert.equal(connectivity.length, 1);
	assert.equal(connectivity[0].sharedFaces.length, 1);
	joined.geometry.dispose();
});

test('tessellates every visible face while preserving its bounds and metadata', () => {
	const volume = buildGrid({ gridSize: 2, innerVoidSize: 0, cellSize: 1 });
	const base = buildPieceGeometry(volume, { id: 0, cellIds: [0] });
	const tessellated = buildPieceGeometry(volume, { id: 0, cellIds: [0] }, { subdivisionLevel: 2 });
	assert.equal(tessellated.faceCount, base.faceCount);
	assert.equal(tessellated.triangleCount, base.triangleCount * 16);
	base.geometry.computeBoundingBox(); tessellated.geometry.computeBoundingBox();
	assert.ok(base.geometry.boundingBox.min.distanceTo(tessellated.geometry.boundingBox.min) < 1e-9);
	assert.ok(base.geometry.boundingBox.max.distanceTo(tessellated.geometry.boundingBox.max) < 1e-9);
	base.geometry.dispose(); tessellated.geometry.dispose();
});

test('sanitizes export names and provides a stable fallback', () => {
	assert.equal(sanitizeExportName('  pieza 1  '), 'pieza-1');
	assert.equal(sanitizeExportName('../pieza:1?.glb'), 'pieza-1-.glb');
	assert.equal(sanitizeExportName('...'), 'shaders-puzzle');
});

test('editable project round-trips and game data references every connection', () => {
	const volume = buildGrid({ gridSize: 3, innerVoidSize: 1, cellSize: 1 });
	const options = { minCellsPerPiece: 2, maxCellsPerPiece: 5, seed: 'save', shapePreference: 'compact' };
	const partition = generatePartition(volume, options);
	const state = { volume, partition, view: { renderMode: 'Solid', explosionFactor: 1 } };
	const restored = deserializeProject(JSON.parse(JSON.stringify(serializeProject(state))));
	assert.deepEqual(restored.partition.pieces, partition.pieces);
	const meshes = buildAllPieceGeometries(restored.volume, restored.partition);
	const gameData = buildGameData(restored.volume, restored.partition, meshes);
	assert.equal(gameData.version, 2);
	assert.equal(gameData.contactGeometry.space, 'assembled');
	assert.equal(gameData.pieces.length, partition.pieces.length);
	for (const connection of gameData.connections) {
		assert.ok(gameData.pieces.find((piece) => piece.id === connection.pieceA).connectionIds.includes(connection.id));
		assert.ok(gameData.pieces.find((piece) => piece.id === connection.pieceB).connectionIds.includes(connection.id));
		const positionA = gameData.pieces.find((piece) => piece.id === connection.pieceA).assembledTransform.position;
		const positionB = gameData.pieces.find((piece) => piece.id === connection.pieceB).assembledTransform.position;
		assert.deepEqual(connection.relativeTransform.position, positionB.map((value, axis) => value - positionA[axis]));
		for (const face of connection.sharedFaces) {
			assert.equal(face.triangles.length, 2);
			for (const id of face.vertexIds) assert.ok(gameData.contactGeometry.vertices[id]);
		}
	}
	for (const item of meshes) item.geometry.dispose();
});

test('maps normalized coordinates and 2D slices into the shared centered domain', () => {
	const domain = { scale: { x: 4, y: 2, z: 6 }, offset: { x: 10, y: -2, z: 3 } };
	assert.deepEqual(domainPointFromNormalized([0, 0.5, 1], domain), [8, -2, 6]);
	assert.deepEqual(sliceRange(domain, 'UW'), { axis: 'y', min: -3, max: -1 });
	assert.deepEqual(slicePointFromNormalized([0.25, 0.75], 'UW', -2.5, domain), [9, -2.5, 4.5]);
	assert.equal(clampSliceToDomain(domain, 'VW', 100), 12);
});

test('exposes six complete shader presets and four editable wave sources', () => {
	const ids = ['spherical-waves', 'directional-stripes', 'grid-3d', 'repeated-spheres', 'repeated-boxes', 'pulse-wave-train'];
	assert.deepEqual(SHADER_PRESETS.map((preset) => preset.id), ids);
	assert.deepEqual(GAME_MATERIAL_PRESETS.map((preset) => preset.id), [...ids, 'white-grid', 'white-grid-particles', 'volumetric-cloud-grid']);
	for (const preset of SHADER_PRESETS) {
		assert.equal(typeof preset.createColorNode, 'function');
		assert.ok(preset.name && preset.description);
		assert.equal(PRESET_BY_ID.get(preset.id), preset);
	}
	assert.equal(createDefaultSources().length, 4);
	const pulse = PRESET_BY_ID.get('pulse-wave-train');
	assert.deepEqual(Object.keys(pulse.controls), ['origin', 'baseColor', 'waveColor', 'propagationSpeed', 'pulseInterval', 'trainDuration', 'cycles', 'bandWidth', 'softness', 'emission']);
	assert.equal(typeof pulse.createEmissionNode, 'function');
});

test('moves white-grid particles continuously inside canonical puzzle space', () => {
	const particles = createWhiteGridParticleData();
	const before = particles.map((particle) => particle.clone());
	updateWhiteGridParticleData(particles, 1.25);
	assert.equal(particles.length, 4);
	for (let i = 0; i < particles.length; i++) {
		const particle = particles[i];
		assert.ok(particle.x > particle.w && particle.x < 1 - particle.w);
		assert.ok(particle.y > particle.w && particle.y < 1 - particle.w);
		assert.ok(particle.z > particle.w && particle.z < 1 - particle.w);
		assert.equal(particle.equals(before[i]), false);
	}
});

test('encodes canonical grid ownership for particle handoff between pieces', () => {
	const data = { pieces: [{ id: 'piece-a', cellIds: [0, 7] }, { id: 'piece-b', cellIds: [1] }] };
	const ownership = createPuzzlePieceMap(data, 2);
	assert.equal(ownership.width, 4);
	assert.equal(ownership.height, 2);
	assert.equal(ownership.pieceTokens.get('piece-a'), 1);
	assert.equal(ownership.pieceTokens.get('piece-b'), 2);
	assert.equal(ownership.pixels[0], 1);
	assert.equal(ownership.pixels[4], 2);
	ownership.texture.dispose();
});

test('shares a sphere across every logical piece touched at a grid corner', () => {
	const data = { pieces: Array.from({ length: 8 }, (_, id) => ({ id: `piece-${id}`, cellIds: [id] })) };
	const lookup = createPieceCellLookup(data, 2);
	const overlaps = findSpherePieceOverlaps(new THREE.Vector4(0.5, 0.5, 0.5, 0.12), 2, lookup);
	assert.equal(overlaps.length, 8);
	assert.deepEqual(new Set(overlaps.map((overlap) => overlap.pieceId)), new Set(data.pieces.map((piece) => piece.id)));
});

test('evaluates pulse arrival, soft cycles, quadratic decay, gap, and repetition', () => {
	const travelTime = 0.9 / PULSE_WAVE_DEFAULTS.propagationSpeed;
	assert.equal(evaluatePulseWaveTrain(0.9, travelTime - 0.001), 0);
	assert.ok(Math.abs(evaluatePulseWaveTrain(0.9, travelTime) - 1) < 1e-10);
	assert.ok(Math.abs(evaluatePulseWaveTrain(0, 0.4) - 0.64) < 1e-10);
	assert.ok(Math.abs(evaluatePulseWaveTrain(0, 0.8) - 0.36) < 1e-10);
	assert.equal(evaluatePulseWaveTrain(0, 0.2), 0);
	assert.equal(evaluatePulseWaveTrain(0, 2.5), 0);
	assert.ok(Math.abs(evaluatePulseWaveTrain(0, 5) - 1) < 1e-10);
});

test('builds TSL color, emission, and slice nodes for the pulse preset', () => {
	const preset = PRESET_BY_ID.get('pulse-wave-train');
	const runtime = new ShaderRuntime(
		preset,
		JSON.parse(JSON.stringify(preset.defaults)),
		{ scale: { x: 2, y: 2, z: 2 }, offset: { x: 0, y: 0, z: 0 } },
		[],
		0
	);
	assert.equal(runtime.create3DColorNode().isNode, true);
	assert.equal(runtime.create3DEmissionNode().isNode, true);
	assert.equal(runtime.create2DColorNode('UV').isNode, true);
});

test('generates UVs from canonical UVW and interpolates ray hits on transformed triangles', () => {
	for (const indexed of [false, true]) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
		geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
		geometry.setAttribute('_uvw', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 1], 3));
		if (indexed) geometry.setIndex([0, 1, 2]);
		const uv = ensurePuzzleTextureUVs(geometry);
		assert.deepEqual(Array.from(uv.array), [0, 0, 1, 0, 0, 1]);

		const mesh = new THREE.Mesh(geometry);
		mesh.position.set(2, 3, -1);
		mesh.rotation.set(0.2, -0.35, 0.1);
		mesh.updateMatrixWorld(true);
		const localPoint = new THREE.Vector3(0.3, 0.5, 0);
		const intersection = {
			object: mesh,
			point: localPoint.clone().applyMatrix4(mesh.matrixWorld),
			face: { a: 0, b: 1, c: 2 },
		};
		const result = interpolateIntersectionAttribute(intersection, '_uvw');
		assert.ok(result.distanceTo(new THREE.Vector3(0.3, 0.5, 0.5)) < 1e-6);
		geometry.dispose();
	}
});

test('applies and restores the pulse chrome material profile and dynamic origin', () => {
	const normalMap = new THREE.Texture();
	const roughnessMap = new THREE.Texture();
	const environmentMap = new THREE.Texture();
	const material = createGamePuzzleMaterial({ pulseWaveAssets: { normalMap, roughnessMap, environmentMap } });
	assert.equal(material.normalMap, null);
	assert.equal(setGameMaterialPreset(material, 'pulse-wave-train'), true);
	assert.equal(material.metalness, 0.97);
	assert.equal(material.normalMap, normalMap);
	assert.equal(material.roughnessMap, roughnessMap);
	assert.equal(material.envMap, environmentMap);
	const shader = {
		uniforms: {},
		vertexShader: '#include <common>\n#include <begin_vertex>',
		fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>',
	};
	material.onBeforeCompile(shader);
	assert.ok(shader.vertexShader.includes('vPuzzleUVW = _uvw'));
	assert.ok(shader.fragmentShader.includes('puzzlePulseWaveIntensity'));
	assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance += puzzlePresetEmission'));
	assert.ok(shader.uniforms.uPuzzlePulseOrigin.value.equals(new THREE.Vector3(0.5, 0.5, 0.5)));
	setGameMaterialTime(material, 3, 2.5);
	assert.equal(material.userData.puzzlePulseTime, 2.5);
	const origin = new THREE.Vector3(0.2, 0.4, 0.8);
	assert.equal(setGameMaterialPulseOrigin(material, origin), true);
	assert.ok(material.userData.puzzlePulseOrigin.equals(origin));
	assert.equal(material.userData.puzzlePulseTime, 0);
	assert.equal(setGameMaterialPreset(material, 'grid-3d'), true);
	assert.equal(material.metalness, 0.9);
	assert.equal(material.normalMap, null);
	assert.equal(material.roughnessMap, null);
	assert.equal(material.envMap, null);
	material.dispose();
});

test('configures the volumetric cloud as an order-independent transparent material', () => {
	const material = createGamePuzzleMaterial({ preset: 'volumetric-cloud-grid', volumeSteps: 10 });
	assert.equal(material.transparent, true);
	assert.equal(material.premultipliedAlpha, true);
	assert.equal(material.depthWrite, false);
	assert.equal(material.side, THREE.FrontSide);
	assert.equal(material.blending, THREE.AdditiveBlending);
	const shader = {
		uniforms: {},
		vertexShader: '#include <common>\n#include <begin_vertex>',
		fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>',
	};
	material.onBeforeCompile(shader);
	assert.ok(shader.fragmentShader.includes('puzzleVolumetricCloudGrid'));
	assert.ok(shader.fragmentShader.includes('puzzleValueNoise'));
	setGameMaterialVolumeOptions(material, { density: 1.2, scale: 7, speed: 0.2, steps: 99, blend: 'subtractive', color: '#ffffff' });
	assert.equal(shader.uniforms.uPuzzleVolumeDensity.value, 1.2);
	assert.equal(shader.uniforms.uPuzzleVolumeScale.value, 7);
	assert.equal(shader.uniforms.uPuzzleVolumeSpeed.value, 0.2);
	assert.equal(shader.uniforms.uPuzzleVolumeSteps.value, 16);
	assert.equal(material.blending, THREE.SubtractiveBlending);
	assert.equal(setGameMaterialPreset(material, 'white-grid'), true);
	assert.equal(material.transparent, false);
	assert.equal(material.depthWrite, true);
	assert.equal(material.side, THREE.DoubleSide);
	material.dispose();
});

test('bundles replaceable provisional pulse material maps', () => {
	for (const name of ['pulse-wave-normal.png', 'pulse-wave-roughness.png', 'pulse-wave-environment.jpg']) {
		assert.ok(statSync(new URL(`../models/Maps/${name}`, import.meta.url)).size > 1024);
	}
});

test('validates the exported game data and scales its cube to half a meter', () => {
	const data = JSON.parse(readFileSync(new URL('../models/shaders-puzzle-data.json', import.meta.url), 'utf8'));
	const meshNames = data.pieces.map((piece) => piece.meshRef);
	assert.equal(validateGameData(data, meshNames), true);
	assert.equal(data.pieces.length, 52);
	assert.equal(computePuzzleScale(data.bounds), 0.0625);
	assert.throws(() => validateGameData(data, meshNames.slice(1)), /was not found/);
});

test('configures compatible VR and AR WebXR sessions', () => {
	const vr = getXRModeConfig('vr');
	const ar = getXRModeConfig('ar');
	assert.equal(vr.sessionMode, 'immersive-vr');
	assert.equal(vr.referenceSpaceType, 'local-floor');
	assert.deepEqual(createXRSessionInit('vr').requiredFeatures, ['local-floor']);
	assert.equal(ar.sessionMode, 'immersive-ar');
	assert.equal(ar.referenceSpaceType, 'local');
	assert.deepEqual(createXRSessionInit('ar').requiredFeatures, []);
	assert.ok(createXRSessionInit('ar').optionalFeatures.includes('hand-tracking'));
	assert.ok(createXRSessionInit('ar').optionalFeatures.includes('layers'));
	assert.throws(() => getXRModeConfig('inline'), /Unknown XR mode/);
});

test('pulses every available WebXR controller and falls back to the grab controller', () => {
	const calls = [];
	const session = { inputSources: [
		{ gamepad: { hapticActuators: [{ pulse: (intensity, duration) => { calls.push(['left', intensity, duration]); return Promise.resolve(); } }] } },
		{ gamepad: { vibrationActuator: { playEffect: (_type, options) => { calls.push(['right', options.strongMagnitude, options.duration]); return Promise.resolve(); } } } },
	] };
	assert.equal(pulseXRControllers(session, null, { intensity: 0.6, duration: 100 }), true);
	assert.deepEqual(calls, [['left', 0.6, 100], ['right', 0.6, 100]]);
	let fallback = null;
	assert.equal(pulseXRControllers(null, { pulse: (intensity, duration) => { fallback = [intensity, duration]; } }), true);
	assert.deepEqual(fallback, [0.55, 95]);
});

test('computes snap error and aligns a complete moving root in world space', () => {
	const pieceA = { assembledTransform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] } };
	const pieceB = { assembledTransform: { position: [1, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] } };
	const targetWorld = new THREE.Matrix4().compose(new THREE.Vector3(2, 1, -1), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4), new THREE.Vector3(1, 1, 1));
	const desired = targetWorld.clone().multiply(new THREE.Matrix4().makeTranslation(0.0625, 0, 0));
	const movingWorld = desired.clone().premultiply(new THREE.Matrix4().makeTranslation(0.02, 0, 0));
	const alignment = calculateSnapAlignment(movingWorld, targetWorld, pieceB, pieceA, 0.0625);
	assert.ok(Math.abs(alignment.positionError - 0.02) < 1e-8);
	assert.ok(alignment.angleError < 1e-6);

	const scene = new THREE.Scene();
	const root = new THREE.Group();
	root.position.setFromMatrixPosition(movingWorld);
	root.quaternion.setFromRotationMatrix(movingWorld);
	scene.add(root);
	applyWorldDelta(root, alignment.delta);
	const alignedPosition = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
	const desiredPosition = new THREE.Vector3().setFromMatrixPosition(alignment.desiredMovingWorld);
	assert.ok(alignedPosition.distanceTo(desiredPosition) < 1e-8);
});

test('scatters pieces inside the configured volume with deterministic separation', () => {
	let state = 123456789;
	const random = () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
	const transforms = scatterTransforms(24, random, { center: [1, 2, -3], size: [2, 1, 4], minDistance: 0.12, maxAttempts: 200 });
	assert.equal(transforms.length, 24);
	for (let i = 0; i < transforms.length; i++) {
		const { position, quaternion } = transforms[i];
		assert.ok(position.x >= 0 && position.x <= 2);
		assert.ok(position.y >= 1.5 && position.y <= 2.5);
		assert.ok(position.z >= -5 && position.z <= -1);
		assert.ok(Math.abs(quaternion.length() - 1) < 1e-10);
		for (let j = 0; j < i; j++) assert.ok(position.distanceTo(transforms[j].position) >= 0.12);
	}
});

test('chooses one snap candidate and merges block membership and progress', () => {
	const candidates = [
		{ id: 'far', alignment: { positionError: 0.039, angleError: 0.2 } },
		{ id: 'best', alignment: { positionError: 0.01, angleError: 0.04 } },
		{ id: 'outside', alignment: { positionError: 0.041, angleError: 0 } },
	];
	assert.equal(selectBestSnapCandidate(candidates, 0.04, 0.3).id, 'best');
	const moving = { pieceIds: new Set(['a', 'b']) };
	const target = { pieceIds: new Set(['c']) };
	const membership = new Map([['a', moving], ['b', moving], ['c', target], ['d', { pieceIds: new Set(['d']) }]]);
	mergeBlockMembership(moving, target, membership);
	assert.deepEqual([...target.pieceIds].sort(), ['a', 'b', 'c']);
	const resolved = collectResolvedConnectionIds([
		{ id: 'a-c', pieceA: 'a', pieceB: 'c' },
		{ id: 'b-d', pieceA: 'b', pieceB: 'd' },
	], membership);
	assert.deepEqual([...resolved], ['a-c']);
});

test('selects a stable localized hint without requiring angular alignment', () => {
	const candidates = [
		{ connection: { id: 'current' }, alignment: { positionError: 0.12, angleError: 2.8 } },
		{ connection: { id: 'slightly-closer' }, alignment: { positionError: 0.105, angleError: 0 } },
		{ connection: { id: 'far' }, alignment: { positionError: 0.4, angleError: 0 } },
	];
	assert.equal(selectHintCandidate(candidates, 0.32, 'current').connection.id, 'current');
	candidates[1].alignment.positionError = 0.08;
	assert.equal(selectHintCandidate(candidates, 0.32, 'current').connection.id, 'slightly-closer');
	assert.equal(selectHintCandidate([candidates[0]], 0.1), null);
});

test('builds coincident v2 and legacy contact patches in each piece local space', () => {
	const volume = buildGrid({ gridSize: 2, innerVoidSize: 0, cellSize: 1 });
	volume.cells[0].pieceId = 0;
	volume.cells[1].pieceId = 1;
	const partition = { pieces: [{ id: 0, cellIds: [0] }, { id: 1, cellIds: [1] }] };
	const meshes = buildAllPieceGeometries(volume, partition);
	const data = buildGameData(volume, partition, meshes);
	const connection = data.connections[0];
	const worldPositions = (geometry, piece) => {
		const matrix = createAssemblyMatrix(piece, 1);
		const attribute = geometry.getAttribute('position');
		return Array.from({ length: attribute.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(attribute, index).applyMatrix4(matrix).toArray()
			.map((value) => value.toFixed(6)).join(','));
	};
	const pieceA = data.pieces.find((piece) => piece.id === connection.pieceA);
	const pieceB = data.pieces.find((piece) => piece.id === connection.pieceB);
	const sourceA = meshes.find(({ piece }) => `piece-${piece.id}` === pieceA.id).geometry;
	const sourceB = meshes.find(({ piece }) => `piece-${piece.id}` === pieceB.id).geometry;
	const v2A = buildConnectionContactGeometry(connection, pieceA, data.contactGeometry, 1);
	const v2B = buildConnectionContactGeometry(connection, pieceB, data.contactGeometry, 1);
	const legacyA = buildLegacyConnectionContactGeometry(connection, pieceA, sourceA, 1);
	const legacyB = buildLegacyConnectionContactGeometry(connection, pieceB, sourceB, 1);
	assert.deepEqual(worldPositions(v2A, pieceA).sort(), worldPositions(v2B, pieceB).sort());
	assert.deepEqual(worldPositions(v2A, pieceA).sort(), worldPositions(legacyA, pieceA).sort());
	assert.deepEqual(worldPositions(v2B, pieceB).sort(), worldPositions(legacyB, pieceB).sort());
	for (const geometry of [v2A, v2B, legacyA, legacyB]) geometry.dispose();
	for (const item of meshes) item.geometry.dispose();
});

test('recovers every localized contact patch from the bundled v1 GLBs', async () => {
	for (const [dataFile, modelFile] of [
		['../models/shaders-puzzle-data.json', '../models/shaders-puzzle.glb'],
		['../models/shaders-puzzle-data2.json', '../models/shaders-puzzle2.glb'],
	]) {
		const data = JSON.parse(readFileSync(new URL(dataFile, import.meta.url), 'utf8'));
		const file = readFileSync(new URL(modelFile, import.meta.url));
		const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
		const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, '', resolve, reject));
		const meshes = new Map();
		gltf.scene.traverse((object) => { if (object.isMesh && object.name) meshes.set(object.name, object); });
		for (const connection of data.connections) {
			for (const pieceId of [connection.pieceA, connection.pieceB]) {
				const piece = data.pieces.find((candidate) => candidate.id === pieceId);
				const geometry = buildLegacyConnectionContactGeometry(connection, piece, meshes.get(piece.meshRef).geometry, 1);
				assert.equal(geometry.getAttribute('position').count, connection.sharedFaces.length * 6);
				geometry.dispose();
			}
		}
	}
});

test('fades connection hints smoothly over their configured distance', () => {
	assert.equal(calculateHintStrength(0, 0.32), 1);
	assert.equal(calculateHintStrength(0.16, 0.32), 0.5);
	assert.equal(calculateHintStrength(0.32, 0.32), 0);
	assert.equal(calculateHintStrength(1, 0.32), 0);
	assert.ok(calculateHintStrength(0.08, 0.32) > calculateHintStrength(0.24, 0.32));
});
