import * as THREE from 'three';

const finiteVector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);

export function validateGameData(data, meshNames = null) {
	if (data?.format !== 'shaders-puzzle-game-data' || ![1, 2].includes(data.version)) throw new Error('Unsupported puzzle game data format.');
	if (!finiteVector(data.bounds?.min, 3) || !finiteVector(data.bounds?.max, 3)) throw new Error('Puzzle bounds are invalid.');
	if (!Array.isArray(data.pieces) || data.pieces.length === 0) throw new Error('Puzzle data contains no pieces.');
	if (!Array.isArray(data.connections)) throw new Error('Puzzle connections are invalid.');

	const availableMeshes = meshNames ? new Set(meshNames) : null;
	const ids = new Set();
	for (const piece of data.pieces) {
		if (!piece?.id || ids.has(piece.id)) throw new Error(`Invalid or duplicate piece id: ${piece?.id ?? 'missing'}.`);
		ids.add(piece.id);
		if (!piece.meshRef || (availableMeshes && !availableMeshes.has(piece.meshRef))) throw new Error(`Mesh "${piece.meshRef}" for ${piece.id} was not found in the GLB.`);
		const transform = piece.assembledTransform;
		if (!finiteVector(transform?.position, 3) || !finiteVector(transform?.quaternion, 4) || !finiteVector(transform?.scale, 3)) {
			throw new Error(`Assembled transform for ${piece.id} is invalid.`);
		}
	}

	const connectionIds = new Set();
	const contactVertices = data.contactGeometry?.vertices;
	if (data.version === 2) {
		if (data.contactGeometry?.space !== 'assembled' || !contactVertices || Array.isArray(contactVertices) || typeof contactVertices !== 'object') {
			throw new Error('Puzzle contact geometry is invalid.');
		}
		for (const [id, position] of Object.entries(contactVertices)) {
			if (!/^\d+$/.test(id) || !finiteVector(position, 3)) throw new Error(`Invalid contact vertex: ${id}.`);
		}
	}
	for (const connection of data.connections) {
		if (!connection?.id || connectionIds.has(connection.id)) throw new Error(`Invalid or duplicate connection id: ${connection?.id ?? 'missing'}.`);
		connectionIds.add(connection.id);
		if (!ids.has(connection.pieceA) || !ids.has(connection.pieceB) || connection.pieceA === connection.pieceB) {
			throw new Error(`Connection ${connection.id} references invalid pieces.`);
		}
		if (!finiteVector(connection.relativeTransform?.position, 3) || !finiteVector(connection.relativeTransform?.quaternion, 4)) {
			throw new Error(`Relative transform for ${connection.id} is invalid.`);
		}
		if (data.version === 2) {
			if (!Array.isArray(connection.sharedFaces) || connection.sharedFaces.length === 0) throw new Error(`Connection ${connection.id} has no contact faces.`);
			for (const face of connection.sharedFaces) {
				if (!face?.id || !Array.isArray(face.vertexIds) || face.vertexIds.length !== 4 || new Set(face.vertexIds).size !== 4) {
					throw new Error(`Connection ${connection.id} has an invalid contact face.`);
				}
				if (!Array.isArray(face.triangles) || face.triangles.length !== 2
					|| face.triangles.some((triangle) => !Array.isArray(triangle) || triangle.length !== 3
						|| triangle.some((id) => !face.vertexIds.includes(id) || !finiteVector(contactVertices[String(id)], 3)))) {
					throw new Error(`Contact triangles for ${face.id} are invalid.`);
				}
			}
		}
	}
	return true;
}

export function computePuzzleScale(bounds, finalSize = 0.5) {
	if (!finiteVector(bounds?.min, 3) || !finiteVector(bounds?.max, 3) || !Number.isFinite(finalSize) || finalSize <= 0) {
		throw new Error('Cannot compute puzzle scale from invalid bounds.');
	}
	const largestSide = Math.max(...bounds.max.map((value, index) => value - bounds.min[index]));
	if (!(largestSide > 0)) throw new Error('Puzzle bounds must have a positive size.');
	return finalSize / largestSide;
}

export function createAssemblyMatrix(piece, unitScale) {
	const transform = piece.assembledTransform;
	return new THREE.Matrix4().compose(
		new THREE.Vector3().fromArray(transform.position).multiplyScalar(unitScale),
		new THREE.Quaternion().fromArray(transform.quaternion).normalize(),
		new THREE.Vector3().fromArray(transform.scale)
	);
}

export function calculateSnapAlignment(movingWorld, targetWorld, movingPiece, targetPiece, unitScale) {
	const movingAssembly = createAssemblyMatrix(movingPiece, unitScale);
	const targetAssemblyInverse = createAssemblyMatrix(targetPiece, unitScale).invert();
	const desiredMovingWorld = targetWorld.clone().multiply(targetAssemblyInverse).multiply(movingAssembly);
	const currentPosition = new THREE.Vector3();
	const currentQuaternion = new THREE.Quaternion();
	const desiredPosition = new THREE.Vector3();
	const desiredQuaternion = new THREE.Quaternion();
	movingWorld.decompose(currentPosition, currentQuaternion, new THREE.Vector3());
	desiredMovingWorld.decompose(desiredPosition, desiredQuaternion, new THREE.Vector3());
	return {
		positionError: currentPosition.distanceTo(desiredPosition),
		angleError: currentQuaternion.angleTo(desiredQuaternion),
		desiredMovingWorld,
		delta: desiredMovingWorld.clone().multiply(movingWorld.clone().invert()),
	};
}

export function applyWorldDelta(object, delta) {
	object.updateWorldMatrix(true, false);
	const desiredWorld = delta.clone().multiply(object.matrixWorld);
	if (object.parent) {
		object.parent.updateWorldMatrix(true, false);
		desiredWorld.premultiply(object.parent.matrixWorld.clone().invert());
	}
	desiredWorld.decompose(object.position, object.quaternion, object.scale);
	object.updateMatrixWorld(true);
}

export function ensurePuzzleTextureUVs(geometry) {
	if (!geometry?.isBufferGeometry) throw new Error('Puzzle texture UVs require a BufferGeometry.');
	if (geometry.getAttribute('uv')) return geometry.getAttribute('uv');
	const uvw = geometry.getAttribute('_uvw');
	if (!uvw || uvw.itemSize < 3) throw new Error('Puzzle texture UVs require the _uvw attribute.');
	if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
	const normal = geometry.getAttribute('normal');
	const values = new Float32Array(uvw.count * 2);
	for (let index = 0; index < uvw.count; index++) {
		const x = Math.abs(normal.getX(index));
		const y = Math.abs(normal.getY(index));
		const z = Math.abs(normal.getZ(index));
		let u; let v;
		if (x >= y && x >= z) { u = uvw.getZ(index); v = uvw.getY(index); }
		else if (y >= z) { u = uvw.getX(index); v = uvw.getZ(index); }
		else { u = uvw.getX(index); v = uvw.getY(index); }
		values[index * 2] = u;
		values[index * 2 + 1] = v;
	}
	const attribute = new THREE.Float32BufferAttribute(values, 2);
	geometry.setAttribute('uv', attribute);
	return attribute;
}

export function interpolateIntersectionAttribute(intersection, attributeName, target = new THREE.Vector3()) {
	const object = intersection?.object;
	const geometry = object?.geometry;
	const face = intersection?.face;
	const point = intersection?.point;
	const attribute = geometry?.getAttribute?.(attributeName);
	const positions = geometry?.getAttribute?.('position');
	if (!object?.isMesh || !face || !point || !attribute || !positions || attribute.itemSize < 3) return null;

	object.updateWorldMatrix(true, false);
	const localPoint = object.worldToLocal(point.clone());
	const a = new THREE.Vector3().fromBufferAttribute(positions, face.a);
	const b = new THREE.Vector3().fromBufferAttribute(positions, face.b);
	const c = new THREE.Vector3().fromBufferAttribute(positions, face.c);
	const barycentric = THREE.Triangle.getBarycoord(localPoint, a, b, c, new THREE.Vector3());
	if (!barycentric) return null;

	const valueA = new THREE.Vector3().fromBufferAttribute(attribute, face.a);
	const valueB = new THREE.Vector3().fromBufferAttribute(attribute, face.b);
	const valueC = new THREE.Vector3().fromBufferAttribute(attribute, face.c);
	return target.copy(valueA).multiplyScalar(barycentric.x)
		.addScaledVector(valueB, barycentric.y)
		.addScaledVector(valueC, barycentric.z);
}

export function selectBestSnapCandidate(candidates, positionTolerance, angleTolerance) {
	let best = null;
	for (const candidate of candidates) {
		const { positionError, angleError } = candidate.alignment;
		if (positionError > positionTolerance || angleError > angleTolerance) continue;
		const score = positionError / positionTolerance + angleError / angleTolerance;
		if (!best || score < best.score) best = { ...candidate, score };
	}
	return best;
}

export function calculateHintStrength(distance, maxDistance) {
	if (!Number.isFinite(distance) || !Number.isFinite(maxDistance) || maxDistance <= 0 || distance >= maxDistance) return 0;
	const proximity = THREE.MathUtils.clamp(1 - distance / maxDistance, 0, 1);
	// Smoothstep avoids a visible pop at the edge of the hint radius while still
	// becoming decisively bright as the two matching pieces approach alignment.
	return proximity * proximity * (3 - 2 * proximity);
}

export function selectHintCandidate(candidates, maxDistance, previousConnectionId = null, hysteresis = 0.18) {
	const eligible = candidates.filter((candidate) => Number.isFinite(candidate.alignment?.positionError)
		&& candidate.alignment.positionError < maxDistance);
	if (!eligible.length) return null;
	const best = eligible.reduce((current, candidate) => candidate.alignment.positionError < current.alignment.positionError ? candidate : current);
	const previous = previousConnectionId == null ? null : eligible.find((candidate) => candidate.connection?.id === previousConnectionId);
	if (!previous || previous === best) return best;
	return best.alignment.positionError < previous.alignment.positionError * (1 - hysteresis) ? best : previous;
}

function geometryFromPositions(positions) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	geometry.computeBoundingSphere();
	return geometry;
}

export function buildConnectionContactGeometry(connection, piece, contactGeometry, unitScale) {
	if (!connection || !piece || ![connection.pieceA, connection.pieceB].includes(piece.id)) throw new Error('Cannot build contact geometry for an unrelated piece.');
	if (contactGeometry?.space !== 'assembled' || !contactGeometry.vertices) throw new Error('Contact geometry is unavailable.');
	const assembledInverse = createAssemblyMatrix(piece, unitScale).invert();
	const reverse = piece.id === connection.pieceB;
	const positions = [];
	for (const face of connection.sharedFaces || []) {
		for (const sourceTriangle of face.triangles || []) {
			const triangle = reverse ? [sourceTriangle[0], sourceTriangle[2], sourceTriangle[1]] : sourceTriangle;
			for (const id of triangle) {
				const source = contactGeometry.vertices[String(id)];
				if (!finiteVector(source, 3)) throw new Error(`Contact vertex ${id} is unavailable.`);
				const local = new THREE.Vector3().fromArray(source).multiplyScalar(unitScale).applyMatrix4(assembledInverse);
				positions.push(local.x, local.y, local.z);
			}
		}
	}
	return geometryFromPositions(positions);
}

function uniquePoints(points, epsilonSquared = 1e-12) {
	const unique = [];
	for (const point of points) if (!unique.some((other) => other.distanceToSquared(point) <= epsilonSquared)) unique.push(point);
	return unique;
}

export function buildLegacyConnectionContactGeometry(connection, piece, sourceGeometry, unitScale) {
	if (!connection || !piece || ![connection.pieceA, connection.pieceB].includes(piece.id)) throw new Error('Cannot build legacy contact geometry for an unrelated piece.');
	const attribute = sourceGeometry?.getAttribute?.('position');
	if (!attribute) throw new Error(`Geometry for ${piece.id} has no positions.`);
	const index = sourceGeometry.index;
	const streamCount = index ? index.count : attribute.count;
	if (streamCount % 6 !== 0) throw new Error(`Geometry for ${piece.id} does not preserve two triangles per face.`);
	const assembled = createAssemblyMatrix(piece, 1);
	const groups = [];
	for (let start = 0; start < streamCount; start += 6) {
		const points = [];
		for (let offset = 0; offset < 6; offset++) {
			const vertexIndex = index ? index.getX(start + offset) : start + offset;
			points.push(new THREE.Vector3().fromBufferAttribute(attribute, vertexIndex));
		}
		const corners = uniquePoints(points);
		if (corners.length !== 4) continue;
		const center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(0.25).applyMatrix4(assembled);
		groups.push({ points, center, used: false });
	}

	const scale = Math.max(1, sourceGeometry.boundingSphere?.radius ?? 1);
	const toleranceSquared = Math.pow(scale * 1e-4, 2);
	const positions = [];
	for (const face of connection.sharedFaces || []) {
		const wanted = new THREE.Vector3().fromArray(face.center);
		let match = null;
		let matchDistance = Infinity;
		for (const group of groups) {
			if (group.used) continue;
			const distance = group.center.distanceToSquared(wanted);
			if (distance < matchDistance) { match = group; matchDistance = distance; }
		}
		if (!match || matchDistance > toleranceSquared) throw new Error(`Could not recover legacy contact face ${face.id} for ${piece.id}.`);
		match.used = true;
		for (const point of match.points) positions.push(point.x * unitScale, point.y * unitScale, point.z * unitScale);
	}
	return geometryFromPositions(positions);
}

export function mergeBlockMembership(movingBlock, targetBlock, pieceToBlock) {
	for (const pieceId of movingBlock.pieceIds) {
		targetBlock.pieceIds.add(pieceId);
		pieceToBlock.set(pieceId, targetBlock);
	}
	return targetBlock;
}

export function collectResolvedConnectionIds(connections, pieceToBlock) {
	return new Set(connections
		.filter((connection) => pieceToBlock.get(connection.pieceA) === pieceToBlock.get(connection.pieceB))
		.map((connection) => connection.id));
}

export function scatterTransforms(count, random = Math.random, options = {}) {
	const center = options.center ?? [0, 1.55, -2.05];
	const size = options.size ?? [3, 2.1, 3];
	const minDistance = options.minDistance ?? 0.17;
	const maxAttempts = options.maxAttempts ?? 80;
	const positions = [];
	const transforms = [];
	for (let i = 0; i < count; i++) {
		let position;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			position = new THREE.Vector3(
				center[0] + (random() - 0.5) * size[0],
				center[1] + (random() - 0.5) * size[1],
				center[2] + (random() - 0.5) * size[2]
			);
			if (positions.every((other) => other.distanceTo(position) >= minDistance)) break;
		}
		positions.push(position);
		const u1 = random(); const u2 = random(); const u3 = random();
		const quaternion = new THREE.Quaternion(
			Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2),
			Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2),
			Math.sqrt(u1) * Math.sin(2 * Math.PI * u3),
			Math.sqrt(u1) * Math.cos(2 * Math.PI * u3)
		).normalize();
		transforms.push({ position, quaternion });
	}
	return transforms;
}
