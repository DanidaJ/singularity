// ==============================
// Particles — Orbiting debris / stars
// ==============================
// Uses InstancedMesh for GPU-efficient rendering of thousands of particles
// orbiting the black hole with Newtonian gravity + small GR correction.

import * as THREE from 'three';
import { DEFAULTS } from '../utils/constants.js';

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.count = DEFAULTS.particleCount;
    this.params = {
      speed: DEFAULTS.particleSpeed,
      glow: DEFAULTS.particleGlow,
      minRadius: DEFAULTS.particleMinRadius,
      maxRadius: DEFAULTS.particleMaxRadius,
    };

    // Particle data arrays
    this.positions = new Float32Array(this.count * 3);
    this.velocities = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.colors = new Float32Array(this.count * 3);
    this.lifetimes = new Float32Array(this.count);

    // Create geometry with BufferAttributes
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));

    // Custom shader material for glowing points
    this.material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vDist;

        void main() {
          vColor = aColor;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vDist = -mvPos.z;
          gl_PointSize = aSize * (200.0 / vDist);
          gl_PointSize = clamp(gl_PointSize, 0.5, 12.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vDist;

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;

          // Soft glow falloff
          float glow = exp(-d * 6.0);
          float core = smoothstep(0.15, 0.0, d);

          vec3 color = vColor * (glow * 0.6 + core * 1.5);
          float alpha = glow * 0.8;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);

    // Initialize particles
    this._initParticles();
  }

  _initParticles() {
    for (let i = 0; i < this.count; i++) {
      this._resetParticle(i);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
  }

  _resetParticle(i) {
    const i3 = i * 3;

    // Random orbital radius
    const radius = this.params.minRadius + Math.random() * (this.params.maxRadius - this.params.minRadius);

    // Random angle
    const theta = Math.random() * Math.PI * 2;

    // Slight vertical spread
    const ySpread = (Math.random() - 0.5) * 0.5;

    // Position on orbital ring
    this.positions[i3] = Math.cos(theta) * radius;
    this.positions[i3 + 1] = ySpread;
    this.positions[i3 + 2] = Math.sin(theta) * radius;

    // Circular orbital velocity: v = sqrt(GM/r), tangent to orbit
    const orbitalSpeed = Math.sqrt(1.0 / radius) * this.params.speed;
    this.velocities[i3] = -Math.sin(theta) * orbitalSpeed;
    this.velocities[i3 + 1] = 0;
    this.velocities[i3 + 2] = Math.cos(theta) * orbitalSpeed;

    // Random size
    this.sizes[i] = 0.5 + Math.random() * 2.5;

    // Color: warm spectrum from orange to blue-white
    const colorT = Math.random();
    if (colorT < 0.3) {
      // Blue-white (hot)
      this.colors[i3] = 0.6 + Math.random() * 0.4;
      this.colors[i3 + 1] = 0.7 + Math.random() * 0.3;
      this.colors[i3 + 2] = 1.0;
    } else if (colorT < 0.7) {
      // Orange (warm)
      this.colors[i3] = 1.0;
      this.colors[i3 + 1] = 0.4 + Math.random() * 0.4;
      this.colors[i3 + 2] = 0.1 + Math.random() * 0.2;
    } else {
      // Dim red (cool)
      this.colors[i3] = 0.8;
      this.colors[i3 + 1] = 0.15 + Math.random() * 0.15;
      this.colors[i3 + 2] = 0.05;
    }

    // Lifetime
    this.lifetimes[i] = 0;
  }

  update(deltaTime) {
    const GM = 1.0; // Gravitational parameter (normalized)
    const rsThresh2 = 2.0 * 1.2 * 2.0 * 1.2; // (rs * 1.2)² for absorption
    const maxR2 = this.params.maxRadius * 2 * this.params.maxRadius * 2; // escape²
    const pos = this.positions;
    const vel = this.velocities;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;

      const x = pos[i3];
      const y = pos[i3 + 1];
      const z = pos[i3 + 2];

      const r2 = x * x + y * y + z * z;

      // Reset if too close (absorbed) or too far (escaped)  — no sqrt needed
      if (r2 < rsThresh2 || r2 > maxR2) {
        this._resetParticle(i);
        continue;
      }

      // Newtonian gravity: a = -GM/r³ * r_vec
      // r³ = r² * r, need sqrt only here
      const r = Math.sqrt(r2);
      const invR3 = GM / (r2 * r);
      const ax = -x * invR3;
      const ay = -y * invR3;
      const az = -z * invR3;

      // Verlet-style velocity update
      vel[i3] += ax * deltaTime;
      vel[i3 + 1] += ay * deltaTime;
      vel[i3 + 2] += az * deltaTime;

      // Position update
      pos[i3] += vel[i3] * deltaTime;
      pos[i3 + 1] += vel[i3 + 1] * deltaTime;
      pos[i3 + 2] += vel[i3 + 2] * deltaTime;

      // Slight drag toward disk plane (y → 0)
      pos[i3 + 1] *= 0.999;

      this.lifetimes[i] += deltaTime;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  setParam(key, value) {
    this.params[key] = value;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.points);
  }
}
