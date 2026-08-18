import { getNeighborCell, FACE_DEFINITIONS } from './grid.js';

function hashSeed(value) {
	let hash = 2166136261;
	for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
	return hash >>> 0;
}

export function seededRandom(seed) {
	let state = hashSeed(seed) || 1;
	return () => {
		state += 0x6d2b79f5;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function neighbors(volume, cell) {
	return FACE_DEFINITIONS.map((face) => getNeighborCell(volume, cell, face)).filter((candidate) => candidate?.occupied);
}

function candidateScore(volume, candidate, region, preference, random) {
	const adjacent = neighbors(volume, candidate).filter((cell) => region.has(cell.id)).length;
	const cells = [...region].map((id) => volume.cells[id]);
	const centroid = cells.reduce((sum, cell) => sum.map((value, axis) => value + cell.index[axis]), [0, 0, 0]).map((value) => value / cells.length);
	const distance = candidate.index.reduce((sum, value, axis) => sum + Math.abs(value - centroid[axis]), 0);
	const jitter = random();
	if (preference === 'compact') return adjacent * 5 - distance + jitter;
	if (preference === 'elongated') {
		const spread = [0, 1, 2].map((axis) => Math.max(...cells.map((cell) => cell.index[axis])) - Math.min(...cells.map((cell) => cell.index[axis])));
		const dominant = spread.indexOf(Math.max(...spread));
		return Math.abs(candidate.index[dominant] - centroid[dominant]) * 2 - adjacent + jitter;
	}
	if (preference === 'irregular') return jitter * 5 - adjacent * 0.25;
	return adjacent * 2 - distance * 0.35 + jitter * 2;
}

function mergeSmallPieces(volume, pieces, min, max) {
	let changed = true;
	while (changed) {
		changed = false;
		const small = pieces.filter((piece) => piece.cellIds.length < min).sort((a, b) => a.cellIds.length - b.cellIds.length);
		for (const piece of small) {
			const adjacentIds = new Set();
			for (const id of piece.cellIds) for (const cell of neighbors(volume, volume.cells[id])) if (cell.pieceId !== piece.id) adjacentIds.add(cell.pieceId);
			const target = [...adjacentIds].map((id) => pieces.find((candidate) => candidate.id === id)).filter(Boolean).filter((candidate) => candidate.cellIds.length + piece.cellIds.length <= max).sort((a, b) => a.cellIds.length - b.cellIds.length)[0];
			if (!target) continue;
			for (const id of piece.cellIds) { volume.cells[id].pieceId = target.id; target.cellIds.push(id); }
			pieces.splice(pieces.indexOf(piece), 1);
			changed = true;
			break;
		}
	}
	pieces.forEach((piece, id) => { piece.id = id; for (const cellId of piece.cellIds) volume.cells[cellId].pieceId = id; });
}

export function generatePartition(volume, options) {
	const min = Math.max(1, Math.floor(options.minCellsPerPiece));
	const max = Math.max(min, Math.floor(options.maxCellsPerPiece));
	const random = seededRandom(options.seed);
	const unassigned = new Set(volume.cells.filter((cell) => cell.occupied).map((cell) => cell.id));
	for (const cell of volume.cells) cell.pieceId = null;
	const pieces = [];
	while (unassigned.size) {
		const available = [...unassigned];
		const startId = available[Math.floor(random() * available.length)];
		const region = new Set([startId]);
		unassigned.delete(startId);
		const targetSize = min + Math.floor(random() * (max - min + 1));
		while (region.size < targetSize) {
			const candidates = new Set();
			for (const id of region) for (const cell of neighbors(volume, volume.cells[id])) if (unassigned.has(cell.id)) candidates.add(cell.id);
			if (!candidates.size) break;
			const ranked = [...candidates].map((id) => ({ id, score: candidateScore(volume, volume.cells[id], region, options.shapePreference, random) })).sort((a, b) => b.score - a.score);
			region.add(ranked[0].id);
			unassigned.delete(ranked[0].id);
		}
		const piece = { id: pieces.length, cellIds: [...region] };
		pieces.push(piece);
		for (const id of region) volume.cells[id].pieceId = piece.id;
	}
	mergeSmallPieces(volume, pieces, min, max);
	const warnings = pieces.filter((piece) => piece.cellIds.length < min || piece.cellIds.length > max).map((piece) => `Piece ${piece.id + 1} has ${piece.cellIds.length} cells`);
	return { ...options, minCellsPerPiece: min, maxCellsPerPiece: max, pieces, warnings };
}

export function validatePartition(volume, partition) {
	const occupied = new Set(volume.cells.filter((cell) => cell.occupied).map((cell) => cell.id));
	const assigned = new Set();
	const errors = [];
	for (const piece of partition?.pieces || []) {
		for (const id of piece.cellIds) {
			if (!occupied.has(id)) errors.push(`Piece ${piece.id} contains empty cell ${id}`);
			if (assigned.has(id)) errors.push(`Cell ${id} is assigned more than once`);
			assigned.add(id);
		}
		if (piece.cellIds.length) {
			const allowed = new Set(piece.cellIds);
			const seen = new Set([piece.cellIds[0]]);
			const queue = [piece.cellIds[0]];
			while (queue.length) for (const neighbor of neighbors(volume, volume.cells[queue.shift()])) if (allowed.has(neighbor.id) && !seen.has(neighbor.id)) { seen.add(neighbor.id); queue.push(neighbor.id); }
			if (seen.size !== allowed.size) errors.push(`Piece ${piece.id} is disconnected`);
		}
	}
	if (assigned.size !== occupied.size) errors.push(`${occupied.size - assigned.size} occupied cells are unassigned`);
	return { valid: errors.length === 0, errors };
}
