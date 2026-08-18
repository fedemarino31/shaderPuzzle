import * as THREE from 'three';

const PARAMETRIC_CORNERS = [
	[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
	[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

const EDGE_PAIRS = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const FACE_QUADS = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [0, 3, 7, 4], [1, 5, 6, 2]];

function jacobianDeterminant(points, u, v, w) {
	const du = new THREE.Vector3();
	const dv = new THREE.Vector3();
	const dw = new THREE.Vector3();
	for (let i = 0; i < 8; i++) {
		const [a, b, c] = PARAMETRIC_CORNERS[i];
		const p = points[i];
		const su = a ? 1 : -1;
		const sv = b ? 1 : -1;
		const sw = c ? 1 : -1;
		du.addScaledVector(p, su * (b ? v : 1 - v) * (c ? w : 1 - w));
		dv.addScaledVector(p, sv * (a ? u : 1 - u) * (c ? w : 1 - w));
		dw.addScaledVector(p, sw * (a ? u : 1 - u) * (b ? v : 1 - v));
	}
	return du.dot(new THREE.Vector3().crossVectors(dv, dw));
}

export function validateCells(volume, cellIds = null, thresholds = {}) {
	const minEdge = thresholds.minEdge ?? volume.cellSize * 0.04;
	const minArea = thresholds.minArea ?? volume.cellSize * volume.cellSize * 0.001;
	const minJacobian = thresholds.minJacobian ?? Math.pow(volume.cellSize, 3) * 0.0001;
	const ids = cellIds || volume.cells.map((cell) => cell.id);
	const invalidCellIds = [];
	const reasons = new Map();
	const samples = [...PARAMETRIC_CORNERS, [0.5, 0.5, 0.5]];

	for (const id of ids) {
		const cell = volume.cells[id];
		const points = cell.vertexIds.map((vertexId) => new THREE.Vector3().fromArray(volume.vertices[vertexId].restPosition));
		const issues = [];
		if (EDGE_PAIRS.some(([a, b]) => points[a].distanceTo(points[b]) < minEdge)) issues.push('collapsed edge');
		for (const [a, b, c, d] of FACE_QUADS) {
			const areaA = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(points[b], points[a]), new THREE.Vector3().subVectors(points[c], points[a])).length() * 0.5;
			const areaB = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(points[c], points[a]), new THREE.Vector3().subVectors(points[d], points[a])).length() * 0.5;
			if (areaA < minArea || areaB < minArea) { issues.push('degenerate face'); break; }
		}
		if (samples.some(([u, v, w]) => jacobianDeterminant(points, u, v, w) <= minJacobian)) issues.push('inverted or collapsed volume');
		if (issues.length) { invalidCellIds.push(id); reasons.set(id, [...new Set(issues)]); }
	}
	return { valid: invalidCellIds.length === 0, invalidCellIds, reasons };
}

export function applyValidatedDelta(volume, startPositions, weights, delta, affectedCellIds, iterations = 10) {
	const applyFactor = (factor) => {
		for (const [id, weight] of weights) {
			const start = startPositions.get(id);
			volume.vertices[id].restPosition = [start[0] + delta.x * weight * factor, start[1] + delta.y * weight * factor, start[2] + delta.z * weight * factor];
		}
	};
	applyFactor(1);
	let result = validateCells(volume, affectedCellIds);
	if (result.valid) return { factor: 1, validation: result };
	let low = 0;
	let high = 1;
	for (let i = 0; i < iterations; i++) {
		const mid = (low + high) / 2;
		applyFactor(mid);
		if (validateCells(volume, affectedCellIds).valid) low = mid;
		else high = mid;
	}
	applyFactor(low);
	return { factor: low, validation: result };
}
