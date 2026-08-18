import * as THREE from 'three';
import { PULSE_WAVE_DEFAULTS } from '../shader/pulseWaveCore.js';
import { createWhiteGridParticleData, WHITE_GRID_PARTICLE_COUNT } from './WhiteGridParticles.js';

// WebGL/PBR counterparts of the TSL presets exposed by the shader editor.
// Keep the ids in sync with src/shader/presets.js.
export const GAME_MATERIAL_PRESETS = [
	{ id: 'spherical-waves', name: 'Spherical Waves' },
	{ id: 'directional-stripes', name: 'Directional Stripes' },
	{ id: 'grid-3d', name: '3D Grid' },
	{ id: 'repeated-spheres', name: 'Repeated Spheres' },
	{ id: 'repeated-boxes', name: 'Repeated Boxes' },
	{ id: 'pulse-wave-train', name: 'Pulse Wave Train' },
	{ id: 'white-grid', name: 'White Grid' },
	{ id: 'white-grid-particles', name: 'White Grid Particles' },
	{ id: 'volumetric-cloud-grid', name: 'Volumetric Cloud Grid' },
];

const PRESET_INDEX = new Map(GAME_MATERIAL_PRESETS.map((preset, index) => [preset.id, index]));

const VERTEX_DECLARATIONS = /* glsl */ `
	attribute vec3 _uvw;
	varying vec3 vPuzzlePosition;
	varying vec3 vPuzzleUVW;
	varying vec3 vPuzzleLocalPosition;
	varying vec3 vPuzzleLocalNormal;
`;

const FRAGMENT_DECLARATIONS = /* glsl */ `
	uniform float uPuzzleTime;
	uniform float uPuzzlePulseTime;
	uniform vec3 uPuzzlePulseOrigin;
	uniform int uPuzzlePreset;
	uniform vec3 uPuzzleCameraLocal;
	uniform vec3 uPuzzleGridOrigin;
	uniform float uPuzzleVoxelSize;
	uniform vec3 uPuzzleBarColor;
	uniform sampler2D uPuzzlePieceMap;
	uniform float uPuzzleGridSize;
	uniform float uPuzzlePieceToken;
	uniform vec3 uPuzzleLocalToUVW;
	uniform vec3 uPuzzleVolumeColor;
	uniform float uPuzzleVolumeDensity;
	uniform float uPuzzleVolumeScale;
	uniform float uPuzzleVolumeSpeed;
	uniform int uPuzzleVolumeSteps;
	uniform vec4 uPuzzleParticles[${WHITE_GRID_PARTICLE_COUNT}];
	varying vec3 vPuzzlePosition;
	varying vec3 vPuzzleUVW;
	varying vec3 vPuzzleLocalPosition;
	varying vec3 vPuzzleLocalNormal;

	float puzzleDistanceToBoundary(float coordinate, float origin) {
		float cellPosition = fract((coordinate - origin) / uPuzzleVoxelSize);
		return min(cellPosition, 1.0 - cellPosition) * uPuzzleVoxelSize;
	}

	float puzzleGridEdgeDistance(vec3 point, int axis) {
		vec3 boundaryDistance = vec3(
			puzzleDistanceToBoundary(point.x, uPuzzleGridOrigin.x),
			puzzleDistanceToBoundary(point.y, uPuzzleGridOrigin.y),
			puzzleDistanceToBoundary(point.z, uPuzzleGridOrigin.z)
		);
		if (axis == 0) return min(boundaryDistance.y, boundaryDistance.z);
		if (axis == 1) return min(boundaryDistance.x, boundaryDistance.z);
		return min(boundaryDistance.x, boundaryDistance.y);
	}

	float puzzleWhiteGrid(vec3 localPosition) {
		vec3 rayDirection = normalize(localPosition - uPuzzleCameraLocal);
		vec3 rayStart = localPosition + rayDirection * 0.0001;
		vec3 cellSize = vec3(max(uPuzzleVoxelSize, 0.0001));
		vec3 directionSign = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), rayDirection));
		vec3 safeDirection = directionSign * max(abs(rayDirection), vec3(0.00001));
		vec3 cellCoordinate = (rayStart - uPuzzleGridOrigin) / cellSize;
		vec3 nextBoundaryIndex = floor(cellCoordinate) + step(vec3(0.0), rayDirection);
		vec3 nextBoundary = uPuzzleGridOrigin + nextBoundaryIndex * cellSize;
		vec3 nextDistance = max((nextBoundary - rayStart) / safeDirection, vec3(0.0));
		vec3 distanceStep = cellSize / abs(safeDirection);
		float barRadius = max(uPuzzleVoxelSize * 0.028, 0.00035);
		float accumulated = 0.0;

		for (int i = 0; i < 16; i++) {
			float travelDistance;
			int crossedAxis;
			if (nextDistance.x < nextDistance.y && nextDistance.x < nextDistance.z) {
				travelDistance = nextDistance.x;
				crossedAxis = 0;
				nextDistance.x += distanceStep.x;
			} else if (nextDistance.y < nextDistance.z) {
				travelDistance = nextDistance.y;
				crossedAxis = 1;
				nextDistance.y += distanceStep.y;
			} else {
				travelDistance = nextDistance.z;
				crossedAxis = 2;
				nextDistance.z += distanceStep.z;
			}
			float edgeDistance = puzzleGridEdgeDistance(rayStart + rayDirection * travelDistance, crossedAxis);
			float aa = clamp(fwidth(edgeDistance), barRadius * 0.08, barRadius * 0.7);
			float core = 1.0 - smoothstep(barRadius - aa, barRadius + aa, edgeDistance);
			float halo = exp(-max(edgeDistance - barRadius, 0.0) / max(barRadius * 1.25, 0.0001));
			float reflectionFade = pow(0.8, float(i));
			accumulated += (core * 0.82 + halo * 0.045) * exp(-travelDistance * 6.0) * reflectionFade;
		}
		return accumulated;
	}

	float puzzlePieceOwner(vec3 uvw) {
		if (any(lessThan(uvw, vec3(0.0))) || any(greaterThanEqual(uvw, vec3(1.0)))) return 0.0;
		vec3 cell = floor(clamp(uvw, vec3(0.0), vec3(0.999999)) * uPuzzleGridSize);
		float mapX = cell.x + cell.z * uPuzzleGridSize;
		vec2 mapSize = vec2(uPuzzleGridSize * uPuzzleGridSize, uPuzzleGridSize);
		vec2 encoded = floor(texture2D(uPuzzlePieceMap, (vec2(mapX, cell.y) + 0.5) / mapSize).rg * 255.0 + 0.5);
		return encoded.x + encoded.y * 256.0;
	}

	float puzzleHash31(vec3 point) {
		point = fract(point * 0.1031);
		point += dot(point, point.yzx + 33.33);
		return fract((point.x + point.y) * point.z);
	}

	float puzzleValueNoise(vec3 point) {
		vec3 cell = floor(point);
		vec3 local = fract(point);
		local = local * local * (3.0 - 2.0 * local);
		float n000 = puzzleHash31(cell);
		float n100 = puzzleHash31(cell + vec3(1.0, 0.0, 0.0));
		float n010 = puzzleHash31(cell + vec3(0.0, 1.0, 0.0));
		float n110 = puzzleHash31(cell + vec3(1.0, 1.0, 0.0));
		float n001 = puzzleHash31(cell + vec3(0.0, 0.0, 1.0));
		float n101 = puzzleHash31(cell + vec3(1.0, 0.0, 1.0));
		float n011 = puzzleHash31(cell + vec3(0.0, 1.0, 1.0));
		float n111 = puzzleHash31(cell + vec3(1.0));
		float z0 = mix(mix(n000, n100, local.x), mix(n010, n110, local.x), local.y);
		float z1 = mix(mix(n001, n101, local.x), mix(n011, n111, local.x), local.y);
		return mix(z0, z1, local.z);
	}

	float puzzleCloudDensity(vec3 uvw, float time) {
		vec3 drift = vec3(0.71, 0.31, -0.47) * time * uPuzzleVolumeSpeed;
		vec3 point = uvw * uPuzzleVolumeScale + drift;
		float noiseValue = puzzleValueNoise(point) * 0.68;
		noiseValue += puzzleValueNoise(point * 2.03 + vec3(7.1, 3.7, 1.9)) * 0.32;
		return smoothstep(0.34, 0.76, noiseValue);
	}

	float puzzleRayCubeExit(vec3 start, vec3 direction) {
		vec3 directionSign = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), direction));
		vec3 safeDirection = directionSign * max(abs(direction), vec3(0.00001));
		vec3 farBoundary = mix(vec3(0.0), vec3(1.0), step(vec3(0.0), direction));
		vec3 travel = (farBoundary - start) / safeDirection;
		return max(min(travel.x, min(travel.y, travel.z)), 0.0);
	}

	float puzzleFiniteWhiteGrid(vec3 localPosition, vec3 uvw) {
		vec3 localRay = normalize(localPosition - uPuzzleCameraLocal);
		vec3 rayStart = localPosition + localRay * 0.0001;
		vec3 uvwStart = uvw + localRay * uPuzzleLocalToUVW * 0.0001;
		vec3 cellSize = vec3(max(uPuzzleVoxelSize, 0.0001));
		vec3 directionSign = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), localRay));
		vec3 safeDirection = directionSign * max(abs(localRay), vec3(0.00001));
		vec3 cellCoordinate = (rayStart - uPuzzleGridOrigin) / cellSize;
		vec3 nextBoundaryIndex = floor(cellCoordinate) + step(vec3(0.0), localRay);
		vec3 nextBoundary = uPuzzleGridOrigin + nextBoundaryIndex * cellSize;
		vec3 nextDistance = max((nextBoundary - rayStart) / safeDirection, vec3(0.0));
		vec3 distanceStep = cellSize / abs(safeDirection);
		float rayExit = puzzleRayCubeExit(uvwStart, localRay * uPuzzleLocalToUVW);
		float barRadius = max(uPuzzleVoxelSize * 0.028, 0.00035);
		float accumulated = 0.0;

		for (int i = 0; i < 16; i++) {
			float travelDistance;
			int crossedAxis;
			if (nextDistance.x < nextDistance.y && nextDistance.x < nextDistance.z) {
				travelDistance = nextDistance.x; crossedAxis = 0; nextDistance.x += distanceStep.x;
			} else if (nextDistance.y < nextDistance.z) {
				travelDistance = nextDistance.y; crossedAxis = 1; nextDistance.y += distanceStep.y;
			} else {
				travelDistance = nextDistance.z; crossedAxis = 2; nextDistance.z += distanceStep.z;
			}
			if (travelDistance >= rayExit) break;
			vec3 crossingUVW = uvwStart + localRay * uPuzzleLocalToUVW * travelDistance;
			vec3 ownershipOffset = localRay * uPuzzleLocalToUVW * 0.0002;
			bool ownedBefore = abs(puzzlePieceOwner(crossingUVW - ownershipOffset) - uPuzzlePieceToken) <= 0.25;
			bool ownedAfter = abs(puzzlePieceOwner(crossingUVW + ownershipOffset) - uPuzzlePieceToken) <= 0.25;
			if (!ownedBefore && !ownedAfter) break;
			float edgeDistance = puzzleGridEdgeDistance(rayStart + localRay * travelDistance, crossedAxis);
			// A wider analytic footprint prevents sub-pixel bars from alternating
			// between fully on/off at the grazing angles common in a headset.
			float aa = max(fwidth(edgeDistance) * 1.5, barRadius * 0.38);
			float core = 1.0 - smoothstep(barRadius - aa, barRadius + aa, edgeDistance);
			float halo = exp(-max(edgeDistance - barRadius, 0.0) / max(barRadius * 1.25, 0.0001));
			accumulated += (core * 0.68 + halo * 0.032) * exp(-travelDistance * 3.0);
			if (!ownedAfter) break;
		}
		// Compress coincident/near-coincident crossings instead of letting a
		// precision spike turn into a white additive pixel.
		return 1.0 - exp(-accumulated);
	}

	vec3 puzzleVolumetricCloudGrid(vec3 localPosition, vec3 uvw, float time) {
		vec3 localRay = normalize(localPosition - uPuzzleCameraLocal);
		vec3 uvwDirection = localRay * uPuzzleLocalToUVW;
		vec3 rayStart = uvw + uvwDirection * 0.0002;
		// FrontSide normally guarantees an entry surface, but snapped pieces can
		// retain coincident contact faces. Ownership makes the decision stable.
		if (abs(puzzlePieceOwner(rayStart) - uPuzzlePieceToken) > 0.25) return vec3(0.0);
		float rayLength = puzzleRayCubeExit(rayStart, uvwDirection);
		float stepLength = rayLength / max(float(uPuzzleVolumeSteps), 1.0);
		float opticalDepth = 0.0;
		for (int i = 0; i < 16; i++) {
			if (i >= uPuzzleVolumeSteps) break;
			float travel = (float(i) + 0.5) * stepLength;
			vec3 samplePoint = rayStart + uvwDirection * travel;
			if (abs(puzzlePieceOwner(samplePoint) - uPuzzlePieceToken) > 0.25) break;
			opticalDepth += puzzleCloudDensity(samplePoint, time) * stepLength;
		}
		// Avoid early saturation: it was turning each entry face into a hard,
		// almost constant-color sheet when several transparent pieces overlapped.
		float cloud = 1.0 - exp(-opticalDepth * uPuzzleVolumeDensity * 4.0);
		float facing = clamp(dot(normalize(vPuzzleLocalNormal), -localRay), 0.0, 1.0);
		float grazingFade = smoothstep(0.035, 0.24, facing);
		vec3 grid = uPuzzleBarColor * puzzleFiniteWhiteGrid(localPosition, uvw) * grazingFade;
		return grid + uPuzzleVolumeColor * cloud * mix(0.18, 0.72, grazingFade);
	}

	vec3 puzzleWhiteGridParticles(vec3 localPosition, vec3 uvw, float time) {
		vec3 localRay = normalize(localPosition - uPuzzleCameraLocal);
		vec3 rayDirection = normalize(localRay * uPuzzleLocalToUVW);
		vec3 rayStart = uvw + rayDirection * 0.00015;
		vec3 result = uPuzzleBarColor * puzzleWhiteGrid(localPosition) * 1.05;
		for (int i = 0; i < ${WHITE_GRID_PARTICLE_COUNT}; i++) {
			vec3 center = uPuzzleParticles[i].xyz;
			float radius = uPuzzleParticles[i].w;
			vec3 offset = rayStart - center;
			float projected = dot(offset, rayDirection);
			float discriminant = projected * projected - dot(offset, offset) + radius * radius;
			if (discriminant <= 0.0) continue;
			float root = sqrt(discriminant);
			float entryTravel = max(-projected - root, 0.0001);
			float exitTravel = -projected + root;
			if (exitTravel <= entryTravel || entryTravel > 1.75) continue;
			float travel = -1.0;
			for (int sampleIndex = 0; sampleIndex < 7; sampleIndex++) {
				float sampleRatio = (float(sampleIndex) + 0.35) / 7.0;
				float sampleTravel = mix(entryTravel, exitTravel, sampleRatio);
				vec3 samplePoint = rayStart + rayDirection * sampleTravel;
				if (travel < 0.0 && abs(puzzlePieceOwner(samplePoint) - uPuzzlePieceToken) <= 0.25) travel = sampleTravel;
			}
			if (travel < 0.0) continue;
			vec3 hitPoint = rayStart + rayDirection * travel;
			vec3 normal = normalize(hitPoint - center);
			float facing = max(dot(normal, -rayDirection), 0.0);
			float fresnel = pow(1.0 - facing, 2.5);
			float depthFade = exp(-travel * 3.5);
			float pulse = 0.84 + 0.16 * sin(time * (2.1 + float(i) * 0.37) + float(i) * 1.7);
			float identityVariation = 0.88 + float(i) * 0.07;
			result += uPuzzleBarColor * identityVariation * (0.75 + facing * 1.15 + fresnel * 1.8) * depthFade * pulse;
		}
		return result;
	}

	vec3 puzzleSRGBToLinear(vec3 value) {
		vec3 lower = value / 12.92;
		vec3 higher = pow((value + 0.055) / 1.055, vec3(2.4));
		return mix(lower, higher, step(vec3(0.04045), value));
	}

	float puzzleBand(float signal, float width, float softness) {
		float edge = softness + fwidth(signal);
		return 1.0 - smoothstep(width, width + edge, abs(signal));
	}

	vec3 puzzleRepeat(vec3 point, vec3 period, vec3 drift) {
		return mod(point + drift + period * 0.5, period) - period * 0.5;
	}

	float puzzleSdfFill(float distanceValue, float softness) {
		return 1.0 - smoothstep(0.0, softness + fwidth(distanceValue), distanceValue);
	}

	float puzzleSdBox(vec3 point, vec3 halfSize) {
		vec3 delta = abs(point) - halfSize;
		float outside = length(max(delta, vec3(0.0)));
		float inside = min(max(delta.x, max(delta.y, delta.z)), 0.0);
		return outside + inside;
	}

	vec3 puzzleSphericalWaves(vec3 position, float time) {
		vec3 background = puzzleSRGBToLinear(vec3(0.027, 0.082, 0.133));
		vec3 result = background;
		vec3 p0 = vec3(-0.45, 0.15, 0.10);
		vec3 p1 = vec3( 0.38,-0.25, 0.25);
		vec3 p2 = vec3( 0.08, 0.42,-0.35);
		float i0 = puzzleBand(sin(distance(position, p0) * 9.0  - time * 2.2),       0.20, 0.08);
		float i1 = puzzleBand(sin(distance(position, p1) * 11.0 - time * 1.7 + 1.2), 0.20, 0.08);
		float i2 = puzzleBand(sin(distance(position, p2) * 8.0  - time * 2.6 + 2.4), 0.20, 0.08);
		result += puzzleSRGBToLinear(vec3(1.000, 0.404, 0.373)) * i0;
		result += puzzleSRGBToLinear(vec3(0.345, 0.851, 1.000)) * i1;
		result += puzzleSRGBToLinear(vec3(0.831, 0.475, 1.000)) * i2;
		return clamp(result, 0.0, 1.0);
	}

	vec3 puzzleDirectionalStripes(vec3 position, float time) {
		vec3 direction = normalize(vec3(1.0, 0.45, 0.2));
		float phase = dot(position, direction) * 8.0 - time * 1.7;
		float band = puzzleBand(sin(phase), 0.20, 0.07);
		return mix(
			puzzleSRGBToLinear(vec3(0.145, 0.067, 0.286)),
			puzzleSRGBToLinear(vec3(1.000, 0.706, 0.361)),
			band
		);
	}

	vec3 puzzleGrid3D(vec3 position, float time) {
		vec3 phase = position * vec3(3.0) * 3.14159265 + vec3(1.0, 0.63, 1.37) * time * 0.13;
		float xLine = puzzleBand(sin(phase.x), 0.08, 0.025);
		float yLine = puzzleBand(sin(phase.y), 0.08, 0.025);
		float zLine = puzzleBand(sin(phase.z), 0.08, 0.025);
		float lineValue = max(min(xLine, yLine), max(min(yLine, zLine), min(zLine, xLine)));
		float pulse = sin(time * 1.4) * 0.15 + 0.85;
		return mix(
			puzzleSRGBToLinear(vec3(0.027, 0.067, 0.118)),
			puzzleSRGBToLinear(vec3(0.404, 0.910, 1.000)) * pulse,
			lineValue
		);
	}

	vec3 puzzleRepeatedSpheres(vec3 position, float time) {
		vec3 repeated = puzzleRepeat(position, vec3(0.8), vec3(0.71, 0.43, 0.29) * time * 0.08);
		float radius = 0.28 + sin(time * 1.8) * 0.05;
		float mask = puzzleSdfFill(length(repeated) - radius, 0.04);
		return mix(
			puzzleSRGBToLinear(vec3(0.063, 0.086, 0.184)),
			puzzleSRGBToLinear(vec3(1.000, 0.373, 0.569)),
			mask
		);
	}

	vec3 puzzleRepeatedBoxes(vec3 position, float time) {
		vec3 repeated = puzzleRepeat(position, vec3(0.9), vec3(0.31, 0.67, 0.47) * time * 0.09);
		float pulse = sin(time * 1.3) * 0.12 + 1.0;
		float mask = puzzleSdfFill(puzzleSdBox(repeated, vec3(0.23, 0.17, 0.28) * pulse), 0.035);
		return mix(
			puzzleSRGBToLinear(vec3(0.071, 0.129, 0.118)),
			puzzleSRGBToLinear(vec3(0.557, 0.882, 0.518)),
			mask
		);
	}

	float puzzlePulseWaveIntensity(vec3 uvw, float pulseTime) {
		const float propagationSpeed = ${PULSE_WAVE_DEFAULTS.propagationSpeed.toFixed(8)};
		const float pulseInterval = ${PULSE_WAVE_DEFAULTS.pulseInterval.toFixed(8)};
		const float trainDuration = ${PULSE_WAVE_DEFAULTS.trainDuration.toFixed(8)};
		const float cycles = ${PULSE_WAVE_DEFAULTS.cycles.toFixed(8)};
		float localTime = pulseTime - distance(uvw, uPuzzlePulseOrigin) / propagationSpeed;
		if (localTime < 0.0) return 0.0;
		float pulseAge = mod(localTime, max(pulseInterval, trainDuration + 0.05));
		if (pulseAge > trainDuration) return 0.0;
		float normalizedAge = clamp(pulseAge / trainDuration, 0.0, 1.0);
		float band = puzzleBand(sin(normalizedAge * cycles * 3.14159265), ${PULSE_WAVE_DEFAULTS.bandWidth.toFixed(8)}, ${PULSE_WAVE_DEFAULTS.softness.toFixed(8)});
		float remaining = 1.0 - normalizedAge;
		return band * remaining * remaining;
	}

	vec3 puzzlePulseWaveTrain(vec3 uvw, float pulseTime) {
		vec3 chrome = puzzleSRGBToLinear(vec3(0.682, 0.725, 0.780));
		vec3 wave = puzzleSRGBToLinear(vec3(0.208, 0.867, 1.000));
		return mix(chrome, wave, puzzlePulseWaveIntensity(uvw, pulseTime));
	}

	vec3 puzzlePulseWaveEmission(vec3 uvw, float pulseTime) {
		vec3 wave = puzzleSRGBToLinear(vec3(0.208, 0.867, 1.000));
		return wave * puzzlePulseWaveIntensity(uvw, pulseTime) * ${PULSE_WAVE_DEFAULTS.emission.toFixed(8)};
	}

	vec3 puzzlePresetColor(vec3 position, vec3 uvw, float time, float pulseTime) {
		if (uPuzzlePreset == 6 || uPuzzlePreset == 7) return vec3(0.003, 0.006, 0.009);
		if (uPuzzlePreset == 8) return vec3(0.0);
		if (uPuzzlePreset == 1) return puzzleDirectionalStripes(position, time);
		if (uPuzzlePreset == 2) return puzzleGrid3D(position, time);
		if (uPuzzlePreset == 3) return puzzleRepeatedSpheres(position, time);
		if (uPuzzlePreset == 4) return puzzleRepeatedBoxes(position, time);
		if (uPuzzlePreset == 5) return puzzlePulseWaveTrain(uvw, pulseTime);
		return puzzleSphericalWaves(position, time);
	}

	vec3 puzzlePresetEmission(vec3 localPosition, vec3 uvw, float time, float pulseTime) {
		if (uPuzzlePreset == 6) return uPuzzleBarColor * puzzleWhiteGrid(localPosition) * 1.15;
		if (uPuzzlePreset == 7) return puzzleWhiteGridParticles(localPosition, uvw, time);
		if (uPuzzlePreset == 8) return puzzleVolumetricCloudGrid(localPosition, uvw, time);
		return uPuzzlePreset == 5 ? puzzlePulseWaveEmission(uvw, pulseTime) : vec3(0.0);
	}
`;

function applyPresetProfile(material) {
	const pulse = material.userData.puzzlePreset === 'pulse-wave-train';
	const volume = material.userData.puzzlePreset === 'volumetric-cloud-grid';
	const assets = material.userData.pulseWaveAssets;
	material.metalness = volume ? 0 : (pulse ? 0.97 : material.userData.defaultPbr.metalness);
	material.roughness = volume ? 1 : (pulse ? 0.17 : material.userData.defaultPbr.roughness);
	material.envMapIntensity = volume ? 0 : (pulse ? 3 : material.userData.defaultPbr.envMapIntensity);
	material.normalMap = pulse ? assets?.normalMap ?? null : null;
	material.normalScale.setScalar(pulse ? 0.12 : 1);
	material.roughnessMap = pulse ? assets?.roughnessMap ?? null : null;
	material.envMap = pulse ? assets?.environmentMap ?? null : null;
	material.transparent = volume;
	material.premultipliedAlpha = volume;
	material.depthWrite = !volume;
	material.side = volume ? THREE.FrontSide : THREE.DoubleSide;
	material.blending = volume
		? (material.userData.puzzleVolumeBlend === 'subtractive' ? THREE.SubtractiveBlending : THREE.AdditiveBlending)
		: THREE.NormalBlending;
	material.needsUpdate = true;
}

export function createGamePuzzleMaterial({ preset = 'spherical-waves', metalness = 0.9, roughness = 0.16, envMapIntensity = 2.2, pulseWaveAssets = null, pulseOrigin = new THREE.Vector3(0.5, 0.5, 0.5), barColor = '#b8edff', gridOrigin = new THREE.Vector3(), voxelSize = 0.1, pieceMap = null, gridSize = 1, pieceToken = 0, localToUVW = new THREE.Vector3(1, 1, 1), particleData = null, volumeColor = '#8edcff', volumeDensity = 0.62, volumeScale = 5.5, volumeSpeed = 0.12, volumeSteps = 10, volumeBlend = 'additive' } = {}) {
	const material = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		metalness,
		roughness,
		envMapIntensity,
		side: THREE.DoubleSide,
	});
	material.userData.puzzlePreset = preset;
	material.userData.puzzleShader = null;
	material.userData.defaultPbr = { metalness, roughness, envMapIntensity };
	material.userData.pulseWaveAssets = pulseWaveAssets;
	material.userData.puzzlePulseOrigin = pulseOrigin.clone();
	material.userData.puzzlePulseTime = 0;
	material.userData.puzzleCameraLocal = new THREE.Vector3();
	material.userData.puzzleCameraWorld = new THREE.Vector3();
	material.userData.puzzleGridOrigin = gridOrigin.clone();
	material.userData.puzzleVoxelSize = voxelSize;
	material.userData.puzzleBarColor = new THREE.Color(barColor);
	material.userData.puzzlePieceMap = pieceMap;
	material.userData.puzzleGridSize = gridSize;
	material.userData.puzzlePieceToken = pieceToken;
	material.userData.puzzleLocalToUVW = localToUVW.clone();
	material.userData.puzzleParticles = particleData || createWhiteGridParticleData();
	material.userData.puzzleVolumeColor = new THREE.Color(volumeColor);
	material.userData.puzzleVolumeDensity = volumeDensity;
	material.userData.puzzleVolumeScale = volumeScale;
	material.userData.puzzleVolumeSpeed = volumeSpeed;
	material.userData.puzzleVolumeSteps = volumeSteps;
	material.userData.puzzleVolumeBlend = volumeBlend;
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uPuzzleTime = { value: 0 };
		shader.uniforms.uPuzzlePulseTime = { value: material.userData.puzzlePulseTime };
		shader.uniforms.uPuzzlePulseOrigin = { value: material.userData.puzzlePulseOrigin };
		shader.uniforms.uPuzzlePreset = { value: PRESET_INDEX.get(material.userData.puzzlePreset) ?? 0 };
		shader.uniforms.uPuzzleCameraLocal = { value: material.userData.puzzleCameraLocal };
		shader.uniforms.uPuzzleGridOrigin = { value: material.userData.puzzleGridOrigin };
		shader.uniforms.uPuzzleVoxelSize = { value: material.userData.puzzleVoxelSize };
		shader.uniforms.uPuzzleBarColor = { value: material.userData.puzzleBarColor };
		shader.uniforms.uPuzzlePieceMap = { value: material.userData.puzzlePieceMap };
		shader.uniforms.uPuzzleGridSize = { value: material.userData.puzzleGridSize };
		shader.uniforms.uPuzzlePieceToken = { value: material.userData.puzzlePieceToken };
		shader.uniforms.uPuzzleLocalToUVW = { value: material.userData.puzzleLocalToUVW };
		shader.uniforms.uPuzzleParticles = { value: material.userData.puzzleParticles };
		shader.uniforms.uPuzzleVolumeColor = { value: material.userData.puzzleVolumeColor };
		shader.uniforms.uPuzzleVolumeDensity = { value: material.userData.puzzleVolumeDensity };
		shader.uniforms.uPuzzleVolumeScale = { value: material.userData.puzzleVolumeScale };
		shader.uniforms.uPuzzleVolumeSpeed = { value: material.userData.puzzleVolumeSpeed };
		shader.uniforms.uPuzzleVolumeSteps = { value: material.userData.puzzleVolumeSteps };
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', `#include <common>\n${VERTEX_DECLARATIONS}`)
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPuzzleUVW = _uvw;\n\tvPuzzlePosition = (_uvw - vec3(0.5)) * 2.0;\n\tvPuzzleLocalPosition = position;\n\tvPuzzleLocalNormal = normalize(objectNormal);');
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\n${FRAGMENT_DECLARATIONS}`)
			.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb = puzzlePresetColor(vPuzzlePosition, vPuzzleUVW, uPuzzleTime, uPuzzlePulseTime);')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += puzzlePresetEmission(vPuzzleLocalPosition, vPuzzleUVW, uPuzzleTime, uPuzzlePulseTime);');
		material.userData.puzzleShader = shader;
	};
	material.customProgramCacheKey = () => 'shaders-puzzle-pbr-v4';
	applyPresetProfile(material);
	return material;
}

export function setGameMaterialVolumeOptions(material, options = {}) {
	if (!material?.userData) return false;
	const shader = material.userData.puzzleShader;
	if (options.color != null) {
		material.userData.puzzleVolumeColor.set(options.color);
		if (shader) shader.uniforms.uPuzzleVolumeColor.value.copy(material.userData.puzzleVolumeColor);
	}
	for (const [option, uniform] of [['density', 'uPuzzleVolumeDensity'], ['scale', 'uPuzzleVolumeScale'], ['speed', 'uPuzzleVolumeSpeed']]) {
		if (options[option] == null) continue;
		material.userData[`puzzleVolume${option[0].toUpperCase()}${option.slice(1)}`] = options[option];
		if (shader) shader.uniforms[uniform].value = options[option];
	}
	if (options.steps != null) {
		material.userData.puzzleVolumeSteps = Math.max(4, Math.min(16, Math.round(options.steps)));
		if (shader) shader.uniforms.uPuzzleVolumeSteps.value = material.userData.puzzleVolumeSteps;
	}
	if (options.blend != null) {
		material.userData.puzzleVolumeBlend = options.blend;
		if (material.userData.puzzlePreset === 'volumetric-cloud-grid') {
			material.blending = options.blend === 'subtractive' ? THREE.SubtractiveBlending : THREE.AdditiveBlending;
		}
	}
	return true;
}

export function setGameMaterialCamera(material, object, camera) {
	if (!material?.userData?.puzzleCameraLocal || !object || !camera) return;
	camera.getWorldPosition(material.userData.puzzleCameraWorld);
	material.userData.puzzleCameraLocal.copy(material.userData.puzzleCameraWorld);
	object.worldToLocal(material.userData.puzzleCameraLocal);
}

export function setGameMaterialPreset(material, preset) {
	if (!material || !PRESET_INDEX.has(preset)) return false;
	material.userData.puzzlePreset = preset;
	applyPresetProfile(material);
	const shader = material.userData.puzzleShader;
	if (shader) shader.uniforms.uPuzzlePreset.value = PRESET_INDEX.get(preset);
	return true;
}

export function setGameMaterialTime(material, time, pulseTime = material?.userData?.puzzlePulseTime ?? 0) {
	if (material?.userData) material.userData.puzzlePulseTime = pulseTime;
	const shader = material?.userData?.puzzleShader;
	if (shader) {
		shader.uniforms.uPuzzleTime.value = time;
		shader.uniforms.uPuzzlePulseTime.value = pulseTime;
	}
}

export function setGameMaterialPulseOrigin(material, uvw) {
	if (!material?.userData || !uvw?.isVector3) return false;
	material.userData.puzzlePulseOrigin.copy(uvw);
	material.userData.puzzlePulseTime = 0;
	const shader = material.userData.puzzleShader;
	if (shader) {
		shader.uniforms.uPuzzlePulseOrigin.value.copy(uvw);
		shader.uniforms.uPuzzlePulseTime.value = 0;
	}
	return true;
}
