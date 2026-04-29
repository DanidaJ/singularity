// ============================================================
// Black Hole Fragment Shader — Schwarzschild Geodesic Raymarcher
// ============================================================
// Implements null geodesic integration in the Schwarzschild metric
// using Leapfrog/Verlet numerical integration. Renders:
//   - Gravitational lensing of background stars
//   - Accretion disk with Doppler beaming & gravitational redshift
//   - Event horizon (perfect absorption)
//   - Einstein ring at photon sphere
//
// Preset modes:
//   0 = Custom (original behavior)
//   1 = Interstellar (Gargantua — clean concentric rings)
//   2 = Quasar (TON 618 — relativistic jets + turbulent disk)
//   3 = Supermassive (Sgr A* — spiral galaxy background)
// ============================================================

precision highp float;

varying vec2 vUv;

// Camera
uniform vec3 u_cameraPos;
uniform vec3 u_cameraRight;
uniform vec3 u_cameraUp;
uniform vec3 u_cameraForward;
uniform float u_fov;
uniform float u_aspectRatio;

// Black hole params
uniform float u_blackHoleMass;
uniform vec3 u_blackHolePos;

// Accretion disk
uniform float u_diskInnerRadius;
uniform float u_diskOuterRadius;
uniform float u_diskSpeed;
uniform float u_diskTemperature;
uniform float u_diskBrightness;
uniform float u_diskTurbulence;

// Time & resolution
uniform float u_time;
uniform vec2 u_resolution;

// Background
uniform samplerCube u_backgroundCube;
uniform bool u_hasBackground;

// Integration params
uniform int u_maxSteps;
uniform float u_stepSize;

// Preset mode
uniform int u_presetMode;

// Debug
uniform int u_debugMode;

#include "./noise.glsl"

// ---- Constants ----
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

// ---- Schwarzschild Metric ----
float schwarzschildRadius(float mass) {
  return 2.0 * mass;
}

// ---- Geodesic Acceleration ----
vec3 geodesicAccel(vec3 pos, vec3 vel, float r2, float r) {
  if (r < 0.001) return vec3(0.0);
  vec3 L = cross(pos, vel);
  float h2 = dot(L, L);
  float r5 = r2 * r2 * r;
  return -1.5 * h2 * pos / r5;
}


// ============================================================
// MODE 0: CUSTOM — Original Gargantua-style disk
// ============================================================
vec3 diskColorCustom(vec3 hitPos, vec3 vel, float rs) {
  float r = length(hitPos.xz);
  float t = clamp((r - u_diskInnerRadius) / (u_diskOuterRadius - u_diskInnerRadius), 0.0, 1.0);

  vec3 hotInner  = vec3(1.0, 0.75, 0.35);
  vec3 midOrange = vec3(0.95, 0.45, 0.12);
  vec3 deepRed   = vec3(0.7, 0.18, 0.05);
  vec3 darkEdge  = vec3(0.25, 0.06, 0.02);

  vec3 baseColor;
  if (t < 0.15) {
    baseColor = mix(hotInner, midOrange, t / 0.15);
  } else if (t < 0.45) {
    baseColor = mix(midOrange, deepRed, (t - 0.15) / 0.3);
  } else {
    baseColor = mix(deepRed, darkEdge, (t - 0.45) / 0.55);
  }

  float angle = atan(hitPos.z, hitPos.x);
  float rotatedAngle = angle + u_time * u_diskSpeed * 0.2;

  float rings = 1.0;
  float ring1 = abs(sin(r * 8.0 + u_time * 0.15));
  rings *= 0.4 + 0.6 * pow(ring1, 0.6);
  float ring2 = abs(sin(r * 18.0 - u_time * 0.08));
  rings *= 0.5 + 0.5 * pow(ring2, 0.8);
  float ring3 = abs(sin(r * 40.0 + u_time * 0.05));
  rings *= 0.6 + 0.4 * pow(ring3, 1.2);
  float ring4 = abs(sin(r * 75.0));
  float fineDetail = 0.7 + 0.3 * pow(ring4, 1.5);
  rings *= mix(fineDetail, 1.0, smoothstep(0.0, 0.4, t));

  float azimuthal = snoise(vec3(rotatedAngle * 1.5, r * 0.3, u_time * 0.03));
  azimuthal = 1.0 + azimuthal * 0.08 * u_diskTurbulence;
  rings *= azimuthal;

  vec3 diskVelocity = normalize(vec3(-hitPos.z, 0.0, hitPos.x)) * u_diskSpeed;
  float dopplerFactor = dot(normalize(vel), normalize(diskVelocity));
  float doppler = pow(max(1.0 + 0.25 * dopplerFactor, 0.15), 2.0);

  float gRedshift = sqrt(max(1.0 - rs / max(r, rs + 0.01), 0.01));

  float radialIntensity = pow(1.0 - t, 1.8);
  float intensity = radialIntensity * doppler * gRedshift;
  intensity *= u_diskBrightness;

  float innerFade = smoothstep(u_diskInnerRadius, u_diskInnerRadius + 0.15, r);
  float outerFade = smoothstep(u_diskOuterRadius, u_diskOuterRadius - 1.5, r);

  return baseColor * intensity * rings * innerFade * outerFade;
}


// ============================================================
// MODE 1: INTERSTELLAR — Gargantua (ultra-clean razor rings)
// ============================================================
vec3 diskColorInterstellar(vec3 hitPos, vec3 vel, float rs) {
  float r = length(hitPos.xz);
  float t = clamp((r - u_diskInnerRadius) / (u_diskOuterRadius - u_diskInnerRadius), 0.0, 1.0);

  // Warmer, more golden palette
  vec3 brightCore = vec3(1.0, 0.85, 0.45);
  vec3 warmMid    = vec3(0.98, 0.55, 0.15);
  vec3 deepOrange = vec3(0.75, 0.25, 0.06);
  vec3 darkRim    = vec3(0.2, 0.05, 0.01);

  vec3 baseColor;
  if (t < 0.1) {
    baseColor = mix(brightCore, warmMid, t / 0.1);
  } else if (t < 0.35) {
    baseColor = mix(warmMid, deepOrange, (t - 0.1) / 0.25);
  } else {
    baseColor = mix(deepOrange, darkRim, (t - 0.35) / 0.65);
  }

  // Ultra-sharp concentric rings
  float rings = 1.0;
  float ring1 = abs(sin(r * 6.0 + u_time * 0.1));
  rings *= 0.3 + 0.7 * pow(ring1, 0.4);
  float ring2 = abs(sin(r * 15.0 - u_time * 0.06));
  rings *= 0.4 + 0.6 * pow(ring2, 0.6);
  float ring3 = abs(sin(r * 35.0 + u_time * 0.03));
  rings *= 0.5 + 0.5 * pow(ring3, 1.0);
  float ring4 = abs(sin(r * 65.0));
  float fine = 0.6 + 0.4 * pow(ring4, 1.5);
  rings *= mix(fine, 1.0, smoothstep(0.0, 0.3, t));
  float ring5 = abs(sin(r * 120.0));
  float veryFine = 0.8 + 0.2 * pow(ring5, 2.0);
  rings *= mix(veryFine, 1.0, smoothstep(0.0, 0.2, t));

  // Minimal azimuthal variation
  float azimuthal = snoise(vec3(atan(hitPos.z, hitPos.x) * 1.0, r * 0.2, u_time * 0.02));
  rings *= 1.0 + azimuthal * 0.04;

  vec3 diskVelocity = normalize(vec3(-hitPos.z, 0.0, hitPos.x)) * u_diskSpeed;
  float dopplerFactor = dot(normalize(vel), normalize(diskVelocity));
  float doppler = pow(max(1.0 + 0.2 * dopplerFactor, 0.2), 1.8);

  float gRedshift = sqrt(max(1.0 - rs / max(r, rs + 0.01), 0.01));

  float radialIntensity = pow(1.0 - t, 2.2);
  float intensity = radialIntensity * doppler * gRedshift * u_diskBrightness;

  float innerFade = smoothstep(u_diskInnerRadius, u_diskInnerRadius + 0.1, r);
  float outerFade = smoothstep(u_diskOuterRadius, u_diskOuterRadius - 1.0, r);

  return baseColor * intensity * rings * innerFade * outerFade;
}


// ============================================================
// MODE 2: QUASAR — TON 618 (turbulent blue-white disk)
// ============================================================
vec3 diskColorQuasar(vec3 hitPos, vec3 vel, float rs) {
  float r = length(hitPos.xz);
  float t = clamp((r - u_diskInnerRadius) / (u_diskOuterRadius - u_diskInnerRadius), 0.0, 1.0);

  // Blue-white hot inner → orange → red outer
  vec3 blazingCore = vec3(0.7, 0.85, 1.0);
  vec3 hotWhite    = vec3(1.0, 0.95, 0.85);
  vec3 brightOrange= vec3(1.0, 0.55, 0.1);
  vec3 deepMagenta = vec3(0.6, 0.1, 0.15);
  vec3 darkEdge    = vec3(0.15, 0.03, 0.02);

  vec3 baseColor;
  if (t < 0.08) {
    baseColor = mix(blazingCore, hotWhite, t / 0.08);
  } else if (t < 0.25) {
    baseColor = mix(hotWhite, brightOrange, (t - 0.08) / 0.17);
  } else if (t < 0.55) {
    baseColor = mix(brightOrange, deepMagenta, (t - 0.25) / 0.3);
  } else {
    baseColor = mix(deepMagenta, darkEdge, (t - 0.55) / 0.45);
  }

  float angle = atan(hitPos.z, hitPos.x);
  float rotatedAngle = angle + u_time * u_diskSpeed * 0.3;

  // Turbulent rings
  float rings = 1.0;
  float ring1 = abs(sin(r * 5.0 + u_time * 0.3 + snoise(vec3(r * 0.5, angle * 2.0, u_time * 0.1)) * 1.5));
  rings *= 0.3 + 0.7 * pow(ring1, 0.5);
  float ring2 = abs(sin(r * 12.0 - u_time * 0.15 + snoise(vec3(r * 0.8, angle * 3.0, u_time * 0.08)) * 2.0));
  rings *= 0.4 + 0.6 * pow(ring2, 0.7);
  float ring3 = abs(sin(r * 25.0 + u_time * 0.08));
  rings *= 0.5 + 0.5 * pow(ring3, 0.9);

  // Azimuthal turbulence
  float turb1 = snoise(vec3(rotatedAngle * 3.0, r * 0.5, u_time * 0.06));
  float turb2 = snoise(vec3(rotatedAngle * 6.0, r * 1.0, u_time * 0.1));
  float turbulence = 1.0 + (turb1 * 0.3 + turb2 * 0.15) * u_diskTurbulence;
  rings *= turbulence;

  // Hot spots
  float hotspot = snoise(vec3(angle * 4.0 + u_time * 0.5, r * 2.0, u_time * 0.2));
  hotspot = pow(max(hotspot, 0.0), 3.0) * 1.5;
  rings += hotspot * (1.0 - t);

  // Aggressive Doppler
  vec3 diskVelocity = normalize(vec3(-hitPos.z, 0.0, hitPos.x)) * u_diskSpeed;
  float dopplerFactor = dot(normalize(vel), normalize(diskVelocity));
  float doppler = pow(max(1.0 + 0.4 * dopplerFactor, 0.1), 2.5);

  float gRedshift = sqrt(max(1.0 - rs / max(r, rs + 0.01), 0.01));

  float radialIntensity = pow(1.0 - t, 1.5);
  float intensity = radialIntensity * doppler * gRedshift * u_diskBrightness;

  float innerFade = smoothstep(u_diskInnerRadius, u_diskInnerRadius + 0.2, r);
  float outerFade = smoothstep(u_diskOuterRadius, u_diskOuterRadius - 2.0, r);

  return baseColor * intensity * rings * innerFade * outerFade;
}


// ============================================================
// MODE 3: SUPERMASSIVE — Sagittarius A* / Milky Way Galaxy
// High-fidelity barred spiral galaxy with:
//   - 4 logarithmic spiral arms (2 major + 2 minor) with tight winding
//   - Central bar structure elongated along one axis
//   - Exponential disk profile with sharp arm/inter-arm contrast
//   - Dark dust lanes on trailing edges of spiral arms
//   - Scattered pink/magenta HII star-forming regions
//   - Multi-layer star populations (dense in arms, sparse between)
//   - Warm golden central bulge with bright nucleus
// ============================================================

// Hash for star field — returns 0..1
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 diskColorSupermassive(vec3 hitPos, vec3 vel, float rs) {
  float r = length(hitPos.xz);
  float t = clamp((r - u_diskInnerRadius) / (u_diskOuterRadius - u_diskInnerRadius), 0.0, 1.0);

  float angle = atan(hitPos.z, hitPos.x);
  float slowRot = angle + u_time * u_diskSpeed * 0.03;

  // ============================================================
  // 1. EXPONENTIAL DISK PROFILE — realistic surface brightness falloff
  //    Scale length ~0.3 of total radius
  // ============================================================
  float scaleLength = 0.18;
  float exponentialDisk = exp(-t / scaleLength) * (1.0 - exp(-t * 12.0));
  // Sharp falloff: inner region fades fast so arms dominate, not a bright wash

  // ============================================================
  // 2. CENTRAL BAR — elongated along a fixed angle, slowly rotating
  // ============================================================
  float barAngle = slowRot + 0.3; // slight offset from arm phase
  float barPA = 0.45; // bar position angle ~25 degrees
  float cosBar = cos(barPA);
  float sinBar = sin(barPA);
  // Rotated coordinates for the bar
  float bx = hitPos.x * cosBar + hitPos.z * sinBar;
  float bz = -hitPos.x * sinBar + hitPos.z * cosBar;
  float barR = sqrt(bx * bx * 0.15 + bz * bz); // elongated along x
  float barVal = exp(-barR * barR * 0.4) * smoothstep(0.25, 0.0, t);

  // ============================================================
  // 3. LOGARITHMIC SPIRAL ARMS — tight winding number
  //    Milky Way pitch angle ~12° → winding factor k ≈ 1/tan(12°) ≈ 4.7
  // ============================================================
  float logR = log(max(r, 0.1));
  float k = 3.8; // winding tightness — looser for more visible arm separation
  float phase = slowRot - logR * k;

  // --- Two major arms (Scutum-Centaurus + Perseus analog) ---
  // Use SHARPER exponents (pow-12) for well-defined ridges with dark gaps
  float arm1 = pow(max(cos(phase), 0.0), 10.0);
  float arm2 = pow(max(cos(phase + PI), 0.0), 10.0);
  // Make one arm slightly brighter (asymmetry like real Milky Way)
  float mainArm = arm1 * 1.0 + arm2 * 0.8;

  // --- Two minor arms (Norma + Sagittarius analog) ---
  float arm3 = pow(max(cos(phase + PI * 0.5), 0.0), 16.0);
  float arm4 = pow(max(cos(phase + PI * 1.5), 0.0), 16.0);
  float minorArm = (arm3 + arm4) * 0.3;

  // --- Arm spurs / feathering (short branches off main arms) ---
  float spurPhase = angle * 6.0 + r * 1.2;
  float spur = pow(max(cos(spurPhase), 0.0), 8.0) * 0.15;
  spur *= mainArm; // only appear near main arms

  float armVal = mainArm + minorArm + spur;

  // ---- Clumpy, irregular arm edges via multi-octave noise ----
  float armTex1 = fbm(vec3(angle * 2.0, r * 0.15, 0.0)) * 0.5 + 0.5;
  float armTex2 = snoise(vec3(angle * 5.0 + r * 0.3, r * 0.08, 0.5));
  armVal *= (0.6 + 0.4 * armTex1);
  armVal += max(armTex2, 0.0) * 0.08 * (1.0 - t); // scatter near arms

  // Suppress arm structure in the very center (bar dominates)
  float armSuppressInCenter = smoothstep(0.05, 0.2, t);
  armVal *= armSuppressInCenter;

  // ============================================================
  // 4. DARK DUST LANES — trailing edge absorption
  //    Offset spiral phase so dust sits just inside the arm
  // ============================================================
  float dustPhase = phase - 0.35;
  float dustArm1 = pow(max(cos(dustPhase), 0.0), 6.0);
  float dustArm2 = pow(max(cos(dustPhase + PI), 0.0), 6.0);
  float dustLane = max(dustArm1, dustArm2);

  // Fine-scale dust texture
  float dustNoise1 = fbm(vec3(angle * 3.0, r * 0.2, 0.8)) * 0.5 + 0.5;
  float dustNoise2 = snoise(vec3(angle * 7.0, r * 0.35, 1.2));
  dustLane *= (dustNoise1 * 0.7 + 0.3);
  dustLane += max(dustNoise2, 0.0) * 0.1; // scattered dust patches

  // Dust darkening factor — strongest in inner/mid disk
  float dustStrength = 0.6 * (1.0 - t * 0.4);
  float dustFactor = 1.0 - dustLane * dustStrength;
  dustFactor = max(dustFactor, 0.15); // never fully black

  // ============================================================
  // 5. CENTRAL BULGE — smooth, golden, rotationally symmetric
  // ============================================================
  float coreBulge = exp(-t * t * 12.0);          // TIGHT bulge — doesn't spread across whole disk
  float coreNucleus = exp(-t * t * 80.0);         // Very concentrated central point

  // ============================================================
  // 6. COLOR PALETTE — warm core → blue-white arms → cool blue edges
  // ============================================================
  vec3 nucleusCol   = vec3(1.0, 0.92, 0.55);      // Bright golden-white nucleus
  vec3 coreCol      = vec3(1.0, 0.82, 0.38);       // Warm golden bulge
  vec3 barCol       = vec3(0.95, 0.75, 0.3);        // Bar: slightly less bright
  vec3 innerArmCol  = vec3(0.8, 0.7, 0.4);          // Golden inner arm
  vec3 midArmCol    = vec3(0.55, 0.6, 0.82);        // Blue-white spiral arm body
  vec3 outerArmCol  = vec3(0.4, 0.5, 0.88);         // Cool blue outer arm
  vec3 diskDimCol   = vec3(0.2, 0.18, 0.15);        // Very dim inter-arm disk
  vec3 dustCol      = vec3(0.12, 0.05, 0.02);       // Dark brown dust lanes
  vec3 nebulaCol    = vec3(0.85, 0.15, 0.35);       // Pink/magenta HII regions

  // Radial color gradient for arms
  vec3 armColor;
  if (t < 0.15) {
    armColor = mix(innerArmCol, midArmCol, t / 0.15);
  } else if (t < 0.5) {
    armColor = mix(midArmCol, outerArmCol, (t - 0.15) / 0.35);
  } else {
    armColor = outerArmCol * max(1.0 - (t - 0.5) * 1.5, 0.08);
  }

  // ============================================================
  // 7. HII / STAR-FORMING REGIONS — pink/magenta clumps in arms
  // ============================================================
  float neb1 = snoise(vec3(angle * 3.0, r * 0.18, 1.5));
  float neb2 = snoise(vec3(angle * 5.5, r * 0.3, 2.7));
  float neb3 = snoise(vec3(angle * 8.0, r * 0.5, 3.9));

  // Only appear in the arms, concentrated in mid-disk
  float nebMask = armVal * (1.0 - abs(t - 0.4) * 2.0);
  nebMask = max(nebMask, 0.0);

  float nebula = pow(max(neb1, 0.0), 2.5) * nebMask * 0.6;
  nebula += pow(max(neb2, 0.0), 3.5) * nebMask * 0.35;
  nebula += pow(max(neb3, 0.0), 4.0) * nebMask * 0.2;

  // ============================================================
  // 8. INTER-ARM REGIONS — very dark, mostly empty
  //    This is the key to making arms "pop" and look separated
  // ============================================================
  float interArmGlow = 0.008 * exponentialDisk; // near-zero inter-arm

  // ============================================================
  // 9. ASSEMBLE FINAL COLOR
  // ============================================================

  // Start with very faint inter-arm disk
  vec3 color = diskDimCol * interArmGlow;

  // Spiral arm body (main contribution)
  color += armColor * armVal * dustFactor * exponentialDisk * 1.0;

  // Warm dust-reddened regions on arm edges
  float dustColorMix = dustLane * 0.25 * armVal * (1.0 - t * 0.5);
  color = mix(color, dustCol * 0.3, dustColorMix);

  // Central bar
  color += barCol * barVal * 0.2;

  // Pink HII nebulae
  color += nebulaCol * nebula * 0.25;

  // Core bulge — small, concentrated, doesn't wash out arms
  color += coreCol * coreBulge * 0.08;
  color += nucleusCol * coreNucleus * 0.2;

  // ============================================================
  // 10. STAR POPULATIONS — multi-layer, concentrated in arms + core
  // ============================================================

  // Layer 1: Dense arm stars (blue tint, follow arm structure)
  vec2 starGrid1 = hitPos.xz * 4.0;
  vec2 starCell1 = floor(starGrid1);
  vec2 starFrac1 = fract(starGrid1) - 0.5;
  float sH1 = hash21(starCell1);
  float sH1b = hash21(starCell1 + 100.0);
  float sDist1 = length(starFrac1 - (vec2(sH1, sH1b) - 0.5) * 0.7);
  float sBright1 = exp(-sDist1 * sDist1 * 120.0);
  sBright1 *= step(0.82, sH1);
  sBright1 *= (armVal * 0.7 + coreBulge * 0.3) * exponentialDisk;
  vec3 sColor1 = mix(vec3(0.65, 0.75, 1.0), vec3(1.0, 0.95, 0.7), sH1b);
  color += sColor1 * sBright1 * 0.25;

  // Layer 2: Sparse bright foreground stars
  vec2 starGrid2 = hitPos.xz * 1.5;
  vec2 starCell2 = floor(starGrid2);
  vec2 starFrac2 = fract(starGrid2) - 0.5;
  float sH2 = hash21(starCell2 + 200.0);
  float sH2b = hash21(starCell2 + 300.0);
  float sDist2 = length(starFrac2 - (vec2(sH2, sH2b) - 0.5) * 0.5);
  float sBright2 = exp(-sDist2 * sDist2 * 60.0);
  sBright2 *= step(0.92, sH2);
  sBright2 *= exponentialDisk;
  vec3 sColor2 = mix(vec3(1.0, 0.9, 0.6), vec3(0.9, 0.85, 1.0), sH2b);
  color += sColor2 * sBright2 * 0.35;

  // Layer 3: Very fine dim stars (numerous, give diffuse glow)
  vec2 starGrid3 = hitPos.xz * 8.0;
  vec2 starCell3 = floor(starGrid3);
  vec2 starFrac3 = fract(starGrid3) - 0.5;
  float sH3 = hash21(starCell3 + 400.0);
  float sH3b = hash21(starCell3 + 500.0);
  float sDist3 = length(starFrac3 - (vec2(sH3, sH3b) - 0.5) * 0.8);
  float sBright3 = exp(-sDist3 * sDist3 * 200.0);
  sBright3 *= step(0.78, sH3);
  sBright3 *= (armVal * 0.5 + 0.5) * exponentialDisk * 0.5;
  color += vec3(0.8, 0.82, 0.9) * sBright3 * 0.1;

  color *= u_diskBrightness;

  // Edge softening
  float iFade = smoothstep(u_diskInnerRadius, u_diskInnerRadius + 1.0, r);
  // Very gradual outer fade to eliminate sawtooth aliasing
  float oFade = smoothstep(u_diskOuterRadius, u_diskOuterRadius - 8.0, r);

  return color * iFade * oFade;
}


// ============================================================
// BACKGROUND RENDERERS
// ============================================================

// ---- Helper: basic star layer ----
vec3 starLayer(vec3 dir, float scale, float threshold, float sharpness, float twinkleSpeed) {
  vec3 p = dir * scale;
  vec3 ip = floor(p);
  vec3 fp = fract(p) - 0.5;

  float h = fract(sin(dot(ip, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float h2 = fract(sin(dot(ip, vec3(269.5, 183.3, 246.1))) * 21345.6789);
  float h3 = fract(sin(dot(ip, vec3(419.2, 371.9, 128.5))) * 67890.1234);

  float starProb = step(threshold, h);
  float dist = length(fp);
  float brightness = starProb * exp(-dist * sharpness);
  brightness *= 0.4 + 0.6 * (0.5 + 0.5 * sin(u_time * (1.0 + h2 * twinkleSpeed) + h3 * TWO_PI));

  return mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.7), h2) * brightness;
}

// ---- Standard star field (Mode 0 & 1) ----
vec3 starFieldDefault(vec3 dir) {
  // NOTE: no early return — HLSL/ANGLE uninitialized variable fix
  vec3 color = vec3(0.0);

  if (u_hasBackground) {
    color = textureCube(u_backgroundCube, dir).rgb;
  } else {
    // Layer 0 — dense small stars
    color += starLayer(dir, 60.0, 0.965, 12.0, 2.0);
    // Layer 1 — sparse bright stars
    color += starLayer(dir, 180.0, 0.96, 18.0, 2.0);

    // Subtle nebula
    float nebula = fbm(dir * 3.0) * 0.5 + 0.5;
    nebula = pow(nebula, 4.0) * 0.012;
    color += vec3(0.08, 0.04, 0.12) * nebula;
  }

  return color;
}

// ---- Quasar background (darker, minimal stars) ----
vec3 starFieldQuasar(vec3 dir) {
  vec3 color = vec3(0.0);

  // Fewer, dimmer stars
  vec3 p = dir * 80.0;
  vec3 ip = floor(p);
  vec3 fp = fract(p) - 0.5;

  float h = fract(sin(dot(ip, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  float h2 = fract(sin(dot(ip, vec3(269.5, 183.3, 246.1))) * 21345.6789);

  float starProb = step(0.975, h);
  float dist = length(fp);
  float brightness = starProb * exp(-dist * 15.0) * 0.5;

  color += mix(vec3(0.5, 0.6, 0.9), vec3(0.9, 0.8, 0.6), h2) * brightness;

  // Faint warm nebula glow
  float nebula = fbm(dir * 2.0 + vec3(u_time * 0.01)) * 0.5 + 0.5;
  nebula = pow(nebula, 3.0) * 0.008;
  color += vec3(0.1, 0.04, 0.08) * nebula;

  return color;
}

// ---- Sgr A* background — simple starfield (galaxy is the disk now) ----
vec3 starFieldSgrA(vec3 dir) {
  vec3 color = vec3(0.0);

  // Standard stars — the galaxy IS the disk, background is just deep space
  color += starLayer(dir, 60.0, 0.96, 12.0, 2.0);
  color += starLayer(dir, 150.0, 0.965, 17.0, 1.5);

  // Very subtle dark nebula
  float nebula = fbm(dir * 2.5) * 0.5 + 0.5;
  nebula = pow(nebula, 4.0) * 0.008;
  color += vec3(0.05, 0.03, 0.08) * nebula;

  return color;
}


// ============================================================
// QUASAR JET — Analytical closest-approach method
// Produces perfectly smooth, round conical jets with no boxy artifacts
// ============================================================
vec3 quasarJetRay(vec3 rayOrigin, vec3 rayDir, float rs) {
  vec3 totalJet = vec3(0.0);

  vec3 bhPos = u_blackHolePos;

  // Project to xz plane relative to BH
  vec2 originXZ = rayOrigin.xz - bhPos.xz;
  vec2 dirXZ = rayDir.xz;
  float dirXZdot = dot(dirXZ, dirXZ);

  // Closest approach distance in xz plane
  float tClosestXZ = 0.0;
  float minDistXZ = length(originXZ);

  if (dirXZdot > 0.0001) {
    tClosestXZ = -dot(originXZ, dirXZ) / dirXZdot;
    minDistXZ = length(originXZ + tClosestXZ * dirXZ);
  }

  // Only compute jets if the ray passes near the axis
  float jetMaxRadius = rs * 3.5;
  if (minDistXZ < jetMaxRadius) {
    // Sample along the ray centered around closest approach
    for (int i = 0; i < 12; i++) {
      float sampleT = tClosestXZ + (float(i) - 5.5) * 3.0;

      if (sampleT > 0.0) {
        vec3 samplePos = rayOrigin + rayDir * sampleT;
        vec3 rel = samplePos - bhPos;
        float absY = abs(rel.y);
        float rXZ = length(rel.xz);

        if (absY > rs * 2.0 && absY < rs * 30.0) {
          // Conical jet: ~6° half-angle
          float coneHalfAngle = 0.10;
          float jetRadius = absY * coneHalfAngle;
          float normalizedR = rXZ / max(jetRadius, 0.001);

          if (normalizedR < 1.2) {
            // Smooth Gaussian core
            float radialProfile = exp(-normalizedR * normalizedR * 3.0);

            // Height falloff
            float heightFade = exp(-absY * 0.06);
            float baseFade = smoothstep(rs * 2.0, rs * 4.0, absY);

            // Gentle internal structure
            float structure = 0.85 + 0.15 * sin(absY * 0.4 + u_time * 1.5);

            float intensity = radialProfile * heightFade * baseFade * structure;

            // Bright knots
            float knot = sin(absY * 0.6 - u_time * 2.5);
            intensity += radialProfile * baseFade * pow(max(knot, 0.0), 6.0) * heightFade * 0.5;

            // 3× brighter than before
            intensity *= 1.5;

            // Color: blue-white core → blue edge
            vec3 jetColor = mix(vec3(0.65, 0.82, 1.0), vec3(0.3, 0.5, 0.95), normalizedR);

            totalJet += jetColor * intensity * 0.18;
          }
        }
      }
    }
  }

  return totalJet;
}


// ============================================================
// DISPATCH: disk color and background by preset mode
// FIX: use if-else-if with initialized variable (HLSL/ANGLE compat)
// ============================================================
vec3 getDiskColor(vec3 hitPos, vec3 vel, float rs) {
  vec3 result = vec3(0.0);
  if (u_presetMode == 1) {
    result = diskColorInterstellar(hitPos, vel, rs);
  } else if (u_presetMode == 2) {
    result = diskColorQuasar(hitPos, vel, rs);
  } else if (u_presetMode == 3) {
    result = diskColorSupermassive(hitPos, vel, rs);
  } else {
    result = diskColorCustom(hitPos, vel, rs);
  }
  return result;
}

vec3 getBackground(vec3 dir) {
  vec3 result = vec3(0.0);
  if (u_presetMode == 2) {
    result = starFieldQuasar(dir);
  } else if (u_presetMode == 3) {
    result = starFieldSgrA(dir);
  } else {
    result = starFieldDefault(dir);
  }
  return result;
}


// ---- Main ----
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  ndc.x *= u_aspectRatio;

  float fovScale = tan(radians(u_fov) * 0.5);
  ndc *= fovScale;

  vec3 rayDir = normalize(
    u_cameraForward + ndc.x * u_cameraRight + ndc.y * u_cameraUp
  );

  vec3 rayOrigin = u_cameraPos;
  float rs = schwarzschildRadius(u_blackHoleMass);

  // ---- Sgr A* mode: skip raymarching, galaxy is particle-based ----
  if (u_presetMode == 3) {
    vec3 bg = starFieldSgrA(rayDir);
    // ACES tone mapping
    vec3 tx = bg;
    bg = (tx * (2.51 * tx + 0.03)) / (tx * (2.43 * tx + 0.59) + 0.14);
    bg = pow(clamp(bg, 0.0, 1.0), vec3(1.0 / 2.2));
    gl_FragColor = vec4(bg, 1.0);
    return;
  }

  // ---- Geodesic Integration ----
  vec3 pos = rayOrigin;
  vec3 vel = rayDir;

  vec3 finalColor = vec3(0.0);
  float minDist = 1e10;
  bool absorbed = false;
  bool escaped = false;
  float diskAlpha = 0.0;
  vec3 diskContribution = vec3(0.0);
  int diskHits = 0;

  float cameraDist = length(u_cameraPos - u_blackHolePos);
  float escapeR = max(40.0, cameraDist + 10.0);
  float escapeR2 = escapeR * escapeR;

  float photonR = 1.5 * rs;

  for (int i = 0; i < 300; i++) {
    if (i >= u_maxSteps) break;

    vec3 toCenter = pos - u_blackHolePos;
    float r2 = dot(toCenter, toCenter);
    float r = sqrt(r2);
    minDist = min(minDist, r);

    // --- Adaptive step sizing ---
    float rNorm = r / rs;
    float dt;
    if (rNorm < 1.5) {
      dt = u_stepSize * 0.05;
    } else if (rNorm < 2.5) {
      dt = u_stepSize * mix(0.05, 0.25, (rNorm - 1.5) / 1.0);
    } else if (rNorm < 8.0) {
      dt = u_stepSize * mix(0.25, 1.5, (rNorm - 2.5) / 5.5);
    } else {
      dt = u_stepSize * mix(1.5, 8.0, clamp((rNorm - 8.0) / 20.0, 0.0, 1.0));
    }

    float prevY = pos.y;
    float prevR = r;

    // Inlined leapfrog step
    vec3 acc1 = geodesicAccel(toCenter, vel, r2, r);
    vec3 velHalf = vel + acc1 * (0.5 * dt);
    pos += velHalf * dt;
    vec3 newToCenter = pos - u_blackHolePos;
    float newR2 = dot(newToCenter, newToCenter);
    float nr = sqrt(newR2);
    vec3 acc2 = geodesicAccel(newToCenter, velHalf, newR2, nr);
    vel = velHalf + acc2 * (0.5 * dt);

    // Event horizon
    if (nr < rs || (prevR > rs && nr < rs * 1.01)) {
      absorbed = true;
      break;
    }

    // Accretion disk intersections (y=0 plane)
    float newY = pos.y;
    if (prevY * newY < 0.0) {
      float frac = abs(prevY) / (abs(prevY) + abs(newY) + 0.0001);
      vec3 hitPos = pos - vel * dt * (1.0 - frac);
      hitPos.y = 0.0;
      float crossR = length(hitPos.xz);
      if (crossR > u_diskInnerRadius && crossR < u_diskOuterRadius) {
        vec3 dc = getDiskColor(hitPos, vel, rs);

        float crossFade = (diskHits == 0) ? 1.0 : 0.6;
        float alpha = clamp(length(dc) * crossFade, 0.0, 0.9);

        diskContribution += dc * crossFade * (1.0 - diskAlpha);
        diskAlpha = clamp(diskAlpha + alpha * (1.0 - diskAlpha), 0.0, 1.0);
        diskHits++;
      }
    }

    // Escaped
    if (newR2 > escapeR2) {
      vec3 bgColor = getBackground(normalize(vel));
      finalColor = bgColor * (1.0 - diskAlpha) + diskContribution;
      escaped = true;
      break;
    }

    // Early out for diverging rays
    if (nr > photonR * 5.0 && dot(newToCenter, vel) > 0.0) {
      vec3 bgColor = getBackground(normalize(vel));
      finalColor = bgColor * (1.0 - diskAlpha) + diskContribution;
      escaped = true;
      break;
    }
  }

  // Max steps reached
  if (!absorbed && !escaped) {
    vec3 bgColor = getBackground(normalize(vel));
    finalColor = bgColor * (1.0 - diskAlpha) + diskContribution;
  }

  // ---- Natural photon ring enhancement ----
  if (!absorbed && diskHits > 0) {
    float photonDist = minDist - photonR;
    float ringWidth = rs * 0.05;
    float boost = 1.0 - clamp(photonDist / ringWidth, 0.0, 1.0);
    float boostIntensity = pow(boost, 16.0) * 0.3;
    finalColor += diskContribution * boostIntensity;
  }

  // Absorbed by event horizon
  if (absorbed) {
    finalColor = diskContribution;
  }

  // Quasar jets — computed as a separate ray-march (NOT per-iteration)
  if (u_presetMode == 2) {
    vec3 jets = quasarJetRay(rayOrigin, rayDir, rs);
    finalColor += jets;
  }

  // ACES Filmic tone mapping
  vec3 x = finalColor;
  finalColor = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);

  // Gamma correction
  finalColor = pow(clamp(finalColor, 0.0, 1.0), vec3(1.0 / 2.2));

  gl_FragColor = vec4(finalColor, 1.0);
}
