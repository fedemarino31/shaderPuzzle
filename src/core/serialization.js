import { buildGrid, getBounds } from './grid.js';
import { validateCells } from './validator.js';
import { validatePartition } from './partition.js';
import { buildConnectivity } from './meshes.js';

export function serializeProject(state) {
	return {
		format: 'shaders-puzzle-editor',
		version: 1,
		volume: { gridSize: state.volume.gridSize, innerVoidSize: state.volume.innerVoidSize, cellSize: state.volume.cellSize },
		vertices: state.volume.vertices.map((vertex) => ({ ...vertex, originalPosition: [...vertex.originalPosition], restPosition: [...vertex.restPosition] })),
		cells: state.volume.cells.map((cell) => ({ ...cell, index: [...cell.index], vertexIds: [...cell.vertexIds] })),
		partition: state.partition ? JSON.parse(JSON.stringify(state.partition)) : null,
		tessellationLevel: Math.max(0, Math.min(4, Math.floor(Number(state.tessellationLevel) || 0))),
		view: { renderMode: state.view.renderMode, explosionFactor: state.view.explosionFactor },
	};
}

export function deserializeProject(data) {
	if (data?.format !== 'shaders-puzzle-editor' || data.version !== 1) throw new Error('Unsupported project format or version.');
	const volume = buildGrid(data.volume);
	if (!Array.isArray(data.vertices) || data.vertices.length !== volume.vertices.length) throw new Error('Project has an invalid vertex count.');
	if (!Array.isArray(data.cells) || data.cells.length !== volume.cells.length) throw new Error('Project has an invalid cell count.');
	for (let i = 0; i < volume.vertices.length; i++) {
		const source = data.vertices[i];
		if (source.id !== i || !Array.isArray(source.restPosition) || source.restPosition.length !== 3 || source.restPosition.some((value) => !Number.isFinite(value))) throw new Error(`Invalid vertex ${i}.`);
		volume.vertices[i].restPosition = [...source.restPosition];
	}
	for (let i = 0; i < volume.cells.length; i++) {
		if (data.cells[i].id !== i || data.cells[i].occupied !== volume.cells[i].occupied) throw new Error(`Invalid occupancy at cell ${i}.`);
		volume.cells[i].pieceId = data.cells[i].pieceId ?? null;
	}
	const geometryValidation = validateCells(volume);
	if (!geometryValidation.valid) throw new Error(`Project contains ${geometryValidation.invalidCellIds.length} invalid cells.`);
	if (data.partition) {
		const validation = validatePartition(volume, data.partition);
		if (!validation.valid) throw new Error(validation.errors[0]);
	}
	const tessellationLevel = Math.max(0, Math.min(4, Math.floor(Number(data.tessellationLevel) || 0)));
	return { volume, partition: data.partition || null, tessellationLevel, view: { renderMode: data.view?.renderMode || 'Solid', explosionFactor: data.view?.explosionFactor ?? 1 } };
}

export function sanitizeExportName(value, fallback = 'shaders-puzzle') {
	const name = String(value ?? '')
		.trim()
		.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^[.-]+|[. -]+$/g, '')
		.slice(0, 120);
	return name || fallback;
}

export function buildGameData(volume, partition, pieceMeshes) {
	const bounds = getBounds(volume);
	const connections = buildConnectivity(volume, partition);
	const contactVertexIds = new Set(connections.flatMap((connection) => connection.sharedFaces.flatMap((face) => face.vertexIds)));
	const contactVertices = Object.fromEntries([...contactVertexIds]
		.sort((a, b) => a - b)
		.map((id) => [id, [...volume.vertices[id].restPosition]]));
	const pivotByPiece = new Map(pieceMeshes.map(({ piece, pivot }) => [`piece-${piece.id}`, pivot]));
	const byPiece = new Map();
	for (const connection of connections) {
		for (const pieceId of [connection.pieceA, connection.pieceB]) {
			if (!byPiece.has(pieceId)) byPiece.set(pieceId, []);
			byPiece.get(pieceId).push(connection.id);
		}
	}
	return {
		format: 'shaders-puzzle-game-data', version: 2, uvwAttribute: '_UVW',
		bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
		contactGeometry: { space: 'assembled', vertices: contactVertices },
		pieces: pieceMeshes.map(({ piece, pivot }) => ({
			id: `piece-${piece.id}`, meshRef: `piece-${piece.id}`, cellIds: [...piece.cellIds],
			assembledTransform: { position: pivot.toArray(), quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
			connectionIds: byPiece.get(`piece-${piece.id}`) || [],
		})),
		connections: connections.map((connection) => {
			const relativePosition = pivotByPiece.get(connection.pieceB).clone().sub(pivotByPiece.get(connection.pieceA)).toArray();
			return {
				id: connection.id, pieceA: connection.pieceA, pieceB: connection.pieceB,
				sharedFaceIds: connection.sharedFaces.map((face) => face.id), sharedFaces: connection.sharedFaces,
				relativeTransform: { position: relativePosition, quaternion: [0, 0, 0, 1] },
			};
		}),
	};
}

export function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url; anchor.download = filename; anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data, filename) {
	downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}
