/**
 * pitch.js – shared note/scale helpers for behaviours. Centralises the
 * normalised-value → quantised-pitch mapping that used to live inline in
 * classic.js, plus a degree-index → pitch mapping used by the cumulative pitch
 * modes of the angular behaviour. Frequencies are in Hz (A4 = 440).
 */

const A4 = 440;

/** Semitone offsets within an octave for each named scale. */
export const SCALES = {
  pentatonic: [0, 2, 4, 7, 9],            // major pentatonic
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],     // natural minor
  wholeTone:  [0, 2, 4, 6, 8, 10],
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** MIDI note number → frequency in Hz. */
export const midiToFreq = (m) => A4 * Math.pow(2, (m - 69) / 12);

const scaleOf = (name) => SCALES[name] ?? SCALES.pentatonic;

/**
 * Map a normalised value n∈[0,1] to a quantised pitch across `octaves` octaves
 * of `scaleName`, anchored at C{baseOctave}. (Same math as the old classic
 * noteFor, generalised to any scale.)
 */
export function quantizeNormToScale(n, scaleName, baseOctave, octaves) {
  const scale = scaleOf(scaleName);
  const steps = Math.max(1, octaves) * scale.length;
  const i = Math.min(steps - 1, Math.floor(n * steps));
  const octave = Math.floor(i / scale.length);
  const degree = i % scale.length;
  const baseMidi = (baseOctave + 1) * 12;            // MIDI of C{baseOctave}
  return midiToFreq(baseMidi + octave * 12 + scale[degree]);
}

/**
 * Map an integer scale-degree index (may be negative or large) to a pitch,
 * walking up/down the scale and wrapping octaves. Used by the cumulative pitch
 * modes where each edge nudges the index up or down.
 */
export function degreeToFreq(index, scaleName, baseOctave) {
  const scale = scaleOf(scaleName);
  const L = scale.length;
  const octave = Math.floor(index / L);
  const degree = ((index % L) + L) % L;
  const baseMidi = (baseOctave + 1) * 12;
  return midiToFreq(baseMidi + octave * 12 + scale[degree]);
}

/** Number of degrees in a scale (for sizing the cumulative index range). */
export const scaleLength = (scaleName) => scaleOf(scaleName).length;
