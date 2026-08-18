import{Et as e,K as t,M as n,Mr as r,W as i,Wt as a,Zt as o,_r as s,cr as c,ea as l,en as u,lr as d,n as f,na as p,q as m,r as h,ra as g,ro as _,t as v}from"./OrbitControls-Br1fpmVG.js";import{t as y}from"./tweakpane-Bt2fMxNb.js";import{t as b}from"./RoomEnvironment-Q56mtrNv.js";import{t as x}from"./BufferGeometryUtils-DCIx8BGp.js";var S=`varying vec3 vLocalPosition;
varying vec3 vLocalNormal;

void main() {
	vLocalPosition = position;
	vLocalNormal = normal;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,C=`#define MAX_SAMPLES 16

uniform vec3 uCameraLocal;
uniform vec3 uBoxHalfSize;
uniform float uTime;
uniform int uSampleCount;
uniform float uNearDistance;
uniform float uFarDistance;
uniform float uRodRadius;
uniform float uCoreIntensity;
uniform float uGlowIntensity;
uniform float uGlowFalloff;
uniform float uAbsorption;
uniform float uReflectivity;
uniform float uExposure;
uniform vec3 uColorX;
uniform vec3 uColorY;
uniform vec3 uColorZ;
uniform bool uSingleColor;
uniform bool uFresnelEnabled;
uniform float uFresnelPower;
uniform int uDebugMode;

varying vec3 vLocalPosition;
varying vec3 vLocalNormal;

vec3 mirrorRepeat(vec3 p) {
	vec3 size = uBoxHalfSize * 2.0;
	vec3 cell = floor((p + uBoxHalfSize) / size);
	vec3 q = fract((p + uBoxHalfSize) / size);
	vec3 parity = mod(abs(cell), 2.0);
	q = mix(q, 1.0 - q, parity);
	return q * size - uBoxHalfSize;
}

vec3 virtualCell(vec3 p) {
	return floor((p + uBoxHalfSize) / (uBoxHalfSize * 2.0));
}

vec4 edgeData(vec3 p) {
	vec3 wall = max(uBoxHalfSize - abs(p), 0.0);
	float dx = length(wall.yz);
	float dy = length(wall.xz);
	float dz = length(wall.xy);
	float d = min(dx, min(dy, dz));
	vec3 weights = 1.0 - smoothstep(vec3(d), vec3(d + 0.015), vec3(dx, dy, dz));
	weights /= max(dot(weights, vec3(1.0)), 1.0);
	return vec4(weights, d);
}

vec3 axisColor(vec3 weights) {
	if (uSingleColor) return uColorX;
	return uColorX * weights.x + uColorY * weights.y + uColorZ * weights.z;
}

void main() {
	vec3 ro = uCameraLocal;
	vec3 rd = normalize(vLocalPosition - ro);
	vec3 rayStart = vLocalPosition + rd * 0.0005;
	vec3 accumulated = vec3(0.0);
	float attenuationDebug = 0.0;
	float edgeDebug = 0.0;
	float coreDebug = 0.0;
	float haloDebug = 0.0;

	for (int i = 0; i < MAX_SAMPLES; i++) {
		if (i >= uSampleCount) break;
		float fi = float(i) / max(float(uSampleCount - 1), 1.0);
		float distribution = fi * fi;
		float t = mix(uNearDistance, uFarDistance, distribution);
		vec3 p = rayStart + rd * t;
		vec3 q = mirrorRepeat(p);
		vec4 edge = edgeData(q);
		float aa = max(fwidth(edge.w), 0.00035);
		float core = 1.0 - smoothstep(uRodRadius - aa, uRodRadius + aa, edge.w);
		float halo = exp(-max(edge.w - uRodRadius, 0.0) * uGlowFalloff);
		vec3 cell = virtualCell(p);
		float bounces = dot(abs(cell), vec3(1.0));
		float attenuation = exp(-t * uAbsorption) * pow(uReflectivity, bounces);
		float emission = core * uCoreIntensity + halo * uGlowIntensity;
		accumulated += axisColor(edge.xyz) * emission * attenuation / float(uSampleCount);
		edgeDebug = max(edgeDebug, 1.0 - smoothstep(0.0, 0.2, edge.w));
		coreDebug = max(coreDebug, core);
		haloDebug = max(haloDebug, halo);
		attenuationDebug = max(attenuationDebug, attenuation);
	}

	vec3 color = 1.0 - exp(-accumulated * uExposure);
	if (uFresnelEnabled) {
		vec3 viewDir = normalize(ro - vLocalPosition);
		float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vLocalNormal))), uFresnelPower);
		color = mix(color, vec3(0.04, 0.09, 0.11), fresnel * 0.38);
	}

	if (uDebugMode == 1) color = vLocalPosition / (uBoxHalfSize * 2.0) + 0.5;
	if (uDebugMode == 2) color = mirrorRepeat(rayStart + rd * 2.0) / (uBoxHalfSize * 2.0) + 0.5;
	if (uDebugMode == 3) color = vec3(edgeDebug);
	if (uDebugMode == 4) color = vec3(coreDebug);
	if (uDebugMode == 5) color = vec3(haloDebug);
	if (uDebugMode == 6) color = vec3(attenuationDebug);
	if (uDebugMode == 7) {
		vec3 cell = virtualCell(rayStart + rd * uFarDistance * 0.5);
		color = 0.35 + 0.65 * sin(cell * vec3(1.7, 2.3, 2.9) + uTime * 0.1);
	}
	gl_FragColor = vec4(color, 1.0);
}
`,w={sampleCount:8,nearDistance:.02,farDistance:20,rodRadius:.025,coreIntensity:1.5,glowIntensity:.5,glowFalloff:15,absorption:.12,reflectivity:.9,exposure:1,colorX:`#54f1ff`,colorY:`#ff53bd`,colorZ:`#ffb443`,singleColor:!1,fresnelEnabled:!0,fresnelPower:3,debugMode:0},T=class extends g{constructor(e={}){let t={...w,...e};super({vertexShader:S,fragmentShader:C,side:0,transparent:!1,depthWrite:!0,uniforms:{uCameraLocal:{value:new _},uBoxHalfSize:{value:new _(1,1,1)},uTime:{value:0},uSampleCount:{value:t.sampleCount},uNearDistance:{value:t.nearDistance},uFarDistance:{value:t.farDistance},uRodRadius:{value:t.rodRadius},uCoreIntensity:{value:t.coreIntensity},uGlowIntensity:{value:t.glowIntensity},uGlowFalloff:{value:t.glowFalloff},uAbsorption:{value:t.absorption},uReflectivity:{value:t.reflectivity},uExposure:{value:t.exposure},uColorX:{value:new m(t.colorX)},uColorY:{value:new m(t.colorY)},uColorZ:{value:new m(t.colorZ)},uSingleColor:{value:t.singleColor},uFresnelEnabled:{value:t.fresnelEnabled},uFresnelPower:{value:t.fresnelPower},uDebugMode:{value:t.debugMode}}})}setParameter(e,t){let n=this.uniforms[`u${e[0].toUpperCase()}${e.slice(1)}`];n&&(n.value?.isColor?n.value.set(t):n.value=t)}},E=`#define MAX_REFLECTIONS 24

uniform vec3 uCameraLocal;
uniform vec3 uBoxHalfSize;
uniform float uTime;
uniform int uSampleCount;
uniform float uDepth;
uniform float uBarRadius;
uniform float uIntensity;
uniform float uGlow;
uniform float uDecay;
uniform float uExposure;
uniform vec3 uBarColor;

varying vec3 vLocalPosition;
varying vec3 vLocalNormal;

float distanceToCellBoundary(float coordinate, float halfSize) {
	float cellSize = halfSize * 2.0;
	float cellPosition = fract((coordinate + halfSize) / cellSize);
	return min(cellPosition, 1.0 - cellPosition) * cellSize;
}

float distanceToEdgeOnPlane(vec3 point, int axis) {
	vec3 boundaryDistance = vec3(
		distanceToCellBoundary(point.x, uBoxHalfSize.x),
		distanceToCellBoundary(point.y, uBoxHalfSize.y),
		distanceToCellBoundary(point.z, uBoxHalfSize.z)
	);
	if (axis == 0) return min(boundaryDistance.y, boundaryDistance.z);
	if (axis == 1) return min(boundaryDistance.x, boundaryDistance.z);
	return min(boundaryDistance.x, boundaryDistance.y);
}

float outerCubeEdgeDistance(vec3 point) {
	vec3 wall = max(uBoxHalfSize - abs(point), 0.0);
	return min(length(wall.yz), min(length(wall.xz), length(wall.xy)));
}

float lightBar(float edgeDistance, float antialiasWidth) {
	float core = 1.0 - smoothstep(uBarRadius - antialiasWidth, uBarRadius + antialiasWidth, edgeDistance);
	float halo = exp(-max(edgeDistance - uBarRadius, 0.0) * 24.0);
	return core * uIntensity + halo * uGlow;
}

void main() {
	vec3 rayDirection = normalize(vLocalPosition - uCameraLocal);
	vec3 rayStart = vLocalPosition + rayDirection * 0.001;
	vec3 cellSize = uBoxHalfSize * 2.0;

	// Voxel DDA: jump directly from one virtual mirror plane to the next.
	// At every plane crossing, proximity to either perpendicular plane forms
	// one of the twelve luminous edges of that repeated cube.
	vec3 directionSign = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), rayDirection));
	vec3 safeDirection = directionSign * max(abs(rayDirection), vec3(0.00001));
	vec3 cellCoordinate = (rayStart + uBoxHalfSize) / cellSize;
	vec3 nextBoundaryIndex = floor(cellCoordinate) + step(vec3(0.0), rayDirection);
	vec3 nextBoundary = nextBoundaryIndex * cellSize - uBoxHalfSize;
	vec3 nextDistance = max((nextBoundary - rayStart) / safeDirection, vec3(0.0));
	vec3 distanceStep = cellSize / abs(safeDirection);

	float accumulatedLight = 0.0;
	float entryAA = max(fwidth(outerCubeEdgeDistance(vLocalPosition)), 0.0005);
	accumulatedLight += lightBar(outerCubeEdgeDistance(vLocalPosition), entryAA) * 1.25;

	for (int i = 0; i < MAX_REFLECTIONS; i++) {
		if (i >= uSampleCount) break;

		float travelDistance;
		int crossedAxis;
		if (nextDistance.x < nextDistance.y && nextDistance.x < nextDistance.z) {
			travelDistance = nextDistance.x;
			crossedAxis = 0;
			nextDistance.x += distanceStep.x;
		} else if (nextDistance.y < nextDistance.z) {
			travelDistance = nextDistance.y;
			crossedAxis = 1;
			nextDistance.y += distanceStep.y;
		} else {
			travelDistance = nextDistance.z;
			crossedAxis = 2;
			nextDistance.z += distanceStep.z;
		}

		if (travelDistance > uDepth) break;
		vec3 crossingPoint = rayStart + rayDirection * travelDistance;
		float edgeDistance = distanceToEdgeOnPlane(crossingPoint, crossedAxis);
		float aa = max(length(fwidth(crossingPoint)) * 0.7, 0.0007);
		float distanceFade = exp(-travelDistance * uDecay);
		accumulatedLight += lightBar(edgeDistance, aa) * distanceFade;
	}

	vec3 color = 1.0 - exp(-uBarColor * accumulatedLight * uExposure);
	vec3 viewDirection = normalize(uCameraLocal - vLocalPosition);
	float glass = pow(1.0 - abs(dot(viewDirection, normalize(vLocalNormal))), 4.0);
	color += vec3(0.012, 0.022, 0.028) * (0.2 + glass * 0.8);
	gl_FragColor = vec4(color, 1.0);
}
`,D={sampleCount:24,depth:26,barRadius:.022,intensity:1.8,glow:.34,decay:.085,exposure:1.1,barColor:`#b8edff`},O=class extends g{constructor(e={}){let t={...D,...e};super({vertexShader:S,fragmentShader:E,side:0,transparent:!1,depthWrite:!0,uniforms:{uCameraLocal:{value:new _},uBoxHalfSize:{value:new _(1,1,1)},uTime:{value:0},uSampleCount:{value:t.sampleCount},uDepth:{value:t.depth},uBarRadius:{value:t.barRadius},uIntensity:{value:t.intensity},uGlow:{value:t.glow},uDecay:{value:t.decay},uExposure:{value:t.exposure},uBarColor:{value:new m(t.barColor)}}})}setParameter(e,t){let n=this.uniforms[`u${e[0].toUpperCase()}${e.slice(1)}`];n&&(n.value?.isColor?n.value.set(t):n.value=t)}},k=class extends o{constructor({size:e=2,frameThickness:t=.075,materialOptions:r={},gridMaterialOptions:i={}}={}){super(),this.size=e,this.cameraWorldPosition=new _,this.materials={chromatic:new T(r),grid:new O(i)};for(let t of Object.values(this.materials))t.uniforms.uBoxHalfSize.value.setScalar(e*.5);this.shaderMode=`chromatic`,this.material=this.materials[this.shaderMode];let a=new n(e,e,e);this.opticalCube=new c(a,this.material),this.add(this.opticalCube);let o=this.createFrameGeometry(e,t),l=new s({color:131844,roughness:.3,metalness:.72});this.frame=new c(o,l),this.frame.renderOrder=1,this.add(this.frame)}setShaderMode(e){!this.materials[e]||e===this.shaderMode||(this.shaderMode=e,this.material=this.materials[e],this.opticalCube.material=this.material)}createFrameGeometry(e,t){let r=e*.5,i=e+t,a=[];for(let e=0;e<3;e++)for(let o of[-r,r])for(let s of[-r,r]){let r=[t,t,t];r[e]=i;let c=new n(...r),l=new _;l.setComponent((e+1)%3,o),l.setComponent((e+2)%3,s),c.translate(l.x,l.y,l.z),a.push(c)}let o=x(a,!1);return a.forEach(e=>e.dispose()),o}update({camera:e,time:t}){this.updateWorldMatrix(!0,!1),e.getWorldPosition(this.cameraWorldPosition),this.material.uniforms.uCameraLocal.value.copy(this.cameraWorldPosition),this.worldToLocal(this.material.uniforms.uCameraLocal.value),this.material.uniforms.uTime.value=t}dispose(){this.opticalCube.geometry.dispose(),this.frame.geometry.dispose(),this.frame.material.dispose(),Object.values(this.materials).forEach(e=>e.dispose())}},A=class{constructor(e){this.viewport=e,this.clock=new t,this.frameSamples=[],this.lastHudUpdate=0,this.params={shaderMode:`chromatic`,sampleCount:8,farDistance:20,rodRadius:.025,coreIntensity:1.5,glowIntensity:.5,glowFalloff:15,absorption:.12,reflectivity:.9,exposure:1,colorX:`#54f1ff`,colorY:`#ff53bd`,colorZ:`#ffb443`,singleColor:!1,fresnelEnabled:!0,fresnelPower:3,debugMode:0,gridSampleCount:24,gridDepth:26,gridBarRadius:.022,gridIntensity:1.8,gridGlow:.34,gridDecay:.085,gridExposure:1.1,gridBarColor:`#b8edff`,autoRotate:!0},this.init()}init(){this.scene=new p,this.scene.background=new m(329481),this.scene.fog=new a(329481,.045),this.camera=new r(42,1,.1,100),this.camera.position.set(3.7,2.6,4.5),this.renderer=new h({antialias:!0,powerPreference:`high-performance`}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.outputColorSpace=l,this.renderer.toneMapping=4,this.renderer.toneMappingExposure=1.05,this.viewport.appendChild(this.renderer.domElement);let t=new b,n=new f(this.renderer);this.scene.environment=n.fromScene(t).texture,t.dispose(),n.dispose(),this.controls=new v(this.camera,this.renderer.domElement),this.controls.enableDamping=!0,this.controls.dampingFactor=.055,this.controls.minDistance=3.25,this.controls.maxDistance=9,this.controls.autoRotate=!0,this.controls.autoRotateSpeed=.48,this.cube=new k({size:2.35,frameThickness:.085,materialOptions:this.params,gridMaterialOptions:{sampleCount:this.params.gridSampleCount,depth:this.params.gridDepth,barRadius:this.params.gridBarRadius,intensity:this.params.gridIntensity,glow:this.params.gridGlow,decay:this.params.gridDecay,exposure:this.params.gridExposure,barColor:this.params.gridBarColor}}),this.cube.rotation.set(-.09,.2,.04),this.scene.add(this.cube),this.scene.add(new u(13105407,1576982,1.25));let o=new e(9235711,2.6);o.position.set(-3,4,5),this.scene.add(o);let s=new c(new i(4.6,64),new d({color:527117,transparent:!0,opacity:.7}));s.rotation.x=-Math.PI/2,s.position.y=-1.7,this.scene.add(s),this.buildPanel(),this.resizeObserver=new ResizeObserver(()=>this.resize()),this.resizeObserver.observe(this.viewport),this.resize(),this.renderer.setAnimationLoop(()=>this.render())}buildPanel(){this.pane=new y({container:document.getElementById(`mirrorPanel`),title:`Optical controls`,expanded:!0});let e=(e,t,n={},r=t,i=`chromatic`)=>e.addBinding(this.params,t,n).on(`change`,({value:e})=>{this.cube.materials[i].setParameter(r,e)}),t=this.pane.addBinding(this.params,`shaderMode`,{label:`Shader`,options:{"Chromatic mirror":`chromatic`,"White grid":`grid`}}),n=this.pane.addFolder({title:`Chromatic mirror`,expanded:!0}),r=this.pane.addFolder({title:`White grid`,expanded:!0});r.hidden=!0,t.on(`change`,({value:e})=>{this.cube.setShaderMode(e),n.hidden=e!==`chromatic`,r.hidden=e!==`grid`});let i=n.addFolder({title:`Depth`});e(i,`sampleCount`,{label:`Samples`,options:{"4 / low":4,"8 / balanced":8,"12 / high":12,"16 / ultra":16}}),e(i,`farDistance`,{label:`Far distance`,min:4,max:32,step:.5}),e(i,`absorption`,{min:.01,max:.35,step:.005}),e(i,`reflectivity`,{min:.65,max:1,step:.005});let a=n.addFolder({title:`Light rods`});e(a,`rodRadius`,{label:`Radius`,min:.006,max:.08,step:.001}),e(a,`coreIntensity`,{label:`Core`,min:0,max:4,step:.05}),e(a,`glowIntensity`,{label:`Glow`,min:0,max:2,step:.025}),e(a,`glowFalloff`,{label:`Falloff`,min:3,max:40,step:.5}),e(a,`exposure`,{min:.2,max:3,step:.05}),e(a,`singleColor`,{label:`Single color`}),e(a,`colorX`,{label:`X axis`}),e(a,`colorY`,{label:`Y axis`}),e(a,`colorZ`,{label:`Z axis`});let o=n.addFolder({title:`Surface & debug`});e(o,`fresnelEnabled`,{label:`Fresnel`}),e(o,`fresnelPower`,{label:`Fresnel power`,min:1,max:8,step:.1}),e(o,`debugMode`,{label:`View`,options:{Final:0,"Local position":1,"Mirror repeat":2,"Edge distance":3,"Core only":4,"Halo only":5,Attenuation:6,"Cell index":7}}),e(r,`gridSampleCount`,{label:`Reflections`,options:{"8 / low":8,"12 / medium":12,"16 / high":16,"24 / full":24}},`sampleCount`,`grid`),e(r,`gridDepth`,{label:`Grid depth`,min:5,max:40,step:.5},`depth`,`grid`),e(r,`gridBarRadius`,{label:`Bar radius`,min:.005,max:.07,step:.001},`barRadius`,`grid`),e(r,`gridIntensity`,{label:`White core`,min:.2,max:5,step:.05},`intensity`,`grid`),e(r,`gridGlow`,{label:`Glow`,min:0,max:2,step:.02},`glow`,`grid`),e(r,`gridDecay`,{label:`Distance decay`,min:.01,max:.3,step:.005},`decay`,`grid`),e(r,`gridExposure`,{label:`Exposure`,min:.2,max:3,step:.05},`exposure`,`grid`),e(r,`gridBarColor`,{label:`Bar color`},`barColor`,`grid`),this.pane.addBinding(this.params,`autoRotate`,{label:`Auto rotate`}).on(`change`,({value:e})=>{this.controls.autoRotate=e})}resize(){let{clientWidth:e,clientHeight:t}=this.viewport;!e||!t||(this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.renderer.setSize(e,t,!1))}updateHud(e,t){if(this.frameSamples.push(t*1e3),this.frameSamples.length>45&&this.frameSamples.shift(),e-this.lastHudUpdate<250)return;let n=this.frameSamples.reduce((e,t)=>e+t,0)/this.frameSamples.length;document.getElementById(`fpsValue`).textContent=Math.round(1e3/n),document.getElementById(`frameValue`).textContent=`${n.toFixed(1)} ms`,document.getElementById(`callsValue`).textContent=this.renderer.info.render.calls,document.getElementById(`trianglesValue`).textContent=this.renderer.info.render.triangles.toLocaleString(),this.lastHudUpdate=e}render(){let e=Math.min(this.clock.getDelta(),.1),t=this.clock.elapsedTime;this.controls.update(),this.cube.update({camera:this.camera,time:t,delta:e}),this.renderer.render(this.scene,this.camera),this.updateHud(performance.now(),e)}};try{new A(document.getElementById(`mirrorViewport`))}catch(e){let t=document.getElementById(`mirrorError`);t.hidden=!1,t.textContent=`Unable to start the shader experiment: ${e.message}`,console.error(e)}