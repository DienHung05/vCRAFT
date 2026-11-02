/**
 * Rising embers (GL_POINTS) and the submit burst that streams into the seal.
 *
 * Source: React Bits Particles (soft sprite fragment with a glow halo, per-particle random seed, twinkle,
 * drift and the burst easing idea), https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Particles/Particles.jsx
 * Licence: MIT + Commons Clause (c) David Haz. Used inside the product; the component itself is not
 * redistributed or sold.
 * Changes: instanced quads in a 3D camera replaced by plain GL_POINTS in 2D screen space (about 200 points,
 * no depth sorting); only the soft round sprite is kept (no square, ring, sparkle, links or lines); the
 * "drift up" mode is the only motion, with a bottom-weighted density and a fade near the top; colours
 * come from the theme palette; the pointer effect is a depth-scaled parallax; the shockwave bursts
 * became a dedicated pass where a few dozen embers follow a curve from the submit button to the seal.
 */
import { buildProgram, disposeAll, type Frame, type GL, seededRandom } from './kiln-gl-util';

const FRAGMENT = `
precision mediump float;
varying vec4 vColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = dot(q, q);
  float core = exp(-d * 5.5);
  float a = core * (1.0 - smoothstep(0.7, 1.0, d)) * vColor.a;
  if (a < 0.003) discard;
  // Premultiplied; the middle of an ember burns a little hotter than its rim.
  gl_FragColor = vec4(vColor.rgb * (1.0 + core * 0.5) * a, a);
}`;

const FIELD_VERTEX = `
precision highp float;
attribute vec4 aSeed;
attribute float aSlot;
uniform float uTime;
uniform float uSize;
uniform float uRatio;
uniform vec2 uPointer;
uniform float uBoost;
uniform vec3 uPalette[5];
varying vec4 vColor;
void main() {
  float depth = aSeed.w;
  float speed = mix(0.012, 0.032, aSeed.z);
  float p = fract(aSeed.y + uTime * speed);
  // Embers linger low, near the fire, and thin out as they climb.
  float y = pow(p, 1.7);
  float sway = sin(uTime * (0.25 + aSeed.z * 0.5) + aSeed.x * 40.0) * 0.012 * (0.4 + p)
    + sin(uTime * 0.9 + aSeed.y * 30.0) * 0.004;
  float x = aSeed.x + sway + uPointer.x * (0.004 + 0.016 * depth);
  float yy = y + uPointer.y * (0.003 + 0.01 * depth);
  float flicker = 0.55 + 0.45 * sin(uTime * (3.0 + aSeed.z * 7.0) + aSeed.y * 50.0);
  float life = smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.35, 1.0, y));
  float bokeh = step(0.93, depth);
  float size = uSize * (0.5 + 1.1 * depth * depth) * (1.0 + bokeh * 2.6);
  gl_PointSize = size * uRatio * (0.75 + 0.25 * flicker);
  gl_Position = vec4(x * 2.0 - 1.0, yy * 2.0 - 1.0, 0.0, 1.0);
  vec3 colour = uPalette[int(aSlot + 0.5)];
  float alpha = min(life * (0.35 + 0.65 * flicker) * mix(0.9, 0.22, bokeh) * uBoost, 1.0);
  vColor = vec4(colour, alpha);
}`;

const BURST_VERTEX = `
precision highp float;
attribute vec4 aSeed;
attribute float aSlot;
uniform vec2 uView;
uniform float uRatio;
uniform float uSize;
uniform float uAge;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uReach;
uniform float uQuick;
uniform vec3 uPalette[5];
varying vec4 vColor;
void main() {
  // Each ember leaves a little later (up to 120ms) and travels 520ms (dur.slow). The quick burst that
  // lands with the seal stamp is shorter: up to 50ms of stagger and 340ms of travel.
  float stagger = mix(0.12, 0.05, uQuick);
  float t = clamp((uAge - aSeed.x * stagger) / mix(0.52, 0.34, uQuick), 0.0, 1.0);
  // ease.kiln, cubic-bezier(0.65, 0, 0.35, 1), approximated by the in-out cubic.
  float e = t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  vec2 target = uTo + (aSeed.zy - 0.5) * uReach;
  vec2 delta = target - uFrom;
  float dist = length(delta);
  vec2 side = vec2(-delta.y, delta.x) / max(dist, 1.0);
  // A curve that bows out sideways and rises, like sparks drawn up a draught.
  vec2 control = (uFrom + target) * 0.5 + side * (aSeed.y * 2.0 - 1.0) * dist * 0.5 + vec2(0.0, -dist * 0.2);
  vec2 pos = (1.0 - e) * (1.0 - e) * uFrom + 2.0 * (1.0 - e) * e * control + e * e * target;
  pos += vec2(aSeed.z - 0.5, aSeed.w - 0.5) * 14.0 * (1.0 - e);
  float waiting = step(uAge, aSeed.x * stagger);
  // Quick fade in, then they dim into the seal over the last stretch.
  float alpha = (1.0 - waiting) * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.78, 1.0, t));
  gl_PointSize = uSize * (1.0 + aSeed.w * 0.8) * (1.1 - 0.5 * e) * uRatio;
  gl_Position = vec4(pos.x / uView.x * 2.0 - 1.0, 1.0 - pos.y / uView.y * 2.0, 0.0, 1.0);
  vColor = vec4(uPalette[int(aSlot + 0.5)], alpha);
}`;

const FIELD_COUNT = 200;
const BURST_COUNT = 48;
const QUICK_COUNT = 24;
const MAX_BURSTS = 4;
/** Bursts live this long, in seconds (120ms of stagger plus 520ms of travel, and a little slack). */
const BURST_SECONDS = 0.7;

export interface BurstTarget {
  /** Start and end in CSS pixels inside the canvas. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Radius of the arrival area (the seal). */
  reach: number;
  /** A shorter, smaller burst that lands with the seal stamp. */
  quick: boolean;
}

export interface EmberPass {
  draw: (frame: Frame) => void;
  /** Starts a burst; `time` is the frame time at which it begins. */
  burst: (target: BurstTarget, time: number) => void;
  dispose: () => void;
}

function seeds(count: number, seed: number, slots: readonly number[]): Float32Array {
  const random = seededRandom(seed);
  // Per point: four seed values and one palette slot.
  const data = new Float32Array(count * 5);
  for (let i = 0; i < count; i++) {
    data[i * 5] = random();
    data[i * 5 + 1] = random();
    data[i * 5 + 2] = random();
    data[i * 5 + 3] = random();
    data[i * 5 + 4] = slots[Math.floor(random() * slots.length)] ?? 0;
  }
  return data;
}

/** Returns null when a shader does not compile (the static art stays). */
export function createEmberPass(gl: GL): EmberPass | null {
  const attributes = ['aSeed', 'aSlot'];
  const field = buildProgram(gl, FIELD_VERTEX, FRAGMENT, attributes);
  const burstProgram = buildProgram(gl, BURST_VERTEX, FRAGMENT, attributes);
  const fieldBuffer = gl.createBuffer();
  const burstBuffer = gl.createBuffer();
  if (!field || !burstProgram || !fieldBuffer || !burstBuffer) {
    disposeAll(gl, [
      field?.program ?? null,
      burstProgram?.program ?? null,
      fieldBuffer,
      burstBuffer,
    ]);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, fieldBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds(FIELD_COUNT, 11, [0, 1, 2, 3, 3, 4]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, burstBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds(BURST_COUNT, 77, [0, 1, 2]), gl.STATIC_DRAW);

  const active: { target: BurstTarget; start: number }[] = [];

  function bindPoints(buffer: WebGLBuffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
  }

  return {
    draw(frame) {
      // Dark: embers add up like light. Light: fine clay dust that darkens the paper a little.
      gl.enable(gl.BLEND);
      if (frame.theme.dark) gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const palette = frame.theme.palette;

      // biome-ignore lint/correctness/useHookAtTopLevel: `useProgram` is a WebGL call, not a React hook
      gl.useProgram(field.program);
      bindPoints(fieldBuffer);
      gl.uniform1f(field.uniform('uTime'), frame.time);
      gl.uniform1f(field.uniform('uSize'), frame.theme.dark ? 7 : 5.5);
      gl.uniform1f(field.uniform('uRatio'), frame.ratio);
      // Paper needs a firmer dot than the dark kiln does to read as dust.
      gl.uniform1f(field.uniform('uBoost'), frame.theme.dark ? 1 : 1.7);
      gl.uniform2f(field.uniform('uPointer'), frame.pointer[0], frame.pointer[1]);
      gl.uniform3fv(field.uniform('uPalette'), palette);
      gl.drawArrays(gl.POINTS, 0, frame.theme.dark ? FIELD_COUNT : 150);

      for (let i = active.length - 1; i >= 0; i--) {
        const item = active[i];
        if (item && frame.time - item.start > BURST_SECONDS) active.splice(i, 1);
      }
      if (active.length > 0) {
        // biome-ignore lint/correctness/useHookAtTopLevel: `useProgram` is a WebGL call, not a React hook
        gl.useProgram(burstProgram.program);
        bindPoints(burstBuffer);
        gl.uniform2f(burstProgram.uniform('uView'), frame.width, frame.height);
        gl.uniform1f(burstProgram.uniform('uRatio'), frame.ratio);
        gl.uniform1f(burstProgram.uniform('uSize'), 12);
        gl.uniform3fv(burstProgram.uniform('uPalette'), palette);
        for (const { target, start } of active) {
          gl.uniform1f(burstProgram.uniform('uAge'), frame.time - start);
          gl.uniform2f(burstProgram.uniform('uFrom'), target.fromX, target.fromY);
          gl.uniform2f(burstProgram.uniform('uTo'), target.toX, target.toY);
          gl.uniform1f(burstProgram.uniform('uReach'), target.reach);
          gl.uniform1f(burstProgram.uniform('uQuick'), target.quick ? 1 : 0);
          gl.drawArrays(gl.POINTS, 0, target.quick ? QUICK_COUNT : BURST_COUNT);
        }
      }
      gl.disableVertexAttribArray(0);
      gl.disableVertexAttribArray(1);
    },
    burst(target, time) {
      if (active.length >= MAX_BURSTS) active.shift();
      active.push({ target, start: time });
    },
    dispose() {
      disposeAll(gl, [field.program, burstProgram.program, fieldBuffer, burstBuffer]);
    },
  };
}
