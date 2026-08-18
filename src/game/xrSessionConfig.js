const XR_MODE_CONFIG = {
	vr: {
		sessionMode: 'immersive-vr',
		referenceSpaceType: 'local-floor',
		label: 'VR',
		requiredFeatures: ['local-floor'],
		optionalFeatures: ['bounded-floor', 'hand-tracking', 'layers'],
	},
	ar: {
		sessionMode: 'immersive-ar',
		referenceSpaceType: 'local',
		label: 'AR',
		requiredFeatures: [],
		optionalFeatures: ['local-floor', 'hand-tracking', 'hit-test', 'layers'],
	},
};

export function getXRModeConfig(mode) {
	const config = XR_MODE_CONFIG[mode];
	if (!config) throw new Error(`Unknown XR mode: ${mode}`);
	return config;
}

export function createXRSessionInit(mode) {
	const config = getXRModeConfig(mode);
	return {
		requiredFeatures: [...config.requiredFeatures],
		optionalFeatures: [...config.optionalFeatures],
	};
}
