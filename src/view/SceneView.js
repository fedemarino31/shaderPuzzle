import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { buildPieceGeometry } from '../core/meshes.js';
import { getBounds, incidentCellIds } from '../core/grid.js';
import { applyValidatedDelta } from '../core/validator.js';

const PALETTE = ['#67d5ff', '#ff9d5c', '#8ee18f', '#c590ff', '#ffd166', '#ff6f91', '#65e0c1', '#8ca8ff', '#e79aff', '#b8d66d'];

function disposeTree(root) {
	root.traverse((object) => {
		object.geometry?.dispose();
		if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
		else object.material?.dispose();
	});
	root.clear();
}

export class SceneView {
	constructor(container, callbacks) {
		this.container = container;
		this.callbacks = callbacks;
		this.scene = new THREE.Scene();
		this.scene.background = null;
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.shadowMap.enabled = true;
		container.appendChild(this.renderer.domElement);
		this.perspectiveCamera = new THREE.PerspectiveCamera(45, 1, 0.02, 500);
		this.perspectiveCamera.position.set(11, 9, 13);
		this.orthographicCamera = new THREE.OrthographicCamera(-6, 6, 6, -6, -100, 100);
		this.camera = this.perspectiveCamera;
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.screenSpacePanning = true;
		this.scene.add(new THREE.HemisphereLight(0xbcdcff, 0x18202a, 2.1));
		const key = new THREE.DirectionalLight(0xffffff, 3.2);
		key.position.set(8, 12, 10);
		this.scene.add(key);
		const fill = new THREE.DirectionalLight(0x69a5ff, 1.1);
		fill.position.set(-10, 2, -8);
		this.scene.add(fill);
		this.scene.add(new THREE.GridHelper(40, 40, 0x334152, 0x1d2732));

		this.content = new THREE.Group();
		this.edgeGroup = new THREE.Group();
		this.pointGroup = new THREE.Group();
		this.invalidGroup = new THREE.Group();
		this.scene.add(this.content, this.edgeGroup, this.pointGroup, this.invalidGroup);
		this.transformProxy = new THREE.Object3D();
		this.scene.add(this.transformProxy);
		this.transform = new TransformControls(this.camera, this.renderer.domElement);
		this.transform.setMode('translate');
		this.transform.setSize(0.75);
		this.scene.add(this.transform.getHelper());
		this.dragging = false;
		this.suppressTransformEvent = false;
		this.raycaster = new THREE.Raycaster();
		this.pointer = new THREE.Vector2();

		this.transform.addEventListener('dragging-changed', ({ value }) => { this.dragging = value; this.controls.enabled = !value; });
		this.transform.addEventListener('mouseDown', () => this.beginTransform());
		this.transform.addEventListener('objectChange', () => this.updateTransform());
		this.transform.addEventListener('mouseUp', () => this.finishTransform());
		this.renderer.domElement.addEventListener('pointerdown', (event) => this.pick(event));
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(container);
		this.resize();
		this.animate();
	}

	setState(state) { this.state = state; this.refresh(); }

	createMaterial(color, mode, opacity, selected = false) {
		return new THREE.MeshStandardMaterial({
			color: selected ? new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3) : color,
			roughness: 0.72, metalness: 0.03, flatShading: true,
			transparent: mode === 'Transparent', opacity: mode === 'Transparent' ? opacity : 1,
			depthWrite: mode !== 'Transparent', side: THREE.DoubleSide,
		});
	}

	refresh() {
		if (!this.state?.volume) return;
		disposeTree(this.content); disposeTree(this.edgeGroup); disposeTree(this.pointGroup); disposeTree(this.invalidGroup);
		this.pointsObject = null;
		this.pieceObjects = [];
		const { volume, partition, view } = this.state;
		const bounds = getBounds(volume);
		const objectCenter = bounds.getCenter(new THREE.Vector3());
		const definitions = partition?.pieces || [{ id: -1, cellIds: volume.cells.filter((cell) => cell.occupied).map((cell) => cell.id) }];
		for (const piece of definitions) {
			const { geometry, pivot } = buildPieceGeometry(volume, piece, { subdivisionLevel: this.state.tessellationLevel });
			const color = piece.id < 0 ? '#6ba9c9' : PALETTE[piece.id % PALETTE.length];
			const selected = piece.id === this.state.selectedPieceId;
			const explodedPosition = pivot.clone().addScaledVector(new THREE.Vector3().subVectors(pivot, objectCenter), view.explosionFactor - 1);
			const object = new THREE.Group();
			object.position.copy(explodedPosition);
			object.userData.pieceId = piece.id;
			if (view.renderMode !== 'Wireframe') {
				const mesh = new THREE.Mesh(geometry, this.createMaterial(color, view.renderMode, view.opacity, selected));
				mesh.userData.pieceId = piece.id; object.add(mesh);
			}
			if (view.renderMode !== 'Solid' || view.showPieceEdges) {
				const edgeGeometry = view.renderMode === 'Wireframe' && this.state.tessellationLevel > 0 ? new THREE.WireframeGeometry(geometry) : new THREE.EdgesGeometry(geometry, 8);
				const edges = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: selected ? 0xffffff : 0x17202a, transparent: true, opacity: 0.8 }));
				edges.userData.pieceId = piece.id; object.add(edges);
			}
			object.visible = !view.hiddenPieces.has(piece.id) && (view.isolatedPieceId == null || view.isolatedPieceId === piece.id);
			this.content.add(object);
			this.pieceObjects.push({ piece, geometry, pivot, object });
		}
		if (view.showGridEdges) this.buildGridEdges();
		if (view.showPoints) this.buildPoints();
		if (this.state.invalidCellIds?.length) this.buildInvalidCells();
		this.updateTransformAttachment();
	}

	buildGridEdges() {
		const positions = [];
		const { volume } = this.state;
		const pointsPerSide = volume.gridSize + 1;
		const idAt = (x, y, z) => x + pointsPerSide * (y + pointsPerSide * z);
		for (let z = 0; z <= volume.gridSize; z++) for (let y = 0; y <= volume.gridSize; y++) for (let x = 0; x <= volume.gridSize; x++) {
			for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
				if (x + dx > volume.gridSize || y + dy > volume.gridSize || z + dz > volume.gridSize) continue;
				positions.push(...volume.vertices[idAt(x, y, z)].restPosition, ...volume.vertices[idAt(x + dx, y + dy, z + dz)].restPosition);
			}
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		this.edgeGroup.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x52667a, transparent: true, opacity: 0.38 })));
	}

	buildPoints() {
		const { volume, selectionWeights, primaryVertexId, view } = this.state;
		const geometry = new THREE.SphereGeometry(1, 10, 7);
		const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
		const points = new THREE.InstancedMesh(geometry, material, volume.vertices.length);
		points.userData.gridPoints = true;
		const matrix = new THREE.Matrix4();
		const color = new THREE.Color();
		volume.vertices.forEach((vertex, id) => {
			const weight = selectionWeights.get(id) || 0;
			const scale = view.pointSize * (1 + weight * 1.25 + Number(id === primaryVertexId) * 0.55);
			matrix.compose(new THREE.Vector3().fromArray(vertex.restPosition), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
			points.setMatrixAt(id, matrix);
			color.set(id === primaryVertexId ? '#fff2a1' : weight > 0 ? '#62d9ff' : '#63778c');
			if (weight > 0 && id !== primaryVertexId) color.lerp(new THREE.Color('#ffffff'), weight * 0.25);
			points.setColorAt(id, color);
		});
		this.pointGroup.add(points); this.pointsObject = points;
	}

	buildInvalidCells() {
		for (const id of this.state.invalidCellIds) {
			const piece = { id: -99, cellIds: [id] };
			const { geometry, pivot } = buildPieceGeometry(this.state.volume, piece);
			const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff4f45, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
			mesh.position.copy(pivot); this.invalidGroup.add(mesh);
		}
	}

	updateTransformAttachment() {
		if (this.state.primaryVertexId == null || !this.state.selectionWeights.size) { this.transform.detach(); return; }
		this.transformProxy.position.fromArray(this.state.volume.vertices[this.state.primaryVertexId].restPosition);
		this.transform.attach(this.transformProxy);
		this.transform.showX = !this.state.deform.lockX;
		this.transform.showY = !this.state.deform.lockY;
		this.transform.showZ = !this.state.deform.lockZ;
	}

	beginTransform() {
		const { volume, selectionWeights } = this.state;
		this.dragStartProxy = this.transformProxy.position.clone();
		this.dragStartPositions = new Map([...selectionWeights].map(([id]) => [id, [...volume.vertices[id].restPosition]]));
		this.dragAffectedCells = incidentCellIds(volume, [...selectionWeights.keys()]);
	}

	updateTransform() {
		if (!this.dragStartPositions || this.suppressTransformEvent) return;
		const delta = this.transformProxy.position.clone().sub(this.dragStartProxy);
		if (this.state.deform.lockX) delta.x = 0;
		if (this.state.deform.lockY) delta.y = 0;
		if (this.state.deform.lockZ) delta.z = 0;
		const result = applyValidatedDelta(this.state.volume, this.dragStartPositions, this.state.selectionWeights, delta, this.dragAffectedCells);
		this.state.invalidCellIds = result.factor < 0.999 ? result.validation.invalidCellIds : [];
		if (result.factor < 0.999) {
			this.suppressTransformEvent = true;
			this.transformProxy.position.copy(this.dragStartProxy).addScaledVector(delta, result.factor);
			this.suppressTransformEvent = false;
		}
		this.callbacks.onGeometryPreview?.(result.factor);
		this.refresh();
	}

	finishTransform() {
		if (!this.dragStartPositions) return;
		const after = new Map([...this.state.selectionWeights].map(([id]) => [id, [...this.state.volume.vertices[id].restPosition]]));
		const changed = [...after].some(([id, value]) => value.some((component, axis) => Math.abs(component - this.dragStartPositions.get(id)[axis]) > 1e-9));
		if (changed) this.callbacks.onTransformComplete?.({ before: this.dragStartPositions, after });
		this.dragStartPositions = null; this.state.invalidCellIds = []; this.refresh();
	}

	pick(event) {
		if (this.dragging || event.button !== 0) return;
		const rect = this.renderer.domElement.getBoundingClientRect();
		this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
		this.raycaster.setFromCamera(this.pointer, this.camera);
		if (this.pointsObject) {
			const pointHit = this.raycaster.intersectObject(this.pointsObject, false)[0];
			if (pointHit?.instanceId != null) { this.callbacks.onVertexSelected?.(pointHit.instanceId); return; }
		}
		const hit = this.raycaster.intersectObjects(this.content.children, true)[0];
		if (hit) this.callbacks.onPieceSelected?.(hit.object.userData.pieceId ?? hit.object.parent?.userData.pieceId);
	}

	setProjection(orthographic) {
		const oldPosition = this.camera.position.clone();
		this.camera = orthographic ? this.orthographicCamera : this.perspectiveCamera;
		this.camera.position.copy(oldPosition); this.camera.lookAt(this.controls.target);
		this.controls.object = this.camera; this.transform.camera = this.camera; this.resize();
	}

	setView(name) {
		const distance = Math.max(8, this.state.volume.gridSize * this.state.volume.cellSize * 1.8);
		const positions = { Perspective: [distance, distance * 0.75, distance], Front: [0, 0, distance], Side: [distance, 0, 0], Top: [0, distance, 0.001] };
		this.camera.position.fromArray(positions[name] || positions.Perspective); this.controls.target.set(0, 0, 0); this.controls.update();
	}

	frame(point = null) {
		const bounds = getBounds(this.state.volume);
		const center = point || bounds.getCenter(new THREE.Vector3());
		const radius = point ? this.state.volume.cellSize * 3 : bounds.getBoundingSphere(new THREE.Sphere()).radius;
		const direction = this.camera.position.clone().sub(this.controls.target).normalize();
		this.controls.target.copy(center); this.camera.position.copy(center).addScaledVector(direction, Math.max(3, radius * 2.2)); this.controls.update();
	}

	resize() {
		const width = this.container.clientWidth || 1; const height = this.container.clientHeight || 1;
		this.renderer.setSize(width, height, false);
		this.perspectiveCamera.aspect = width / height; this.perspectiveCamera.updateProjectionMatrix();
		const halfHeight = Math.max(3, this.state?.volume?.gridSize || 8) * 0.75;
		this.orthographicCamera.left = -halfHeight * width / height; this.orthographicCamera.right = halfHeight * width / height;
		this.orthographicCamera.top = halfHeight; this.orthographicCamera.bottom = -halfHeight; this.orthographicCamera.updateProjectionMatrix();
	}

	animate() { requestAnimationFrame(() => this.animate()); this.controls.update(); this.renderer.render(this.scene, this.camera); }
}
