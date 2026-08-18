const action = (time, x, z = 0) => ({ time, x, z });

export const SCENARIOS = Object.freeze([
	{ id: 'stable', label: 'A · Piso estable', duration: 5, actions: [action(0, 0)] },
	{ id: 'soft-tilt', label: 'B · Inclinación suave', duration: 7, actions: [action(0, 0), action(5, 15)] },
	{ id: 'moderate-tilt', label: 'C · Inclinación moderada', duration: 8, actions: [action(0, 0), action(6, 38)] },
	{ id: 'extreme-tilt', label: 'D · Pendiente extrema', duration: 8, actions: [action(0, 0), action(4, 76), action(8, 76)] },
	{ id: 'vertical', label: 'E · Contenedor vertical', duration: 8, actions: [action(0, 0), action(3, 90)] },
	{ id: 'sudden-turn', label: 'F · Giro brusco', duration: 7, actions: [action(0, 0), action(1.4, 0), action(1.55, 90)] },
	{ id: 'shake', label: 'G · Sacudida', duration: 8, actions: [action(0, 0), action(1, 28, -18), action(1.45, -35, 24), action(1.9, 42, -28), action(2.35, -48, 20), action(2.8, 20, -12), action(3.4, 0, 0)] },
]);

export function sampleScenario(scenario, elapsed) {
	const actions = scenario.actions;
	if (elapsed <= actions[0].time) return { x: actions[0].x, z: actions[0].z };
	for (let index = 1; index < actions.length; index++) {
		const next = actions[index];
		if (elapsed > next.time) continue;
		const previous = actions[index - 1];
		const t = (elapsed - previous.time) / Math.max(0.001, next.time - previous.time);
		const smooth = t * t * (3 - 2 * t);
		return { x: previous.x + (next.x - previous.x) * smooth, z: previous.z + (next.z - previous.z) * smooth };
	}
	return { x: actions.at(-1).x, z: actions.at(-1).z };
}

export function evaluateScenario(scenario, timeline) {
	if (!timeline.length) return { score: 0, summary: 'Sin muestras' };
	const stateTimes = new Map();
	let falls = 0;
	let impacts = 0;
	let previousState = null;
	let stabilitySum = 0;
	for (const sample of timeline) {
		stateTimes.set(sample.state, (stateTimes.get(sample.state) || 0) + 1);
		if (sample.state === 'FALLING' && previousState !== 'FALLING') falls++;
		if (sample.state === 'IMPACT' && previousState !== 'IMPACT') impacts++;
		stabilitySum += sample.stability;
		previousState = sample.state;
	}
	const ratio = (state) => (stateTimes.get(state) || 0) / timeline.length;
	const averageStability = stabilitySum / timeline.length;
	let score = 70;
	if (scenario.id === 'stable') score = 100 - falls * 35 - Math.max(0, 0.85 - ratio('IDLE')) * 55;
	else if (scenario.id === 'soft-tilt') score = 92 - falls * 40 + Math.min(8, ratio('BALANCING') * 18);
	else if (['extreme-tilt', 'vertical'].includes(scenario.id)) score = 58 + Math.min(22, (ratio('SLIDING') + ratio('FALLING')) * 35) + Math.min(20, impacts * 10);
	else if (scenario.id === 'sudden-turn') score = 52 + Math.min(18, falls * 18) + Math.min(18, impacts * 18) + Math.min(12, ratio('GETTING_UP') * 45);
	else if (scenario.id === 'shake') score = 55 + Math.min(18, falls * 10) + Math.min(17, impacts * 7) + Math.min(10, ratio('BALANCING') * 20);
	else score = 78 - falls * 18 + Math.min(15, (ratio('BALANCING') + ratio('WALKING') + ratio('SLIDING')) * 25);
	return {
		score: Math.round(Math.max(0, Math.min(100, score))),
		summary: `${falls} caídas · ${impacts} impactos · estabilidad media ${Math.round(averageStability * 100)}%`,
	};
}
