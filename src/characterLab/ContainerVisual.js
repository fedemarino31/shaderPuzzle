import * as THREE from 'three';
import { LAB_CONFIG } from './config.js';

export class ContainerVisual extends THREE.Group {
	constructor() {
		super();
		const [hx, hy, hz] = LAB_CONFIG.container.halfExtents;
		const [cx, cy, cz] = LAB_CONFIG.container.center;
		this.position.set(cx, cy, cz);
		const glass = new THREE.MeshPhysicalMaterial({
			color: 0xa9d8d1, transmission: 0.6, transparent: true, opacity: 0.15,
			roughness: 0.18, metalness: 0.04, thickness: 0.08, side: THREE.DoubleSide,
			depthWrite: false,
		});
		const floor = new THREE.MeshPhysicalMaterial({ color: 0x29433e, transparent: true, opacity: 0.34, roughness: 0.48, side: THREE.DoubleSide, depthWrite: false });
		const panels = [
			{ size: [hx * 2, hz * 2], position: [0, -hy, 0], rotation: [-Math.PI / 2, 0, 0], material: floor },
			{ size: [hx * 2, hz * 2], position: [0, hy, 0], rotation: [-Math.PI / 2, 0, 0], material: glass },
			{ size: [hx * 2, hy * 2], position: [0, 0, -hz], rotation: [0, 0, 0], material: glass },
			{ size: [hx * 2, hy * 2], position: [0, 0, hz], rotation: [0, 0, 0], material: glass },
			{ size: [hz * 2, hy * 2], position: [-hx, 0, 0], rotation: [0, Math.PI / 2, 0], material: glass },
			{ size: [hz * 2, hy * 2], position: [hx, 0, 0], rotation: [0, Math.PI / 2, 0], material: glass },
		];
		for (const item of panels) {
			const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...item.size), item.material);
			mesh.position.set(...item.position); mesh.rotation.set(...item.rotation); mesh.receiveShadow = true; this.add(mesh);
		}
		const edges = new THREE.LineSegments(
			new THREE.EdgesGeometry(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2)),
			new THREE.LineBasicMaterial({ color: 0x83cfc0, transparent: true, opacity: 0.78 }),
		);
		this.add(edges);
		const floorGrid = new THREE.GridHelper(hx * 2, 16, 0x79d9c3, 0x355c56);
		floorGrid.scale.z = hz / hx; floorGrid.position.y = -hy + 0.003;
		floorGrid.material.transparent = true; floorGrid.material.opacity = 0.28; this.add(floorGrid);
	}
}
