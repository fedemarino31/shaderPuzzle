import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { validateGameData } from './gameCore.js';

export const PUZZLE_SETS = [
	{
		id: 'puzzle-1',
		name: 'Puzzle 1 · 52 pieces',
		modelUrl: new URL('../../models/shaders-puzzle.glb', import.meta.url).href,
		dataUrl: new URL('../../models/shaders-puzzle-data.json', import.meta.url).href,
	},
	{
		id: 'puzzle-2',
		name: 'Puzzle 2 · 7 pieces',
		modelUrl: new URL('../../models/shaders-puzzle2.glb', import.meta.url).href,
		dataUrl: new URL('../../models/shaders-puzzle-data2.json', import.meta.url).href,
	},
];

export const DEFAULT_PUZZLE_SET_ID = 'puzzle-2';
export const PUZZLE_SET_BY_ID = new Map(PUZZLE_SETS.map((set) => [set.id, set]));

export async function loadPuzzleAssets({ modelUrl, dataUrl } = PUZZLE_SET_BY_ID.get(DEFAULT_PUZZLE_SET_ID)) {
	if (!modelUrl || !dataUrl) throw new Error('Puzzle set requires both modelUrl and dataUrl.');
	const [dataResponse, gltf] = await Promise.all([
		fetch(dataUrl),
		new GLTFLoader().loadAsync(modelUrl),
	]);
	if (!dataResponse.ok) throw new Error(`Could not load puzzle data (${dataResponse.status}).`);
	const data = await dataResponse.json();
	const meshes = new Map();
	gltf.scene.traverse((object) => {
		if (object.isMesh && object.name) meshes.set(object.name, object);
	});
	validateGameData(data, meshes.keys());
	for (const piece of data.pieces) {
		const mesh = meshes.get(piece.meshRef);
		if (!mesh.geometry.getAttribute('_uvw')) throw new Error(`${piece.meshRef} does not contain the required _uvw attribute.`);
	}
	return { data, meshes };
}
