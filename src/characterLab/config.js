export const LAB_CONFIG = Object.freeze({
	container: { halfExtents: [2, 1, 1], wallThickness: 0.055, center: [0, 1.45, 0] },
	proxy: { radius: 0.17, halfHeight: 0.25, start: [0, -0.46, 0], mass: 1.2 },
	physics: { gravity: [0, -9.81, 0], fixedStep: 1 / 60, maxSubsteps: 5 },
	state: {
		balanceThreshold: 0.84,
		fallThreshold: 0.24,
		balanceSlope: 7,
		walkSlope: 18,
		slideSlope: 34,
		impactThreshold: 7.5,
		crossFadeDuration: 0.22,
		impactDuration: 0.38,
		minStateDuration: 0.18,
	},
});

export const PERSONALITIES = Object.freeze({
	normal: {
		label: 'Normal', balanceSkill: 0.74, panicThreshold: 0.28, recoverySpeed: 1,
		impactSensitivity: 1, armExaggeration: 1, movementEnergy: 1, clumsiness: 0.18,
		getUpDelay: 0.72,
	},
	clumsy: {
		label: 'Torpe', balanceSkill: 0.48, panicThreshold: 0.42, recoverySpeed: 0.72,
		impactSensitivity: 1.35, armExaggeration: 1.48, movementEnergy: 1.15, clumsiness: 0.55,
		getUpDelay: 1.15,
	},
});

export const STATE_COLORS = Object.freeze({
	IDLE: '#71e1c1', BALANCING: '#f1cd6f', WALKING: '#7cc8ff', SLIDING: '#ef9b62',
	FALLING: '#ef6c67', IMPACT: '#ff5570', DOWN: '#9b8ea6', GETTING_UP: '#ba9af1',
});
