import * as THREE from 'three';
import vertexShader from './shaders/infinityMirror.vert.glsl?raw';
import fragmentShader from './shaders/infinityMirror.frag.glsl?raw';

const DEFAULTS = {
	sampleCount: 8,
	nearDistance: 0.02,
	farDistance: 20,
	rodRadius: 0.025,
	coreIntensity: 1.5,
	glowIntensity: 0.5,
	glowFalloff: 15,
	absorption: 0.12,
	reflectivity: 0.9,
	exposure: 1,
	colorX: '#54f1ff',
	colorY: '#ff53bd',
	colorZ: '#ffb443',
	singleColor: false,
	fresnelEnabled: true,
	fresnelPower: 3,
	debugMode: 0,
};

export class InfinityMirrorMaterial extends THREE.ShaderMaterial {
	constructor(options = {}) {
		const values = { ...DEFAULTS, ...options };
		super({
			vertexShader,
			fragmentShader,
			side: THREE.FrontSide,
			transparent: false,
			depthWrite: true,
			uniforms: {
				uCameraLocal: { value: new THREE.Vector3() },
				uBoxHalfSize: { value: new THREE.Vector3(1, 1, 1) },
				uTime: { value: 0 },
				uSampleCount: { value: values.sampleCount },
				uNearDistance: { value: values.nearDistance },
				uFarDistance: { value: values.farDistance },
				uRodRadius: { value: values.rodRadius },
				uCoreIntensity: { value: values.coreIntensity },
				uGlowIntensity: { value: values.glowIntensity },
				uGlowFalloff: { value: values.glowFalloff },
				uAbsorption: { value: values.absorption },
				uReflectivity: { value: values.reflectivity },
				uExposure: { value: values.exposure },
				uColorX: { value: new THREE.Color(values.colorX) },
				uColorY: { value: new THREE.Color(values.colorY) },
				uColorZ: { value: new THREE.Color(values.colorZ) },
				uSingleColor: { value: values.singleColor },
				uFresnelEnabled: { value: values.fresnelEnabled },
				uFresnelPower: { value: values.fresnelPower },
				uDebugMode: { value: values.debugMode },
			},
		});
	}

	setParameter(name, value) {
		const uniform = this.uniforms[`u${name[0].toUpperCase()}${name.slice(1)}`];
		if (!uniform) return;
		if (uniform.value?.isColor) uniform.value.set(value);
		else uniform.value = value;
	}
}
