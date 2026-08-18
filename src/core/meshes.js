import * as THREE from 'three';
import { FACE_DEFINITIONS, getBounds, getCellCenter, getNeighborCell } from './grid.js';

function quadTriangleCorners(ids) {
	const diagonalAC = [Math.min(ids[0], ids[2]), Math.max(ids[0], ids[2])];
	const diagonalBD = [Math.min(ids[1], ids[3]), Math.max(ids[1], ids[3])];
	const useAC = diagonalAC[0] < diagonalBD[0] || (diagonalAC[0] === diagonalBD[0] && diagonalAC[1] <= diagonalBD[1]);
	return useAC ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
}

export function triangulateQuadVertexIds(vertexIds) {
	return quadTriangleCorners(vertexIds).map((triangle) => triangle.map((corner) => vertexIds[corner]));
}

function piecePivot(volume, piece) {
	const pivot = new THREE.Vector3();
	for (const id of piece.cellIds) pivot.add(getCellCenter(volume, volume.cells[id]));
	return pivot.multiplyScalar(1 / Math.max(1, piece.cellIds.length));
}

function appendTriangle(positions, uvw, points, bounds, size, pivot) {
	for (const p of points) {
		positions.push(p.x - pivot.x, p.y - pivot.y, p.z - pivot.z);
		uvw.push(
			size.x ? (p.x - bounds.min.x) / size.x : 0,
			size.y ? (p.y - bounds.min.y) / size.y : 0,
			size.z ? (p.z - bounds.min.z) / size.z : 0,
		);
	}
}

function bilinearPoint(corners, u, v) {
	return new THREE.Vector3()
		.addScaledVector(corners[0], (1 - u) * (1 - v))
		.addScaledVector(corners[1], u * (1 - v))
		.addScaledVector(corners[2], u * v)
		.addScaledVector(corners[3], (1 - u) * v);
}

export function buildPieceGeometry(volume, piece, { subdivisionLevel = 0 } = {}) {
	const positions = [];
	const uvw = [];
	const bounds = getBounds(volume);
	const size = bounds.getSize(new THREE.Vector3());
	const pivot = piecePivot(volume, piece);
	const pieceIds = new Set(piece.cellIds);
	const safeLevel = Math.max(0, Math.min(4, Math.floor(Number(subdivisionLevel) || 0)));
	const divisions = 2 ** safeLevel;
	let faceCount = 0;
	for (const cellId of piece.cellIds) {
		const cell = volume.cells[cellId];
		for (const face of FACE_DEFINITIONS) {
			const neighbor = getNeighborCell(volume, cell, face);
			if (neighbor?.occupied && pieceIds.has(neighbor.id)) continue;
			const vertexIds = face.corners.map((corner) => cell.vertexIds[corner]);
			const corners = vertexIds.map((id) => new THREE.Vector3().fromArray(volume.vertices[id].restPosition));
			const useAC = quadTriangleCorners(vertexIds)[0][2] === 2;
			for (let y = 0; y < divisions; y++) for (let x = 0; x < divisions; x++) {
				const u0 = x / divisions; const u1 = (x + 1) / divisions;
				const v0 = y / divisions; const v1 = (y + 1) / divisions;
				const points = [bilinearPoint(corners, u0, v0), bilinearPoint(corners, u1, v0), bilinearPoint(corners, u1, v1), bilinearPoint(corners, u0, v1)];
				const triangles = useAC ? [[points[0], points[1], points[2]], [points[0], points[2], points[3]]] : [[points[0], points[1], points[3]], [points[1], points[2], points[3]]];
				for (const triangle of triangles) appendTriangle(positions, uvw, triangle, bounds, size, pivot);
			}
			faceCount++;
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('_uvw', new THREE.Float32BufferAttribute(uvw, 3));
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	return { geometry, pivot, faceCount, subdivisionLevel: safeLevel, triangleCount: positions.length / 9 };
}

export function buildAllPieceGeometries(volume, partition, options = {}) {
	return partition.pieces.map((piece) => ({ piece, ...buildPieceGeometry(volume, piece, options) }));
}

export function buildConnectivity(volume, partition) {
	const connections = new Map();
	for (const cell of volume.cells) {
		if (!cell.occupied || cell.pieceId == null) continue;
		for (let faceIndex = 0; faceIndex < FACE_DEFINITIONS.length; faceIndex++) {
			const face = FACE_DEFINITIONS[faceIndex];
			const neighbor = getNeighborCell(volume, cell, face);
			if (!neighbor?.occupied || neighbor.pieceId == null || neighbor.pieceId === cell.pieceId || cell.id > neighbor.id) continue;
			const a = Math.min(cell.pieceId, neighbor.pieceId);
			const b = Math.max(cell.pieceId, neighbor.pieceId);
			const key = `${a}:${b}`;
			if (!connections.has(key)) connections.set(key, { id: `connection-${a}-${b}`, pieceA: `piece-${a}`, pieceB: `piece-${b}`, sharedFaces: [] });
			const vertexIds = face.corners.map((corner) => cell.vertexIds[corner]);
			const center = new THREE.Vector3();
			for (const id of vertexIds) center.add(new THREE.Vector3().fromArray(volume.vertices[id].restPosition));
			center.multiplyScalar(0.25);
			const currentIsA = cell.pieceId === a;
			connections.get(key).sharedFaces.push({
				id: `face-${Math.min(cell.id, neighbor.id)}-${Math.max(cell.id, neighbor.id)}`,
				cellA: currentIsA ? cell.id : neighbor.id,
				cellB: currentIsA ? neighbor.id : cell.id,
				vertexIds,
				triangles: triangulateQuadVertexIds(vertexIds),
				center: center.toArray(),
				normal: currentIsA ? [...face.offset] : face.offset.map((value) => -value),
			});
		}
	}
	return [...connections.values()].map((connection) => {
		const center = connection.sharedFaces.reduce((sum, face) => sum.map((value, i) => value + face.center[i]), [0, 0, 0]).map((value) => value / connection.sharedFaces.length);
		return { ...connection, center };
	});
}
