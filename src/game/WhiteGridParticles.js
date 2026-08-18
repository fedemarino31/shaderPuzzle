import * as THREE from 'three';

export const WHITE_GRID_PARTICLE_COUNT = 4;

export const PARTICLE_SPEED_MULTIPLIER = 3.0;

const PARTICLE_PATHS = [
	{ phase: [0.13, 0.67, 0.31], speed: [0.071, 0.043, 0.059], radius: 0.042 },
	{ phase: [0.76, 0.19, 0.54], speed: [-0.047, 0.063, 0.037], radius: 0.032 },
	{ phase: [0.42, 0.88, 0.08], speed: [0.039, -0.052, 0.069], radius: 0.052 },
	{ phase: [0.91, 0.36, 0.72], speed: [-0.061, -0.035, 0.046], radius: 0.027 },
];

function pingPong(value) {
	const wrapped = ((value % 2) + 2) % 2;
	return 1 - Math.abs(wrapped - 1);
}

export function createWhiteGridParticleData() {
	const particles = Array.from({ length: WHITE_GRID_PARTICLE_COUNT }, () => new THREE.Vector4());
	return updateWhiteGridParticleData(particles, 0);
}

export function updateWhiteGridParticleData(particles, time) {
	for (let i = 0; i < WHITE_GRID_PARTICLE_COUNT; i++) {
		const path = PARTICLE_PATHS[i];
		const margin = path.radius + 0.012;
		const span = 1 - margin * 2;
		particles[i].set(
			margin + pingPong(path.phase[0] + time * path.speed[0] * PARTICLE_SPEED_MULTIPLIER) * span,
			margin + pingPong(path.phase[1] + time * path.speed[1] * PARTICLE_SPEED_MULTIPLIER) * span,
			margin + pingPong(path.phase[2] + time * path.speed[2] * PARTICLE_SPEED_MULTIPLIER) * span,
			path.radius,
		);
	}
	return particles;
}

export function createPuzzlePieceMap(data, gridSize) {
	const safeSize = Math.max(1, Math.floor(gridSize));
	const width = safeSize * safeSize;
	const pixels = new Uint8Array(width * safeSize * 4);
	const pieceTokens = new Map();
	data.pieces.forEach((piece, index) => {
		const token = index + 1;
		pieceTokens.set(piece.id, token);
		for (const cellId of piece.cellIds) {
			const x = cellId % safeSize;
			const y = Math.floor(cellId / safeSize) % safeSize;
			const z = Math.floor(cellId / (safeSize * safeSize));
			if (z < 0 || z >= safeSize) continue;
			const offset = ((x + z * safeSize) + y * width) * 4;
			pixels[offset] = token & 0xff;
			pixels[offset + 1] = (token >> 8) & 0xff;
			pixels[offset + 3] = 255;
		}
	});
	const texture = new THREE.DataTexture(pixels, width, safeSize, THREE.RGBAFormat, THREE.UnsignedByteType);
	texture.name = 'puzzle-piece-ownership';
	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.generateMipmaps = false;
	texture.colorSpace = THREE.NoColorSpace;
	texture.needsUpdate = true;
	return { texture, pieceTokens, pixels, width, height: safeSize };
}

export function createPieceCellLookup(data, gridSize) {
	const lookup = new Array(Math.max(1, Math.floor(gridSize)) ** 3).fill(null);
	for (const piece of data.pieces) for (const cellId of piece.cellIds) if (cellId >= 0 && cellId < lookup.length) lookup[cellId] = piece.id;
	return lookup;
}

export function findSpherePieceOverlaps(particle, gridSize, cellOwners) {
	const size = Math.max(1, Math.floor(gridSize));
	const radius = Math.max(0, particle.w);
	const cellSize = 1 / size;
	const clampIndex = (value) => Math.max(0, Math.min(size - 1, Math.floor(value * size)));
	const min = [clampIndex(particle.x - radius), clampIndex(particle.y - radius), clampIndex(particle.z - radius)];
	const max = [clampIndex(particle.x + radius), clampIndex(particle.y + radius), clampIndex(particle.z + radius)];
	const center = new THREE.Vector3(particle.x, particle.y, particle.z);
	const byPiece = new Map();
	for (let z = min[2]; z <= max[2]; z++) for (let y = min[1]; y <= max[1]; y++) for (let x = min[0]; x <= max[0]; x++) {
		const pieceId = cellOwners[x + size * (y + size * z)];
		if (pieceId == null) continue;
		const closest = new THREE.Vector3(
			THREE.MathUtils.clamp(center.x, x * cellSize, (x + 1) * cellSize),
			THREE.MathUtils.clamp(center.y, y * cellSize, (y + 1) * cellSize),
			THREE.MathUtils.clamp(center.z, z * cellSize, (z + 1) * cellSize),
		);
		const distance = closest.distanceTo(center);
		if (distance > radius) continue;
		const weight = Math.max(radius - distance, radius * 0.002);
		const current = byPiece.get(pieceId) || { pieceId, weight: 0, position: new THREE.Vector3() };
		current.weight += weight;
		current.position.addScaledVector(closest, weight);
		byPiece.set(pieceId, current);
	}
	return [...byPiece.values()].map((entry) => ({ ...entry, position: entry.position.multiplyScalar(1 / entry.weight) }));
}
