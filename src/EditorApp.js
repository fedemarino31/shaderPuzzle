import * as THREE from 'three';
import { Pane } from 'tweakpane';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildGrid, getBounds, occupiedCellCount } from './core/grid.js';
import { calculateSelection, randomSelection } from './core/selection.js';
import { HistoryManager } from './core/history.js';
import { validateCells } from './core/validator.js';
import { generatePartition, validatePartition } from './core/partition.js';
import { buildAllPieceGeometries } from './core/meshes.js';
import { buildGameData, deserializeProject, downloadBlob, downloadJson, sanitizeExportName, serializeProject } from './core/serialization.js';
import { SceneView } from './view/SceneView.js';

const STAGES = ['Volume', 'Deformation', 'Partition', 'Inspection', 'Export'];

export class EditorApp {
	constructor() {
		this.params = {
			volume: { gridSize: 8, innerVoidSize: 4, cellSize: 1 },
			deform: { mode: 'Point', lineAxis: 'X', lineRange: 8, rangeX: 1, rangeY: 1, rangeZ: 1, radius: 2.5, intensity: 1, exponent: 2, lockX: false, lockY: false, lockZ: false },
			partition: { minCellsPerPiece: 4, maxCellsPerPiece: 12, seed: 'puzzle-1', shapePreference: 'balanced' },
			tessellation: { level: 0 },
			export: { name: 'shaders-puzzle' },
			view: { renderMode: 'Solid', opacity: 0.28, explosionFactor: 1, showPoints: true, pointSize: 0.065, showGridEdges: true, showPieceEdges: false, projection: 'Perspective', cameraView: 'Perspective' },
		};
		this.state = {
			volume: buildGrid(this.params.volume), partition: null, primaryVertexId: null, selectionWeights: new Map(), selectedPieceId: null,
			invalidCellIds: [], deform: this.params.deform, tessellationLevel: 0,
			view: { ...this.params.view, hiddenPieces: new Set(), isolatedPieceId: null },
		};
		this.history = new HistoryManager();
		this.currentStage = 'Volume';
		this.sceneView = new SceneView(document.getElementById('viewport'), {
			onVertexSelected: (id) => this.selectVertex(id),
			onPieceSelected: (id) => this.selectPiece(id),
			onTransformComplete: (command) => this.completeTransform(command),
			onGeometryPreview: (factor) => this.setStatus(factor < 0.999 ? 'Movement limited by geometry validation.' : 'Deforming selection…', factor < 0.999 ? 'warning' : 'ok'),
		});
		this.sceneView.setState(this.state);
		this.buildStageIndicator();
		this.buildPanel();
		this.bindGlobalEvents();
		this.updateUI();
		this.sceneView.frame();
	}

	buildStageIndicator() {
		const nav = document.getElementById('stageIndicator');
		for (const stage of STAGES) {
			const button = document.createElement('button');
			button.type = 'button'; button.className = 'stage-button'; button.textContent = stage;
			button.addEventListener('click', () => this.setStage(stage));
			nav.appendChild(button);
		}
	}

	buildPanel() {
		this.pane = new Pane({ container: document.getElementById('panel'), title: 'Editor controls', expanded: true });
		this.folders = {};
		this.folders.Volume = this.buildVolumePanel();
		this.folders.Deformation = this.buildDeformationPanel();
		this.folders.Partition = this.buildPartitionPanel();
		this.folders.Inspection = this.buildInspectionPanel();
		this.folders.Export = this.buildExportPanel();
	}

	buildVolumePanel() {
		const folder = this.pane.addFolder({ title: 'Volume setup' });
		folder.addBinding(this.params.volume, 'gridSize', { label: 'Outer size', min: 2, max: 16, step: 1 });
		folder.addBinding(this.params.volume, 'innerVoidSize', { label: 'Void size', min: 0, max: 14, step: 1 });
		folder.addBinding(this.params.volume, 'cellSize', { label: 'Cell size', min: 0.1, max: 3, step: 0.1 });
		folder.addButton({ title: 'Build volume' }).on('click', () => this.rebuildVolume());
		const display = folder.addFolder({ title: 'Display' });
		display.addBinding(this.params.view, 'showPoints', { label: 'Grid points' }).on('change', ({ value }) => { this.state.view.showPoints = value; this.sceneView.refresh(); });
		display.addBinding(this.params.view, 'pointSize', { label: 'Point size', min: 0.02, max: 0.2, step: 0.005 }).on('change', ({ value }) => { this.state.view.pointSize = value; this.sceneView.refresh(); });
		display.addBinding(this.params.view, 'showGridEdges', { label: 'Grid edges' }).on('change', ({ value }) => { this.state.view.showGridEdges = value; this.sceneView.refresh(); });
		return folder;
	}

	buildDeformationPanel() {
		const folder = this.pane.addFolder({ title: 'Grid deformation' });
		folder.addBinding(this.params.deform, 'mode', { label: 'Selection', options: { Point: 'Point', Line: 'Line', 'Hard range': 'Hard range', 'Soft sphere': 'Soft sphere' } }).on('change', () => this.recalculateSelection());
		folder.addBinding(this.params.deform, 'lineAxis', { label: 'Line axis', options: { X: 'X', Y: 'Y', Z: 'Z' } }).on('change', () => this.recalculateSelection());
		folder.addBinding(this.params.deform, 'lineRange', { label: 'Line range', min: 0, max: 16, step: 1 }).on('change', () => this.recalculateSelection());
		const hard = folder.addFolder({ title: 'Hard range extents' });
		for (const axis of ['X', 'Y', 'Z']) hard.addBinding(this.params.deform, `range${axis}`, { label: axis, min: 0, max: 8, step: 1 }).on('change', () => this.recalculateSelection());
		const soft = folder.addFolder({ title: 'Soft selection' });
		soft.addBinding(this.params.deform, 'radius', { min: 0.1, max: 8, step: 0.1 }).on('change', () => this.recalculateSelection());
		soft.addBinding(this.params.deform, 'intensity', { min: 0.05, max: 1, step: 0.05 }).on('change', () => this.recalculateSelection());
		soft.addBinding(this.params.deform, 'exponent', { min: 0.25, max: 8, step: 0.25 }).on('change', () => this.recalculateSelection());
		const locks = folder.addFolder({ title: 'Axis locks' });
		for (const axis of ['X', 'Y', 'Z']) locks.addBinding(this.params.deform, `lock${axis}`, { label: `Lock ${axis}` }).on('change', () => this.sceneView.updateTransformAttachment());
		folder.addButton({ title: 'Random structured selection' }).on('click', () => this.selectRandom());
		folder.addButton({ title: 'Reset selected vertices' }).on('click', () => this.resetSelected());
		folder.addButton({ title: 'Reset entire grid' }).on('click', () => this.resetGrid());
		folder.addButton({ title: 'Undo  ·  Ctrl+Z' }).on('click', () => this.undo());
		folder.addButton({ title: 'Redo  ·  Ctrl+Shift+Z' }).on('click', () => this.redo());
		return folder;
	}

	buildPartitionPanel() {
		const folder = this.pane.addFolder({ title: 'Piece generation' });
		folder.addBinding(this.params.partition, 'minCellsPerPiece', { label: 'Minimum cells', min: 1, max: 64, step: 1 });
		folder.addBinding(this.params.partition, 'maxCellsPerPiece', { label: 'Maximum cells', min: 1, max: 128, step: 1 });
		folder.addBinding(this.params.partition, 'seed', { label: 'Seed' });
		folder.addBinding(this.params.partition, 'shapePreference', { label: 'Shape', options: { Balanced: 'balanced', Compact: 'compact', Elongated: 'elongated', Irregular: 'irregular' } });
		folder.addButton({ title: 'Generate partition' }).on('click', () => this.generatePieces());
		folder.addButton({ title: 'New random seed' }).on('click', () => { this.params.partition.seed = crypto.randomUUID().slice(0, 8); this.pane.refresh(); this.generatePieces(); });
		const tessellation = folder.addFolder({ title: 'Surface tessellation' });
		tessellation.addBinding(this.params.tessellation, 'level', { label: 'Subdivision level', min: 0, max: 4, step: 1 });
		tessellation.addButton({ title: 'Apply tessellation' }).on('click', () => this.applyTessellation());
		return folder;
	}

	buildInspectionPanel() {
		const folder = this.pane.addFolder({ title: 'Piece inspection' });
		folder.addBinding(this.params.view, 'renderMode', { label: 'Render mode', options: { Solid: 'Solid', Transparent: 'Transparent', Wireframe: 'Wireframe' } }).on('change', ({ value }) => { this.state.view.renderMode = value; this.sceneView.refresh(); });
		folder.addBinding(this.params.view, 'opacity', { min: 0.05, max: 0.9, step: 0.01 }).on('change', ({ value }) => { this.state.view.opacity = value; this.sceneView.refresh(); });
		folder.addBinding(this.params.view, 'explosionFactor', { label: 'Explosion', min: 1, max: 3, step: 0.01 }).on('change', ({ value }) => { this.state.view.explosionFactor = value; this.sceneView.refresh(); });
		folder.addBinding(this.params.view, 'showPieceEdges', { label: 'Piece edges' }).on('change', ({ value }) => { this.state.view.showPieceEdges = value; this.sceneView.refresh(); });
		folder.addButton({ title: 'Isolate selected piece' }).on('click', () => this.toggleIsolation());
		folder.addButton({ title: 'Hide selected piece' }).on('click', () => this.hideSelectedPiece());
		folder.addButton({ title: 'Restore visibility' }).on('click', () => { this.state.view.hiddenPieces.clear(); this.state.view.isolatedPieceId = null; this.sceneView.refresh(); });
		folder.addButton({ title: 'Reset explosion' }).on('click', () => { this.params.view.explosionFactor = 1; this.state.view.explosionFactor = 1; this.pane.refresh(); this.sceneView.refresh(); });
		const camera = folder.addFolder({ title: 'Camera' });
		camera.addBinding(this.params.view, 'projection', { options: { Perspective: 'Perspective', Orthographic: 'Orthographic' } }).on('change', ({ value }) => this.sceneView.setProjection(value === 'Orthographic'));
		camera.addBinding(this.params.view, 'cameraView', { label: 'View', options: { Perspective: 'Perspective', Front: 'Front', Side: 'Side', Top: 'Top' } }).on('change', ({ value }) => this.sceneView.setView(value));
		return folder;
	}

	buildExportPanel() {
		const folder = this.pane.addFolder({ title: 'Project and export' });
		folder.addBinding(this.params.export, 'name', { label: 'File name' });
		folder.addButton({ title: 'Save editable project' }).on('click', () => downloadJson(serializeProject(this.state), `${this.getExportName()}-project.json`));
		folder.addButton({ title: 'Load editable project' }).on('click', () => document.getElementById('projectFileInput').click());
		folder.addButton({ title: 'Export GLB + game data' }).on('click', () => this.exportPackage());
		return folder;
	}

	bindGlobalEvents() {
		document.getElementById('frameAll').addEventListener('click', () => this.sceneView.frame());
		document.getElementById('frameSelection').addEventListener('click', () => {
			if (this.state.primaryVertexId != null) this.sceneView.frame(new THREE.Vector3().fromArray(this.state.volume.vertices[this.state.primaryVertexId].restPosition));
		});
		document.getElementById('projectFileInput').addEventListener('change', (event) => this.loadProject(event.target.files[0]));
		window.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') this.clearSelection();
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); }
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); this.redo(); }
		});
	}

	setStage(stage) {
		this.currentStage = stage;
		for (const [name, folder] of Object.entries(this.folders)) folder.hidden = name !== stage;
		for (const button of document.querySelectorAll('.stage-button')) button.classList.toggle('active', button.textContent === stage);
		if (stage === 'Deformation') { this.state.view.showPoints = true; this.params.view.showPoints = true; }
		this.pane.refresh(); this.sceneView.refresh();
	}

	rebuildVolume() {
		const hasEdits = this.state.partition || this.state.volume.vertices.some((vertex) => vertex.restPosition.some((value, axis) => Math.abs(value - vertex.originalPosition[axis]) > 1e-9));
		if (hasEdits && !confirm('Rebuilding the volume will discard deformation and partition data. Continue?')) return;
		try {
			this.state.volume = buildGrid(this.params.volume); this.state.partition = null; this.state.primaryVertexId = null; this.state.selectionWeights = new Map(); this.state.selectedPieceId = null;
			this.state.view.hiddenPieces.clear(); this.state.view.isolatedPieceId = null; this.history.clear(); this.sceneView.refresh(); this.updateUI(); this.sceneView.frame();
		} catch (error) { this.setStatus(error.message, 'error'); }
	}

	selectVertex(id) { this.state.primaryVertexId = id; this.recalculateSelection(); this.setStatus(`Grid vertex ${id} selected.`, 'ok'); }
	recalculateSelection() { this.state.selectionWeights = calculateSelection(this.state.volume, this.state.primaryVertexId, this.params.deform); this.sceneView.refresh(); this.updateStatus(); }
	clearSelection() { this.state.primaryVertexId = null; this.state.selectionWeights = new Map(); this.state.selectedPieceId = null; this.sceneView.refresh(); this.updateStatus(); }
	selectPiece(id) { if (id == null || id < 0) return; this.state.selectedPieceId = id; this.sceneView.refresh(); this.setStatus(`Piece ${id + 1} selected.`, 'ok'); }
	selectRandom() { const result = randomSelection(this.state.volume, this.params.deform); this.state.primaryVertexId = result.primaryId; this.state.selectionWeights = result.weights; this.pane.refresh(); this.sceneView.refresh(); this.updateStatus(); }

	completeTransform(command) { this.history.push(command); this.state.partition && (this.state.partition.meshesDirty = true); this.updateStatus(); }
	applyPositionMap(map) { for (const [id, position] of map) this.state.volume.vertices[id].restPosition = [...position]; this.state.partition && (this.state.partition.meshesDirty = true); this.recalculateSelection(); }
	undo() { if (!this.history.undo((positions) => this.applyPositionMap(positions))) this.setStatus('Nothing to undo.', 'warning'); else this.setStatus('Deformation undone.', 'ok'); }
	redo() { if (!this.history.redo((positions) => this.applyPositionMap(positions))) this.setStatus('Nothing to redo.', 'warning'); else this.setStatus('Deformation restored.', 'ok'); }

	resetSelected() {
		if (!this.state.selectionWeights.size) return this.setStatus('Select one or more grid vertices first.', 'warning');
		const before = new Map([...this.state.selectionWeights].map(([id]) => [id, [...this.state.volume.vertices[id].restPosition]]));
		for (const [id] of this.state.selectionWeights) this.state.volume.vertices[id].restPosition = [...this.state.volume.vertices[id].originalPosition];
		if (!validateCells(this.state.volume).valid) { this.applyPositionMap(before); return this.setStatus('Reset would create invalid cells.', 'error'); }
		const after = new Map([...this.state.selectionWeights].map(([id]) => [id, [...this.state.volume.vertices[id].restPosition]]));
		this.history.push({ before, after }); this.recalculateSelection();
	}

	resetGrid() {
		if (!confirm('Reset every grid vertex to its regular position?')) return;
		const before = new Map(this.state.volume.vertices.map((vertex) => [vertex.id, [...vertex.restPosition]]));
		for (const vertex of this.state.volume.vertices) vertex.restPosition = [...vertex.originalPosition];
		const after = new Map(this.state.volume.vertices.map((vertex) => [vertex.id, [...vertex.restPosition]]));
		this.history.push({ before, after }); this.recalculateSelection(); this.setStatus('Grid reset.', 'ok');
	}

	generatePieces() {
		const validation = validateCells(this.state.volume);
		if (!validation.valid) return this.setStatus(`Cannot partition: ${validation.invalidCellIds.length} invalid cells.`, 'error');
		if (this.params.partition.maxCellsPerPiece < this.params.partition.minCellsPerPiece) return this.setStatus('Maximum piece size must be at least the minimum.', 'error');
		this.state.partition = generatePartition(this.state.volume, this.params.partition);
		const partitionValidation = validatePartition(this.state.volume, this.state.partition);
		if (!partitionValidation.valid) return this.setStatus(partitionValidation.errors[0], 'error');
		this.state.selectedPieceId = null; this.state.view.hiddenPieces.clear(); this.state.view.isolatedPieceId = null;
		this.sceneView.refresh(); this.setStage('Inspection'); this.updateStatus();
	}

	applyTessellation() {
		const level = Math.max(0, Math.min(4, Math.floor(Number(this.params.tessellation.level) || 0)));
		this.params.tessellation.level = level;
		this.state.tessellationLevel = level;
		this.sceneView.refresh(); this.pane.refresh();
		const divisions = 2 ** level;
		this.setStatus(level ? `Tessellation applied: level ${level} (${divisions}×${divisions} sections per face).` : 'Tessellation disabled; original faces restored.', 'ok');
	}

	toggleIsolation() { if (this.state.selectedPieceId == null) return this.setStatus('Select a piece first.', 'warning'); this.state.view.isolatedPieceId = this.state.view.isolatedPieceId === this.state.selectedPieceId ? null : this.state.selectedPieceId; this.sceneView.refresh(); }
	hideSelectedPiece() { if (this.state.selectedPieceId == null) return this.setStatus('Select a piece first.', 'warning'); this.state.view.hiddenPieces.add(this.state.selectedPieceId); this.state.view.isolatedPieceId = null; this.sceneView.refresh(); }

	async loadProject(file) {
		if (!file) return;
		try {
			const loaded = deserializeProject(JSON.parse(await file.text()));
			this.state.volume = loaded.volume; this.state.partition = loaded.partition;
			this.state.tessellationLevel = loaded.tessellationLevel; this.params.tessellation.level = loaded.tessellationLevel;
			Object.assign(this.params.volume, { gridSize: loaded.volume.gridSize, innerVoidSize: loaded.volume.innerVoidSize, cellSize: loaded.volume.cellSize });
			Object.assign(this.params.view, loaded.view); Object.assign(this.state.view, loaded.view);
			this.state.primaryVertexId = null; this.state.selectionWeights = new Map(); this.state.selectedPieceId = null; this.state.view.hiddenPieces = new Set(); this.state.view.isolatedPieceId = null; this.history.clear();
			if (loaded.partition) Object.assign(this.params.partition, loaded.partition);
			this.pane.refresh(); this.sceneView.refresh(); this.setStage(loaded.partition ? 'Inspection' : 'Volume'); this.sceneView.frame(); this.updateStatus();
		} catch (error) { this.setStatus(`Could not load project: ${error.message}`, 'error'); }
		finally { document.getElementById('projectFileInput').value = ''; }
	}

	exportPackage() {
		if (!this.state.partition) return this.setStatus('Generate a partition before exporting.', 'warning');
		const pieces = buildAllPieceGeometries(this.state.volume, this.state.partition, { subdivisionLevel: this.state.tessellationLevel });
		const exportName = this.getExportName();
		const root = new THREE.Group(); root.name = 'ShadersPuzzle';
		for (const { piece, geometry, pivot } of pieces) {
			const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true }));
			mesh.name = `piece-${piece.id}`; mesh.position.copy(pivot); root.add(mesh);
		}
		const data = buildGameData(this.state.volume, this.state.partition, pieces);
		new GLTFExporter().parse(root, (arrayBuffer) => {
			downloadBlob(new Blob([arrayBuffer], { type: 'model/gltf-binary' }), `${exportName}.glb`);
			downloadJson(data, `${exportName}.json`);
			root.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
			this.setStatus(`Exported ${pieces.length} pieces and ${data.connections.length} connections.`, 'ok');
		}, (error) => this.setStatus(`GLB export failed: ${error.message}`, 'error'), { binary: true });
	}

	getExportName() {
		const name = sanitizeExportName(this.params.export.name);
		if (name !== this.params.export.name) { this.params.export.name = name; this.pane.refresh(); }
		return name;
	}

	updateUI() { this.setStage(this.currentStage); this.updateStatus(); }
	updateStatus() {
		const occupied = occupiedCellCount(this.state.volume);
		const selection = this.state.selectionWeights.size;
		const pieces = this.state.partition?.pieces.length || 0;
		const warnings = this.state.partition?.warnings?.length || 0;
		this.setStatus(`${this.state.volume.gridSize}³ cells · ${occupied} occupied · ${this.state.volume.vertices.length} vertices · ${selection} selected · ${pieces} pieces${warnings ? ` · ${warnings} size warnings` : ''}`, warnings ? 'warning' : 'ok');
	}
	setStatus(message, level = '') { const element = document.getElementById('statusText'); element.textContent = message; element.dataset.level = level; }
}
