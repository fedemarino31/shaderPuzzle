import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { InfinityMirrorMaterial } from './InfinityMirrorMaterial.js';
import { InfinityGridMaterial } from './InfinityGridMaterial.js';

export class InfinityMirrorCube extends THREE.Group {
	constructor({ size = 2, frameThickness = 0.075, materialOptions = {}, gridMaterialOptions = {} } = {}) {
		super();
		this.size = size;
		this.cameraWorldPosition = new THREE.Vector3();
		this.materials = {
			chromatic: new InfinityMirrorMaterial(materialOptions),
			grid: new InfinityGridMaterial(gridMaterialOptions),
		};
		for (const material of Object.values(this.materials)) material.uniforms.uBoxHalfSize.value.setScalar(size * 0.5);
		this.shaderMode = 'chromatic';
		this.material = this.materials[this.shaderMode];

		const opticalGeometry = new THREE.BoxGeometry(size, size, size);
		this.opticalCube = new THREE.Mesh(opticalGeometry, this.material);
		this.add(this.opticalCube);

		const frameGeometry = this.createFrameGeometry(size, frameThickness);
		const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x020304, roughness: 0.3, metalness: 0.72 });
		this.frame = new THREE.Mesh(frameGeometry, frameMaterial);
		this.frame.renderOrder = 1;
		this.add(this.frame);
	}

	setShaderMode(mode) {
		if (!this.materials[mode] || mode === this.shaderMode) return;
		this.shaderMode = mode;
		this.material = this.materials[mode];
		this.opticalCube.material = this.material;
	}

	createFrameGeometry(size, thickness) {
		const half = size * 0.5;
		const length = size + thickness;
		const geometries = [];
		for (let axis = 0; axis < 3; axis++) {
			for (const a of [-half, half]) {
				for (const b of [-half, half]) {
					const dimensions = [thickness, thickness, thickness];
					dimensions[axis] = length;
					const geometry = new THREE.BoxGeometry(...dimensions);
					const position = new THREE.Vector3();
					position.setComponent((axis + 1) % 3, a);
					position.setComponent((axis + 2) % 3, b);
					geometry.translate(position.x, position.y, position.z);
					geometries.push(geometry);
				}
			}
		}
		const merged = mergeGeometries(geometries, false);
		geometries.forEach((geometry) => geometry.dispose());
		return merged;
	}

	update({ camera, time }) {
		this.updateWorldMatrix(true, false);
		camera.getWorldPosition(this.cameraWorldPosition);
		this.material.uniforms.uCameraLocal.value.copy(this.cameraWorldPosition);
		this.worldToLocal(this.material.uniforms.uCameraLocal.value);
		this.material.uniforms.uTime.value = time;
	}

	dispose() {
		this.opticalCube.geometry.dispose();
		this.frame.geometry.dispose();
		this.frame.material.dispose();
		Object.values(this.materials).forEach((material) => material.dispose());
	}
}
