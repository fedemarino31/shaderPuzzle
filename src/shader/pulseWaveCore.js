export const PULSE_WAVE_DEFAULTS = Object.freeze({
	propagationSpeed: 0.45,
	pulseInterval: 5,
	trainDuration: 2,
	cycles: 5,
	bandWidth: 0.22,
	softness: 0.12,
	emission: 1.2,
});

function smoothstep(edge0, edge1, value) {
	if (edge0 === edge1) return value < edge0 ? 0 : 1;
	const normalized = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return normalized * normalized * (3 - 2 * normalized);
}

export function evaluatePulseWaveTrain(distanceUVW, pulseTime, parameters = PULSE_WAVE_DEFAULTS) {
	const speed = Math.max(parameters.propagationSpeed, 0.0001);
	const duration = Math.max(parameters.trainDuration, 0.0001);
	const interval = Math.max(parameters.pulseInterval, duration + 0.05);
	const localTime = pulseTime - Math.max(0, distanceUVW) / speed;
	if (localTime < 0) return 0;
	const pulseAge = ((localTime % interval) + interval) % interval;
	if (pulseAge > duration) return 0;
	const normalizedAge = Math.max(0, Math.min(1, pulseAge / duration));
	const signal = Math.abs(Math.sin(normalizedAge * parameters.cycles * Math.PI));
	const band = 1 - smoothstep(parameters.bandWidth, parameters.bandWidth + parameters.softness, signal);
	const remaining = 1 - normalizedAge;
	return band * remaining * remaining;
}
