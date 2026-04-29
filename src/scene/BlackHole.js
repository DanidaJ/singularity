// ==============================
// BlackHole — Full-screen shader quad
// ==============================
// Renders the black hole using a custom fragment shader that performs
// Schwarzschild geodesic raymarching for every pixel.

import * as THREE from 'three';
import vertexShader from '../shaders/blackhole.vert';
import fragmentShader from '../shaders/blackhole.frag';
import { DEFAULTS } from '../utils/constants.js';

export class BlackHole {
  constructor() {
    this.params = { ...DEFAULTS };

    // Temp vectors for extracting camera basis
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._forward = new THREE.Vector3();

    // Create uniforms
    this.uniforms = {
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_time: { value: 0.0 },
      u_cameraPos: { value: new THREE.Vector3() },
      u_cameraRight: { value: new THREE.Vector3() },
      u_cameraUp: { value: new THREE.Vector3() },
      u_cameraForward: { value: new THREE.Vector3() },
      u_fov: { value: DEFAULTS.cameraFov },
      u_aspectRatio: { value: window.innerWidth / window.innerHeight },

      // Black hole
      u_blackHoleMass: { value: DEFAULTS.blackHoleMass },
      u_blackHolePos: { value: new THREE.Vector3(0, 0, 0) },

      // Accretion disk
      u_diskInnerRadius: { value: DEFAULTS.diskInnerRadius },
      u_diskOuterRadius: { value: DEFAULTS.diskOuterRadius },
      u_diskSpeed: { value: DEFAULTS.diskSpeed },
      u_diskTemperature: { value: DEFAULTS.diskTemperature },
      u_diskBrightness: { value: DEFAULTS.diskBrightness },
      u_diskTurbulence: { value: DEFAULTS.diskTurbulence },

      // Background
      u_backgroundCube: { value: null },
      u_hasBackground: { value: false },

      // Integration
      u_maxSteps: { value: DEFAULTS.maxSteps },
      u_stepSize: { value: DEFAULTS.stepSize },

      // Preset mode
      u_presetMode: { value: DEFAULTS.presetMode },

      // Debug
      u_debugMode: { value: 0 },
    };

    // Full-screen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      depthWrite: false,
      depthTest: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;

    // Own scene + ortho camera for rendering the full-screen quad
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Extract camera basis vectors and update uniforms each frame
   */
  update(time, perspectiveCamera) {
    this.uniforms.u_time.value = time;
    this.uniforms.u_cameraPos.value.copy(perspectiveCamera.position);

    // Extract basis vectors from camera's world matrix
    const m = perspectiveCamera.matrixWorld.elements;
    // Column 0 = right, Column 1 = up, Column 2 = -forward (camera looks down -Z in local space)
    this._right.set(m[0], m[1], m[2]).normalize();
    this._up.set(m[4], m[5], m[6]).normalize();
    this._forward.set(-m[8], -m[9], -m[10]).normalize(); // negate because camera looks down -Z

    this.uniforms.u_cameraRight.value.copy(this._right);
    this.uniforms.u_cameraUp.value.copy(this._up);
    this.uniforms.u_cameraForward.value.copy(this._forward);

    this.uniforms.u_fov.value = perspectiveCamera.fov;
    this.uniforms.u_aspectRatio.value = perspectiveCamera.aspect;
  }

  resize(width, height) {
    this.uniforms.u_resolution.value.set(width, height);
    this.uniforms.u_aspectRatio.value = width / height;
  }

  /**
   * Render the black hole shader (call renderer.setRenderTarget beforehand)
   */
  render(renderer) {
    renderer.render(this.scene, this.orthoCamera);
  }

  setParam(key, value) {
    const uniformKey = 'u_' + key;
    if (this.uniforms[uniformKey]) {
      this.uniforms[uniformKey].value = value;
    }
    this.params[key] = value;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
