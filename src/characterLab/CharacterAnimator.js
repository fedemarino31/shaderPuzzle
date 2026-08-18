import * as THREE from 'three';

const track = (node, axis, times, values) => new THREE.NumberKeyframeTrack(`${node}.rotation[${axis}]`, times, values);
const loop = [0, 0.5, 1];

function createClips() {
	return [
		new THREE.AnimationClip('IDLE', 2, [
			track('torsoLower', 'z', [0, 1, 2], [-0.025, 0.025, -0.025]),
			track('head', 'y', [0, 1, 2], [-0.12, 0.12, -0.12]),
		]),
		new THREE.AnimationClip('BALANCING', 1, [
			track('armL', 'z', loop, [-0.72, -1.05, -0.72]), track('armR', 'z', loop, [0.82, 1.12, 0.82]),
			track('shinL', 'x', loop, [0.18, 0.34, 0.18]), track('shinR', 'x', loop, [0.28, 0.14, 0.28]),
		]),
		new THREE.AnimationClip('WALKING', 0.72, [
			track('thighL', 'x', [0, .36, .72], [-0.5, 0.5, -0.5]), track('thighR', 'x', [0, .36, .72], [0.5, -0.5, 0.5]),
			track('shinL', 'x', [0, .36, .72], [0.1, 0.62, 0.1]), track('shinR', 'x', [0, .36, .72], [0.62, 0.1, 0.62]),
			track('armL', 'x', [0, .36, .72], [0.35, -0.35, 0.35]), track('armR', 'x', [0, .36, .72], [-0.35, 0.35, -0.35]),
		]),
		new THREE.AnimationClip('SLIDING', 1.1, [
			track('torsoLower', 'x', loop, [-0.25, -0.38, -0.25]), track('armL', 'z', loop, [-1.0, -1.35, -1.0]), track('armR', 'z', loop, [1.15, 0.85, 1.15]),
			track('shinL', 'x', loop, [0.5, 0.7, 0.5]), track('shinR', 'x', loop, [0.58, 0.42, 0.58]),
		]),
		new THREE.AnimationClip('FALLING', 0.8, [
			track('armL', 'z', loop, [-1.1, -1.55, -1.1]), track('armR', 'z', loop, [1.1, 1.55, 1.1]),
			track('thighL', 'x', loop, [0.5, -0.2, 0.5]), track('thighR', 'x', loop, [-0.35, 0.45, -0.35]),
		]),
		new THREE.AnimationClip('IMPACT', 0.38, [
			track('torsoLower', 'x', [0, .12, .38], [0, -0.8, -0.35]), track('head', 'x', [0, .12, .38], [0, 0.65, 0.15]),
			track('armL', 'z', [0, .12, .38], [-1, -1.7, -0.8]), track('armR', 'z', [0, .12, .38], [1, 1.65, 0.85]),
		]),
		new THREE.AnimationClip('DOWN', 1.4, [
			track('torsoLower', 'x', [0, .7, 1.4], [-0.45, -0.55, -0.45]), track('head', 'z', [0, .7, 1.4], [-0.18, 0.05, -0.18]),
			track('thighL', 'x', [0, .7, 1.4], [0.75, 0.68, 0.75]), track('thighR', 'x', [0, .7, 1.4], [0.32, 0.4, 0.32]),
		]),
		new THREE.AnimationClip('GETTING_UP', 1.05, [
			track('torsoLower', 'x', [0, .35, .75, 1.05], [-0.85, -0.62, -0.18, 0]),
			track('armL', 'x', [0, .35, .75, 1.05], [0.7, 1.2, 0.4, 0]), track('armR', 'x', [0, .35, .75, 1.05], [0.7, 1.15, 0.35, 0]),
			track('shinL', 'x', [0, .35, .75, 1.05], [0.8, 1.0, 0.45, 0]), track('shinR', 'x', [0, .35, .75, 1.05], [0.65, 0.9, 0.35, 0]),
		]),
	];
}

class DampedSpring {
	constructor() { this.value = 0; this.velocity = 0; }
	update(target, delta, frequency = 8, damping = 0.78) {
		const acceleration = (target - this.value) * frequency * frequency - 2 * damping * frequency * this.velocity;
		this.velocity += acceleration * delta;
		this.value += this.velocity * delta;
		return this.value;
	}
	reset() { this.value = 0; this.velocity = 0; }
}

export class CharacterAnimator {
	constructor(rig, config, personality) {
		this.rig = rig;
		this.config = config;
		this.personality = personality;
		this.mixer = new THREE.AnimationMixer(rig.group);
		this.actions = new Map(createClips().map((clip) => [clip.name, this.mixer.clipAction(clip)]));
		this.currentAction = this.actions.get('IDLE');
		this.currentAction.play();
		this.armSpring = new DampedSpring();
		this.headSpring = new DampedSpring();
		this.targetPosition = new THREE.Vector3();
		this.targetQuaternion = new THREE.Quaternion();
	}

	setPersonality(personality) { this.personality = personality; }

	setState(state, previous) {
		const next = this.actions.get(state);
		if (!next || next === this.currentAction) return;
		next.reset().setEffectiveTimeScale(state === 'GETTING_UP' ? this.personality.recoverySpeed : this.personality.movementEnergy).play();
		if (previous === 'IMPACT') this.currentAction.stop();
		else next.crossFadeFrom(this.currentAction, this.config.crossFadeDuration, true);
		this.currentAction = next;
	}

	reset() {
		for (const action of this.actions.values()) action.stop();
		this.currentAction = this.actions.get('IDLE').reset().play();
		this.armSpring.reset(); this.headSpring.reset();
		this.rig.group.rotation.set(0, 0, 0);
	}

	update(delta, stateMachine, sensors, physics) {
		this.mixer.update(delta);
		const state = stateMachine.state;
		const position = physics.getCharacterPosition();
		if (sensors.support && !['FALLING'].includes(state)) this.targetPosition.copy(sensors.supportPoint).addScaledVector(sensors.contactNormal, 0.012);
		else this.targetPosition.copy(position).addScaledVector(new THREE.Vector3(0, -1, 0), 0.42);
		this.rig.group.position.lerp(this.targetPosition, 1 - Math.exp(-delta * 18));

		let fallTilt = 0;
		if (state === 'FALLING') fallTilt = 0.8;
		else if (state === 'IMPACT') fallTilt = 1.18;
		else if (state === 'DOWN') fallTilt = 1.36;
		else if (state === 'GETTING_UP') fallTilt = 1.36 * Math.max(0, 1 - stateMachine.timeInState * this.personality.recoverySpeed);
		const directionSign = Math.abs(sensors.fallDirection.x) > 0.12 ? Math.sign(sensors.fallDirection.x) : 1;
		this.targetQuaternion.setFromEuler(new THREE.Euler(sensors.fallDirection.z * fallTilt * 0.5, 0, -directionSign * fallTilt, 'ZXY'));
		this.rig.group.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-delta * (state === 'IMPACT' ? 18 : 7)));

		const instability = 1 - sensors.stability;
		const leanX = THREE.MathUtils.clamp(sensors.fallDirection.z * instability * 0.52, -0.48, 0.48);
		const leanZ = THREE.MathUtils.clamp(-sensors.fallDirection.x * instability * 0.52, -0.48, 0.48);
		this.rig.nodes.torsoLower.rotation.x += leanX;
		this.rig.nodes.torsoLower.rotation.z += leanZ;
		this.rig.nodes.pelvis.rotation.x -= leanX * 0.34;
		this.rig.nodes.pelvis.rotation.z -= leanZ * 0.34;
		const knee = instability * 0.5 + Math.min(0.2, sensors.acceleration * 0.009);
		this.rig.nodes.shinL.rotation.x += knee;
		this.rig.nodes.shinR.rotation.x += knee * 0.92;
		const armTarget = instability * this.personality.armExaggeration;
		const armLag = this.armSpring.update(armTarget, delta, 7.5, 0.68);
		this.rig.nodes.armL.rotation.z -= armLag * 0.58;
		this.rig.nodes.armR.rotation.z += armLag * 0.62;
		const headLag = this.headSpring.update(-leanZ, delta, 5.2, 0.82);
		this.rig.nodes.head.rotation.z += headLag * 0.75;
		this.rig.nodes.head.rotation.x -= leanX * 0.72;
	}
}
