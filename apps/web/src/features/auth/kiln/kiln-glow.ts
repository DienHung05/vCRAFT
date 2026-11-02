/**
 * Kiln glow and heat shimmer: one fullscreen-triangle pass, drawn small and upscaled.
 *
 * Source: the noise and glow approach of React Bits Aurora (hash dither, smoother falloff, hem and
 * ribbon structure), https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Aurora/Aurora.jsx
 * Licence: MIT + Commons Clause (c) David Haz. Used inside the product; the component itself is not
 * redistributed or sold.
 * Changes: simplex noise replaced by a cheap two-octave value noise; the aurora ramp and OKLCH stops
 * replaced by the theme's hot and ember colours; the hem now rises from the bottom as a flickering
 * kiln glow with three drifting pools of heat shimmer; the hover reach became a tiny pointer parallax;
 * premultiplied output so it composites over the CSS scene; the pass renders into a half-resolution
 * texture at most 30 times a second and the texture is blitted every frame (the glow is smooth and slow,
 * so this costs nothing visible); no React, intro or layer props.
 */
import { buildProgram, disposeAll, type Frame, type GL } from './kiln-gl-util';

/** The glow is drawn at this fraction of the canvas size and upscaled. */
const SCALE = 0.5;
/** ... and redrawn at most this often. */
const INTERVAL = 1 / 30;

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uHot;
uniform vec3 uEmber;
uniform float uStrength;
uniform vec2 uPointer;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  return vnoise(p) * 0.65 + vnoise(p * 2.03 + 7.1) * 0.35;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  if (uv.y > 0.85) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float aspect = uResolution.x / uResolution.y;
  float t = uTime;

  // Kiln glow: breathes along the bottom, strongest around the kiln mouths (26% and 84%).
  float breath = fbm(vec2(uv.x * 1.6 * aspect + t * 0.05, t * 0.17));
  float mouth = exp(-pow((uv.x - 0.26 - uPointer.x * 0.012) / 0.3, 2.0)) * 0.6
    + exp(-pow((uv.x - 0.84 - uPointer.x * 0.008) / 0.22, 2.0)) * 0.35;
  float flame = exp(-(uv.y + uPointer.y * 0.01) * 3.4) * (0.3 + 0.7 * breath) * (0.45 + mouth);

  // Heat shimmer: three wide pools of hot air. Each is a soft gaussian in height, broken up along its
  // length by slow noise, so they drift as blobs rather than lying as stripes.
  float shimmer = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float height = 0.3 + fk * 0.15 + 0.03 * sin(t * 0.07 + fk * 2.0);
    float warp = (fbm(vec2(uv.x * 0.8 * aspect + t * (0.03 + 0.01 * fk) + fk * 9.0, fk * 3.0 + t * 0.05)) - 0.5) * 0.1;
    float band = exp(-pow((uv.y - height - warp) / (0.07 + 0.025 * fk), 2.0));
    float along = smoothstep(0.3, 0.75, fbm(vec2(uv.x * 0.55 * aspect - t * (0.02 + 0.006 * fk) + fk * 5.0, fk * 1.7 + t * 0.03)));
    shimmer += band * along;
  }

  float alpha = (flame * 0.2 + shimmer * 0.05) * uStrength;
  vec3 tint = mix(uEmber, uHot, clamp(flame * 0.9, 0.0, 1.0));
  float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(tint * alpha + dither * alpha, alpha);
}`;

const BLIT = `
precision mediump float;
uniform sampler2D uTexture;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uTexture, vUv);
}`;

export interface GlowPass {
  draw: (frame: Frame) => void;
  dispose: () => void;
}

/** Returns null when the shader does not compile or the framebuffer is unusable (the static art stays). */
export function createGlowPass(gl: GL): GlowPass | null {
  const glow = buildProgram(gl, VERTEX, FRAGMENT, ['aPosition']);
  const blit = buildProgram(gl, VERTEX, BLIT, ['aPosition']);
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  const parts = [glow?.program ?? null, blit?.program ?? null, buffer, texture, framebuffer];
  if (!glow || !blit || !buffer || !texture || !framebuffer) {
    disposeAll(gl, parts);
    return null;
  }
  // One oversized triangle covers the viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let width = 0;
  let height = 0;
  let lastRender = Number.NEGATIVE_INFINITY;

  const triangle = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(0);
  };

  return {
    draw(frame) {
      const w = Math.max(1, Math.round(frame.pixelWidth * SCALE));
      const h = Math.max(1, Math.round(frame.pixelHeight * SCALE));
      if (w !== width || h !== height) {
        width = w;
        height = h;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        lastRender = Number.NEGATIVE_INFINITY;
      }

      if (frame.time - lastRender >= INTERVAL) {
        lastRender = frame.time;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, w, h);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // biome-ignore lint/correctness/useHookAtTopLevel: `useProgram` is a WebGL call, not a React hook
        gl.useProgram(glow.program);
        gl.uniform2f(glow.uniform('uResolution'), w, h);
        gl.uniform1f(glow.uniform('uTime'), frame.time);
        gl.uniform3f(
          glow.uniform('uHot'),
          frame.theme.hot[0],
          frame.theme.hot[1],
          frame.theme.hot[2],
        );
        gl.uniform3f(
          glow.uniform('uEmber'),
          frame.theme.ember[0],
          frame.theme.ember[1],
          frame.theme.ember[2],
        );
        // The light theme keeps the glow faint: it is a clay wash on paper, not a fire.
        gl.uniform1f(glow.uniform('uStrength'), frame.theme.dark ? 1 : 0.55);
        gl.uniform2f(glow.uniform('uPointer'), frame.pointer[0], frame.pointer[1]);
        triangle();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, frame.pixelWidth, frame.pixelHeight);
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      // biome-ignore lint/correctness/useHookAtTopLevel: `useProgram` is a WebGL call, not a React hook
      gl.useProgram(blit.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(blit.uniform('uTexture'), 0);
      triangle();
    },
    dispose() {
      disposeAll(gl, parts);
    },
  };
}
