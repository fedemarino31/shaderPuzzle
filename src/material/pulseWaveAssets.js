const NORMAL_URL = new URL('../../models/Maps/pulse-wave-normal.png', import.meta.url).href;
const ROUGHNESS_URL = new URL('../../models/Maps/pulse-wave-roughness.png', import.meta.url).href;
const ENVIRONMENT_URL = new URL('../../models/Maps/pulse-wave-environment.jpg', import.meta.url).href;

async function loadOptional(loader, url, label) {
	try {
		return await loader.loadAsync(url);
	} catch (error) {
		console.warn(`Could not load provisional pulse-wave ${label}.`, error);
		return null;
	}
}

export async function loadPulseWaveAssets(THREE, renderer, fallbackEnvironment = null) {
	const loader = new THREE.TextureLoader();
	const [normalMap, roughnessMap, environmentTexture] = await Promise.all([
		loadOptional(loader, NORMAL_URL, 'normal map'),
		loadOptional(loader, ROUGHNESS_URL, 'roughness map'),
		loadOptional(loader, ENVIRONMENT_URL, 'environment map'),
	]);

	for (const texture of [normalMap, roughnessMap]) {
		if (!texture) continue;
		texture.colorSpace = THREE.NoColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set(5, 5);
	}

	let environmentTarget = null;
	let environmentMap = fallbackEnvironment;
	if (environmentTexture) {
		let pmrem = null;
		try {
			environmentTexture.colorSpace = THREE.SRGBColorSpace;
			environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
			pmrem = new THREE.PMREMGenerator(renderer);
			pmrem.compileEquirectangularShader?.();
			environmentTarget = pmrem.fromEquirectangular(environmentTexture);
			environmentMap = environmentTarget.texture;
		} catch (error) {
			console.warn('Could not prepare the provisional pulse-wave environment; using RoomEnvironment.', error);
			environmentTarget?.dispose();
			environmentTarget = null;
			environmentMap = fallbackEnvironment;
		} finally {
			pmrem?.dispose();
			environmentTexture.dispose();
		}
	}

	return { normalMap, roughnessMap, environmentMap, environmentTarget };
}

export function disposePulseWaveAssets(assets) {
	assets?.normalMap?.dispose();
	assets?.roughnessMap?.dispose();
	assets?.environmentTarget?.dispose();
}
