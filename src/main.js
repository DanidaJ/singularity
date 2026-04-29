// ==============================
// Main — Application Entry Point
// ==============================
// Layered rendering pipeline:
// 1. Black hole shader (full-screen quad, ortho camera) — rendered at reduced internal resolution
// 2. Particles (perspective camera, additive blend)
// 3. Post-processing (bloom, chromatic aberration, vignette)

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BlackHole } from './scene/BlackHole.js';
import { Particles } from './scene/Particles.js';
import { MilkyWay } from './scene/MilkyWay.js';
import { Controls } from './controls/Controls.js';
import { DEFAULTS } from './utils/constants.js';

// ---- Performance: BH shader resolution scale ----
// The raymarching shader is the bottleneck. Rendering it at 70% resolution
// saves ~50% fragment work. Bloom pass masks any quality difference.
const BH_RESOLUTION_SCALE = 0.7;

// ---- Initialize ----
const canvas = document.getElementById('webgl-canvas');
const loadingScreen = document.getElementById('loading-screen');
const fpsCounter = document.getElementById('fps-counter');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x000000, 1);
renderer.autoClear = false;

// Camera
const camera = new THREE.PerspectiveCamera(
  DEFAULTS.cameraFov,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 6, DEFAULTS.cameraDistance);
camera.lookAt(0, 0, 0);

// Scene for particles
const scene = new THREE.Scene();

// ---- Modules ----
const blackHole = new BlackHole();
const particles = new Particles(scene);
const milkyWay = new MilkyWay(scene);

// ---- Composited Scene ----
// We render the BH shader to a texture, display it as a background quad
// in a composited scene with particles, and run the composer on THAT scene.
const compositedScene = new THREE.Scene();

// BH render target — at reduced resolution for performance
const dpr = Math.min(window.devicePixelRatio, 2);
const bhRT = new THREE.WebGLRenderTarget(
  Math.floor(window.innerWidth * dpr * BH_RESOLUTION_SCALE),
  Math.floor(window.innerHeight * dpr * BH_RESOLUTION_SCALE),
  {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  }
);

// Background quad showing BH render
const bgQuadGeo = new THREE.PlaneGeometry(2, 2);
const bgQuadMat = new THREE.MeshBasicMaterial({
  map: bhRT.texture,
  depthWrite: false,
  depthTest: false,
});
const bgQuad = new THREE.Mesh(bgQuadGeo, bgQuadMat);
bgQuad.frustumCulled = false;
bgQuad.renderOrder = -1;
compositedScene.add(bgQuad);

// Ortho camera for the background quad
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---- Post-Processing ----
const composer = new EffectComposer(renderer);

// Custom render pass that renders our layered scene
class CustomRenderPass {
  constructor() {
    this.enabled = true;
    this.needsSwap = true;
    this.clear = true;
    this.renderToScreen = false;
  }
  setSize() {}
  render(renderer, writeBuffer /*, readBuffer */) {
    renderer.setRenderTarget(writeBuffer);
    renderer.clear(true, true, true);

    // Draw BH texture as background
    renderer.render(compositedScene, bgCamera);

    // Draw particles on top
    renderer.clearDepth();
    renderer.render(scene, camera);
  }
  dispose() {}
}

const customPass = new CustomRenderPass();
composer.addPass(customPass);

// Bloom
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  DEFAULTS.bloomIntensity,
  DEFAULTS.bloomRadius,
  DEFAULTS.bloomThreshold
);
composer.addPass(bloomPass);

// Custom post shader
const postShader = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_chromaticAberration: { value: DEFAULTS.chromaticAberration },
    u_vignette: { value: DEFAULTS.vignette },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_chromaticAberration;
    uniform float u_vignette;
    varying vec2 vUv;

    float grain(vec2 uv, float t) {
      return fract(sin(dot(uv + t, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float dist = length(center);

      float aberration = u_chromaticAberration * dist * dist;
      vec2 dir = normalize(center + 0.001) * aberration;

      float r = texture2D(tDiffuse, uv + dir).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir).b;
      vec3 color = vec3(r, g, b);

      // Vignette
      float vig = 1.0 - dist * dist * u_vignette * 2.0;
      vig = smoothstep(0.0, 1.0, clamp(vig, 0.0, 1.0));
      color *= vig;

      // Film grain
      float grainAmt = 0.025;
      float g1 = grain(uv * u_resolution, u_time) * grainAmt;
      color += g1 - grainAmt * 0.5;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
composer.addPass(postShader);

// PostFX interface
const postFX = {
  params: { ...DEFAULTS },
  setParam(key, value) {
    this.params[key] = value;
    switch (key) {
      case 'bloomIntensity': bloomPass.strength = value; break;
      case 'bloomThreshold': bloomPass.threshold = value; break;
      case 'bloomRadius': bloomPass.radius = value; break;
      case 'chromaticAberration': postShader.uniforms.u_chromaticAberration.value = value; break;
      case 'vignette': postShader.uniforms.u_vignette.value = value; break;
    }
  },
};

const controls = new Controls(camera, canvas, blackHole, particles, postFX, milkyWay);

// ---- Animation Loop ----
const clock = new THREE.Clock();
let frameCount = 0;
let fpsTime = 0;

let particleAccum = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controls.update(delta);
  camera.updateMatrixWorld();
  blackHole.update(elapsed, camera);
  milkyWay.update(elapsed);

  // Update particles at a fixed physics rate (skip frames if needed)
  particleAccum += delta;
  if (particleAccum > 0.016) { // ~60Hz physics
    particles.update(particleAccum * 10);
    particleAccum = 0;
  }

  postShader.uniforms.u_time.value = elapsed;

  // ---- Step 1: Render BH shader to its render target (reduced resolution) ----
  renderer.setRenderTarget(bhRT);
  renderer.clear(true, true, true);
  blackHole.render(renderer);

  // ---- Step 2: Compose & post-process to screen ----
  renderer.setRenderTarget(null);
  composer.render();

  // FPS — update the counter element only if it exists (it may be recreated by preset switching)
  frameCount++;
  fpsTime += delta;
  if (fpsTime >= 0.5) {
    const fpsEl = document.getElementById('fps-counter');
    if (fpsEl) fpsEl.textContent = Math.round(frameCount / fpsTime);
    frameCount = 0;
    fpsTime = 0;
  }
}

// ---- Resize ----
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  blackHole.resize(w, h);
  bhRT.setSize(
    Math.floor(w * dpr * BH_RESOLUTION_SCALE),
    Math.floor(h * dpr * BH_RESOLUTION_SCALE)
  );
  composer.setSize(w, h);
  postShader.uniforms.u_resolution.value.set(w, h);
}
window.addEventListener('resize', onResize);

// ---- Start ----
setTimeout(() => loadingScreen.classList.add('hidden'), 1500);
animate();

console.log(
  '%c⚫ SINGULARITY — Schwarzschild Geodesic Raymarcher',
  'color: #ff6b35; font-size: 14px; font-weight: bold;'
);
console.log(
  '%cGeodesic integration: Leapfrog | Steps: ' + DEFAULTS.maxSteps + ' | r_s = ' + (2 * DEFAULTS.blackHoleMass).toFixed(1),
  'color: #4fc3f7; font-size: 11px;'
);
