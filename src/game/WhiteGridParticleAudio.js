import * as THREE from 'three';
import { createPieceCellLookup, findSpherePieceOverlaps, WHITE_GRID_PARTICLE_COUNT } from './WhiteGridParticles.js';

export const WHITE_GRID_LOOP_URLS = [
	new URL('../../audios/loop1.mp3', import.meta.url).href,
	new URL('../../audios/loop2.mp3', import.meta.url).href,
	new URL('../../audios/loop3.mp3', import.meta.url).href,
	new URL('../../audios/loop4.mp3', import.meta.url).href,
];

export class WhiteGridParticleAudio {
	constructor({ scene, listener, soundUrls = WHITE_GRID_LOOP_URLS, volume = 0.22 }) {
		this.scene = scene;
		this.listener = listener;
		this.volume = volume;
		// Audio belongs exclusively to the White Grid Particles preset. The game
		// explicitly enables it when that preset becomes active.
		this.enabled = false;
		this.started = false;
		this.startRequested = false;
		this.disposed = false;
		this.buffers = new Array(WHITE_GRID_PARTICLE_COUNT).fill(null);
		this.emitters = Array.from({ length: WHITE_GRID_PARTICLE_COUNT }, () => new Map());
		this.startedAt = new Array(WHITE_GRID_PARTICLE_COUNT).fill(null);
		this.soundUrls = soundUrls;
		this.loadPromise = null;
	}

	async load(urls) {
		const loader = new THREE.AudioLoader();
		const buffers = await Promise.all(urls.map(async (url) => {
			try { return await loader.loadAsync(url); }
			catch (error) { console.warn(`Could not load particle loop ${url}.`, error); return null; }
		}));
		if (this.disposed) return;
		this.buffers = buffers;
		if (this.startRequested) this.start();
	}

	setPuzzle({ assembly, data, gridSize }) {
		this.clearEmitters();
		this.assembly = assembly;
		this.gridSize = gridSize;
		this.cellOwners = createPieceCellLookup(data, gridSize);
	}

	setEnabled(enabled) {
		const nextEnabled = Boolean(enabled);
		if (this.enabled === nextEnabled) return;
		this.enabled = nextEnabled;
		if (!this.enabled) this.clearEmitters();
		else if (this.startRequested) this.start();
	}

	setVolume(volume) {
		this.volume = THREE.MathUtils.clamp(Number(volume) || 0, 0, 1);
	}

	unlockAndStart() {
		if (!this.enabled) return;
		this.startRequested = true;
		// Do not even fetch/decode the four loops for unrelated shader presets.
		this.loadPromise ||= this.load(this.soundUrls);
		const context = this.listener.context;
		if (context.state === 'suspended') context.resume().then(() => this.start()).catch(() => {});
		else this.start();
	}

	start() {
		if (this.disposed || this.started || !this.startRequested || this.buffers.every((buffer) => !buffer)) return;
		this.started = true;
	}

	setEmitterVolume(sound, volume) {
		const gain = sound.gain.gain;
		gain.cancelScheduledValues(this.listener.context.currentTime);
		gain.setTargetAtTime(volume, this.listener.context.currentTime, 0.035);
	}

	createEmitter(particleIndex, pieceId) {
		const buffer = this.buffers[particleIndex];
		if (!buffer) return null;
		const sound = new THREE.PositionalAudio(this.listener);
		sound.setBuffer(buffer);
		sound.setLoop(true);
		sound.setRefDistance(0.22);
		sound.setRolloffFactor(1.45);
		sound.setDistanceModel('inverse');
		sound.setMaxDistance(5);
		sound.setVolume(0);
		this.scene.add(sound);
		const contextTime = this.listener.context.currentTime;
		if (this.startedAt[particleIndex] == null) this.startedAt[particleIndex] = contextTime;
		sound.offset = (contextTime - this.startedAt[particleIndex]) % buffer.duration;
		sound.play();
		this.emitters[particleIndex].set(pieceId, sound);
		return sound;
	}

	removeEmitter(particleIndex, pieceId) {
		const sound = this.emitters[particleIndex].get(pieceId);
		if (!sound) return;
		if (sound.isPlaying) sound.stop();
		this.scene.remove(sound);
		sound.disconnect();
		this.emitters[particleIndex].delete(pieceId);
	}

	update(particles) {
		if (!this.enabled || !this.started || !this.assembly || !this.cellOwners || !particles) return;
		for (let index = 0; index < Math.min(particles.length, WHITE_GRID_PARTICLE_COUNT); index++) {
			const overlaps = findSpherePieceOverlaps(particles[index], this.gridSize, this.cellOwners);
			const activePieces = new Set(overlaps.map((overlap) => overlap.pieceId));
			for (const pieceId of this.emitters[index].keys()) if (!activePieces.has(pieceId)) this.removeEmitter(index, pieceId);
			const totalWeight = overlaps.reduce((sum, overlap) => sum + overlap.weight, 0) || 1;
			for (const overlap of overlaps) {
				const sound = this.emitters[index].get(overlap.pieceId) || this.createEmitter(index, overlap.pieceId);
				if (!sound) continue;
				const worldPosition = this.assembly.canonicalToPieceWorld(overlap.pieceId, overlap.position);
				if (!worldPosition) { this.setEmitterVolume(sound, 0); continue; }
				sound.position.copy(worldPosition);
				this.setEmitterVolume(sound, this.enabled ? this.volume * overlap.weight / totalWeight : 0);
			}
		}
	}

	clearEmitters() {
		for (let index = 0; index < this.emitters.length; index++) for (const pieceId of [...this.emitters[index].keys()]) this.removeEmitter(index, pieceId);
		this.startedAt.fill(null);
	}

	dispose() {
		this.disposed = true;
		this.clearEmitters();
	}
}
