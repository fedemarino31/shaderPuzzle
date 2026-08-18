import { chooseLocomotionState } from './logic.js';

export class CharacterStateMachine {
	constructor(config, personality) {
		this.config = config;
		this.personality = personality;
		this.state = 'IDLE';
		this.previousState = null;
		this.timeInState = 0;
		this.substate = 'STABLE';
		this.onChange = null;
	}

	reset() {
		this.state = 'IDLE';
		this.previousState = null;
		this.timeInState = 0;
		this.substate = 'STABLE';
	}

	setPersonality(personality) { this.personality = personality; }

	transition(next, substate = '') {
		if (next === this.state) {
			if (substate) this.substate = substate;
			return;
		}
		this.previousState = this.state;
		this.state = next;
		this.timeInState = 0;
		this.substate = substate || this.defaultSubstate(next);
		this.onChange?.(next, this.previousState);
	}

	defaultSubstate(state) {
		return ({ IDLE: 'STABLE', BALANCING: 'COMPENSATING', WALKING: 'CORRECTIVE_STEP', SLIDING: 'LOSING_GRIP', FALLING: 'AIRBORNE', IMPACT: 'RECOIL', DOWN: 'ASSESSING', GETTING_UP: 'PUSHING_UP' })[state];
	}

	update(delta, sensors) {
		this.timeInState += delta;
		const impactLimit = this.config.impactThreshold / this.personality.impactSensitivity;
		if (sensors.impactStrength > impactLimit && !['IMPACT', 'DOWN'].includes(this.state) && this.timeInState > 0.08) {
			this.transition('IMPACT', 'RECOIL');
			return;
		}
		if (this.state === 'IMPACT') {
			if (this.timeInState >= this.config.impactDuration) this.transition('DOWN');
			return;
		}
		if (this.state === 'DOWN') {
			if (this.timeInState >= this.personality.getUpDelay && sensors.support && sensors.speed < 0.8) this.transition('GETTING_UP');
			return;
		}
		if (this.state === 'GETTING_UP') {
			if (!sensors.support && this.timeInState > 0.18) this.transition('FALLING');
			else if (this.timeInState >= 1.05 / this.personality.recoverySpeed) this.transition(chooseLocomotionState(sensors, this.config, this.personality));
			return;
		}
		const next = chooseLocomotionState(sensors, this.config, this.personality);
		const immediate = next === 'FALLING' || (this.state === 'FALLING' && sensors.support);
		if (this.state === 'FALLING' && sensors.support && this.timeInState > 0.12) {
			this.transition('IMPACT', 'LANDING');
			return;
		}
		if (next !== this.state && (immediate || this.timeInState >= this.config.minStateDuration)) this.transition(next);
	}
}
