// Engineering-style JET map for post-processing views.
export const SIMULATION_JET_STOPS = [
  [0.0, [0, 0, 131]],
  [0.125, [0, 60, 170]],
  [0.25, [5, 120, 220]],
  [0.375, [40, 200, 255]],
  [0.5, [125, 255, 170]],
  [0.625, [220, 255, 55]],
  [0.75, [255, 190, 0]],
  [0.875, [250, 60, 0]],
  [1.0, [128, 0, 0]],
];

// Backward-compatible alias for existing imports.
export const SIMULATION_RAINBOW_STOPS = SIMULATION_JET_STOPS;

// ParaView-style diverging preset.
export const SIMULATION_COOL_TO_WARM_STOPS = [
  [0.0, [59, 76, 192]],
  [0.2, [102, 126, 221]],
  [0.4, [170, 197, 255]],
  [0.5, [221, 221, 221]],
  [0.6, [247, 184, 156]],
  [0.8, [220, 110, 87]],
  [1.0, [180, 4, 38]],
];

export const SIMULATION_VIRIDIS_STOPS = [
  [0.0, [68, 1, 84]],
  [0.2, [59, 82, 139]],
  [0.4, [33, 145, 140]],
  [0.6, [94, 201, 98]],
  [0.8, [170, 220, 50]],
  [1.0, [253, 231, 37]],
];

export const SIMULATION_BLACK_BODY_STOPS = [
  [0.0, [0, 0, 0]],
  [0.2, [120, 0, 0]],
  [0.4, [180, 30, 0]],
  [0.6, [230, 120, 0]],
  [0.8, [255, 210, 80]],
  [1.0, [255, 255, 255]],
];

export const SIMULATION_COLORMAP_PRESETS = {
  jet: SIMULATION_JET_STOPS,
  rainbow: SIMULATION_RAINBOW_STOPS,
  coolToWarm: SIMULATION_COOL_TO_WARM_STOPS,
  viridis: SIMULATION_VIRIDIS_STOPS,
  blackBody: SIMULATION_BLACK_BODY_STOPS,
};

export const getSimulationColormapStops = (preset = 'jet') => (
  SIMULATION_COLORMAP_PRESETS[preset] || SIMULATION_JET_STOPS
);

export const reverseColorStops = (stops) => {
  if (!Array.isArray(stops)) return [];
  return [...stops]
    .reverse()
    .map(([position, rgb]) => [1 - position, rgb]);
};

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
