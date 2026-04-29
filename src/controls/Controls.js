// ==============================
// Controls — OrbitControls + GUI panel + Preset Selector
// ==============================

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { DEFAULTS, PRESETS, PRESET_META, PRESET_MODES } from '../utils/constants.js';

export class Controls {
  constructor(camera, canvas, blackHole, particles, postFX, milkyWay) {
    this.camera = camera;
    this.blackHole = blackHole;
    this.particles = particles;
    this.postFX = postFX;
    this.milkyWay = milkyWay;

    // Camera transition state
    this._cameraTransition = null;

    // ---- Orbit Controls ----
    this.orbit = new OrbitControls(camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;
    this.orbit.rotateSpeed = 0.5;
    this.orbit.zoomSpeed = 0.8;
    this.orbit.minDistance = 8;     // Don't let camera get inside the photon sphere
    this.orbit.maxDistance = 50;    // Keep black hole visible at max zoom
    this.orbit.enablePan = false; // Pan disabled — keep black hole centered
    this.orbit.autoRotate = true;
    this.orbit.autoRotateSpeed = 0.15;

    // ---- GUI ----
    this._setupGUI();

    // ---- Preset Bar ----
    this._setupPresetBar();
  }

  _setupGUI() {
    this.gui = new GUI({ title: '⚫ Black Hole Controls' });
    this.gui.close(); // Start collapsed

    // Current values (linked to GUI)
    this._values = {
      // Black Hole
      blackHoleMass: DEFAULTS.blackHoleMass,

      // Accretion Disk
      diskInnerRadius: DEFAULTS.diskInnerRadius,
      diskOuterRadius: DEFAULTS.diskOuterRadius,
      diskSpeed: DEFAULTS.diskSpeed,
      diskBrightness: DEFAULTS.diskBrightness,
      diskTurbulence: DEFAULTS.diskTurbulence,

      // Integration quality
      maxSteps: DEFAULTS.maxSteps,
      stepSize: DEFAULTS.stepSize,

      // Particles
      particleSpeed: DEFAULTS.particleSpeed,

      // Post-processing
      bloomIntensity: DEFAULTS.bloomIntensity,
      bloomThreshold: DEFAULTS.bloomThreshold,
      bloomRadius: DEFAULTS.bloomRadius,
      chromaticAberration: DEFAULTS.chromaticAberration,
      vignette: DEFAULTS.vignette,

      // Camera
      autoRotate: true,
      autoRotateSpeed: 0.15,
    };

    // ---- Black Hole folder ----
    const bhFolder = this.gui.addFolder('Black Hole');
    bhFolder.add(this._values, 'blackHoleMass', 0.3, 3.0, 0.01)
      .name('Mass (M)')
      .onChange(v => {
        this.blackHole.setParam('blackHoleMass', v);
        // Update HUD
        document.getElementById('rs-display').textContent = (2 * v).toFixed(2);
        document.getElementById('photon-sphere-display').textContent = (3 * v).toFixed(2);
      });

    // ---- Accretion Disk folder ----
    const diskFolder = this.gui.addFolder('Accretion Disk');
    diskFolder.add(this._values, 'diskInnerRadius', 1.5, 10.0, 0.1)
      .name('Inner Radius')
      .onChange(v => this.blackHole.setParam('diskInnerRadius', v));
    diskFolder.add(this._values, 'diskOuterRadius', 5.0, 30.0, 0.5)
      .name('Outer Radius')
      .onChange(v => this.blackHole.setParam('diskOuterRadius', v));
    diskFolder.add(this._values, 'diskSpeed', 0.0, 3.0, 0.05)
      .name('Rotation Speed')
      .onChange(v => this.blackHole.setParam('diskSpeed', v));
    diskFolder.add(this._values, 'diskBrightness', 0.5, 6.0, 0.1)
      .name('Brightness')
      .onChange(v => this.blackHole.setParam('diskBrightness', v));
    diskFolder.add(this._values, 'diskTurbulence', 0.0, 3.0, 0.1)
      .name('Turbulence')
      .onChange(v => this.blackHole.setParam('diskTurbulence', v));

    // ---- Quality folder ----
    const qualityFolder = this.gui.addFolder('Ray Quality');
    qualityFolder.add(this._values, 'maxSteps', 50, 300, 10)
      .name('Max Steps')
      .onChange(v => this.blackHole.setParam('maxSteps', v));
    qualityFolder.add(this._values, 'stepSize', 0.05, 0.5, 0.01)
      .name('Step Size')
      .onChange(v => this.blackHole.setParam('stepSize', v));

    // ---- Particles folder ----
    const partFolder = this.gui.addFolder('Particles');
    partFolder.add(this._values, 'particleSpeed', 0.05, 1.0, 0.05)
      .name('Orbital Speed')
      .onChange(v => this.particles.setParam('speed', v));

    // ---- Post-Processing folder ----
    const postFolder = this.gui.addFolder('Post-Processing');
    postFolder.add(this._values, 'bloomIntensity', 0.0, 5.0, 0.1)
      .name('Bloom Intensity')
      .onChange(v => this.postFX.setParam('bloomIntensity', v));
    postFolder.add(this._values, 'bloomThreshold', 0.0, 1.0, 0.05)
      .name('Bloom Threshold')
      .onChange(v => this.postFX.setParam('bloomThreshold', v));
    postFolder.add(this._values, 'bloomRadius', 0.0, 2.0, 0.05)
      .name('Bloom Radius')
      .onChange(v => this.postFX.setParam('bloomRadius', v));
    postFolder.add(this._values, 'chromaticAberration', 0.0, 0.02, 0.001)
      .name('Chromatic Aberr.')
      .onChange(v => this.postFX.setParam('chromaticAberration', v));
    postFolder.add(this._values, 'vignette', 0.0, 1.5, 0.05)
      .name('Vignette')
      .onChange(v => this.postFX.setParam('vignette', v));

    // ---- Camera folder ----
    const camFolder = this.gui.addFolder('Camera');
    camFolder.add(this._values, 'autoRotate')
      .name('Auto Rotate')
      .onChange(v => this.orbit.autoRotate = v);
    camFolder.add(this._values, 'autoRotateSpeed', 0.0, 1.0, 0.05)
      .name('Rotate Speed')
      .onChange(v => this.orbit.autoRotateSpeed = v);
  }

  _setupPresetBar() {
    const bar = document.getElementById('preset-bar');
    if (!bar) return;

    const presetKeys = ['custom', 'interstellar', 'quasar', 'supermassive'];
    this._presetButtons = {};

    presetKeys.forEach(key => {
      const btn = bar.querySelector(`[data-preset="${key}"]`);
      if (btn) {
        this._presetButtons[key] = btn;
        btn.addEventListener('click', () => {
          this._selectPreset(key);
        });
      }
    });

    // Start with 'custom' active
    this._activePreset = 'custom';
    this._updatePresetBarUI('custom');
  }

  _selectPreset(name) {
    if (name === this._activePreset) return;

    this._activePreset = name;
    this._updatePresetBarUI(name);

    if (name === 'custom') {
      this._applyPreset(null); // Reset to defaults
    } else {
      this._applyPreset(name);
    }
  }

  _updatePresetBarUI(activeName) {
    Object.entries(this._presetButtons).forEach(([key, btn]) => {
      btn.classList.toggle('active', key === activeName);
    });

    // Update HUD subtitle
    const meta = PRESET_META[activeName];
    if (meta) {
      const subtitleEl = document.querySelector('.hud-subtitle');
      if (subtitleEl) subtitleEl.textContent = meta.hudSubtitle;

      // Update stats panel
      this._updateHUDStats(activeName, meta);
    }
  }

  _updateHUDStats(presetName, meta) {
    const statsContainer = document.querySelector('.hud-stats');
    if (!statsContainer) return;

    // Clear existing stats
    statsContainer.innerHTML = '';

    // FPS row (always present)
    const fpsRow = document.createElement('div');
    fpsRow.className = 'stat-row';
    fpsRow.innerHTML = `
      <span class="stat-label">FPS</span>
      <span class="stat-value" id="fps-counter">60</span>
    `;
    statsContainer.appendChild(fpsRow);

    // Preset-specific stats
    if (meta && meta.stats) {
      Object.entries(meta.stats).forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
          <span class="stat-label">${label}</span>
          <span class="stat-value">${value}</span>
        `;
        statsContainer.appendChild(row);
      });
    }
  }

  _applyPreset(name) {
    if (name === null) {
      // Reset to defaults
      const resetValues = {
        blackHoleMass: DEFAULTS.blackHoleMass,
        diskInnerRadius: DEFAULTS.diskInnerRadius,
        diskOuterRadius: DEFAULTS.diskOuterRadius,
        diskSpeed: DEFAULTS.diskSpeed,
        diskBrightness: DEFAULTS.diskBrightness,
        diskTurbulence: DEFAULTS.diskTurbulence,
        maxSteps: DEFAULTS.maxSteps,
        stepSize: DEFAULTS.stepSize,
        bloomIntensity: DEFAULTS.bloomIntensity,
        bloomThreshold: DEFAULTS.bloomThreshold,
        bloomRadius: DEFAULTS.bloomRadius,
        chromaticAberration: DEFAULTS.chromaticAberration,
        vignette: DEFAULTS.vignette,
      };

      for (const [key, value] of Object.entries(resetValues)) {
        if (this._values[key] !== undefined) this._values[key] = value;
        if (key.startsWith('disk') || key === 'blackHoleMass' || key === 'maxSteps' || key === 'stepSize') {
          this.blackHole.setParam(key, value);
        }
        if (key.startsWith('bloom') || key === 'chromaticAberration' || key === 'vignette') {
          this.postFX.setParam(key, value);
        }
      }

      // Reset preset mode to custom
      this.blackHole.setParam('presetMode', PRESET_MODES.custom);

      // Reset camera
      this._startCameraTransition([0, 6, DEFAULTS.cameraDistance]);
      this.orbit.autoRotateSpeed = 0.15;

      this.gui.controllersRecursive().forEach(c => c.updateDisplay());

      // Show orbiting particles, hide galaxy
      this.particles.points.visible = true;
      if (this.milkyWay) this.milkyWay.hide();

      return;
    }

    const preset = PRESETS[name];
    if (!preset) return;

    for (const [key, value] of Object.entries(preset)) {
      if (key === 'presetMode') {
        this.blackHole.setParam('presetMode', value);
        continue;
      }
      if (key === 'cameraPosition') {
        this._startCameraTransition(value);
        continue;
      }
      if (key === 'autoRotateSpeed') {
        this.orbit.autoRotateSpeed = value;
        this._values.autoRotateSpeed = value;
        continue;
      }

      if (this._values[key] !== undefined) {
        this._values[key] = value;
      }

      // Apply to black hole
      if (key.startsWith('disk') || key === 'blackHoleMass' || key === 'maxSteps' || key === 'stepSize') {
        this.blackHole.setParam(key, value);
      }

      // Apply to post-processing
      if (key.startsWith('bloom') || key === 'chromaticAberration' || key === 'vignette') {
        this.postFX.setParam(key, value);
      }
    }

    // Refresh all GUI controllers
    this.gui.controllersRecursive().forEach(c => c.updateDisplay());

    // Toggle particle systems based on preset
    if (name === 'supermassive') {
      // Sgr A*: show galaxy, hide orbiting debris
      this.particles.points.visible = false;
      if (this.milkyWay) this.milkyWay.show();
    } else {
      // All other presets: show orbiting debris, hide galaxy
      this.particles.points.visible = true;
      if (this.milkyWay) this.milkyWay.hide();
    }
  }

  _startCameraTransition(targetPos) {
    this._cameraTransition = {
      startPos: this.camera.position.clone(),
      endPos: { x: targetPos[0], y: targetPos[1], z: targetPos[2] },
      progress: 0,
      duration: 1.5, // seconds
    };
  }

  update(delta) {
    // Camera transition
    if (this._cameraTransition) {
      const t = this._cameraTransition;
      t.progress += (delta || 0.016) / t.duration;

      if (t.progress >= 1.0) {
        this.camera.position.set(t.endPos.x, t.endPos.y, t.endPos.z);
        this._cameraTransition = null;
      } else {
        // Smooth easing (ease-in-out cubic)
        const ease = t.progress < 0.5
          ? 4 * t.progress * t.progress * t.progress
          : 1 - Math.pow(-2 * t.progress + 2, 3) / 2;

        this.camera.position.set(
          t.startPos.x + (t.endPos.x - t.startPos.x) * ease,
          t.startPos.y + (t.endPos.y - t.startPos.y) * ease,
          t.startPos.z + (t.endPos.z - t.startPos.z) * ease,
        );
      }

      this.camera.lookAt(0, 0, 0);
    }

    this.orbit.update();
  }

  dispose() {
    this.orbit.dispose();
    this.gui.destroy();
  }
}
