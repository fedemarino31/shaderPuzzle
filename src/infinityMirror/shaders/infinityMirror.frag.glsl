#define MAX_SAMPLES 16

uniform vec3 uCameraLocal;
uniform vec3 uBoxHalfSize;
uniform float uTime;
uniform int uSampleCount;
uniform float uNearDistance;
uniform float uFarDistance;
uniform float uRodRadius;
uniform float uCoreIntensity;
uniform float uGlowIntensity;
uniform float uGlowFalloff;
uniform float uAbsorption;
uniform float uReflectivity;
uniform float uExposure;
uniform vec3 uColorX;
uniform vec3 uColorY;
uniform vec3 uColorZ;
uniform bool uSingleColor;
uniform bool uFresnelEnabled;
uniform float uFresnelPower;
uniform int uDebugMode;

varying vec3 vLocalPosition;
varying vec3 vLocalNormal;

vec3 mirrorRepeat(vec3 p) {
	vec3 size = uBoxHalfSize * 2.0;
	vec3 cell = floor((p + uBoxHalfSize) / size);
	vec3 q = fract((p + uBoxHalfSize) / size);
	vec3 parity = mod(abs(cell), 2.0);
	q = mix(q, 1.0 - q, parity);
	return q * size - uBoxHalfSize;
}

vec3 virtualCell(vec3 p) {
	return floor((p + uBoxHalfSize) / (uBoxHalfSize * 2.0));
}

vec4 edgeData(vec3 p) {
	vec3 wall = max(uBoxHalfSize - abs(p), 0.0);
	float dx = length(wall.yz);
	float dy = length(wall.xz);
	float dz = length(wall.xy);
	float d = min(dx, min(dy, dz));
	vec3 weights = 1.0 - smoothstep(vec3(d), vec3(d + 0.015), vec3(dx, dy, dz));
	weights /= max(dot(weights, vec3(1.0)), 1.0);
	return vec4(weights, d);
}

vec3 axisColor(vec3 weights) {
	if (uSingleColor) return uColorX;
	return uColorX * weights.x + uColorY * weights.y + uColorZ * weights.z;
}

void main() {
	vec3 ro = uCameraLocal;
	vec3 rd = normalize(vLocalPosition - ro);
	vec3 rayStart = vLocalPosition + rd * 0.0005;
	vec3 accumulated = vec3(0.0);
	float attenuationDebug = 0.0;
	float edgeDebug = 0.0;
	float coreDebug = 0.0;
	float haloDebug = 0.0;

	for (int i = 0; i < MAX_SAMPLES; i++) {
		if (i >= uSampleCount) break;
		float fi = float(i) / max(float(uSampleCount - 1), 1.0);
		float distribution = fi * fi;
		float t = mix(uNearDistance, uFarDistance, distribution);
		vec3 p = rayStart + rd * t;
		vec3 q = mirrorRepeat(p);
		vec4 edge = edgeData(q);
		float aa = max(fwidth(edge.w), 0.00035);
		float core = 1.0 - smoothstep(uRodRadius - aa, uRodRadius + aa, edge.w);
		float halo = exp(-max(edge.w - uRodRadius, 0.0) * uGlowFalloff);
		vec3 cell = virtualCell(p);
		float bounces = dot(abs(cell), vec3(1.0));
		float attenuation = exp(-t * uAbsorption) * pow(uReflectivity, bounces);
		float emission = core * uCoreIntensity + halo * uGlowIntensity;
		accumulated += axisColor(edge.xyz) * emission * attenuation / float(uSampleCount);
		edgeDebug = max(edgeDebug, 1.0 - smoothstep(0.0, 0.2, edge.w));
		coreDebug = max(coreDebug, core);
		haloDebug = max(haloDebug, halo);
		attenuationDebug = max(attenuationDebug, attenuation);
	}

	vec3 color = 1.0 - exp(-accumulated * uExposure);
	if (uFresnelEnabled) {
		vec3 viewDir = normalize(ro - vLocalPosition);
		float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vLocalNormal))), uFresnelPower);
		color = mix(color, vec3(0.04, 0.09, 0.11), fresnel * 0.38);
	}

	if (uDebugMode == 1) color = vLocalPosition / (uBoxHalfSize * 2.0) + 0.5;
	if (uDebugMode == 2) color = mirrorRepeat(rayStart + rd * 2.0) / (uBoxHalfSize * 2.0) + 0.5;
	if (uDebugMode == 3) color = vec3(edgeDebug);
	if (uDebugMode == 4) color = vec3(coreDebug);
	if (uDebugMode == 5) color = vec3(haloDebug);
	if (uDebugMode == 6) color = vec3(attenuationDebug);
	if (uDebugMode == 7) {
		vec3 cell = virtualCell(rayStart + rd * uFarDistance * 0.5);
		color = 0.35 + 0.65 * sin(cell * vec3(1.7, 2.3, 2.9) + uTime * 0.1);
	}
	gl_FragColor = vec4(color, 1.0);
}
