export const SIMULATION_RAINBOW_STOPS = [
  [0.0, [0, 0, 180]],
  [0.18, [0, 104, 255]],
  [0.36, [0, 214, 255]],
  [0.55, [0, 196, 82]],
  [0.74, [245, 226, 32]],
  [0.88, [255, 128, 0]],
  [1.0, [180, 0, 0]],
];

export const buildColorLookupTable = (stops, size = 256) => {
  const lut = new Uint8ClampedArray(size * 4);
  if (!Array.isArray(stops) || stops.length === 0) {
    return lut;
  }

  for (let i = 0; i < size; i++) {
    const t = size === 1 ? 0 : i / (size - 1);
    let left = stops[0];
    let right = stops[stops.length - 1];

    for (let j = 1; j < stops.length; j++) {
      if (t <= stops[j][0]) {
        left = stops[j - 1];
        right = stops[j];
        break;
      }
    }

    const span = Math.max(1e-6, right[0] - left[0]);
    const mix = Math.max(0, Math.min(1, (t - left[0]) / span));
    const offset = i * 4;
    lut[offset] = Math.round(left[1][0] + (right[1][0] - left[1][0]) * mix);
    lut[offset + 1] = Math.round(left[1][1] + (right[1][1] - left[1][1]) * mix);
    lut[offset + 2] = Math.round(left[1][2] + (right[1][2] - left[1][2]) * mix);
    lut[offset + 3] = 255;
  }

  return lut;
};

export const buildCssGradient = (stops, direction = '180deg') => {
  if (!Array.isArray(stops) || stops.length === 0) {
    return `linear-gradient(${direction}, rgb(0, 0, 0), rgb(255, 255, 255))`;
  }

  const colorStops = stops.map(([position, rgb]) => {
    const percent = Math.max(0, Math.min(100, position * 100));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) ${percent}%`;
  });
  return `linear-gradient(${direction}, ${colorStops.join(', ')})`;
};

export const buildPlotlyColorscale = (stops) => {
  if (!Array.isArray(stops)) return [];
  return stops.map(([position, rgb]) => [position, `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`]);
};
