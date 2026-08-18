import * as THREE from 'three';

export const SNAP_SOUND_URLS = [
	new URL('../../audios/bonus1.mp3', import.meta.url).href,
];

function createFallbackBuffer(context) {
	const duration = 0.14;
	const sampleRate = context.sampleRate;
	const buffer = context.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate);
	const channel = buffer.getChannelData(0);
	let noise = 0x51f15e;
	for (let i = 0; i < channel.length; i++) {
		const time = i / sampleRate;
		noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
		const random = (noise / 0xffffffff) * 2 - 1;
		const attack = Math.min(1, time / 0.003);
		const body = Math.exp(-time * 34) * Math.sin(2 * Math.PI * (540 - time * 900) * time);
		const click = Math.exp(-time * 90) * random;
		channel[i] = attack * (body * 0.72 + click * 0.28);
	}
	return buffer;
}

function pulseActuator(actuator, intensity, duration) {
	if (!actuator) return false;
	try {
		if (typeof actuator.pulse === 'function') {
			actuator.pulse(intensity, duration).catch?.(() => {});
			return true;
		}
		if (typeof actuator.playEffect === 'function') {
			actuator.playEffect('dual-rumble', { duration, strongMagnitude: intensity, weakMagnitude: intensity * 0.7 }).catch?.(() => {});
			return true;
		}
	} catch { /* Unsupported or disconnected actuator. */ }
	return false;
}

export function pulseXRControllers(session, fallbackController = null, { intensity = 0.55, duration = 95 } = {}) {
	const actuators = new Set();
	for (const source of session?.inputSources || []) {
		const gamepad = source?.gamepad;
		for (const actuator of gamepad?.hapticActuators || []) actuators.add(actuator);
		if (gamepad?.vibrationActuator) actuators.add(gamepad.vibrationActuator);
	}
	let pulsed = false;
	for (const actuator of actuators) pulsed = pulseActuator(actuator, intensity, duration) || pulsed;
	if (!pulsed) {
		try { fallbackController?.pulse?.(intensity, duration); pulsed = Boolean(fallbackController?.pulse); } catch { /* Controller may have disconnected. */ }
	}
	return pulsed;
}

export class SnapFeedback {
	constructor({ camera, scene, listener = null, getXRSession = () => null, soundUrls = SNAP_SOUND_URLS }) {
		this.scene = scene;
		this.getXRSession = getXRSession;
		this.listener = listener || new THREE.AudioListener();
		if (!listener) camera.add(this.listener);
		this.buffers = [createFallbackBuffer(this.listener.context)];
		this.nextBuffer = 0;
		this.loadSounds(soundUrls);
	}

	async loadSounds(urls) {
		const loader = new THREE.AudioLoader();
		const loaded = (await Promise.all(urls.map(async (url) => {
			try { return await loader.loadAsync(url); }
			catch { return null; }
		}))).filter(Boolean);
		if (loaded.length) this.buffers = loaded;
	}

	unlock() {
		if (this.listener.context.state === 'suspended') this.listener.context.resume().catch(() => {});
	}

	playSnap(worldPosition, controller = null) {
		pulseXRControllers(this.getXRSession(), controller);
		const position = worldPosition?.isVector3 ? worldPosition.clone() : new THREE.Vector3();
		const play = () => {
			const buffer = this.buffers[this.nextBuffer++ % this.buffers.length];
			const sound = new THREE.PositionalAudio(this.listener);
			sound.setBuffer(buffer);
			sound.setRefDistance(0.18);
			sound.setRolloffFactor(1.65);
			sound.setDistanceModel('inverse');
			sound.setMaxDistance(6);
			sound.setVolume(0.8);
			sound.position.copy(position);
			this.scene.add(sound);
			sound.play();
			sound.source?.addEventListener('ended', () => {
				this.scene.remove(sound);
				sound.disconnect();
			}, { once: true });
		};
		if (this.listener.context.state === 'suspended') this.listener.context.resume().then(play).catch(() => {});
		else play();
	}
}
