/**
 * waveMaterial.js – per-instance wave highlight on top of MeshStandardMaterial.
 *
 * Each InstancedMesh (nodes, edges) gets an extra per-instance attribute `aWave`
 * (Float32, 1 component, in [-1,1]). The magnitude is the highlight intensity;
 * the SIGN selects which walker family painted it: positive → `hotColor` (parent
 * / regular walkers), negative → `childColor` (reproduced children). The material
 * is patched via onBeforeCompile so the shader reads `aWave` per instance and:
 *   • mixes the base colour toward the chosen colour by |aWave|
 *   • adds an emissive boost proportional to |aWave|
 *
 * The CPU writes only the indices that change into the attribute's array and
 * flushes a partial GPU update (addUpdateRange), so a live wave never re-uploads
 * the full buffer — only the ~hot subset.
 */

import { Color, InstancedBufferAttribute } from 'three';

/**
 * Attach an `aWave` instanced attribute (initialised to 0) to a geometry.
 * @param {import('three').BufferGeometry} geometry
 * @param {number} instanceCount
 * @returns {InstancedBufferAttribute}
 */
export function attachWaveAttribute(geometry, instanceCount) {
  const arr = new Float32Array(instanceCount); // zero-filled
  const attr = new InstancedBufferAttribute(arr, 1);
  attr.setUsage(0x88e8); // DYNAMIC_DRAW — updated frequently
  geometry.setAttribute('aWave', attr);
  return attr;
}

/**
 * Patch a MeshStandardMaterial in place to render the wave highlight.
 * @param {import('three').MeshStandardMaterial} material
 * @param {{ hotColor?: import('three').ColorRepresentation, childColor?: import('three').ColorRepresentation, emissiveBoost?: number }} [opts]
 */
export function applyWaveMaterial(material, opts = {}) {
  const hot = new Color(opts.hotColor ?? '#ff5a2a');
  const child = new Color(opts.childColor ?? '#2ad1ff');
  const emissiveBoost = opts.emissiveBoost ?? 2.2;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHotColor = { value: hot };
    shader.uniforms.uChildColor = { value: child };
    shader.uniforms.uEmissiveBoost = { value: emissiveBoost };

    // Pass aWave from vertex → fragment.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aWave;
         varying float vWave;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWave = aWave;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vWave;
         uniform vec3 uHotColor;
         uniform vec3 uChildColor;
         uniform float uEmissiveBoost;`,
      )
      // Tint toward hot (parent) or child colour by |vWave|; sign picks the family.
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float wAmt = clamp(abs(vWave), 0.0, 1.0);
         vec3 waveCol = vWave < 0.0 ? uChildColor : uHotColor;
         diffuseColor.rgb = mix(diffuseColor.rgb, waveCol, wAmt);`,
      )
      // Boost emission so highlighted elements glow regardless of lighting.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance += waveCol * (wAmt * uEmissiveBoost);`,
      );
  };

  // Force a recompile if the material was already used.
  material.needsUpdate = true;
  return material;
}

/**
 * Flush a wave attribute to the GPU. If many indices are hot, a single full
 * update of just this (small, 1-component) attribute is cheaper than tracking
 * scattered ranges; for a tight hot set we mark the min..max range.
 *
 * @param {InstancedBufferAttribute} attr
 * @param {Iterable<number>} [hotIds] optional hot index set for a tight range
 */
export function flushWaveAttribute(attr, hotIds) {
  attr.clearUpdateRanges?.();
  if (hotIds) {
    let min = Infinity, max = -Infinity;
    for (const id of hotIds) { if (id < min) min = id; if (id > max) max = id; }
    if (max >= min) {
      // addUpdateRange(start, count) on the underlying array (1 comp/instance).
      attr.addUpdateRange(min, max - min + 1);
    }
  }
  attr.needsUpdate = true;
}
