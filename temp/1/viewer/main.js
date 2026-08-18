/**
 * main.js – standalone hypergraph viewer with wave propagation.
 *
 * Loads a .glb exported by the WebGPU app (src/gpu/exportGLB.js), renders its
 * two InstancedMeshes with a per-instance highlight, and lets the user click a
 * node to spawn walkers that traverse the graph node-by-node.
 *
 * Pipeline: loadGraph (GLB → graph + spatial BVH + fingerprint stats) →
 * picker (pickFromRay) → traversal engine (interpretes/walkers → TraverseEvents)
 * → sinks (highlightSink owns the aWave attributes; audioRouter sonifies each
 * step through the shared 3D spatial synth).
 *
 * Render uses three's WebGLRenderer (not WebGPU): the GLB ships standard
 * MeshStandardMaterials, which the highlight sink patches via onBeforeCompile.
 */

import {
  Scene,
  WebGLRenderer,
  Color,
  DirectionalLight,
  HemisphereLight,
  Box3,
  Vector3,
  Sphere,
  Group,
  TextureLoader,
  EquirectangularReflectionMapping,
  PMREMGenerator,
  SRGBColorSpace,
  RepeatWrapping,
  ClampToEdgeWrapping,
  LinearFilter,
} from "three";
import { createMenu } from "../vendor/dynamicMenu_createMenu.js";
import { CameraManager } from "../cameras/cameraManager.js";
import { IMAGE_BACKGROUNDS, SOLID_COLOR } from "../utils/backgrounds.js";

import { loadGraph } from "./loadGraph.js";
import { createPicker, pickFromPointerEvent } from "./picking.js";
import { initXR } from "./xr.js";
import { createTraversalEngine } from "./traversal/engine.js";
import { createHighlightSink } from "./sinks/highlightSink.js";
import { createAudioRouter } from "./sinks/audioRouter.js";
import { createSpatialSynth } from "./audio/spatialSynth.js";
import { listBehaviors, getBehavior } from "./behaviors/registry.js";
import { setSampleOptions } from "./behaviors/ambient.js";
import { STAT_KEYS } from "./graphStats.js";
import { PALETTES, samplePalette } from "./palettes.js";

const canvas = document.getElementById("viewerCanvas");

// ── Renderer / scene / camera ──────────────────────────────────────────────
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene();
scene.background = new Color("#0d0d0f");

// Camera manager: orbital (OrbitControls) + drone (fly), cycled with the 'c'
// key — same setup as the builder. The viewer passes its own scene/renderer
// since it doesn't use the WebGPU GraphicsManager.
const cameraMgr = new CameraManager({
  scene,
  renderer,
  orbitalCamera: { initialPosition: [150, 150, 150], initialTarget: [0, 0, 0] },
  droneCamera: { initialPosition: [150, 150, 150], initialTarget: [0, 0, 0] },
});
const cameraState = { camera: cameraMgr.currentCameraType };
const activeCamera = () => cameraMgr.getCamera();

// Per-camera tunables exposed in the "Camera" tab. Orbital has none; the drone
// speed maps a 1–5 level onto the same multipliers as the 1–5 keys; the auto
// camera's shot/distance/smoothing options are pushed into the AutoCamera.
const DRONE_SPEED_LEVELS = [1, 2, 4, 8, 12]; // = keyboard keys 1..5
const cameraParams = {
  fov: cameraMgr.currentFov,
  droneSpeedLevel: 2,
  autoMinDuration: 4,
  autoDurationRange: 5, // shotMin / (shotMax = min + range)
  autoDistMin: 0.18,
  autoDistMax: 0.35, // factors of the graph radius
  autoPosTau: 1.2,
  autoLookTau: 0.7, // smoothing time constants (s)
};
const pushDrone = () =>
  cameraMgr.setDroneSpeed(DRONE_SPEED_LEVELS[cameraParams.droneSpeedLevel - 1]);
const pushAuto = () =>
  cameraMgr.setAutoOptions({
    shotMin: cameraParams.autoMinDuration,
    shotMax: cameraParams.autoMinDuration + cameraParams.autoDurationRange,
    followDistMin: cameraParams.autoDistMin,
    followDistMax: cameraParams.autoDistMax,
    posTau: cameraParams.autoPosTau,
    lookTau: cameraParams.autoLookTau,
  });

// Directional + hemisphere mirror the builder's baked TSL lighting
// (threeRender.js): light from normalize(1,2,3), plus a sky/ground hemi fill.
const dir = new DirectionalLight(0xffffff, 1.1);
dir.position.set(1, 2, 3);
scene.add(dir);
// Hemisphere fill — same sky/ground tint the builder's hemiLight() uses
// (sky 0.75,0.85,1.0 / ground 0.25,0.22,0.20). Intensity is driven from
// renderParams.hemi (default 0.9, matching the builder) via applyRenderParams.
const hemiLight = new HemisphereLight(0xbfd9ff, 0x403833, 0.0);
scene.add(hemiLight);

// ── Graph group ──────────────────────────────────────────────────────────
// The loaded GLB scene lives inside this group so its whole graph is scaled to
// metres (longest bbox dimension = TARGET_VOLUME_M) and parked at chest height
// in front of the viewer — comfortable in AR, while the desktop orbit camera
// just reframes onto it (frameScene). The baked node coordinates are untouched,
// so the BVH and picking stay in graph-local space.
const TARGET_VOLUME_M = 1.5; // longest bbox dimension in metres
const graphGroup = new Group();
scene.add(graphGroup);

// ── State filled after load ──────────────────────────────────────────────
let graph = null;
let picker = null;
let engine = null; // traversal engine (walkers → events)
let highlight = null; // highlight sink (owns aWave attributes + fade)
let audioRouter = null; // routes each step to its behaviour's sonify → synth
let currentScene = null; // the loaded gltf scene currently in the world
let nodesMesh = null; // the 'nodes' InstancedMesh (for picking)
let edgesMesh = null; // the 'edges' InstancedMesh (for recolour/radius)
let menu = null; // DynamicMenu instance (built once; createMenu is async)

// Comportamiento selection + walker movement settings (bound by the panel; the
// live values are snapshotted onto each interprete at launch time).
const behaviorState = { id: "classic" };
const walkerParams = {
  hopIntervalMs: 180,
  energyMode: "infinite", // 'infinite' | 'finite'
  energyBudget: 40, // steps before dying when finite
  energyCost: 1, // energy spent per step
  addOnClick: true, // whether a node click launches a new interprete
};

// Which interprete the "Parámetros" folder edits. `id` is the select's option KEY:
// 'template' = the shared defaults for the next launch; otherwise the stringified
// interprete id (its live params object is bound, so sonic edits affect that
// interprete in real time). Bound to the select so menu.sync() reflects auto-selection.
const interpreteSelState = { id: "template" };
let interpreteSelectItem = null; // the "intérprete" select handle (updateOptions in place)
let lastEngineRev = -1; // last engine.revision the interprete select reflected

// Rendering settings — mirror the builder's "Rendering" folder (minus show grid
// and the age-gradient colours, which have no equivalent in the viewer's GLB
// pipeline). Radii are scale factors on the baked geometry; applied per load so
// edits survive model swaps. Node/edge colours are seeded from the first model's
// materials (capturing whatever colour it was exported with).
const renderParams = {
  nodeRadius: 1, // scale factor on the baked sphere radius
  edgeRadius: 1, // scale factor on the baked cylinder radius (X/Z only)
  hemi: 0.9, // hemisphere light intensity (matches the builder's default)
  colorAttr: "age", // which node attribute drives colour (see COLOR_ATTRS)
  palette: "warm", // multi-stop palette key (see palettes.js)
  colorGamma: 2.0, // >1 → flatter distribution (spreads the dense young cluster)
  edgeColor: "#cccccc",
  bgColor: "#0d0d0f",
  bgMode: IMAGE_BACKGROUNDS[0]?.id ?? SOLID_COLOR, // SOLID_COLOR or an image id
  edgeMetal: 0.4, // edge PBR metalness — makes the IBL reflections visible
  edgeRough: 0.35, // edge PBR roughness
};
let renderInit = false; // seed colours from the first loaded model

// Node attributes offered as colour sources: only those with a bounded/normalised
// range that reads well as a gradient (age + the inherently [0,1] fingerprints).
// { statKey: menuLabel }.
const COLOR_ATTRS = {
  age: "age",
  clustering: "clustering",
  dirBalance: "dirBalance",
  nbhdLinearity: "linearity",
  nbhdPlanarity: "planarity",
  nbhdSphericity: "sphericity",
};

// Persistent menu-driven settings. The highlight sink is recreated per model
// load and the audioRouter too, so the menu writes here and
// applySettingsToSinks() pushes these onto the fresh sink + the shared synth —
// settings survive model swaps and the menu, built once, never has to rebuild.
// Pitch/envelope here are defaults snapshotted onto each interprete at launch.
const highlightSettings = { fadeFactor: 0.92, edgePulseHalf: 0.5 };
// General audio settings only — behaviour-specific pitch/envelope live in
// behaviorSettings below (the Orquesta tab's per-comportamiento folder), not here.
const audioSettings = {
  enabled: true,
  volumeDb: -10,
  compEnabled: true,
  compThreshold: -18,
  compRatio: 4,
};

// Per-behaviour parameter snapshots (the menu's per-behaviour folder writes here).
// Each behaviour reads its own object at launch, so behaviours with the same key
// (e.g. ADSR) don't collide. Movement params (hop/energy) stay shared in
// walkerParams. Keep these in sync with each behaviour's `defaults`.
const behaviorSettings = {
  classic: {
    freqAttr: "age",
    baseOctave: 3,
    octaves: 3,
    durationSec: 0.25,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.3,
    release: 0.8,
  },
  angular: {
    pitchMode: "absolute",
    angleSource: "beta",
    angleOffset: 0,
    angleReverse: false,
    scale: "pentatonic",
    baseOctave: 3,
    octaves: 3,
    maxStep: 2,
    durationSec: 0.25,
    gain: 0.7,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.3,
    release: 0.8,
    modSlots: [
      { source: "age", target: "brightness", min: 0, max: 1 },
      { source: "degree", target: "unisonDetune", min: 0, max: 0.6 },
      { source: "clustering", target: "release", min: 0.1, max: 0.8 },
    ],
  },
  reproductor: {
    freqAttr: "age",
    baseOctave: 2,
    octaves: 3,
    durationSec: 0.25,
    velNew: 0.9,
    velRevisit: 0.4,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.3,
    release: 0.8,
    degreeThreshold: 4,
    maxChildren: 3,
    childBudget: 12,
    childPitchSemitones: 12,
    childHopMult: 1,
    childHopOffset: 10,
    childGain: 0.5,
  },
  ambient: {
    instrument: "", // resuelto tras cargar el manifest (init → setSampleOptions)
    baseGain: 0.6,
    fadeSec: 4,
    rampMs: 800,
    lfoTarget: "frequency",
    modSlots: [
      { source: "degree",       op: "avg", windowMs: 4000, target: "frequency", min: 0.1,  max: 0.9 },
      { source: "localDensity", op: "avg", windowMs: 6000, target: "gain",      min: 0.25, max: 0.9 },
      { source: "age",          op: "avg", windowMs: 5000, target: "detune",    min: 0.35, max: 0.65 },
      { source: "clustering",   op: "max", windowMs: 8000, target: "Q",         min: 0,    max: 0.5 },
    ],
    eventSlots: [
      { source: "degree", windowMs: 3000, mode: "level", threshold: 0.65, bandMax: 1, hysteresis: 0.1,
        action: "swell", amount: 1.5, gestureMs: 5000 },
      { source: "distToGlobalCentroid", windowMs: 4000, mode: "band", threshold: 0.6, bandMax: 1, hysteresis: 0.05,
        action: "panLfo", amount: 0.8, gestureMs: 0 },
    ],
  },
};
const settingsFor = (id) => behaviorSettings[id] ?? behaviorSettings.classic;

// Shared 3D spatial synth: one service for every behaviour, persisting across
// model swaps. Its AudioContext is created lazily on the first user gesture
// (synthSvc.start()); clearAllNodes() drops per-node panners on model swap.
const synthSvc = createSpatialSynth({
  volumeDb: audioSettings.volumeDb,
  compEnabled: audioSettings.compEnabled,
  compThreshold: audioSettings.compThreshold,
  compRatio: audioSettings.compRatio,
});
const _fwd = new Vector3(); // scratch for the listener's forward vector

// Hue ⇄ hex helpers — DynamicMenu has no colour control, so the age/edge/bg colours
// are driven by Hue sliders (0–360°) with fixed saturation/lightness per role.
const _hueTmp = new Color();
const hexToHue = (hex) => {
  const o = {};
  _hueTmp.set(hex).getHSL(o);
  return Math.round(o.h * 360);
};
const hueToHex = (h, s, l) =>
  `#${_hueTmp.setHSL((((h % 360) + 360) % 360) / 360, s, l).getHexString()}`;
const HUE_SL = { age: [0.85, 0.55], edge: [0.5, 0.7], bg: [0.4, 0.15] }; // [saturation, lightness]

// ── 360 backgrounds + IBL ──
// Each image background (maps/backgrounds.json) is an equirectangular 360 image:
// the visible background AND scene.environment, so the GLB's MeshStandardMaterial
// edges reflect it. PMREM prefilters it for correct roughness response. In
// 'solid color' mode the environment is swapped for a flat colour env matching
// bgColor so the reflections stay coherent with the background (image disabled).
const pmrem = new PMREMGenerator(renderer);
const bgTextures = {}; // id → equirect texture
const envMaps = {}; // id → PMREM env

for (const bg of IMAGE_BACKGROUNDS) {
  new TextureLoader().load(bg.url, (tex) => {
    tex.mapping = EquirectangularReflectionMapping;
    tex.colorSpace = SRGBColorSpace;
    // Wrap horizontally so the longitude 0°/360° seam samples continuously
    // (ClampToEdge defaults leave a visible vertical meridian line at the wrap).
    // Vertical stays clamped — the poles must not wrap onto each other.
    tex.wrapS = RepeatWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    // Disable mipmaps for the background sample. three's equirect background
    // shader derives `u` from the view direction; across the 0°/360° seam `u`
    // jumps ~1→0 between adjacent screen pixels, so the mip-LOD selector picks a
    // very coarse level *only* on that column → the blurry vertical seam line.
    // LinearFilter + no mipmaps removes the LOD selection entirely, killing it.
    tex.minFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.needsUpdate = true;
    bgTextures[bg.id] = tex;
    envMaps[bg.id] = pmrem.fromEquirectangular(tex).texture;
    if (renderParams.bgMode === bg.id) applyRenderParams();
  });
}

/** Set background + environment per the current mode (solid colour vs 360 image). */
function applyBackground() {
  const sel = renderParams.bgMode;
  if (sel !== SOLID_COLOR && bgTextures[sel]) {
    scene.background = bgTextures[sel];
    scene.environment = envMaps[sel]; // IBL from the image
  } else {
    if (scene.background instanceof Color)
      scene.background.set(renderParams.bgColor);
    else scene.background = new Color(renderParams.bgColor);
    scene.environment = null; // no envMap: reflections fall back to scene lights only
  }
}

/** Scale an instanced mesh's shared geometry by a delta vs the last applied factor. */
function applyMeshRadius(mesh, factor, axes /* [x,y,z] */) {
  if (!mesh) return;
  const prev = mesh.userData.radiusScale ?? 1;
  if (factor === prev) return;
  const d = factor / prev;
  mesh.geometry.scale(axes[0] ? d : 1, axes[1] ? d : 1, axes[2] ? d : 1);
  mesh.userData.radiusScale = factor;
}

/**
 * Colour each node instance by a chosen normalised attribute (renderParams.colorAttr)
 * sampled through a multi-stop palette (renderParams.palette), with a gamma bias so
 * the dense cluster of young "leaf" nodes spreads out. Uses three's native
 * per-instance colour; the wave-highlight tint composites on top.
 */
function applyNodeColors() {
  if (!nodesMesh || !graph) return;
  // three multiplies instanceColor by the material's base colour (color_fragment:
  // `diffuseColor.rgb *= vColor`). The GLB ships a non-white node colour, which
  // would filter out channels — force white so instanceColor controls the result.
  nodesMesh.material.color.setRGB(1, 1, 1);
  const colors = (PALETTES[renderParams.palette] ?? PALETTES.warm).colors;
  const attr = renderParams.colorAttr;
  const g = renderParams.colorGamma;
  const tmp = new Color();
  for (let i = 0; i < graph.numNodes; i++) {
    const t = Math.pow(graph.stats.norm(attr, i), g); // linear norm → gamma bias
    samplePalette(colors, t, tmp);
    nodesMesh.setColorAt(i, tmp);
  }
  if (nodesMesh.instanceColor) nodesMesh.instanceColor.needsUpdate = true;
}

/** Push the current renderParams onto the scene + currently loaded meshes. */
function applyRenderParams() {
  applyBackground();
  hemiLight.intensity = renderParams.hemi;
  if (nodesMesh) {
    applyNodeColors();
    applyMeshRadius(nodesMesh, renderParams.nodeRadius, [1, 1, 1]); // uniform
  }
  if (edgesMesh) {
    edgesMesh.material.color.set(renderParams.edgeColor);
    // PBR params so the IBL from scene.environment shows up on the edges.
    edgesMesh.material.metalness = renderParams.edgeMetal;
    edgesMesh.material.roughness = renderParams.edgeRough;
    edgesMesh.material.envMapIntensity = 1.0;
    edgesMesh.material.needsUpdate = true;
    applyMeshRadius(edgesMesh, renderParams.edgeRadius, [1, 0, 1]); // radius, keep length
  }
}

// ── Stats DOM (read-only; all controls live in the DynamicMenu) ──────────────
const dom = {
  model: document.getElementById("statModel"),
  nodes: document.getElementById("statNodes"),
  edges: document.getElementById("statEdges"),
  interpretes: document.getElementById("statInterpretes"),
  walkers: document.getElementById("statWalkers"),
  fps: document.getElementById("statFps"),
};

// Model picker state (bound by the DynamicMenu "Model" tab).
let modelList = []; // [{ file }] from /api/models
const modelState = { file: "" }; // currently selected file in the dropdown
let isLoading = false; // re-entrancy guard for loadModel

/**
 * Scale graphGroup so the loaded graph's longest bounding-box dimension equals
 * TARGET_VOLUME_M metres, and park it at chest height in front of the viewer.
 * Measured with the group at identity so previous models don't bias the box.
 */
function scaleGraphToVolume(gltfScene) {
  graphGroup.scale.setScalar(1);
  graphGroup.position.set(0, 0, 0);
  graphGroup.updateMatrixWorld(true);

  const size = new Box3().setFromObject(gltfScene).getSize(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim <= 0) return;

  graphGroup.scale.setScalar(TARGET_VOLUME_M / maxDim);
  graphGroup.position.set(0, 1.3, -1.5); // ~chest height, in front (AR-friendly)
  graphGroup.updateMatrixWorld(true);
}

/** Frame both cameras on the whole graph using its bounding sphere. */
function frameScene(object3d) {
  const box = new Box3().setFromObject(object3d);
  const sphere = box.getBoundingSphere(new Sphere());
  if (!isFinite(sphere.radius) || sphere.radius <= 0) return;

  const fov = cameraMgr.getCamera("orbital").fov;
  const dist = (sphere.radius / Math.sin((fov * Math.PI) / 180 / 2)) * 1.2;
  const dir = new Vector3(1, 0.8, 1).normalize();
  const eye = sphere.center.clone().add(dir.clone().multiplyScalar(dist));

  const orbital = cameraMgr.getCameraWrapper("orbital");
  orbital.setClip(Math.max(0.01, sphere.radius / 1000), sphere.radius * 100);
  orbital.frame(sphere.center, dist, dir);

  // Park the drone at the same vantage point, looking at the model.
  cameraMgr
    .getCameraWrapper("drone")
    .reset(eye.toArray(), sphere.center.toArray());
}

// Encuadre de "frame graph": holgura alrededor del grafo. 1.0 = ajuste exacto a
// la caja; subir = más aire. ← tocar esto para ajustar más/menos.
const FIT_MARGIN = 0.9;

/**
 * Zoom-to-fit for the orbital camera: adjusts only the distance so the whole graph
 * fits tightly, keeping the current viewing angle (unlike frameScene, which uses a
 * fixed 3/4 view and also moves the drone). Fits the bounding BOX (projecting its 8
 * corners onto the camera's right/up axes) rather than the bounding sphere, which
 * for an elongated graph overestimates the radius (~1.4×) and left a big margin.
 * Bound to the 'f' key and the orbital folder's "frame graph" button.
 */
function frameGraphOrbital() {
  if (!graph) return;
  const box = new Box3().setFromObject(graphGroup);
  if (box.isEmpty()) return;
  const center = box.getCenter(new Vector3());
  const sphere = box.getBoundingSphere(new Sphere()); // sólo para near/far clip

  const orbital = cameraMgr.getCameraWrapper("orbital");
  const cam = orbital.getCamera();
  const vFov = (cam.fov * Math.PI) / 180;
  const aspect = cameraMgr.aspect || cam.aspect || 16 / 9;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * aspect;

  // Base de cámara a partir de la dirección de vista actual.
  const dir = new Vector3()
    .copy(cam.position)
    .sub(orbital.getControls().target);
  if (dir.lengthSq() < 1e-9) dir.set(1, 0.8, 1);
  dir.normalize();
  const right = new Vector3().crossVectors(dir, new Vector3(0, 1, 0));
  if (right.lengthSq() < 1e-9) right.set(1, 0, 0); // vista casi vertical
  right.normalize();
  const camUp = new Vector3().crossVectors(right, dir).normalize();

  // Máxima extensión de la caja proyectada sobre los ejes de pantalla.
  let maxH = 0,
    maxV = 0;
  const c = new Vector3();
  for (let xi = 0; xi < 2; xi++)
    for (let yi = 0; yi < 2; yi++)
      for (let zi = 0; zi < 2; zi++) {
        c.set(
          xi ? box.max.x : box.min.x,
          yi ? box.max.y : box.min.y,
          zi ? box.max.z : box.min.z,
        ).sub(center);
        maxH = Math.max(maxH, Math.abs(c.dot(right)));
        maxV = Math.max(maxV, Math.abs(c.dot(camUp)));
      }
  const dist = Math.max(maxV / tanV, maxH / tanH) * FIT_MARGIN;

  orbital.setClip(Math.max(0.01, sphere.radius / 1000), sphere.radius * 100);
  orbital.frame(center, dist, dir);
}

// ── Model list / selection ──────────────────────────────────────────────────

/** Fetch the list of available models (no DOM; the panel renders the dropdown). */
async function populateModelList() {
  let models = [];
  try {
    const res = await fetch("/api/models");
    ({ models } = await res.json());
  } catch (err) {
    console.warn("[Viewer] could not fetch model list:", err);
  }
  modelList = models || [];
  return modelList;
}

/**
 * Resolve the model to show on first load: ?model=NN query → last model loaded
 * (localStorage, if it still exists) → the latest available.
 */
function pickInitialFile(models) {
  const q = new URLSearchParams(location.search).get("model");
  if (q) {
    const file = `model${String(parseInt(q, 10)).padStart(2, "0")}.glb`;
    if (models.some((m) => m.file === file)) return file;
  }
  let saved = null;
  try {
    saved = localStorage.getItem("hm.model");
  } catch {
    /* almacenamiento no disponible */
  }
  if (saved && models.some((m) => m.file === saved)) return saved;
  return models.length ? models[models.length - 1].file : null;
}

// ── Load (and swap) a model ──────────────────────────────────────────────────

/** Tear down the currently loaded model's scene + GPU/CPU state. */
function disposeCurrent() {
  if (currentScene) {
    graphGroup.remove(currentScene);
    currentScene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [];
      for (const m of mats) m.dispose?.();
    });
    currentScene = null;
  }
  synthSvc.clearAllNodes(); // release this graph's per-node panners (ids change)
  engine?.clear(); // dispose walkers → fade-out of persistent loop layers
  graph = picker = engine = highlight = audioRouter = null;
  nodesMesh = edgesMesh = null;
}

/** Load `file` from /models, replacing whatever is currently shown. */
async function loadModel(file) {
  if (!file || isLoading) return;
  isLoading = true;
  const url = `/models/${file}`;
  dom.model.textContent = "loading…";

  let result;
  try {
    result = await loadGraph(url);
  } catch (err) {
    console.error(`[Viewer] failed to load ${file}:`, err);
    dom.model.textContent = "load error";
    isLoading = false;
    return;
  }

  disposeCurrent();

  const { scene: gltfScene, nodes, edges, graph: g } = result;
  graph = g;
  currentScene = gltfScene;
  nodesMesh = nodes;
  edgesMesh = edges;
  graphGroup.add(gltfScene);
  scaleGraphToVolume(gltfScene);
  dom.model.textContent = file;

  // Seed the edge colour picker from the first model's exported material, then keep
  // the user's values; apply renderParams to this fresh model's meshes. (Nodes are
  // coloured by age, not by a single material colour, so they aren't seeded.)
  if (!renderInit) {
    if (edges)
      renderParams.edgeColor = `#${edges.material.color.getHexString()}`;
    renderInit = true;
  }
  applyRenderParams();

  // ── Highlight sink owns the per-instance aWave attributes + patched materials ──
  if (nodes) nodes.frustumCulled = false;
  if (edges) edges.frustumCulled = false;
  highlight = createHighlightSink({ nodes, edges });

  picker = createPicker(graph);
  engine = createTraversalEngine(graph, graph.stats, { audio: synthSvc });
  audioRouter = createAudioRouter({ graph, graphGroup, synth: synthSvc });
  engine.subscribe(highlight.onEvents);
  engine.subscribe(audioRouter.onEvents);
  // AutoCamera ("director") tracks walker positions from the same event stream and
  // needs the graph/group to resolve world positions of the nodes they visit.
  engine.subscribe(cameraMgr.autoOnEvents);
  cameraMgr.setAutoCameraContext({ graph, graphGroup });

  console.log(
    `[Viewer] fingerprint ready in ${graph.stats.computeMs.toFixed(2)} ms`,
  );

  dom.nodes.textContent = graph.numNodes.toLocaleString();
  dom.edges.textContent = graph.numEdges.toLocaleString();
  if (dom.interpretes) dom.interpretes.textContent = "0";
  dom.walkers.textContent = "0";

  modelState.file = file;
  try {
    localStorage.setItem("hm.model", file);
  } catch {
    /* almacenamiento no disponible */
  }
  frameScene(graphGroup);
  applySettingsToSinks(); // push persistent menu settings onto the fresh sinks
  // The engine was recreated for this model: drop any stale interprete selection.
  selectInterprete("template");
  lastEngineRev = engine.revision;
  isLoading = false;

  console.log(
    `[Viewer] loaded ${file}: ${graph.numNodes} nodes, ${graph.numEdges} edges, BVH nodes=${graph.spatial.nodeCount}`,
  );
}

// ── XR (AR) — controllers, teleport, controller-driven node picking ──────────
// getters are read lazily so picker/graphGroup reflect the currently loaded model.
const xr = initXR({
  renderer,
  scene,
  camera: cameraMgr.getCamera("orbital"),
  getPicker: () => picker,
  getGraphGroup: () => graphGroup,
  // On session end, restore the viewer's configured background/IBL (solid colour
  // or 360 image) instead of a hardcoded flat colour.
  restoreBackground: () => applyBackground(),
  onPick: (id) => {
    if (!walkerParams.addOnClick) return;
    synthSvc.start(); // first fire also unlocks the Web Audio context
    launchInterprete(id);
    console.log(
      `[Viewer] XR pick nodeId=${id} → interprete launched`,
      graph.stats.describe(id),
    );
  },
});

async function init() {
  // The sample manifest (plain JSON, no AudioContext) loads in parallel with the
  // model list; the ambient behaviour's sample select needs it before buildMenu.
  const [models] = await Promise.all([
    populateModelList(),
    synthSvc.loadManifest(),
  ]);
  const sampleNames = synthSvc.loops.sampleNames();
  setSampleOptions(sampleNames);
  if (!behaviorSettings.ambient.instrument && sampleNames.length)
    behaviorSettings.ambient.instrument = sampleNames[0];
  setupInput();

  // Restore the persisted node-colour config (attribute + palette) before the menu
  // is built, so the selectors and the first applyNodeColors() use the saved values.
  try {
    const saved = JSON.parse(localStorage.getItem("hm.color") || "{}");
    if (saved.colorAttr && saved.colorAttr in COLOR_ATTRS)
      renderParams.colorAttr = saved.colorAttr;
    if (saved.palette && saved.palette in PALETTES)
      renderParams.palette = saved.palette;
  } catch {
    /* almacenamiento no disponible o JSON inválido */
  }

  // Pick the initial model first so the Model tab's dropdown shows it selected,
  // then build the (async) menu once, then load.
  const initial = pickInitialFile(models);
  if (initial) modelState.file = initial;

  await buildMenu();

  if (initial) {
    await loadModel(initial);
  } else {
    dom.model.textContent = "no models";
  }
}

// ── Input: click to spawn a walker ──────────────────────────────────────────
function setupInput() {
  let downX = 0,
    downY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    // Ignore drags (those orbit the camera).
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
    if (!walkerParams.addOnClick) return; // spawning disabled from the menu
    if (!picker || !nodesMesh) return;
    const t0 = performance.now();
    const id = pickFromPointerEvent(
      picker,
      e,
      canvas,
      activeCamera(),
      graphGroup,
    );
    const dt = performance.now() - t0;
    if (id != null) {
      synthSvc.start(); // first click also unlocks the Web Audio context
      launchInterprete(id);
      console.log(
        `[Viewer] pick nodeId=${id} in ${dt.toFixed(3)} ms → interprete launched`,
        graph.stats.describe(id),
      );
    }
  });
}

/**
 * Launch an interprete of the selected behaviour at `nodeId`. The live menu
 * settings are snapshotted onto the interprete, so it keeps its own
 * traversal/pitch/range even if the panel is changed before the next launch.
 */
function launchInterprete(nodeId) {
  if (!engine) return;
  const behavior = getBehavior(behaviorState.id);
  // Deep clone so each walker owns an independent params object — nested values
  // (e.g. angular's modSlots array) would otherwise stay shared with the template
  // and across walkers, breaking per-walker editing.
  const params = structuredClone({
    ...behavior.defaults,
    ...walkerParams,
    ...settingsFor(behavior.id),
  });
  const id = engine.launch(behavior, nodeId, params);
  selectInterprete(id); // auto-select the fresh interprete so its params are editable now
}

// ── DynamicMenu control panel ───────────────────────────────────────────────
// Each former Tweakpane folder becomes a tab (folder name + FontAwesome icon).
// The menu is built once (createMenu is async); all values live in persistent
// state objects so it never needs rebuilding across model swaps.

/** Add a slider bound to obj[prop]; `after` runs after each committed change. */
function addSlider(parent, obj, prop, cfg, after) {
  parent
    .addItem({ type: "slider", initialValue: obj[prop], ...cfg })
    .onChange((v) => {
      obj[prop] = v;
      if (after) after();
    });
}

// ── Rebuildable per-selection folders (behaviour + camera) ───────────────────
// The "Orquesta" and "Camera" tabs each hold one folder whose contents
// depend on the current selection. On a change we clear the folder (removeItem
// the tracked handles) and repopulate it. `folderHelpers` returns add* wrappers
// bound to a folder that auto-track their handles into `items` for removal.
function folderHelpers(folder, items) {
  const track = (h) => {
    items.push(h);
    return h;
  };
  const bind = (type) => (obj, prop, cfg, after) =>
    track(
      folder
        .addItem({ type, initialValue: obj[prop], ...cfg })
        .onChange((v) => {
          obj[prop] = v;
          if (after) after();
        }),
    );
  return {
    addSlider: bind("slider"),
    addSelect: bind("select"),
    addSwitch: bind("switch"),
  };
}

let behFolder = null;
let behItems = [];

/** The interprete currently selected for editing, or null in 'template' mode. */
function currentInterprete() {
  if (interpreteSelState.id === "template" || !engine) return null;
  const id = Number(interpreteSelState.id);
  return engine.getInterpretes().find((itp) => itp.id === id) ?? null;
}

/**
 * Rebuild the "Parámetros" folder for the current selection. In 'template' mode it
 * binds the shared defaults of the selected behaviour (editing pre-configures the
 * next launch). When a live interprete is selected it binds that interprete's own
 * behaviour + params object (sonic edits take effect immediately) and appends a
 * "Borrar intérprete" button.
 */
function rebuildBehaviorFolder() {
  if (!behFolder) return;
  for (const h of behItems) behFolder.removeItem(h);
  behItems = [];

  const itp = currentInterprete();
  if (itp) {
    itp.behavior.buildMenu?.(
      behFolder,
      itp.params,
      folderHelpers(behFolder, behItems),
    );
    behItems.push(
      behFolder.addItem({
        type: "button",
        label: "Borrar intérprete",
        action: () => {
          engine.remove(itp.id);
          selectInterprete("template");
        },
      }),
    );
  } else {
    // 'template' mode (or the selected interprete is gone): edit the shared defaults.
    const beh = getBehavior(behaviorState.id);
    beh.buildMenu?.(
      behFolder,
      settingsFor(beh.id),
      folderHelpers(behFolder, behItems),
    );
  }
}

/** Build the { id → label } map for the "intérprete" select. */
function buildInterpreteOptions() {
  const opts = { template: "▶ próximo intérprete" };
  if (engine) {
    for (const itp of engine.getInterpretes()) {
      opts[itp.id] = `#${itp.id} ${itp.behavior.label} @n${itp.startNodeId}`;
    }
  }
  return opts;
}

/** Refresh the interprete select's options in place; fall back to template if the
 *  selected interprete has gone (died on finite energy, cleared, etc.). */
function refreshInterpreteSelect() {
  if (!interpreteSelectItem) return;
  interpreteSelectItem.updateOptions(buildInterpreteOptions());
  if (interpreteSelState.id !== "template" && !currentInterprete()) {
    interpreteSelState.id = "template";
    rebuildBehaviorFolder();
  }
  menu?.sync(); // push interpreteSelState.id back into the (listened) select UI
}

/** Select an interprete (or 'template') and rebuild the param folder + select UI. */
function selectInterprete(idOrTemplate) {
  interpreteSelState.id = String(idOrTemplate); // option keys are strings
  refreshInterpreteSelect();
  rebuildBehaviorFolder();
}

let camFolder = null;
let camItems = [];

/** Rebuild the camera folder with the selected camera's specific parameters. */
function rebuildCameraFolder() {
  if (!camFolder) return;
  for (const h of camItems) camFolder.removeItem(h);
  camItems = [];
  const { addSlider } = folderHelpers(camFolder, camItems);
  if (cameraState.camera === "orbital") {
    camItems.push(
      camFolder.addItem({
        type: "button",
        label: "frame graph (f)",
        action: frameGraphOrbital,
      }),
    );
  } else if (cameraState.camera === "drone") {
    addSlider(
      cameraParams,
      "droneSpeedLevel",
      { label: "speed", min: 1, max: 5, step: 1 },
      pushDrone,
    );
  } else if (cameraState.camera === "auto") {
    addSlider(
      cameraParams,
      "autoMinDuration",
      { label: "min dur (s)", min: 1, max: 10, step: 0.5 },
      pushAuto,
    );
    addSlider(
      cameraParams,
      "autoDurationRange",
      { label: "dur range (s)", min: 0, max: 15, step: 0.5 },
      pushAuto,
    );
    addSlider(
      cameraParams,
      "autoDistMin",
      { label: "dist min", min: 0.05, max: 1.5, step: 0.01 },
      pushAuto,
    );
    addSlider(
      cameraParams,
      "autoDistMax",
      { label: "dist max", min: 0.05, max: 1.5, step: 0.01 },
      pushAuto,
    );
    addSlider(
      cameraParams,
      "autoPosTau",
      { label: "smooth pos", min: 0.2, max: 4, step: 0.1 },
      pushAuto,
    );
    addSlider(
      cameraParams,
      "autoLookTau",
      { label: "smooth look", min: 0.2, max: 3, step: 0.1 },
      pushAuto,
    );
  }
}

/** Push the persistent menu settings onto the freshly created sinks (per load). */
function applySettingsToSinks() {
  if (highlight) {
    highlight.params.fadeFactor = highlightSettings.fadeFactor;
    highlight.params.edgePulseHalf = highlightSettings.edgePulseHalf;
  }
  if (audioRouter) audioRouter.params.enabled = audioSettings.enabled;
  synthSvc.loops.setEnabled(audioSettings.enabled); // the router only gates notes
  synthSvc.setVolumeDb(audioSettings.volumeDb);
  synthSvc.setCompressor({
    enabled: audioSettings.compEnabled,
    threshold: audioSettings.compThreshold,
    ratio: audioSettings.compRatio,
  });
}

// ── Help popup ───────────────────────────────────────────────────────────────
// Plain-language description of every per-node fingerprint attribute (the same
// keys offered by the Audio tab's "pitch" select, i.e. STAT_KEYS / graphStats.js).
const STAT_DESCRIPTIONS = {
  degree: "Number of edges connected to the node — its raw connectivity.",
  edgeLenMin: "Length of the shortest edge touching the node.",
  edgeLenMax: "Length of the longest edge touching the node.",
  edgeLenAvg: "Average length of the edges around the node.",
  edgeLenStd:
    "Spread (standard deviation) of those edge lengths — high means very uneven edges.",
  edgeLenSum: "Total length of all edges attached to the node.",
  neighborDegAvg:
    "Average degree of the node’s neighbours (how connected its surroundings are).",
  neighborDegMin: "Smallest degree among the node’s neighbours.",
  neighborDegMax: "Largest degree among the node’s neighbours.",
  triangles:
    "How many triangles the node takes part in (pairs of its neighbours that are themselves linked).",
  clustering:
    "Local clustering coefficient, 0–1: fraction of the node’s neighbours that are connected to each other.",
  dirBalance:
    "Directional balance of the edges, 0–1: 0 = neighbours surround the node evenly, 1 = they all pull to one side.",
  nbhdLinearity:
    "How line-like the local neighbourhood is (its points lie along a single direction).",
  nbhdPlanarity: "How plane-like / flat the local neighbourhood is.",
  nbhdSphericity: "How spherical / evenly 3D the local neighbourhood is.",
  centroidOffset:
    "Distance from the node to the average position (centroid) of its neighbours.",
  distToGlobalCentroid:
    "Distance from the node to the centroid of the whole graph.",
  localDensity:
    "How many other nodes sit within a fixed radius — spatial crowding around the node.",
  componentSize:
    "Number of nodes in the connected component the node belongs to.",
  geodesicFromCenter:
    "Hop distance (shortest path in edges) from the node nearest the graph’s centre.",
  age: "Creation order exported from the simulation — lower is older, higher is newer.",
};

/** Populate the help popup body from STAT_KEYS (built once, on first open). */
function buildHelpContent() {
  const body = document.getElementById("helpBody");
  if (!body || body.dataset.built) return;

  const intro = document.createElement("p");
  intro.className = "help-intro";
  intro.textContent =
    'Each node carries a "fingerprint" of properties computed once when the model loads, ' +
    "from its geometry and topology. Any of these can drive the sound via the Audio tab’s " +
    '"pitch" selector. Values are normalised to 0–1 before they map to pitch.';
  body.appendChild(intro);

  for (const key of STAT_KEYS) {
    const row = document.createElement("div");
    row.className = "prop";
    const name = document.createElement("div");
    name.className = "prop-name";
    name.textContent = key;
    const desc = document.createElement("div");
    desc.className = "prop-desc";
    desc.textContent = STAT_DESCRIPTIONS[key] ?? "—";
    row.appendChild(name);
    row.appendChild(desc);
    body.appendChild(row);
  }
  body.dataset.built = "1";
}

/** Show or hide the help popup. */
function toggleHelp(force) {
  const overlay = document.getElementById("helpOverlay");
  if (!overlay) return;
  const show = force ?? overlay.hidden;
  if (show) buildHelpContent();
  overlay.hidden = !show;
}

document
  .getElementById("helpClose")
  ?.addEventListener("click", () => toggleHelp(false));

// ── Viewer keyboard shortcuts ────────────────────────────────────────────────
// O/P cycle the colour palette, K/L cycle the colour attribute (both recolour the
// nodes and sync the menu selectors), F frames the orbital camera on the graph.
// (Camera 'c'/'r' live in CameraManager; the drone's i/o/j/k/l are disabled here.)
/** Persist the node-colour config (attribute + palette) across reloads. */
function persistColor() {
  try {
    localStorage.setItem(
      "hm.color",
      JSON.stringify({
        colorAttr: renderParams.colorAttr,
        palette: renderParams.palette,
      }),
    );
  } catch {
    /* almacenamiento no disponible */
  }
}

function cycleColorBy(mapObj, prop, dir) {
  const keys = Object.keys(mapObj);
  const i = Math.max(0, keys.indexOf(renderParams[prop]));
  renderParams[prop] = keys[(i + dir + keys.length) % keys.length];
  applyNodeColors();
  persistColor();
  menu?.sync();
}

window.addEventListener("keydown", (e) => {
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable)
    return;
  switch (e.key.toLowerCase()) {
    case "o":
      cycleColorBy(PALETTES, "palette", -1);
      break;
    case "p":
      cycleColorBy(PALETTES, "palette", 1);
      break;
    case "k":
      cycleColorBy(COLOR_ATTRS, "colorAttr", -1);
      break;
    case "l":
      cycleColorBy(COLOR_ATTRS, "colorAttr", 1);
      break;
    case "f":
      frameGraphOrbital();
      break;
    case "h": {
      // ocultar/mostrar el menú
      const tp = document.getElementById("tp");
      if (tp) tp.style.display = tp.style.display === "none" ? "" : "none";
      break;
    }
    default:
      return;
  }
});

async function buildMenu() {
  menu = await createMenu(document.getElementById("tp"), {
    collapsibleFolders: true,
  });

  // Live synth-level edits (volume + master compressor). Pitch/envelope are
  // per-interprete snapshots read at launch, so they need no live push.
  const pushAudio = () => {
    synthSvc.setVolumeDb(audioSettings.volumeDb);
    synthSvc.setCompressor({
      enabled: audioSettings.compEnabled,
      threshold: audioSettings.compThreshold,
      ratio: audioSettings.compRatio,
    });
  };

  // ── Model (load/swap the .glb) ──
  const tModel = menu.addTab("Model", "fa-cube");
  if (modelList.length) {
    tModel.addItem(modelState, "file", {
      type: "select",
      label: "file",
      options: Object.fromEntries(modelList.map((m) => [m.file, m.file])),
    });
    tModel.addItem({
      type: "button",
      label: "Load",
      action: () => loadModel(modelState.file),
    });
  } else {
    tModel.addItem({
      type: "select",
      label: "status",
      options: { none: "no models" },
    });
  }
  tModel.addItem({ type: "button", label: "help", action: () => toggleHelp() });

  // ── Rendering (node/edge colour + radius, background, hemi light) ──
  const tRender = menu.addTab("Rendering", "fa-palette");
  addSlider(
    tRender,
    renderParams,
    "nodeRadius",
    { label: "node radius", min: 0.1, max: 10, step: 0.1 },
    applyRenderParams,
  );
  addSlider(
    tRender,
    renderParams,
    "edgeRadius",
    { label: "edge radius", min: 0.1, max: 10, step: 0.1 },
    applyRenderParams,
  );
  addSlider(
    tRender,
    renderParams,
    "hemi",
    { label: "hemi light", min: 0, max: 2, step: 0.05 },
    applyRenderParams,
  );

  // Node colour: a chosen normalised attribute sampled through a multi-stop palette.
  // Bound + .listen() so the K/L and O/P keyboard shortcuts reflect into the UI via
  // menu.sync().
  tRender
    .addItem(renderParams, "colorAttr", {
      type: "select",
      label: "color ←",
      options: COLOR_ATTRS,
    })
    .onChange((v) => {
      renderParams.colorAttr = v;
      applyNodeColors();
      persistColor();
    })
    .listen();
  tRender
    .addItem(renderParams, "palette", {
      type: "select",
      label: "palette",
      options: Object.fromEntries(
        Object.entries(PALETTES).map(([k, p]) => [k, p.label]),
      ),
    })
    .onChange((v) => {
      renderParams.palette = v;
      applyNodeColors();
      persistColor();
    })
    .listen();
  addSlider(
    tRender,
    renderParams,
    "colorGamma",
    { label: "color gamma", min: 0.2, max: 5, step: 0.1 },
    applyNodeColors,
  );

  tRender
    .addItem({
      type: "slider",
      label: "edge hue",
      min: 0,
      max: 360,
      step: 1,
      initialValue: hexToHue(renderParams.edgeColor),
    })
    .onChange((v) => {
      renderParams.edgeColor = hueToHex(v, ...HUE_SL.edge);
      applyRenderParams();
    });
  addSlider(
    tRender,
    renderParams,
    "edgeMetal",
    { label: "edge metal", min: 0, max: 1, step: 0.05 },
    applyRenderParams,
  );
  addSlider(
    tRender,
    renderParams,
    "edgeRough",
    { label: "edge rough", min: 0.02, max: 1, step: 0.02 },
    applyRenderParams,
  );

  // background select — DynamicMenu's { key: label } map returns the KEY (the id).
  const bgOpts = { [SOLID_COLOR]: SOLID_COLOR };
  for (const b of IMAGE_BACKGROUNDS) bgOpts[b.id] = b.label;
  tRender
    .addItem({
      type: "select",
      label: "background",
      options: bgOpts,
      initialValue: renderParams.bgMode,
    })
    .onChange((v) => {
      renderParams.bgMode = v;
      applyRenderParams();
    });
  tRender
    .addItem({
      type: "slider",
      label: "bg hue",
      min: 0,
      max: 360,
      step: 1,
      initialValue: hexToHue(renderParams.bgColor),
    })
    .onChange((v) => {
      renderParams.bgColor = hueToHex(v, ...HUE_SL.bg);
      applyRenderParams();
    });

  // ── Camera (type selector + general FOV + per-camera folder) ──
  // Selector mirrors the 'c' key (kept in sync in the render loop); below it a
  // general FOV, then a folder with the selected camera's specific params
  // (none for orbital, fly speed for drone, cinematography for auto).
  const tCam = menu.addTab("Camera", "fa-video");
  tCam
    .addItem(cameraState, "camera", {
      type: "select",
      label: "tipo",
      options: { orbital: "orbital", drone: "drone", auto: "auto" },
    })
    .onChange((v) => {
      cameraState.camera = v;
      cameraMgr.setCamera(v);
      cameraMgr.setFov(cameraMgr.currentFov);
      rebuildCameraFolder();
    })
    .listen(); // .listen() + menu.sync() keep it in sync when 'c' cycles the camera
  addSlider(
    tCam,
    cameraParams,
    "fov",
    { label: "fov", min: 20, max: 110, step: 1 },
    () => cameraMgr.setFov(cameraParams.fov),
  );
  camFolder = tCam.addFolder("Parámetros");
  rebuildCameraFolder();
  pushDrone(); // align the camera classes with the menu defaults
  pushAuto();

  // ── Orquesta (comportamiento selector + shared movement + per-interprete folder) ──
  // The tab manages everything alive: the 'tipo' selector picks which Comportamiento
  // the next click launches; below it sit the movement params shared by every
  // behaviour, the list of live intérpretes, and a folder holding the selected
  // interprete's own controls, rebuilt by behaviour.buildMenu() on change.
  const tBeh = menu.addTab("Orquesta", "fa-music");
  // 'tipo' is the comportamiento for the NEXT launch (and the template's controls).
  // It only rebuilds the folder while in template mode — a live interprete keeps its
  // own behaviour on screen regardless of what the next launch will be.
  tBeh
    .addItem(behaviorState, "id", {
      type: "select",
      label: "comportamiento",
      options: Object.fromEntries(listBehaviors().map((b) => [b.id, b.label])),
    })
    .onChange((v) => {
      behaviorState.id = v;
      if (interpreteSelState.id === "template") rebuildBehaviorFolder();
    });
  // Movement params are snapshotted into each interprete at launch, so these only
  // configure the NEXT one (they can't retune an interprete already running).
  addSlider(tBeh, walkerParams, "hopIntervalMs", {
    label: "hop ms",
    min: 30,
    max: 600,
    step: 10,
  });
  tBeh.addItem(walkerParams, "energyMode", {
    type: "select",
    label: "energy",
    options: { infinite: "infinite", finite: "finite" },
  });
  addSlider(tBeh, walkerParams, "energyBudget", {
    label: "budget",
    min: 1,
    max: 500,
    step: 1,
  });
  addSlider(tBeh, walkerParams, "energyCost", {
    label: "cost",
    min: 1,
    max: 20,
    step: 1,
  });
  // Toggle whether a node click launches a new interprete (gated in setupInput / XR onPick).
  tBeh.addItem(walkerParams, "addOnClick", {
    type: "switch",
    label: "lanzar intérprete al click",
  });
  // Which interprete the Parámetros folder edits: the template, or one live interprete.
  interpreteSelectItem = tBeh
    .addItem(interpreteSelState, "id", {
      type: "select",
      label: "intérprete",
      options: buildInterpreteOptions(),
    })
    .onChange((v) => selectInterprete(v))
    .listen();
  tBeh.addItem({
    type: "button",
    label: "Vaciar orquesta",
    action: () => {
      if (!engine) return;
      engine.clear();
      highlight.reset();
      selectInterprete("template");
    },
  });
  // Per-behaviour controls live in this folder; populate it for the current pick.
  behFolder = tBeh.addFolder("Parámetros");
  rebuildBehaviorFolder();

  // ── Highlight ──
  const tHi = menu.addTab("Highlight", "fa-wand-magic-sparkles");
  addSlider(
    tHi,
    highlightSettings,
    "fadeFactor",
    { label: "fade", min: 0.8, max: 0.99, step: 0.005 },
    () => {
      if (highlight) highlight.params.fadeFactor = highlightSettings.fadeFactor;
    },
  );
  addSlider(
    tHi,
    highlightSettings,
    "edgePulseHalf",
    { label: "pulse pk", min: 0.1, max: 0.9, step: 0.05 },
    () => {
      if (highlight)
        highlight.params.edgePulseHalf = highlightSettings.edgePulseHalf;
    },
  );

  // ── Audio (general system params only — pitch/envelope are per-behaviour) ──
  const tAudio = menu.addTab("Audio", "fa-volume-high");
  tAudio
    .addItem({
      type: "switch",
      label: "enabled",
      initialValue: audioSettings.enabled,
    })
    .onChange((v) => {
      audioSettings.enabled = v;
      if (audioRouter) audioRouter.params.enabled = v;
      synthSvc.loops.setEnabled(v); // loop layers bypass the router
    });
  addSlider(
    tAudio,
    audioSettings,
    "volumeDb",
    { label: "vol dB", min: -40, max: 0, step: 1 },
    pushAudio,
  );

  // ── Master: dynamic compressor + brickwall limiter (anti-saturation) ──
  // The limiter at -1 dBFS always guards the output; the compressor smooths the
  // build-up when many walkers fire many overlapping notes.
  const tMaster = menu.addTab("Master", "fa-sliders");
  tMaster
    .addItem({
      type: "switch",
      label: "compressor",
      initialValue: audioSettings.compEnabled,
    })
    .onChange((v) => {
      audioSettings.compEnabled = v;
      pushAudio();
    });
  addSlider(
    tMaster,
    audioSettings,
    "compThreshold",
    { label: "thresh dB", min: -48, max: 0, step: 1 },
    pushAudio,
  );
  addSlider(
    tMaster,
    audioSettings,
    "compRatio",
    { label: "ratio", min: 1, max: 20, step: 1 },
    pushAudio,
  );

  // Render this same menu as a 3D panel inside VR/AR (shared state + interaction).
  xr.attachMenu(menu);
}

// ── Render loop ─────────────────────────────────────────────────────────────
let last = performance.now();
let fpsAccum = 0,
  fpsFrames = 0;

function loop(now) {
  const dtMs = now - last;
  last = now;

  cameraMgr.update(dtMs / 1000);
  xr.update(now / 1000, dtMs / 1000);

  // Keep the panel's camera dropdown in sync if 'c' cycled the camera.
  if (cameraState.camera !== cameraMgr.currentCameraType) {
    cameraState.camera = cameraMgr.currentCameraType;
    menu?.sync(); // re-read the .listen()-marked camera select into the menu UI
    rebuildCameraFolder(); // follow the active camera with its param folder
  }

  // Move the spatial-audio listener with the active camera so notes pan as the
  // viewer orbits (the synth positions each note at its node).
  if (synthSvc.started) {
    const cam = activeCamera();
    synthSvc.setListener({
      position: cam.position.toArray(),
      forward: cam.getWorldDirection(_fwd).toArray(),
      up: cam.up.toArray(),
    });
  }

  if (engine) {
    engine.update(dtMs); // advance walkers; emit events → highlight.onEvents
    highlight.update(engine.clock); // frame-paced visuals + partial GPU upload
    dom.walkers.textContent = String(engine.walkerCount);
    if (dom.interpretes)
      dom.interpretes.textContent = String(engine.interpreteCount);
    // Refresh the interprete select only when the set of interpretes changed (launch,
    // finish on finite energy, delete, clear) — not every frame.
    if (engine.revision !== lastEngineRev) {
      lastEngineRev = engine.revision;
      refreshInterpreteSelect();
    }
  }

  renderer.render(scene, activeCamera());

  // FPS readout (~2 Hz).
  fpsAccum += dtMs;
  fpsFrames++;
  if (fpsAccum >= 500) {
    dom.fps.textContent = Math.round((fpsFrames * 1000) / fpsAccum);
    fpsAccum = 0;
    fpsFrames = 0;
  }
}

window.addEventListener("resize", () => {
  cameraMgr.setAspect(window.innerWidth / window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init().catch((err) => {
  console.error("[Viewer] init failed:", err);
  dom.model.textContent = "load error";
});
renderer.setAnimationLoop(loop);

// Debug/scripting hook (console + automated verification): the live engine and
// synth service, plus the same launch path the click handler uses.
window.__hm = {
  get engine() { return engine; },
  get graph() { return graph; },
  synthSvc,
  behaviorState,
  behaviorSettings,
  launchInterprete,
};
