import { abs, fwidth, length, max, min, mod, oneMinus, smoothstep, vec3 } from 'three/tsl';

export function safeNormalize(value) {
	return value.div(max(length(value), 0.0001));
}

export function animatedBand(signal, width, softness) {
	const edge = softness.add(fwidth(signal));
	return oneMinus(smoothstep(width, width.add(edge), abs(signal)));
}

export function sdfFill(distance, softness) {
	return oneMinus(smoothstep(0, softness.add(fwidth(distance)), distance));
}

export function sdSphere(point, radius) {
	return length(point).sub(radius);
}

export function sdBox(point, halfSize) {
	const delta = abs(point).sub(halfSize);
	const outside = length(max(delta, vec3(0)));
	const inside = min(max(delta.x, max(delta.y, delta.z)), 0);
	return outside.add(inside);
}

export function repeat3(point, period, drift = vec3(0)) {
	return mod(point.add(drift).add(period.mul(0.5)), period).sub(period.mul(0.5));
}
