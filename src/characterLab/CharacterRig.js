import * as THREE from 'three';

const makeMaterial = (color, roughness = 0.55, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function capsuleSegment(radius, length, material) {
	const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 5, 10), material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

export class CharacterRig {
	constructor() {
		this.group = new THREE.Group();
		this.group.name = 'characterRoot';
		this.group.rotation.order = 'ZXY';
		this.nodes = {};
		this.build();
	}

	makePivot(name, parent, position) {
		const pivot = new THREE.Group();
		pivot.name = name;
		pivot.position.copy(position);
		parent.add(pivot);
		this.nodes[name] = pivot;
		return pivot;
	}

	build() {
		const suit = makeMaterial(0xe46f5d, 0.62);
		const suitDark = makeMaterial(0x813e43, 0.7);
		const skin = makeMaterial(0xffc6a1, 0.72);
		const accent = makeMaterial(0x70e0c2, 0.38, 0.18);
		const sole = makeMaterial(0x20282b, 0.8);

		const pelvis = this.makePivot('pelvis', this.group, new THREE.Vector3(0, 0.5, 0));
		const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.17), suitDark);
		pelvisMesh.position.y = 0.01; pelvisMesh.castShadow = true; pelvis.add(pelvisMesh);

		const torsoLower = this.makePivot('torsoLower', pelvis, new THREE.Vector3(0, 0.08, 0));
		const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.2, 5, 10), suit);
		torsoMesh.position.y = 0.15; torsoMesh.scale.z = 0.72; torsoMesh.castShadow = true; torsoLower.add(torsoMesh);
		const torsoUpper = this.makePivot('torsoUpper', torsoLower, new THREE.Vector3(0, 0.29, 0));
		const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 6, 18), accent);
		collar.rotation.x = Math.PI / 2; collar.position.y = 0.03; torsoUpper.add(collar);

		const head = this.makePivot('head', torsoUpper, new THREE.Vector3(0, 0.18, 0));
		const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12), skin);
		headMesh.scale.set(0.9, 1.05, 0.9); headMesh.castShadow = true; head.add(headMesh);
		const face = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), sole);
		face.position.set(0, 0.015, 0.126); face.scale.x = 1.75; head.add(face);

		this.buildArm('L', torsoUpper, -0.15, suit, skin);
		this.buildArm('R', torsoUpper, 0.15, suit, skin);
		this.buildLeg('L', pelvis, -0.075, suitDark, sole);
		this.buildLeg('R', pelvis, 0.075, suitDark, sole);

		const beacon = new THREE.PointLight(0x64e2c0, 0.55, 1.5);
		beacon.position.set(0, 0.85, 0.2); this.group.add(beacon);
	}

	buildArm(side, parent, x, material, skin) {
		const sign = side === 'L' ? -1 : 1;
		const upper = this.makePivot(`arm${side}`, parent, new THREE.Vector3(x, 0.02, 0));
		upper.rotation.z = sign * 0.12;
		const upperMesh = capsuleSegment(0.055, 0.23, material);
		upperMesh.position.y = -0.11; upper.add(upperMesh);
		const forearm = this.makePivot(`forearm${side}`, upper, new THREE.Vector3(0, -0.22, 0));
		const forearmMesh = capsuleSegment(0.045, 0.21, skin);
		forearmMesh.position.y = -0.1; forearm.add(forearmMesh);
		const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), skin);
		hand.position.y = -0.21; forearm.add(hand);
	}

	buildLeg(side, parent, x, material, sole) {
		const thigh = this.makePivot(`thigh${side}`, parent, new THREE.Vector3(x, -0.04, 0));
		const thighMesh = capsuleSegment(0.065, 0.24, material);
		thighMesh.position.y = -0.115; thigh.add(thighMesh);
		const shin = this.makePivot(`shin${side}`, thigh, new THREE.Vector3(0, -0.23, 0));
		const shinMesh = capsuleSegment(0.054, 0.22, material);
		shinMesh.position.y = -0.105; shin.add(shinMesh);
		const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.19), sole);
		foot.position.set(0, -0.215, 0.035); foot.castShadow = true; shin.add(foot);
	}
}
