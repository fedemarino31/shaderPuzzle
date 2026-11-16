// Tunable parameters for the game materials.
//
// Edit values here and reload the page (Vite hot-reloads automatically).
// Used by both Game and Game Tester.
//
// Conventions
//  - Colors are sRGB hex strings ('#rrggbb').
//  - "position" space for spherical-waves / stripes / grid-3d / repeated-spheres is
//    the puzzle cube mapped to [-1, 1] on every axis (0,0,0 = center of the cube).
//  - Time-based values are per second; materials always animate.
//  - `pbr` overrides metalness / roughness / envMapIntensity for that material
//    (omit a key to keep the default below).

export const DEFAULT_PBR = { metalness: 0.9, roughness: 0.16, envMapIntensity: 2.2 };

// Random color assigned to each piece for the white-grid based materials.
export const PIECE_COLOR = { saturation: [0.9, 1.0], lightness: [0.52, 0.6] };

export const GAME_MATERIAL_PARAMS = {
	'white-grid': {
		pbr: {},
		barRadius: 0.028, // bar thickness, as a fraction of one voxel
		minBarRadius: 0.00035, // minimum bar thickness in meters
		coreIntensity: 0.82,
		haloIntensity: 0.045,
		haloFalloff: 1.25, // halo width, in bar radii
		depthFade: 6.0, // how fast reflected bars fade with distance
		reflectionFade: 0.8, // brightness kept on every internal bounce
		emission: 1.15, // overall brightness multiplier
		particleGridEmission: 1.05, // same as `emission`, used by white-grid-particles
	},

	'white-grid-particles': {
		pbr: {},
		// Particle brightness = (base + facing * facingGain + fresnel * fresnelGain) * depthFade
		baseGlow: 0.75,
		facingGain: 1.15,
		fresnelGain: 1.8,
		fresnelPower: 2.5,
		depthFade: 3.5,
		pulseAmount: 0.16, // 0 = steady, higher = stronger brightness pulsing
		pulseSpeed: 2.1,
		speedMultiplier: 3.0, // particle travel speed
		sound: { volume: 0.22 },
		// phase / speed are in cube units (0..1) and cube units per second.
		particles: [
			{ phase: [0.13, 0.67, 0.31], speed: [0.071, 0.043, 0.059], radius: 0.042 },
			{ phase: [0.76, 0.19, 0.54], speed: [-0.047, 0.063, 0.037], radius: 0.032 },
			{ phase: [0.42, 0.88, 0.08], speed: [0.039, -0.052, 0.069], radius: 0.052 },
			{ phase: [0.91, 0.36, 0.72], speed: [-0.061, -0.035, 0.046], radius: 0.027 },
		],
	},

	'spherical-waves': {
		pbr: {},
		background: '#071522',
		bandWidth: 0.20,
		softness: 0.08,
		waves: [
			{ center: [-0.45, 0.15, 0.10], frequency: 9.0, speed: 2.2, phase: 0.0, color: '#ff675f' },
			{ center: [0.38, -0.25, 0.25], frequency: 11.0, speed: 1.7, phase: 1.2, color: '#58d9ff' },
			{ center: [0.08, 0.42, -0.35], frequency: 8.0, speed: 2.6, phase: 2.4, color: '#d479ff' },
		],
	},

	'directional-stripes': {
		pbr: {},
		direction: [1.0, 0.45, 0.2],
		frequency: 8.0,
		speed: 1.7,
		bandWidth: 0.20,
		softness: 0.07,
		colorA: '#251149', // between stripes
		colorB: '#ffb45c', // stripe
	},

	'grid-3d': {
		pbr: {},
		frequency: 3.0, // lines per half-cube
		drift: [0.13, 0.082, 0.178], // line drift speed per axis
		lineWidth: 0.08,
		softness: 0.025,
		pulseSpeed: 1.4,
		pulseAmount: 0.15,
		colorBackground: '#07111e',
		colorLine: '#67e8ff',
	},

	'repeated-spheres': {
		pbr: {},
		period: 0.8, // distance between sphere centers
		drift: [0.0568, 0.0344, 0.0232], // sphere field movement per axis
		radius: 0.28,
		radiusPulse: 0.05,
		pulseSpeed: 1.8,
		softness: 0.04,
		colorBackground: '#10162f',
		colorSphere: '#ff5f91',
	},
};

// Order shown in the Game selection screen.
export const GAME_MENU_MATERIALS = [
	{ id: 'white-grid-particles', label: 'White Grid Particles' },
	{ id: 'spherical-waves', label: 'Spherical Waves' },
	{ id: 'directional-stripes', label: 'Directional Stripes' },
	{ id: 'grid-3d', label: '3D Grid' },
	{ id: 'repeated-spheres', label: 'Repeated Spheres' },
];

// Menu preview of the assembled puzzle shown on each material card.
export const GAME_MENU_PREVIEW = {
	explode: 0.22, // how far pieces float apart (fraction of the cube size)
	rotationSpeed: 0.4, // radians per second around the vertical axis
	tilt: 0.35, // camera elevation in radians
	cameraDistance: 1.55, // meters from the 0.5 m cube
	fov: 32,
	background: '#0a0f18',
};

// AR play session.
export const GAME_SESSION = {
	// Where the 7 pieces are scattered, relative to the player start (meters).
	scatter: { center: [0, 1.55, -2.05], size: [3, 2.1, 3], minDistance: 0.17 },
	puzzleSetId: 'puzzle-2', // 7 pieces
};
