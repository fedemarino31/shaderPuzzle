import * as THREE from 'three';
import { GrabbableVRObject, GVREventTypes } from '../vendor/xrComponents.js';
import { applyWorldDelta, buildConnectionContactGeometry, buildLegacyConnectionContactGeometry, calculateHintStrength, calculateSnapAlignment, collectGeometryBoundaryEdges, collectResolvedConnectionIds, ensurePuzzleTextureUVs, mergeBlockMembership, scatterTransforms, selectBestSnapCandidate, selectHintCandidate } from './gameCore.js';
import { setGameMaterialCamera } from './GameMaterials.js';

const POSITION_TOLERANCE = 0.04;
const ANGLE_TOLERANCE = THREE.MathUtils.degToRad(18);
// Distance at which compatible nearby pieces begin showing their contact outline.
export const CONTACT_HINT_DISTANCE = 0.5;
const HINT_MAX_OPACITY = 0.95;
const HINT_EDGE_THICKNESS = 0.018;
const MOVING_HINT_COLOR = 0xffb84d;
const TARGET_HINT_COLOR = 0x67e8ff;
const READY_HINT_COLOR = 0x7dff9b;

export class PuzzleAssembly {
	constructor({ scene, data, sourceMeshes, unitScale, material = null, materialFactory = null, onChange = () => {}, onStatus = () => {}, onInteraction = () => {}, onSnap = () => {} }) {
		this.scene = scene;
		this.data = data;
		this.sourceMeshes = sourceMeshes;
		this.unitScale = unitScale;
		this.material = material;
		this.materialFactory = materialFactory;
		this.onChange = onChange;
		this.onStatus = onStatus;
		this.onInteraction = onInteraction;
		this.onSnap = onSnap;
		this.pieces = new Map(data.pieces.map((piece) => [piece.id, piece]));
		this.connections = new Map(data.connections.map((connection) => [connection.id, connection]));
		this.pieceObjects = new Map();
		this.pieceToBlock = new Map();
		this.blocks = new Map();
		this.contactGeometryCache = new Map();
		this.warnedContactGeometry = new Set();
		this.activeHintConnectionId = null;
		this.movingContactHint = this.createContactHint('moving-contact-hint', MOVING_HINT_COLOR);
		this.targetContactHint = this.createContactHint('target-contact-hint', TARGET_HINT_COLOR);
		this.nextBlockId = 1;
		this.resolvedConnections = new Set();
		this.preview = new THREE.BoxHelper(new THREE.Group(), 0x67e8ff);
		this.preview.visible = false;
		this.preview.material.depthTest = false;
		this.preview.renderOrder = 10;
		this.scene.add(this.preview);
		this.newScatter();
	}

	newScatter() {
		this.lastScatter = scatterTransforms(this.data.pieces.length);
		this.rebuild(this.lastScatter);
	}

	restart() {
		this.rebuild(this.lastScatter);
	}

	rebuild(scatter) {
		this.clearBlocks();
		this.resolvedConnections.clear();
		this.data.pieces.forEach((piece, index) => {
			const source = this.sourceMeshes.get(piece.meshRef);
			const geometry = source.geometry.clone();
			geometry.scale(this.unitScale, this.unitScale, this.unitScale);
			ensurePuzzleTextureUVs(geometry);
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
			const pieceMaterial = this.materialFactory ? this.materialFactory(piece, index, geometry) : this.material;
			const mesh = new THREE.Mesh(geometry, pieceMaterial);
			if (this.materialFactory) mesh.onBeforeRender = (_renderer, _scene, camera) => setGameMaterialCamera(pieceMaterial, mesh, camera);
			mesh.name = piece.id;
			mesh.userData.pieceId = piece.id;
			mesh.castShadow = false;
			mesh.receiveShadow = false;
			const root = new THREE.Group();
			root.name = `block-${this.nextBlockId++}`;
			root.add(mesh);
			root.position.copy(scatter[index].position);
			root.quaternion.copy(scatter[index].quaternion);
			this.scene.add(root);
			const block = { id: root.name, root, pieceIds: new Set([piece.id]), grabbable: null, grabbed: false, candidate: null, candidateController: null };
			this.blocks.set(block.id, block);
			this.pieceObjects.set(piece.id, mesh);
			this.pieceToBlock.set(piece.id, block);
			this.bindGrabbable(block);
		});
		this.preview.visible = false;
		this.onStatus('Pieces scattered. Grab a piece and find its neighbors.');
		this.emitChange();
	}

	getRaycastTargets() {
		return [...this.pieceObjects.values()].filter((mesh) => mesh.visible);
	}

	getBlockForPieceId(pieceId) {
		return this.pieceToBlock.get(pieceId) ?? null;
	}

	getMaterials() {
		return [...this.pieceObjects.values()].map((mesh) => mesh.material);
	}

	canonicalToPieceWorld(pieceId, uvw, target = new THREE.Vector3()) {
		const piece = this.pieces.get(pieceId);
		const object = this.pieceObjects.get(pieceId);
		if (!piece || !object || !uvw) return null;
		const boundsMin = this.data.bounds.min;
		const boundsMax = this.data.bounds.max;
		const assembled = target.set(
			THREE.MathUtils.lerp(boundsMin[0], boundsMax[0], uvw.x),
			THREE.MathUtils.lerp(boundsMin[1], boundsMax[1], uvw.y),
			THREE.MathUtils.lerp(boundsMin[2], boundsMax[2], uvw.z),
		);
		const pivot = piece.assembledTransform.position;
		assembled.sub(new THREE.Vector3().fromArray(pivot)).multiplyScalar(this.unitScale);
		object.updateWorldMatrix(true, false);
		return object.localToWorld(assembled);
	}

	createContactHint(name, color) {
		const group = new THREE.Group();
		group.name = name;
		group.visible = false;
		const edgeMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: new THREE.Color(color) },
				uOpacity: { value: 0 },
				uTime: { value: 0 },
			},
			vertexShader: `
				void main() {
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform vec3 uColor;
				uniform float uOpacity;
				uniform float uTime;
				void main() {
					float stripeWave = sin((gl_FragCoord.x - uTime * 54.0) * 0.34906585);
					float transition = max(fwidth(stripeWave), 0.015);
					float brightStripe = smoothstep(-transition, transition, stripeWave);
					float luminosity = mix(0.42, 1.0, brightStripe);
					gl_FragColor = vec4(uColor * luminosity, uOpacity);
				}
			`,
			transparent: true,
			depthTest: true,
			depthWrite: false,
			toneMapped: false,
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});
		const edges = new THREE.Group();
		edges.renderOrder = 9;
		group.add(edges);
		group.userData = {
			edges,
			edgeMaterial,
			boxGeometry: new THREE.BoxGeometry(1, 1, 1),
			baseColor: new THREE.Color(color),
			contactGeometry: null,
		};
		return group;
	}

	clearBlocks() {
		this.clearConnectionHints();
		for (const geometry of this.contactGeometryCache.values()) geometry.dispose();
		this.contactGeometryCache.clear();
		for (const block of this.blocks.values()) {
			this.unbindGrabbable(block);
			block.root.traverse((object) => {
				if (object.isMesh) {
					object.geometry.dispose();
					if (this.materialFactory) object.material.dispose();
				}
			});
			this.scene.remove(block.root);
		}
		this.blocks.clear();
		this.pieceObjects.clear();
		this.pieceToBlock.clear();
	}

	bindGrabbable(block) {
		const grabbable = new GrabbableVRObject(block.root, this.scene, {
			contactGrabbing: { enabled: true, distanceThreshold: 0.04 },
			remoteGrabbing: { enabled: true },
			showHelpers: false,
			follow: { mode: 'attach', preserveGrabOffset: true },
			placement: { mode: 'free' },
		});
		block.handlers = {
			start: (event) => this.handleGrabStart(block, event),
			update: (event) => this.handleGrabUpdate(block, event),
			end: (event) => this.handleGrabEnd(block, event),
		};
		grabbable.addEventListener(GVREventTypes.ON_GRAB_START, block.handlers.start);
		grabbable.addEventListener(GVREventTypes.ON_GRAB_UPDATE, block.handlers.update);
		grabbable.addEventListener(GVREventTypes.ON_GRAB_END, block.handlers.end);
		block.grabbable = grabbable;
	}

	unbindGrabbable(block) {
		if (!block.grabbable) return;
		block.grabbable.removeEventListener(GVREventTypes.ON_GRAB_START, block.handlers.start);
		block.grabbable.removeEventListener(GVREventTypes.ON_GRAB_UPDATE, block.handlers.update);
		block.grabbable.removeEventListener(GVREventTypes.ON_GRAB_END, block.handlers.end);
		block.grabbable.dispose();
		block.grabbable = null;
	}

	handleGrabStart(block) {
		this.onInteraction();
		block.grabbed = true;
		block.candidate = null;
		this.preview.visible = false;
		this.clearConnectionHints();
		this.onStatus(`Holding ${block.pieceIds.size === 1 ? '1 piece' : `${block.pieceIds.size} connected pieces`}.`);
	}

	handleGrabUpdate(block, event) {
		const previousId = block.candidate?.connection.id;
		block.root.updateWorldMatrix(true, true);
		const candidates = this.findConnectionCandidates(block, { includeGrabbedTargets: true });
		const snapCandidates = candidates.filter(({ targetBlock }) => !targetBlock.grabbed);
		block.candidate = selectBestSnapCandidate(snapCandidates, POSITION_TOLERANCE, ANGLE_TOLERANCE);
		block.candidateController = event.controller;
		if (!block.candidate) {
			this.preview.visible = false;
			if (previousId) this.onStatus('Move closer and align the neighboring faces.');
			return;
		}
		this.preview.setFromObject(block.root);
		this.preview.visible = true;
		if (previousId !== block.candidate.connection.id) {
			event.controller?.pulse?.(0.25, 45);
			this.onStatus('Connection ready — release grip to snap.');
		}
	}

	handleGrabEnd(block) {
		block.grabbed = false;
		this.preview.visible = false;
		this.clearConnectionHints();
		block.root.updateWorldMatrix(true, true);
		const candidate = selectBestSnapCandidate(this.findConnectionCandidates(block), POSITION_TOLERANCE, ANGLE_TOLERANCE);
		block.candidate = null;
		if (!candidate) {
			this.onStatus('Block released without a matching connection.');
			return;
		}
		queueMicrotask(() => {
			if (this.blocks.has(block.id)) this.commitSnap(block, candidate);
		});
	}

	beginDesktopTransform(block) {
		if (!block || !this.blocks.has(block.id)) return false;
		this.handleGrabStart(block);
		return true;
	}

	updateDesktopTransform(block) {
		if (!block?.grabbed || !this.blocks.has(block.id)) return;
		this.handleGrabUpdate(block, { controller: null });
	}

	endDesktopTransform(block) {
		if (!block || !this.blocks.has(block.id)) return null;
		block.grabbed = false;
		this.preview.visible = false;
		this.clearConnectionHints();
		block.root.updateWorldMatrix(true, true);
		const candidate = selectBestSnapCandidate(this.findConnectionCandidates(block), POSITION_TOLERANCE, ANGLE_TOLERANCE);
		block.candidate = null;
		if (!candidate) {
			this.onStatus('Block released without a matching connection.');
			return block;
		}
		return this.commitSnap(block, candidate) ?? block;
	}

	findConnectionCandidates(movingBlock, { includeGrabbedTargets = false } = {}) {
		const candidates = [];
		for (const connection of this.connections.values()) {
			const movingIsA = movingBlock.pieceIds.has(connection.pieceA);
			const movingIsB = movingBlock.pieceIds.has(connection.pieceB);
			if (movingIsA === movingIsB) continue;
			const movingId = movingIsA ? connection.pieceA : connection.pieceB;
			const targetId = movingIsA ? connection.pieceB : connection.pieceA;
			const targetBlock = this.pieceToBlock.get(targetId);
			if (!targetBlock || targetBlock === movingBlock || (!includeGrabbedTargets && targetBlock.grabbed)) continue;
			const movingObject = this.pieceObjects.get(movingId);
			const targetObject = this.pieceObjects.get(targetId);
			targetObject.updateWorldMatrix(true, false);
			movingObject.updateWorldMatrix(true, false);
			const alignment = calculateSnapAlignment(
				movingObject.matrixWorld,
				targetObject.matrixWorld,
				this.pieces.get(movingId),
				this.pieces.get(targetId),
				this.unitScale
			);
			candidates.push({ connection, movingId, targetId, targetBlock, alignment });
		}
		return candidates;
	}

	findGlobalHintCandidates() {
		const candidates = [];
		for (const connection of this.connections.values()) {
			const movingId = connection.pieceA;
			const targetId = connection.pieceB;
			const movingBlock = this.pieceToBlock.get(movingId);
			const targetBlock = this.pieceToBlock.get(targetId);
			if (!movingBlock || !targetBlock || movingBlock === targetBlock) continue;
			const movingObject = this.pieceObjects.get(movingId);
			const targetObject = this.pieceObjects.get(targetId);
			movingObject.updateWorldMatrix(true, false);
			targetObject.updateWorldMatrix(true, false);
			const alignment = calculateSnapAlignment(
				movingObject.matrixWorld,
				targetObject.matrixWorld,
				this.pieces.get(movingId),
				this.pieces.get(targetId),
				this.unitScale,
			);
			candidates.push({ connection, movingId, targetId, movingBlock, targetBlock, alignment });
		}
		return candidates;
	}

	getContactGeometry(connection, pieceId) {
		const key = `${connection.id}:${pieceId}`;
		if (this.contactGeometryCache.has(key)) return this.contactGeometryCache.get(key);
		const piece = this.pieces.get(pieceId);
		const source = this.sourceMeshes.get(piece.meshRef);
		let geometry;
		try {
			geometry = this.data.contactGeometry
				? buildConnectionContactGeometry(connection, piece, this.data.contactGeometry, this.unitScale)
				: buildLegacyConnectionContactGeometry(connection, piece, source.geometry, this.unitScale);
		} catch (error) {
			if (!this.warnedContactGeometry.has(key)) {
				this.warnedContactGeometry.add(key);
				console.warn(`Could not build contact hint ${key}.`, error);
			}
			return null;
		}
		this.contactGeometryCache.set(key, geometry);
		return geometry;
	}

	attachContactHint(hint, pieceId, geometry) {
		const pieceObject = this.pieceObjects.get(pieceId);
		if (!pieceObject || !geometry) return false;
		const { edges, edgeMaterial, boxGeometry } = hint.userData;
		if (hint.userData.contactGeometry !== geometry) {
			edges.clear();
			const xAxis = new THREE.Vector3(1, 0, 0);
			for (const edge of collectGeometryBoundaryEdges(geometry)) {
				const direction = edge.end.clone().sub(edge.start);
				const length = direction.length();
				if (length <= Number.EPSILON) continue;
				const box = new THREE.Mesh(boxGeometry, edgeMaterial);
				box.position.copy(edge.start).add(edge.end).multiplyScalar(0.5);
				box.quaternion.setFromUnitVectors(xAxis, direction.multiplyScalar(1 / length));
				box.scale.set(length + HINT_EDGE_THICKNESS, HINT_EDGE_THICKNESS, HINT_EDGE_THICKNESS);
				box.renderOrder = 9;
				box.frustumCulled = false;
				edges.add(box);
			}
			hint.userData.contactGeometry = geometry;
		}
		pieceObject.add(hint);
		hint.position.set(0, 0, 0);
		hint.quaternion.identity();
		hint.scale.set(1, 1, 1);
		hint.visible = true;
		return true;
	}

	setContactHintAppearance(hint, strength, ready) {
		const { edgeMaterial, baseColor } = hint.userData;
		edgeMaterial.uniforms.uColor.value.copy(baseColor);
		if (ready) edgeMaterial.uniforms.uColor.value.setHex(READY_HINT_COLOR);
		edgeMaterial.uniforms.uOpacity.value = strength * HINT_MAX_OPACITY;
	}

	updateConnectionHint(candidate) {
		if (!candidate) return this.clearConnectionHints();
		const { connection, movingId, targetId, alignment } = candidate;
		const movingGeometry = this.getContactGeometry(connection, movingId);
		const targetGeometry = this.getContactGeometry(connection, targetId);
		if (!movingGeometry || !targetGeometry) return this.clearConnectionHints();
		const strength = calculateHintStrength(alignment.positionError, CONTACT_HINT_DISTANCE);
		const ready = alignment.positionError <= POSITION_TOLERANCE && alignment.angleError <= ANGLE_TOLERANCE;
		this.attachContactHint(this.movingContactHint, movingId, movingGeometry);
		this.attachContactHint(this.targetContactHint, targetId, targetGeometry);
		this.setContactHintAppearance(this.movingContactHint, strength, ready);
		this.setContactHintAppearance(this.targetContactHint, strength, ready);
		this.activeHintConnectionId = connection.id;
	}

	clearConnectionHints() {
		for (const hint of [this.movingContactHint, this.targetContactHint]) {
			hint.visible = false;
			hint.parent?.remove(hint);
			hint.userData.edgeMaterial.uniforms.uOpacity.value = 0;
		}
		this.activeHintConnectionId = null;
	}

	update(timeSeconds) {
		for (const hint of [this.movingContactHint, this.targetContactHint]) {
			hint.userData.edgeMaterial.uniforms.uTime.value = timeSeconds;
		}
		const candidates = this.findGlobalHintCandidates();
		const hintCandidate = selectHintCandidate(candidates, CONTACT_HINT_DISTANCE, this.activeHintConnectionId);
		this.updateConnectionHint(hintCandidate);
	}

	commitSnap(movingBlock, candidate) {
		const targetBlock = this.pieceToBlock.get(candidate.targetId);
		if (!targetBlock || targetBlock === movingBlock || targetBlock.grabbed) return null;
		const movingObject = this.pieceObjects.get(candidate.movingId);
		const targetObject = this.pieceObjects.get(candidate.targetId);
		movingObject.updateWorldMatrix(true, false);
		targetObject.updateWorldMatrix(true, false);
		const alignment = calculateSnapAlignment(movingObject.matrixWorld, targetObject.matrixWorld, this.pieces.get(candidate.movingId), this.pieces.get(candidate.targetId), this.unitScale);
		if (alignment.positionError > POSITION_TOLERANCE || alignment.angleError > ANGLE_TOLERANCE) return null;

		applyWorldDelta(movingBlock.root, alignment.delta);
		const contactGeometry = this.getContactGeometry(candidate.connection, candidate.targetId);
		const contactPoint = new THREE.Vector3();
		if (contactGeometry) {
			contactGeometry.computeBoundingBox();
			contactGeometry.boundingBox.getCenter(contactPoint);
			targetObject.updateWorldMatrix(true, false);
			targetObject.localToWorld(contactPoint);
		} else {
			movingObject.getWorldPosition(contactPoint).add(targetObject.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
		}
		this.unbindGrabbable(movingBlock);
		this.unbindGrabbable(targetBlock);
		for (const pieceId of movingBlock.pieceIds) {
			const pieceObject = this.pieceObjects.get(pieceId);
			targetBlock.root.attach(pieceObject);
		}
		mergeBlockMembership(movingBlock, targetBlock, this.pieceToBlock);
		this.scene.remove(movingBlock.root);
		this.blocks.delete(movingBlock.id);
		this.blocks.set(targetBlock.id, targetBlock);
		this.bindGrabbable(targetBlock);
		this.refreshResolvedConnections();
		this.onSnap({ connection: candidate.connection, position: contactPoint, controller: movingBlock.candidateController });
		const complete = this.blocks.size === 1;
		this.onStatus(complete ? 'Puzzle complete!' : `Snapped! ${this.blocks.size} blocks remain.`);
		this.emitChange();
		return targetBlock;
	}

	refreshResolvedConnections() {
		this.resolvedConnections = collectResolvedConnectionIds([...this.connections.values()], this.pieceToBlock);
	}

	emitChange() {
		this.onChange({
			blocks: this.blocks.size,
			pieces: this.data.pieces.length,
			resolved: this.resolvedConnections.size,
			connections: this.data.connections.length,
			complete: this.blocks.size === 1,
		});
	}

	dispose() {
		this.clearBlocks();
		for (const hint of [this.movingContactHint, this.targetContactHint]) {
			hint.userData.boxGeometry.dispose();
			hint.userData.edgeMaterial.dispose();
		}
		this.scene.remove(this.preview);
		this.preview.geometry.dispose();
		this.preview.material.dispose();
	}
}
