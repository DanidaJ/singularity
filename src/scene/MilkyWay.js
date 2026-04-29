// ==============================
// MilkyWay — Particle-based Spiral Galaxy
// ==============================
// Renders the Milky Way as ~350k point particles arranged in:
//   - Logarithmic spiral arms (2 major + 2 minor)
//   - Dense golden central bulge
//   - Pink/magenta HII star-forming regions
//   - Scattered inter-arm field stars
//   - Faint outer halo
//   - Bright central core glow (Sgr A* as luminous center)
//
// Uses THREE.Points with additive blending for natural brightness
// accumulation in dense regions. No per-frame CPU updates needed —
// just group rotation.

import * as THREE from 'three';

export class MilkyWay {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false; // Hidden until Sgr A* preset selected

    this._createGalaxyParticles();
    this._createCoreGlow();

    this.scene.add(this.group);
  }

  // ---- Gaussian random (Box-Muller) ----
  _gaussRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  _createGalaxyParticles() {
    // ---- Particle budget ----
    const ARM_STARS     = 200000;
    const CORE_STARS    = 80000;
    const INTERARM      = 40000;
    const HII_STARS     = 18000;
    const HALO_STARS    = 12000;
    const TOTAL = ARM_STARS + CORE_STARS + INTERARM + HII_STARS + HALO_STARS;

    const positions = new Float32Array(TOTAL * 3);
    const colors    = new Float32Array(TOTAL * 3);
    const sizes     = new Float32Array(TOTAL);

    let idx = 0;
    const GALAXY_RADIUS = 28.0;
    const ARM_COUNT = 4;  // 2 major at 0, π + 2 minor at π/2, 3π/2

    // Milky Way pitch angle ~12° → winding factor
    const pitchAngle = 12.0 * Math.PI / 180.0;
    const windingK = 1.0 / Math.tan(pitchAngle);

    // Helper: add a single particle
    const add = (x, y, z, r, g, b, s) => {
      const i3 = idx * 3;
      positions[i3]     = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      colors[i3]     = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
      sizes[idx] = s;
      idx++;
    };

    // ================================================================
    // 1. SPIRAL ARM STARS — along logarithmic spirals
    // ================================================================
    for (let i = 0; i < ARM_STARS; i++) {
      // Pick arm: 0,1 = major, 2,3 = minor
      const armIdx = Math.floor(Math.random() * ARM_COUNT);
      const isMajor = armIdx < 2;
      const armOffset = (armIdx / ARM_COUNT) * Math.PI * 2;

      // Radius: r^0.5 distribution for uniform area density,
      // biased away from very center (bulge handles that)
      const rNorm = Math.pow(Math.random(), 0.6);
      const r = (0.12 + rNorm * 0.88) * GALAXY_RADIUS;

      // Spiral angle from radius
      const spiralAngle = windingK * Math.log(r / 3.0 + 1.0) + armOffset;

      // Angular scatter: tight for major arms, wider for minor
      const armWidth = isMajor ? (0.12 + rNorm * 0.2) : (0.2 + rNorm * 0.35);
      const scatter = this._gaussRandom() * armWidth;
      const theta = spiralAngle + scatter;

      // ---- Skip dust lane region (trailing edge) ----
      // Creates natural dark lanes inside each arm
      const armPhase = Math.abs(scatter);
      const dustCheck = scatter > 0 && armPhase < 0.06 && rNorm > 0.1 && rNorm < 0.8;
      if (dustCheck && Math.random() < 0.7) continue; // 70% chance to skip = dark lane

      // Position
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      // Thin disk: thicker near center, very thin at edges
      const ySpread = (0.08 + (1.0 - rNorm) * 0.25);
      const y = this._gaussRandom() * ySpread;

      // ---- Color: radial gradient ----
      let cr, cg, cb;
      const cn = Math.random() * 0.12; // color noise
      if (rNorm < 0.12) {
        // Inner: warm golden-white
        cr = 0.95 + cn; cg = 0.8 + cn; cb = 0.4 + cn;
      } else if (rNorm < 0.45) {
        // Mid: blue-white stars
        const blend = (rNorm - 0.12) / 0.33;
        cr = 0.85 - blend * 0.35 + cn;
        cg = 0.82 - blend * 0.1 + cn;
        cb = 0.75 + blend * 0.25 + cn;
      } else {
        // Outer: cool blue
        cr = 0.4 + cn; cg = 0.5 + cn; cb = 0.85 + cn;
      }

      // Minor arms are dimmer
      const armBrightness = isMajor ? 1.0 : 0.45;
      cr *= armBrightness;
      cg *= armBrightness;
      cb *= armBrightness;

      // Some random bright stars (O/B type)
      if (Math.random() < 0.02) {
        cr = 0.7 + Math.random() * 0.3;
        cg = 0.8 + Math.random() * 0.2;
        cb = 1.0;
      }

      const size = (0.3 + Math.random() * 1.2) * armBrightness;
      add(x, y, z, cr, cg, cb, size);
    }

    // ================================================================
    // 2. CENTRAL BULGE — dense, warm golden, slightly flattened
    // ================================================================
    for (let i = 0; i < CORE_STARS; i++) {
      // 3D Gaussian, concentrated tightly
      const sigma = 2.8;
      let rx = this._gaussRandom() * sigma;
      let ry = this._gaussRandom() * sigma * 0.35; // Very flattened
      let rz = this._gaussRandom() * sigma;

      const dist = Math.sqrt(rx * rx + ry * ry * 8 + rz * rz);

      // Color: hotter (brighter) near center
      const distNorm = Math.min(dist / 6.0, 1.0);
      const cn = Math.random() * 0.08;
      const cr = 1.0 - distNorm * 0.15 + cn;
      const cg = 0.88 - distNorm * 0.15 + cn;
      const cb = 0.42 - distNorm * 0.12 + cn;

      // Larger and brighter near center
      const size = (0.4 + Math.random() * 2.2) * (1.0 - distNorm * 0.4);

      add(rx, ry, rz, cr, cg, cb, size);
    }

    // ================================================================
    // 3. INTER-ARM FIELD STARS — scattered randomly, very dim
    // ================================================================
    for (let i = 0; i < INTERARM; i++) {
      const r = Math.sqrt(Math.random()) * GALAXY_RADIUS * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = this._gaussRandom() * 0.12;

      // Very dim yellowish/white
      const cn = Math.random() * 0.1;
      const cr = 0.35 + cn;
      const cg = 0.35 + cn;
      const cb = 0.3 + cn;

      add(x, y, z, cr, cg, cb, 0.15 + Math.random() * 0.4);
    }

    // ================================================================
    // 4. HII STAR-FORMING REGIONS — pink/magenta clumps in major arms
    // ================================================================
    for (let i = 0; i < HII_STARS; i++) {
      // Only in major arms
      const armIdx = Math.floor(Math.random() * 2);
      const armOffset = (armIdx / ARM_COUNT) * Math.PI * 2;

      // Mid-disk radius (where star formation is active)
      const rNorm = 0.15 + Math.random() * 0.65;
      const r = rNorm * GALAXY_RADIUS;

      const spiralAngle = windingK * Math.log(r / 3.0 + 1.0) + armOffset;
      const scatter = this._gaussRandom() * 0.1;
      const theta = spiralAngle + scatter;

      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = this._gaussRandom() * 0.08;

      // Pink/magenta with variation
      const cr = 0.8 + Math.random() * 0.2;
      const cg = 0.1 + Math.random() * 0.15;
      const cb = 0.3 + Math.random() * 0.25;

      // Slightly larger for visibility
      add(x, y, z, cr, cg, cb, 0.8 + Math.random() * 2.5);
    }

    // ================================================================
    // 5. OUTER HALO — very sparse, dim red/old-star colors
    // ================================================================
    for (let i = 0; i < HALO_STARS; i++) {
      const r = GALAXY_RADIUS * (0.6 + Math.random() * 0.6);
      const theta = Math.random() * Math.PI * 2;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const y = this._gaussRandom() * 0.4;

      // Dim reddish/yellowish (old stellar population)
      const cr = 0.3 + Math.random() * 0.15;
      const cg = 0.25 + Math.random() * 0.1;
      const cb = 0.2 + Math.random() * 0.1;

      add(x, y, z, cr, cg, cb, 0.12 + Math.random() * 0.25);
    }

    // ---- Trim arrays if dust lane skipping reduced count ----
    const actualCount = idx;

    // ---- Create THREE.Points ----
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, actualCount * 3), 3));
    geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors.slice(0, actualCount * 3), 3));
    geometry.setAttribute('aSize',    new THREE.BufferAttribute(sizes.slice(0, actualCount), 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        attribute float aSize;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vDist;

        void main() {
          vColor = aColor;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vDist = -mvPos.z;
          // Scale point size with perspective
          gl_PointSize = aSize * (280.0 / max(vDist, 1.0));
          gl_PointSize = clamp(gl_PointSize, 0.3, 10.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vDist;

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;

          // Soft circular glow with bright core
          float glow = exp(-d * 7.0);
          float core = smoothstep(0.15, 0.0, d);

          vec3 color = vColor * (glow * 0.5 + core * 1.4);
          float alpha = glow * 0.65 + core * 0.35;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.group.add(this.points);
  }

  _createCoreGlow() {
    // Bright central glow using a canvas-textured billboard sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Radial gradient: bright golden center → transparent
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0.0,  'rgba(255, 240, 170, 1.0)');
    gradient.addColorStop(0.05, 'rgba(255, 225, 140, 0.9)');
    gradient.addColorStop(0.15, 'rgba(255, 210, 100, 0.5)');
    gradient.addColorStop(0.35, 'rgba(255, 190, 70, 0.15)');
    gradient.addColorStop(0.6,  'rgba(255, 170, 50, 0.04)');
    gradient.addColorStop(1.0,  'rgba(255, 150, 30, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(8, 8, 1); // Large central glow
    sprite.position.set(0, 0, 0);
    this.coreSprite = sprite;
    this.group.add(sprite);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  update(time) {
    if (!this.group.visible) return;
    // Very slow galactic rotation
    this.group.rotation.y = time * 0.008;
  }

  dispose() {
    if (this.points) {
      this.points.geometry.dispose();
      this.points.material.dispose();
    }
    if (this.coreSprite) {
      this.coreSprite.material.map.dispose();
      this.coreSprite.material.dispose();
    }
    this.scene.remove(this.group);
  }
}
