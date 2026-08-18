varying vec3 vLocalPosition;
varying vec3 vLocalNormal;

void main() {
	vLocalPosition = position;
	vLocalNormal = normal;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
