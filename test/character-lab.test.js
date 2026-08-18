import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStability, chooseLocomotionState } from '../src/characterLab/logic.js';
import { PERSONALITIES, LAB_CONFIG } from '../src/characterLab/config.js';
import { SCENARIOS, evaluateScenario, sampleScenario } from '../src/characterLab/scenarios.js';
import { PhysicsWorld } from '../src/characterLab/PhysicsWorld.js';
import { CharacterStateMachine } from '../src/characterLab/CharacterStateMachine.js';
import * as THREE from 'three';

const stableSensors = { support: true, slope: 0, angularSpeed: 0, acceleration: 0, speed: 0, timeUnstable: 0 };

test('stability responds continuously to physical stress', () => {
	const stable = computeStability(stableSensors, PERSONALITIES.normal);
	const tilted = computeStability({ ...stableSensors, slope: 32, angularSpeed: 1.2, timeUnstable: 0.35 }, PERSONALITIES.normal);
	const airborne = computeStability({ ...stableSensors, support: false, slope: 90, speed: 2, timeUnstable: 0.8 }, PERSONALITIES.normal);
	assert.ok(stable > 0.9);
	assert.ok(tilted < stable && tilted > airborne);
	assert.ok(airborne < LAB_CONFIG.state.fallThreshold);
});

test('clumsy personality becomes less stable under the same stimulus', () => {
	const stimulus = { ...stableSensors, slope: 28, angularSpeed: 1.8, acceleration: 5, timeUnstable: 0.4 };
	assert.ok(computeStability(stimulus, PERSONALITIES.clumsy) < computeStability(stimulus, PERSONALITIES.normal));
});

test('locomotion selection covers balance, slide, and fall without isolated angle logic', () => {
	assert.equal(chooseLocomotionState({ ...stableSensors, stability: 0.95 }, LAB_CONFIG.state, PERSONALITIES.normal), 'IDLE');
	assert.equal(chooseLocomotionState({ ...stableSensors, slope: 12, stability: 0.77 }, LAB_CONFIG.state, PERSONALITIES.normal), 'BALANCING');
	assert.equal(chooseLocomotionState({ ...stableSensors, slope: 48, stability: 0.46 }, LAB_CONFIG.state, PERSONALITIES.normal), 'SLIDING');
	assert.equal(chooseLocomotionState({ ...stableSensors, support: false, stability: 0.1, timeUnstable: 0.3 }, LAB_CONFIG.state, PERSONALITIES.normal), 'FALLING');
});

test('scenario interpolation and evaluation are deterministic', () => {
	const soft = SCENARIOS.find((scenario) => scenario.id === 'soft-tilt');
	assert.deepEqual(sampleScenario(soft, 0), { x: 0, z: 0 });
	assert.deepEqual(sampleScenario(soft, soft.duration), { x: 15, z: 0 });
	const timeline = Array.from({ length: 20 }, (_, index) => ({ state: 'IDLE', stability: 0.96, time: index * 0.1 }));
	assert.deepEqual(evaluateScenario(SCENARIOS[0], timeline), { score: 100, summary: '0 caídas · 0 impactos · estabilidad media 96%' });
});

test('Rapier proxy settles on the container floor and survives a sudden turn', async () => {
	const physics = new PhysicsWorld();
	await physics.init();
	const level = new THREE.Quaternion();
	physics.reset(level);
	for (let index = 0; index < 120; index++) physics.step(1 / 60, level);
	const settled = physics.getCharacterPosition();
	assert.ok(Math.abs(settled.y - 0.87) < 0.04);
	assert.ok(physics.getCharacterVelocity().length() < 0.02);
	const turned = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
	for (let index = 0; index < 120; index++) physics.step(1 / 60, turned);
	assert.ok(physics.getCharacterPosition().toArray().every(Number.isFinite));
});

test('state machine completes the fall, impact, down, and recovery cycle', () => {
	const machine = new CharacterStateMachine(LAB_CONFIG.state, PERSONALITIES.normal);
	const sensors = { support: false, timeUnstable: 0.4, stability: 0.1, slope: 90, speed: 1.5, impactStrength: 0 };
	machine.update(0.14, sensors);
	assert.equal(machine.state, 'FALLING');
	machine.update(0.1, { ...sensors, support: true, impactStrength: 12 });
	assert.equal(machine.state, 'IMPACT');
	machine.update(0.4, { ...sensors, support: true, speed: 0.2, impactStrength: 0 });
	assert.equal(machine.state, 'DOWN');
	machine.update(0.8, { ...sensors, support: true, speed: 0.1, stability: 0.95, slope: 0, impactStrength: 0 });
	assert.equal(machine.state, 'GETTING_UP');
	machine.update(1.1, { ...sensors, support: true, speed: 0, stability: 0.97, slope: 0, impactStrength: 0 });
	assert.equal(machine.state, 'IDLE');
});
