// ==============================
// Physical & Simulation Constants
// ==============================

export const PRESET_MODES = {
  custom: 0,
  interstellar: 1,
  quasar: 2,
  supermassive: 3,
};

export const DEFAULTS = {
  // Black hole
  blackHoleMass: 1.0,          // M=1 → r_s = 2.0
  blackHolePos: [0, 0, 0],

  // Accretion disk
  diskInnerRadius: 3.0,        // Just outside photon sphere (1.5 * r_s)
  diskOuterRadius: 14.0,       // Wide disk like Gargantua
  diskSpeed: 0.5,
  diskTemperature: 1.0,
  diskBrightness: 1.0,         // Controlled brightness — lets ring bands show through
  diskTurbulence: 0.3,         // Very clean bands — Gargantua has minimal turbulence

  // Integration — Leapfrog integrator with adaptive stepping
  // Balanced for visual accuracy and performance
  maxSteps: 250,
  stepSize: 0.25,

  // Camera
  cameraDistance: 22.0,
  cameraFov: 50,

  // Particles
  particleCount: 1500,
  particleMinRadius: 4.0,
  particleMaxRadius: 20.0,
  particleSpeed: 0.3,
  particleGlow: 1.0,

  // Post-processing
  bloomIntensity: 0.4,         // Subtle bloom — prevents washing out ring structure
  bloomThreshold: 0.75,        // Only the very brightest areas bloom
  bloomRadius: 0.25,           // Tight glow, not a big haze
  chromaticAberration: 0.002,
  vignette: 0.3,

  // Preset mode
  presetMode: 0,
};

// Preset configurations
export const PRESETS = {
  interstellar: {
    presetMode: PRESET_MODES.interstellar,
    blackHoleMass: 1.0,
    diskInnerRadius: 3.0,
    diskOuterRadius: 14.0,
    diskSpeed: 0.3,
    diskBrightness: 0.85,
    diskTurbulence: 0.15,
    bloomIntensity: 0.25,
    bloomThreshold: 0.8,
    bloomRadius: 0.2,
    chromaticAberration: 0.001,
    vignette: 0.25,
    maxSteps: 250,
    stepSize: 0.2,
    // Camera: slightly elevated to show lensed arcs above and below
    cameraPosition: [0, 8, 22],
    autoRotateSpeed: 0.1,
  },
  quasar: {
    presetMode: PRESET_MODES.quasar,
    blackHoleMass: 1.5,
    diskInnerRadius: 4.5,
    diskOuterRadius: 20.0,
    diskSpeed: 1.0,
    diskBrightness: 2.8,
    diskTurbulence: 1.8,
    bloomIntensity: 0.6,          // Toned down — jets shouldn't blow out
    bloomThreshold: 0.55,
    bloomRadius: 0.4,
    chromaticAberration: 0.004,
    vignette: 0.4,
    maxSteps: 200,
    stepSize: 0.25,
    // Camera: side view to show jets
    cameraPosition: [18, 12, 18],
    autoRotateSpeed: 0.2,
  },
  supermassive: {
    presetMode: PRESET_MODES.supermassive,
    blackHoleMass: 1.0,
    diskInnerRadius: 3.0,
    diskOuterRadius: 30.0,          // Wide disk for more arm winding
    diskSpeed: 0.12,                // Very slow galactic rotation
    diskBrightness: 1.8,            // Compensate for steep exponential disk falloff
    diskTurbulence: 0.4,
    bloomIntensity: 0.2,            // Minimal bloom — galaxy shouldn't glow
    bloomThreshold: 0.88,           // Only core nucleus blooms
    bloomRadius: 0.2,
    chromaticAberration: 0.001,
    vignette: 0.2,
    maxSteps: 250,
    stepSize: 0.22,
    // Camera: elevated ~55° for near-face-on view of spiral arms
    cameraPosition: [0, 28, 18],
    autoRotateSpeed: 0.05,
  },
};

// Preset display metadata
export const PRESET_META = {
  custom: {
    name: 'Custom',
    subtitle: 'Schwarzschild Geodesic',
    description: 'Free-form black hole simulation',
    icon: '⚫',
    stats: {
      'SCHWARZSCHILD RADIUS': '2.00',
      'PHOTON SPHERE': '3.00',
    },
    hudSubtitle: 'Schwarzschild Geodesic Simulation',
  },
  interstellar: {
    name: 'Gargantua',
    subtitle: 'Interstellar',
    description: 'A 100 million M☉ rotating black hole',
    icon: '🌀',
    stats: {
      'MASS': '100M M☉',
      'TYPE': 'Kerr Black Hole',
      'SCHWARZSCHILD RADIUS': '2.00',
      'ISCO': '3.0 rₛ',
    },
    hudSubtitle: 'Gargantua — Interstellar (2014)',
  },
  quasar: {
    name: 'TON 618',
    subtitle: 'Quasar',
    description: 'The most massive black hole observed',
    icon: '💥',
    stats: {
      'MASS': '66B M☉',
      'LUMINOSITY': '4×10⁴⁰ W',
      'JET VELOCITY': '0.99c',
      'REDSHIFT': 'z = 2.219',
    },
    hudSubtitle: 'TON 618 — Ultramassive Quasar',
  },
  supermassive: {
    name: 'Sgr A*',
    subtitle: 'Milky Way Core',
    description: 'The supermassive black hole at our galactic center',
    icon: '🌌',
    stats: {
      'MASS': '4M M☉',
      'DISTANCE': '26,000 ly',
      'CONSTELLATION': 'Sagittarius',
      'SHADOW': '~52 μas',
    },
    hudSubtitle: 'Sagittarius A* — Milky Way Center',
  },
};
