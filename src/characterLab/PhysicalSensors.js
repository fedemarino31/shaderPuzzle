import * as THREE from 'three';
import { computeStability, clamp01 } from './logic.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_DOWN = new THREE.Vector3(0, -1, 0);

export class PhysicalSensors {
	constructor() {
		this.previousVelocity = new THREE.Vector3();
		this.localGravity = new THREE.Vector3(0, -9.81, 0);
		this.contactNormal = new THREE.Vector3(0, 1, 0);
		this.supportPoint = new THREE.Vector3();
		this.fallDirection = new THREE.Vector3(1, 0, 0);
		this.timeUnstable = 0;
		this.support = true;
		this.slope = 0;
		this.speed = 0;
		this.acceleration = 0;
		this.stability = 1;
		this.impactStrength = 0;
		this.surface = 'Y+';
	}

	reset() {
		this.previousVelocity.set(0, 0, 0);
		this.timeUnstable = 0;
		this.impactStrength = 0;
		this.stability = 1;
	}

	update(delta, physics, containerQuaternion, angularSpeed, personality) {
		const position = physics.getCharacterPosition();
		const velocity = physics.getCharacterVelocity();
		const inverseContainer = containerQuaternion.clone().invert();
		this.localGravity.copy(WORLD_DOWN).multiplyScalar(9.81).applyQuaternion(inverseContainer);

		const hit = physics.castSupportRay(position, WORLD_DOWN, 0.62);
		this.support = Boolean(hit && hit.timeOfImpact <= 0.58 && velocity.y <= 0.9);
		if (hit) {
			this.contactNormal.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
			this.supportPoint.copy(position).addScaledVector(WORLD_DOWN, hit.timeOfImpact);
			this.surface = hit.collider?.userData?.surface || this.surface;
		}
		this.slope = this.support ? THREE.MathUtils.radToDeg(Math.acos(clamp01(this.contactNormal.dot(WORLD_UP)))) : 90;
		this.speed = velocity.length();
		this.acceleration = velocity.clone().sub(this.previousVelocity).length() / Math.max(delta, 1 / 120);
		this.previousVelocity.copy(velocity);
		const unstableNow = !this.support || this.slope > 10 || this.acceleration > 8 || angularSpeed > 1.4;
		this.timeUnstable = unstableNow ? Math.min(3, this.timeUnstable + delta) : Math.max(0, this.timeUnstable - delta * 1.8);
		this.stability = computeStability({
			support: this.support,
			slope: this.slope,
			angularSpeed,
			acceleration: this.acceleration,
			speed: this.speed,
			timeUnstable: this.timeUnstable,
		}, personality);
		this.impactStrength = Math.max(physics.contactForceThisFrame || 0, physics.lastContactForce || 0);
		this.fallDirection.copy(velocity).setY(0);
		if (this.fallDirection.lengthSq() < 0.001) {
			this.fallDirection.copy(this.localGravity).applyQuaternion(containerQuaternion).setY(0);
		}
		if (this.fallDirection.lengthSq() < 0.001) this.fallDirection.set(1, 0, 0);
		this.fallDirection.normalize();
		return this;
	}
}
