import * as THREE from 'three/webgpu';
import { attribute, positionGeometry, uniform, uv, vec3 } from 'three/tsl';
import { PLANE_AXES } from './domain.js';

function nodeForValue(value) {
	if (typeof value === 'number') return uniform(value);
	if (typeof value === 'string' && value.startsWith('#')) return uniform(new THREE.Color(value));
	if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
		return uniform(new THREE.Vector3(value.x, value.y, value.z));
	}
	throw new Error(`Unsupported shader parameter: ${JSON.stringify(value)}`);
}

function updateNode(node, value) {
	if (typeof value === 'number') node.value = value;
	else if (typeof value === 'string') node.value.set(value);
	else node.value.set(value.x, value.y, value.z);
}

export class ShaderRuntime {
	constructor(preset, presetState, domain, sources, timeValue = 0) {
		this.preset = preset;
		this.domainNodes = {
			offset: uniform(new THREE.Vector3(domain.offset.x, domain.offset.y, domain.offset.z)),
			scale: uniform(new THREE.Vector3(domain.scale.x, domain.scale.y, domain.scale.z)),
			slice: uniform(domain.offset.z),
		};
		this.timeNode = uniform(timeValue);
		this.pulseTimeNode = uniform(timeValue);
		this.paramNodes = {};
		for (const [key, value] of Object.entries(presetState)) {
			if (key === 'sourceCount') continue;
			if (key === 'blendMode') this.paramNodes[key] = uniform(value === 'nearest-source' ? 1 : 0);
			else this.paramNodes[key] = nodeForValue(value);
		}
		this.sourceNodes = sources.map((source, index) => ({
			enabled: uniform(index < presetState.sourceCount && source.enabled ? 1 : 0),
			position: nodeForValue(source.position), color: nodeForValue(source.color),
			frequency: uniform(source.frequency), speed: uniform(source.speed), phase: uniform(source.phase),
		}));
	}

	create3DColorNode() {
		const position = this.domainNodes.offset.add(positionGeometry.mul(this.domainNodes.scale));
		const uvw = positionGeometry.add(0.5);
		return this.preset.createColorNode(this.createContext(position, uvw));
	}

	createAttributeColorNode(attributeName = '_uvw') {
		const coordinates = attribute(attributeName, 'vec3');
		const position = this.domainNodes.offset.add(coordinates.sub(0.5).mul(this.domainNodes.scale));
		return this.preset.createColorNode(this.createContext(position, coordinates));
	}

	create2DColorNode(plane) {
		const mapping = PLANE_AXES[plane];
		const texcoord = uv();
		const values = { x: this.domainNodes.slice, y: this.domainNodes.slice, z: this.domainNodes.slice };
		values[mapping.visible[0]] = this.domainNodes.offset[mapping.visible[0]].add(texcoord.x.sub(0.5).mul(this.domainNodes.scale[mapping.visible[0]]));
		values[mapping.visible[1]] = this.domainNodes.offset[mapping.visible[1]].add(texcoord.y.sub(0.5).mul(this.domainNodes.scale[mapping.visible[1]]));
		const normalizedSlice = this.domainNodes.slice.sub(this.domainNodes.offset[mapping.slice]).div(this.domainNodes.scale[mapping.slice]).add(0.5);
		const uvwValues = { x: normalizedSlice, y: normalizedSlice, z: normalizedSlice };
		uvwValues[mapping.visible[0]] = texcoord.x;
		uvwValues[mapping.visible[1]] = texcoord.y;
		return this.preset.createColorNode(this.createContext(vec3(values.x, values.y, values.z), vec3(uvwValues.x, uvwValues.y, uvwValues.z)));
	}

	create3DEmissionNode() {
		if (!this.preset.createEmissionNode) return null;
		const position = this.domainNodes.offset.add(positionGeometry.mul(this.domainNodes.scale));
		return this.preset.createEmissionNode(this.createContext(position, positionGeometry.add(0.5)));
	}

	createContext(position, uvw) {
		return { position, uvw, time: this.timeNode, pulseTime: this.pulseTimeNode, params: this.paramNodes, sources: this.sourceNodes };
	}

	setTime(value) { this.timeNode.value = value; }
	setPulseTime(value) { this.pulseTimeNode.value = value; }

	syncDomain(domain) {
		this.domainNodes.offset.value.set(domain.offset.x, domain.offset.y, domain.offset.z);
		this.domainNodes.scale.value.set(domain.scale.x, domain.scale.y, domain.scale.z);
	}

	setSlice(value) { this.domainNodes.slice.value = value; }

	syncParameter(key, value) {
		if (key === 'sourceCount') return;
		if (key === 'blendMode') this.paramNodes[key].value = value === 'nearest-source' ? 1 : 0;
		else updateNode(this.paramNodes[key], value);
	}

	syncSources(sources, sourceCount) {
		for (let i = 0; i < this.sourceNodes.length; i++) {
			const source = sources[i]; const nodes = this.sourceNodes[i];
			nodes.enabled.value = i < sourceCount && source.enabled ? 1 : 0;
			nodes.position.value.set(source.position.x, source.position.y, source.position.z);
			nodes.color.value.set(source.color);
			nodes.frequency.value = source.frequency; nodes.speed.value = source.speed; nodes.phase.value = source.phase;
		}
	}
}
