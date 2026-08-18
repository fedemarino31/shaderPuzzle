import * as THREE from 'three';

export const FACE_DEFINITIONS = [
	{ axis: 0, sign: -1, offset: [-1, 0, 0], corners: [0, 4, 7, 3] },
	{ axis: 0, sign: 1, offset: [1, 0, 0], corners: [1, 2, 6, 5] },
	{ axis: 1, sign: -1, offset: [0, -1, 0], corners: [0, 1, 5, 4] },
	{ axis: 1, sign: 1, offset: [0, 1, 0], corners: [3, 7, 6, 2] },
	{ axis: 2, sign: -1, offset: [0, 0, -1], corners: [0, 3, 2, 1] },
	{ axis: 2, sign: 1, offset: [0, 0, 1], corners: [4, 5, 6, 7] },
];

const CELL_CORNERS = [
	[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
	[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

export function vertexId(x, y, z, pointsPerSide) {
	return x + pointsPerSide * (y + pointsPerSide * z);
}

export function cellId(x, y, z, gridSize) {
	return x + gridSize * (y + gridSize * z);
}

export function isInsideGrid(x, y, z, gridSize) {
	return x >= 0 && y >= 0 && z >= 0 && x < gridSize && y < gridSize && z < gridSize;
}

export function buildGrid({ gridSize = 8, innerVoidSize = 4, cellSize = 1 } = {}) {
	if (!Number.isInteger(gridSize) || gridSize < 2) throw new Error('Outer size must be an integer of at least 2.');
	if (!Number.isInteger(innerVoidSize) || innerVoidSize < 0 || innerVoidSize >= gridSize) {
		throw new Error('Void size must be a non-negative integer smaller than the outer size.');
	}
	if ((gridSize - innerVoidSize) % 2 !== 0) throw new Error('Outer and void sizes must have matching parity.');
	if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Cell size must be greater than zero.');

	const pointsPerSide = gridSize + 1;
	const half = (gridSize * cellSize) / 2;
	const vertices = [];
	for (let z = 0; z <= gridSize; z++) {
		for (let y = 0; y <= gridSize; y++) {
			for (let x = 0; x <= gridSize; x++) {
				const position = [x * cellSize - half, y * cellSize - half, z * cellSize - half];
				vertices.push({ id: vertexId(x, y, z, pointsPerSide), index: [x, y, z], originalPosition: [...position], restPosition: [...position] });
			}
		}
	}

	const voidStart = (gridSize - innerVoidSize) / 2;
	const voidEnd = voidStart + innerVoidSize;
	const cells = [];
	for (let z = 0; z < gridSize; z++) {
		for (let y = 0; y < gridSize; y++) {
			for (let x = 0; x < gridSize; x++) {
				const ids = CELL_CORNERS.map(([dx, dy, dz]) => vertexId(x + dx, y + dy, z + dz, pointsPerSide));
				const inVoid = innerVoidSize > 0 && x >= voidStart && x < voidEnd && y >= voidStart && y < voidEnd && z >= voidStart && z < voidEnd;
				cells.push({ id: cellId(x, y, z, gridSize), index: [x, y, z], vertexIds: ids, occupied: !inVoid, pieceId: null });
			}
		}
	}

	return { gridSize, innerVoidSize, cellSize, vertices, cells };
}

export function getNeighborCell(volume, cell, face) {
	const [x, y, z] = cell.index;
	const [dx, dy, dz] = face.offset;
	if (!isInsideGrid(x + dx, y + dy, z + dz, volume.gridSize)) return null;
	return volume.cells[cellId(x + dx, y + dy, z + dz, volume.gridSize)];
}

export function getCellCenter(volume, cell, target = new THREE.Vector3()) {
	target.set(0, 0, 0);
	for (const id of cell.vertexIds) target.add(new THREE.Vector3().fromArray(volume.vertices[id].restPosition));
	return target.multiplyScalar(1 / 8);
}

export function getBounds(volume) {
	const bounds = new THREE.Box3();
	for (const vertex of volume.vertices) bounds.expandByPoint(new THREE.Vector3().fromArray(vertex.restPosition));
	return bounds;
}

export function incidentCellIds(volume, vertexIds) {
	const wanted = new Set(vertexIds);
	const result = [];
	for (const cell of volume.cells) {
		if (cell.vertexIds.some((id) => wanted.has(id))) result.push(cell.id);
	}
	return result;
}

export function occupiedCellCount(volume) {
	return volume.cells.reduce((count, cell) => count + Number(cell.occupied), 0);
}
