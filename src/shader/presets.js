import { clamp, distance, dot, max, min, mix, mod, oneMinus, select, sin, vec3 } from 'three/tsl';
import { animatedBand, repeat3, safeNormalize, sdBox, sdfFill, sdSphere } from './tslCommon.js';
import { PULSE_WAVE_DEFAULTS } from './pulseWaveCore.js';

const number = (label, minValue, maxValue, step = 0.01) => ({ type: 'number', label, min: minValue, max: maxValue, step });
const color = (label) => ({ type: 'color', label });
const vector = (label, minValue, maxValue, step = 0.01) => ({ type: 'vec3', label, min: minValue, max: maxValue, step });

function sphericalWaves({ position, time, params, sources }) {
	let additive = params.background;
	let nearestDistance = distance(position, sources[0].position).add(oneMinus(sources[0].enabled).mul(100000));
	let nearestColor = sources[0].color;
	let nearestIntensity = animatedBand(
		sin(distance(position, sources[0].position).mul(sources[0].frequency).sub(time.mul(sources[0].speed)).add(sources[0].phase)),
		params.bandWidth,
		params.softness
	);
	let nearestEnabled = sources[0].enabled;

	for (let i = 0; i < sources.length; i++) {
		const source = sources[i];
		const radialPhase = distance(position, source.position).mul(source.frequency).sub(time.mul(source.speed)).add(source.phase);
		const intensity = animatedBand(sin(radialPhase), params.bandWidth, params.softness).mul(source.enabled);
		additive = additive.add(source.color.mul(intensity));
		if (i === 0) continue;
		const candidateDistance = distance(position, source.position).add(oneMinus(source.enabled).mul(100000));
		const closer = candidateDistance.lessThan(nearestDistance);
		nearestDistance = select(closer, candidateDistance, nearestDistance);
		nearestColor = select(closer, source.color, nearestColor);
		nearestIntensity = select(closer, intensity, nearestIntensity);
		nearestEnabled = select(closer, source.enabled, nearestEnabled);
	}

	const additiveResult = clamp(additive, 0, 1);
	const nearestResult = mix(params.background, nearestColor, nearestIntensity.mul(nearestEnabled));
	return mix(additiveResult, nearestResult, params.blendMode);
}

function pulseWaveTrainIntensity({ uvw, pulseTime, params }) {
	const travelDelay = distance(uvw, params.origin).div(max(params.propagationSpeed, 0.0001));
	const localTime = pulseTime.sub(travelDelay);
	const effectiveInterval = max(params.pulseInterval, params.trainDuration.add(0.05));
	const pulseAge = mod(max(localTime, 0), effectiveInterval);
	const normalizedAge = pulseAge.div(max(params.trainDuration, 0.0001));
	const phase = normalizedAge.mul(params.cycles).mul(Math.PI);
	const band = animatedBand(sin(phase), params.bandWidth, params.softness);
	const remaining = oneMinus(clamp(normalizedAge, 0, 1));
	const envelope = remaining.mul(remaining);
	const active = localTime.greaterThanEqual(0).and(pulseAge.lessThanEqual(params.trainDuration));
	return select(active, band.mul(envelope), 0);
}

function pulseWaveTrainColor(context) {
	const intensity = pulseWaveTrainIntensity(context);
	return mix(context.params.baseColor, context.params.waveColor, intensity);
}

function pulseWaveTrainEmission(context) {
	return context.params.waveColor.mul(pulseWaveTrainIntensity(context)).mul(context.params.emission);
}

function directionalStripes({ position, time, params }) {
	const phase = dot(position, safeNormalize(params.direction)).mul(params.frequency).sub(time.mul(params.speed)).add(params.phase);
	const band = animatedBand(sin(phase), params.width, params.softness);
	return mix(params.background, params.foreground, band);
}

function grid3d({ position, time, params }) {
	const phase = position.mul(params.frequency).mul(Math.PI).add(vec3(1, 0.63, 1.37).mul(time.mul(params.speed)));
	const lineX = animatedBand(sin(phase.x), params.width, params.softness);
	const lineY = animatedBand(sin(phase.y), params.width, params.softness);
	const lineZ = animatedBand(sin(phase.z), params.width, params.softness);
	const line = max(min(lineX, lineY), max(min(lineY, lineZ), min(lineZ, lineX)));
	const pulse = sin(time.mul(params.pulseSpeed)).mul(0.15).add(0.85);
	return mix(params.background, params.foreground.mul(pulse), line);
}

function repeatedSpheres({ position, time, params }) {
	const drift = vec3(0.71, 0.43, 0.29).mul(time.mul(params.speed));
	const repeated = repeat3(position, params.period, drift);
	const radius = params.radius.add(sin(time.mul(params.pulseSpeed)).mul(params.pulseAmount));
	const mask = sdfFill(sdSphere(repeated, radius), params.softness);
	return mix(params.background, params.foreground, mask);
}

function repeatedBoxes({ position, time, params }) {
	const drift = vec3(0.31, 0.67, 0.47).mul(time.mul(params.speed));
	const repeated = repeat3(position, params.period, drift);
	const pulse = sin(time.mul(params.pulseSpeed)).mul(params.pulseAmount).add(1);
	const mask = sdfFill(sdBox(repeated, params.halfSize.mul(pulse)), params.softness);
	return mix(params.background, params.foreground, mask);
}

export const SHADER_PRESETS = [
	{
		id: 'spherical-waves', name: 'Spherical Waves', description: 'Animated colored wave fronts emitted by editable points in the UVW volume.',
		defaults: { background: '#071522', bandWidth: 0.2, softness: 0.08, blendMode: 'additive', sourceCount: 3 },
		controls: { background: color('Background'), bandWidth: number('Band width', 0.01, 0.95), softness: number('Softness', 0.001, 0.4, 0.005) },
		createColorNode: sphericalWaves,
	},
	{
		id: 'directional-stripes', name: 'Directional Stripes', description: 'Moving bands projected along an arbitrary three-dimensional direction.',
		defaults: { direction: { x: 1, y: 0.45, z: 0.2 }, frequency: 8, width: 0.2, softness: 0.07, speed: 1.7, phase: 0, foreground: '#ffb45c', background: '#251149' },
		controls: { direction: vector('Direction', -1, 1), frequency: number('Frequency', 0.1, 30, 0.1), width: number('Band width', 0.01, 0.95), softness: number('Softness', 0.001, 0.4, 0.005), speed: number('Speed', -5, 5), phase: number('Phase', -6.28, 6.28), foreground: color('Stripe color'), background: color('Background') },
		createColorNode: directionalStripes,
	},
	{
		id: 'grid-3d', name: '3D Grid', description: 'A repeating animated lattice built from three perpendicular coordinate families.',
		defaults: { frequency: { x: 3, y: 3, z: 3 }, width: 0.08, softness: 0.025, speed: 0.13, pulseSpeed: 1.4, foreground: '#67e8ff', background: '#07111e' },
		controls: { frequency: vector('Frequency', 0.2, 12, 0.1), width: number('Line width', 0.005, 0.3, 0.005), softness: number('Softness', 0.001, 0.2, 0.005), speed: number('Travel speed', -2, 2), pulseSpeed: number('Pulse speed', 0, 6), foreground: color('Grid color'), background: color('Background') },
		createColorNode: grid3d,
	},
	{
		id: 'repeated-spheres', name: 'Repeated Spheres', description: 'A modulo-repeated SDF sphere field with animated drift and radius.',
		defaults: { period: { x: 0.8, y: 0.8, z: 0.8 }, radius: 0.28, softness: 0.04, speed: 0.08, pulseSpeed: 1.8, pulseAmount: 0.05, foreground: '#ff5f91', background: '#10162f' },
		controls: { period: vector('Repeat size', 0.1, 3, 0.05), radius: number('Radius', 0.02, 1), softness: number('Softness', 0.001, 0.3, 0.005), speed: number('Drift speed', -1, 1), pulseSpeed: number('Pulse speed', 0, 8), pulseAmount: number('Pulse amount', 0, 0.4), foreground: color('Sphere color'), background: color('Background') },
		createColorNode: repeatedSpheres,
	},
	{
		id: 'repeated-boxes', name: 'Repeated Boxes', description: 'A modulo-repeated box SDF with independent dimensions and animated motion.',
		defaults: { period: { x: 0.9, y: 0.9, z: 0.9 }, halfSize: { x: 0.23, y: 0.17, z: 0.28 }, softness: 0.035, speed: 0.09, pulseSpeed: 1.3, pulseAmount: 0.12, foreground: '#8ee184', background: '#12211e' },
		controls: { period: vector('Repeat size', 0.1, 3, 0.05), halfSize: vector('Half size', 0.01, 0.8, 0.01), softness: number('Softness', 0.001, 0.3, 0.005), speed: number('Drift speed', -1, 1), pulseSpeed: number('Pulse speed', 0, 8), pulseAmount: number('Pulse amount', 0, 0.5), foreground: color('Box color'), background: color('Background') },
		createColorNode: repeatedBoxes,
	},
	{
		id: 'pulse-wave-train', name: 'Pulse Wave Train', description: 'A repeating soft spherical pulse with a quadratic-decay wave train in canonical UVW space.',
		defaults: {
			origin: { x: 0.5, y: 0.5, z: 0.5 }, baseColor: '#aeb9c7', waveColor: '#35ddff',
			...PULSE_WAVE_DEFAULTS,
		},
		controls: {
			origin: vector('Origin UVW', 0, 1, 0.01), baseColor: color('Chrome color'), waveColor: color('Wave color'),
			propagationSpeed: number('Propagation speed', 0.05, 2, 0.01), pulseInterval: number('Pulse interval', 0.25, 15, 0.05),
			trainDuration: number('Train duration', 0.1, 10, 0.05), cycles: number('Cycle count', 1, 12, 1),
			bandWidth: number('Band width', 0.01, 0.9, 0.01), softness: number('Soft edge', 0.005, 0.5, 0.005),
			emission: number('Emission', 0, 3, 0.05),
		},
		createColorNode: pulseWaveTrainColor,
		createEmissionNode: pulseWaveTrainEmission,
	},
];

export const PRESET_BY_ID = new Map(SHADER_PRESETS.map((preset) => [preset.id, preset]));

export function createDefaultSources() {
	return [
		{ enabled: true, position: { x: -0.45, y: 0.15, z: 0.1 }, color: '#ff675f', frequency: 9, speed: 2.2, phase: 0 },
		{ enabled: true, position: { x: 0.38, y: -0.25, z: 0.25 }, color: '#58d9ff', frequency: 11, speed: 1.7, phase: 1.2 },
		{ enabled: true, position: { x: 0.08, y: 0.42, z: -0.35 }, color: '#d479ff', frequency: 8, speed: 2.6, phase: 2.4 },
		{ enabled: true, position: { x: 0.2, y: -0.1, z: -0.5 }, color: '#ffe06a', frequency: 10, speed: 2, phase: 0.5 },
	];
}
