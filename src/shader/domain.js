export const PLANE_AXES = {
	UV: { visible: ['x', 'y'], slice: 'z' },
	UW: { visible: ['x', 'z'], slice: 'y' },
	VW: { visible: ['y', 'z'], slice: 'x' },
};

export function domainPointFromNormalized(q, domain) {
	return ['x', 'y', 'z'].map((axis, index) => domain.offset[axis] + (q[index] - 0.5) * domain.scale[axis]);
}

export function sliceRange(domain, plane) {
	const axis = PLANE_AXES[plane].slice;
	return { axis, min: domain.offset[axis] - domain.scale[axis] / 2, max: domain.offset[axis] + domain.scale[axis] / 2 };
}

export function slicePointFromNormalized(uv, plane, slice, domain) {
	const axes = PLANE_AXES[plane];
	const point = { x: 0, y: 0, z: 0 };
	point[axes.visible[0]] = domain.offset[axes.visible[0]] + (uv[0] - 0.5) * domain.scale[axes.visible[0]];
	point[axes.visible[1]] = domain.offset[axes.visible[1]] + (uv[1] - 0.5) * domain.scale[axes.visible[1]];
	point[axes.slice] = slice;
	return [point.x, point.y, point.z];
}

export function clampSliceToDomain(domain, plane, value) {
	const range = sliceRange(domain, plane);
	return Math.max(range.min, Math.min(range.max, value));
}
