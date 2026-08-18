import * as THREE from 'three';
import vertexShader from './shaders/infinityMirror.vert.glsl?raw';
import fragmentShader from './shaders/infinityGrid.frag.glsl?raw';

const DEFAULTS = {
	sampleCount: 24,
	depth: 26,
	barRadius: 0.022,
	intensity: 1.8,
	glow: 0.34,
	decay: 0.085,
	exposure: 1.1,
	barColor: '#b8edff',
};

export class InfinityGridMaterial extends THREE.ShaderMaterial {
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
				uDepth: { value: values.depth },
				uBarRadius: { value: values.barRadius },
				uIntensity: { value: values.intensity },
				uGlow: { value: values.glow },
				uDecay: { value: values.decay },
				uExposure: { value: values.exposure },
				uBarColor: { value: new THREE.Color(values.barColor) },
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
