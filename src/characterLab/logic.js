export function clamp01(value) { return Math.max(0, Math.min(1, value)); }

export function computeStability({ support, slope, angularSpeed, acceleration, speed, timeUnstable }, personality) {
	const slopePenalty = clamp01(slope / (62 + personality.balanceSkill * 14));
	const angularPenalty = clamp01(angularSpeed / (5.5 + personality.balanceSkill * 1.5));
	const accelerationPenalty = clamp01(acceleration / 18);
	const speedPenalty = clamp01(speed / 3.2);
	const durationPenalty = clamp01(timeUnstable / 1.15);
	const ability = personality.balanceSkill * 0.08;
	return clamp01(
		(support ? 0.38 : 0.02)
		+ (1 - slopePenalty) * 0.29
		+ (1 - angularPenalty) * 0.12
		+ (1 - accelerationPenalty) * 0.08
		+ (1 - speedPenalty) * 0.07
		+ (1 - durationPenalty) * 0.06
		+ ability
		- personality.clumsiness * 0.06
		- (support ? 0 : 0.18)
	);
}

export function chooseLocomotionState(sensors, config, personality) {
	if (!sensors.support && sensors.timeUnstable > 0.12) return 'FALLING';
	if (sensors.stability < config.fallThreshold + personality.panicThreshold * 0.08 && sensors.timeUnstable > 0.22) return 'FALLING';
	if (sensors.slope > config.slideSlope - personality.clumsiness * 7 || (sensors.speed > 1.35 && sensors.stability < 0.58)) return 'SLIDING';
	if (sensors.slope > config.walkSlope - personality.balanceSkill * 2 && sensors.stability < 0.75) return 'WALKING';
	if (sensors.slope > config.balanceSlope || sensors.stability < config.balanceThreshold) return 'BALANCING';
	return 'IDLE';
}
