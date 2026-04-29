// ==============================
// PostFX — Post-processing pipeline
// ==============================
// EffectComposer with bloom, chromatic aberration, vignette, and film grain.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DEFAULTS } from '../utils/constants.js';

// Custom post-processing shader: chromatic aberration + vignette + film grain
const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    u_time: { value: 0.0 },
    u_resolution: { value: new THREE.Vector2() },
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

    // Film grain
    float grain(vec2 uv, float t) {
      return fract(sin(dot(uv + t, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float dist = length(center);

      // Chromatic aberration — increases toward edges
      float aberration = u_chromaticAberration * dist * dist;
      vec2 dir = normalize(center) * aberration;

      float r = texture2D(tDiffuse, uv + dir).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir).b;

      vec3 color = vec3(r, g, b);

      // Vignette
      float vig = 1.0 - dist * dist * u_vignette * 2.0;
      vig = clamp(vig, 0.0, 1.0);
      vig = smoothstep(0.0, 1.0, vig);
      color *= vig;

      // Subtle film grain
      float grainAmount = 0.03;
      float g1 = grain(uv * u_resolution, u_time) * grainAmount;
      color += g1 - grainAmount * 0.5;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.params = {
      bloomIntensity: DEFAULTS.bloomIntensity,
      bloomThreshold: DEFAULTS.bloomThreshold,
      bloomRadius: DEFAULTS.bloomRadius,
      chromaticAberration: DEFAULTS.chromaticAberration,
      vignette: DEFAULTS.vignette,
    };

    const size = renderer.getSize(new THREE.Vector2());

    // Effect composer
    this.composer = new EffectComposer(renderer);

    // Render pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      this.params.bloomIntensity,
      this.params.bloomRadius,
      this.params.bloomThreshold
    );
    this.composer.addPass(this.bloomPass);

    // Custom post shader
    this.postPass = new ShaderPass(PostShader);
    this.postPass.uniforms.u_resolution.value.copy(size);
    this.composer.addPass(this.postPass);
  }

  update(time) {
    this.postPass.uniforms.u_time.value = time;
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.postPass.uniforms.u_resolution.value.set(width, height);
  }

  setParam(key, value) {
    this.params[key] = value;

    switch (key) {
      case 'bloomIntensity':
        this.bloomPass.strength = value;
        break;
      case 'bloomThreshold':
        this.bloomPass.threshold = value;
        break;
      case 'bloomRadius':
        this.bloomPass.radius = value;
        break;
      case 'chromaticAberration':
        this.postPass.uniforms.u_chromaticAberration.value = value;
        break;
      case 'vignette':
        this.postPass.uniforms.u_vignette.value = value;
        break;
    }
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}
