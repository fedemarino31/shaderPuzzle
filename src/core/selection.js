import * as THREE from 'three';

function smoothWeight(t, exponent, intensity) {
	return Math.max(0, Math.min(1, Math.pow(Math.max(0, t), exponent) * intensity));
}

export function calculateSelection(volume, primaryId, options) {
	if (primaryId == null || !volume.vertices[primaryId]) return new Map();
	const primary = volume.vertices[primaryId];
	const result = new Map();
	const mode = options.mode || 'Point';

	for (const vertex of volume.vertices) {
		const delta = vertex.index.map((value, axis) => Math.abs(value - primary.index[axis]));
		let weight = 0;
		if (mode === 'Point') weight = vertex.id === primaryId ? 1 : 0;
		if (mode === 'Line') {
			const axis = Math.max(0, ['X', 'Y', 'Z'].indexOf(options.lineAxis));
			const aligned = delta.every((value, candidateAxis) => candidateAxis === axis || value === 0);
			weight = aligned && delta[axis] <= options.lineRange ? 1 : 0;
		}
		if (mode === 'Hard range') {
			weight = delta[0] <= options.rangeX && delta[1] <= options.rangeY && delta[2] <= options.rangeZ ? 1 : 0;
		}
		if (mode === 'Soft sphere') {
			const p = new THREE.Vector3().fromArray(primary.restPosition);
			const q = new THREE.Vector3().fromArray(vertex.restPosition);
			const distance = p.distanceTo(q);
			weight = distance === 0 ? 1 : smoothWeight(1 - distance / options.radius, options.exponent, options.intensity);
		}
		if (weight > 0) result.set(vertex.id, weight);
	}
	return result;
}

export function randomSelection(volume, options, random = Math.random) {
	const primaryId = Math.floor(random() * volume.vertices.length);
	const modes = ['Point', 'Line', 'Hard range', 'Soft sphere'];
	options.mode = modes[Math.floor(random() * modes.length)];
	options.lineAxis = ['X', 'Y', 'Z'][Math.floor(random() * 3)];
	return { primaryId, weights: calculateSelection(volume, primaryId, options) };
}
