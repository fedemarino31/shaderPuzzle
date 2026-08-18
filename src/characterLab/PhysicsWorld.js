import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { LAB_CONFIG } from './config.js';

const toRapierRotation = (quaternion) => ({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });

export class PhysicsWorld {
	async init() {
		await RAPIER.init({});
		const [gx, gy, gz] = LAB_CONFIG.physics.gravity;
		this.world = new RAPIER.World({ x: gx, y: gy, z: gz });
		this.world.timestep = LAB_CONFIG.physics.fixedStep;
		this.events = new RAPIER.EventQueue(true);
		this.accumulator = 0;
		this.lastContactForce = 0;
		this.contactForceThisFrame = 0;
		this.createContainer();
		this.createCharacter();
	}

	createContainer() {
		const [cx, cy, cz] = LAB_CONFIG.container.center;
		const [hx, hy, hz] = LAB_CONFIG.container.halfExtents;
		const thickness = LAB_CONFIG.container.wallThickness;
		const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(cx, cy, cz);
		this.containerBody = this.world.createRigidBody(bodyDesc);
		const walls = [
			{ half: [hx + thickness, thickness, hz + thickness], at: [0, -hy - thickness, 0], name: 'Y+' },
			{ half: [hx + thickness, thickness, hz + thickness], at: [0, hy + thickness, 0], name: 'Y-' },
			{ half: [thickness, hy, hz], at: [-hx - thickness, 0, 0], name: 'X+' },
			{ half: [thickness, hy, hz], at: [hx + thickness, 0, 0], name: 'X-' },
			{ half: [hx, hy, thickness], at: [0, 0, -hz - thickness], name: 'Z+' },
			{ half: [hx, hy, thickness], at: [0, 0, hz + thickness], name: 'Z-' },
		];
		this.containerColliders = walls.map(({ half, at, name }) => {
			const descriptor = RAPIER.ColliderDesc.cuboid(...half)
				.setTranslation(...at)
				.setFriction(0.76)
				.setRestitution(0.08)
				.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
			const collider = this.world.createCollider(descriptor, this.containerBody);
			collider.userData = { surface: name };
			return collider;
		});
	}

	createCharacter() {
		const [cx, cy, cz] = LAB_CONFIG.container.center;
		const [px, py, pz] = LAB_CONFIG.proxy.start;
		const descriptor = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(cx + px, cy + py, cz + pz)
			.setLinearDamping(0.22)
			.setAngularDamping(3)
			.setCanSleep(false);
		this.characterBody = this.world.createRigidBody(descriptor);
		this.characterBody.setEnabledRotations(false, false, false, true);
		const colliderDescriptor = RAPIER.ColliderDesc.capsule(LAB_CONFIG.proxy.halfHeight, LAB_CONFIG.proxy.radius)
			.setDensity(LAB_CONFIG.proxy.mass)
			.setFriction(0.7)
			.setRestitution(0.1)
			.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
		this.characterCollider = this.world.createCollider(colliderDescriptor, this.characterBody);
		this.characterCollider.userData = { character: true };
	}

	reset(containerQuaternion = new THREE.Quaternion()) {
		const [cx, cy, cz] = LAB_CONFIG.container.center;
		this.containerBody.setTranslation({ x: cx, y: cy, z: cz }, true);
		this.containerBody.setNextKinematicRotation(toRapierRotation(containerQuaternion));
		this.containerBody.setRotation(toRapierRotation(containerQuaternion), true);
		this.characterBody.setTranslation({ x: cx, y: cy - 0.46, z: cz }, true);
		this.characterBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
		this.characterBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
		this.lastContactForce = 0;
		this.contactForceThisFrame = 0;
		this.accumulator = 0;
	}

	step(delta, containerQuaternion, beforeStep) {
		this.accumulator = Math.min(this.accumulator + delta, LAB_CONFIG.physics.fixedStep * LAB_CONFIG.physics.maxSubsteps);
		this.contactForceThisFrame = 0;
		let stepped = false;
		while (this.accumulator >= LAB_CONFIG.physics.fixedStep) {
			this.containerBody.setNextKinematicRotation(toRapierRotation(containerQuaternion));
			beforeStep?.(LAB_CONFIG.physics.fixedStep);
			this.world.step(this.events);
			this.events.drainContactForceEvents((event) => {
				const force = event.totalForceMagnitude();
				if (Number.isFinite(force)) this.contactForceThisFrame = Math.max(this.contactForceThisFrame, force);
			});
			this.accumulator -= LAB_CONFIG.physics.fixedStep;
			stepped = true;
		}
		if (stepped) this.lastContactForce = Math.max(this.contactForceThisFrame, this.lastContactForce * 0.86);
		else this.lastContactForce *= 0.96;
	}

	applyImpulse(vector) {
		this.characterBody.applyImpulse({ x: vector.x, y: vector.y, z: vector.z }, true);
	}

	getCharacterPosition(target = new THREE.Vector3()) {
		const value = this.characterBody.translation();
		return target.set(value.x, value.y, value.z);
	}

	getCharacterVelocity(target = new THREE.Vector3()) {
		const value = this.characterBody.linvel();
		return target.set(value.x, value.y, value.z);
	}

	castSupportRay(origin, direction, maxDistance = 0.58) {
		const ray = new RAPIER.Ray(
			{ x: origin.x, y: origin.y, z: origin.z },
			{ x: direction.x, y: direction.y, z: direction.z },
		);
		return this.world.castRayAndGetNormal(ray, maxDistance, true, undefined, undefined, this.characterCollider, this.characterBody);
	}
}
