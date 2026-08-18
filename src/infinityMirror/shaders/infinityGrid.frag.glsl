#define MAX_REFLECTIONS 24

uniform vec3 uCameraLocal;
uniform vec3 uBoxHalfSize;
uniform float uTime;
uniform int uSampleCount;
uniform float uDepth;
uniform float uBarRadius;
uniform float uIntensity;
uniform float uGlow;
uniform float uDecay;
uniform float uExposure;
uniform vec3 uBarColor;

varying vec3 vLocalPosition;
varying vec3 vLocalNormal;

float distanceToCellBoundary(float coordinate, float halfSize) {
	float cellSize = halfSize * 2.0;
	float cellPosition = fract((coordinate + halfSize) / cellSize);
	return min(cellPosition, 1.0 - cellPosition) * cellSize;
}

float distanceToEdgeOnPlane(vec3 point, int axis) {
	vec3 boundaryDistance = vec3(
		distanceToCellBoundary(point.x, uBoxHalfSize.x),
		distanceToCellBoundary(point.y, uBoxHalfSize.y),
		distanceToCellBoundary(point.z, uBoxHalfSize.z)
	);
	if (axis == 0) return min(boundaryDistance.y, boundaryDistance.z);
	if (axis == 1) return min(boundaryDistance.x, boundaryDistance.z);
	return min(boundaryDistance.x, boundaryDistance.y);
}

float outerCubeEdgeDistance(vec3 point) {
	vec3 wall = max(uBoxHalfSize - abs(point), 0.0);
	return min(length(wall.yz), min(length(wall.xz), length(wall.xy)));
}

float lightBar(float edgeDistance, float antialiasWidth) {
	float core = 1.0 - smoothstep(uBarRadius - antialiasWidth, uBarRadius + antialiasWidth, edgeDistance);
	float halo = exp(-max(edgeDistance - uBarRadius, 0.0) * 24.0);
	return core * uIntensity + halo * uGlow;
}

void main() {
	vec3 rayDirection = normalize(vLocalPosition - uCameraLocal);
	vec3 rayStart = vLocalPosition + rayDirection * 0.001;
	vec3 cellSize = uBoxHalfSize * 2.0;

	// Voxel DDA: jump directly from one virtual mirror plane to the next.
	// At every plane crossing, proximity to either perpendicular plane forms
	// one of the twelve luminous edges of that repeated cube.
	vec3 directionSign = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), rayDirection));
	vec3 safeDirection = directionSign * max(abs(rayDirection), vec3(0.00001));
	vec3 cellCoordinate = (rayStart + uBoxHalfSize) / cellSize;
	vec3 nextBoundaryIndex = floor(cellCoordinate) + step(vec3(0.0), rayDirection);
	vec3 nextBoundary = nextBoundaryIndex * cellSize - uBoxHalfSize;
	vec3 nextDistance = max((nextBoundary - rayStart) / safeDirection, vec3(0.0));
	vec3 distanceStep = cellSize / abs(safeDirection);

	float accumulatedLight = 0.0;
	float entryAA = max(fwidth(outerCubeEdgeDistance(vLocalPosition)), 0.0005);
	accumulatedLight += lightBar(outerCubeEdgeDistance(vLocalPosition), entryAA) * 1.25;

	for (int i = 0; i < MAX_REFLECTIONS; i++) {
		if (i >= uSampleCount) break;

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

		if (travelDistance > uDepth) break;
		vec3 crossingPoint = rayStart + rayDirection * travelDistance;
		float edgeDistance = distanceToEdgeOnPlane(crossingPoint, crossedAxis);
		float aa = max(length(fwidth(crossingPoint)) * 0.7, 0.0007);
		float distanceFade = exp(-travelDistance * uDecay);
		accumulatedLight += lightBar(edgeDistance, aa) * distanceFade;
	}

	vec3 color = 1.0 - exp(-uBarColor * accumulatedLight * uExposure);
	vec3 viewDirection = normalize(uCameraLocal - vLocalPosition);
	float glass = pow(1.0 - abs(dot(viewDirection, normalize(vLocalNormal))), 4.0);
	color += vec3(0.012, 0.022, 0.028) * (0.2 + glass * 0.8);
	gl_FragColor = vec4(color, 1.0);
}
