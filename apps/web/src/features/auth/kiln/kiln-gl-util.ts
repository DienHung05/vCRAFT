/**
 * Small WebGL helpers shared by the kiln effect passes (shader compile/link, a seeded RNG).
 *
 * Source: shader compile and link helpers adapted from React Bits (Aurora.jsx and Particles.jsx),
 * https://github.com/DavidHDev/react-bits/tree/main/src/content/Backgrounds
 * Licence: MIT + Commons Clause (c) David Haz. Used inside the product; the component itself is not
 * redistributed or sold.
 * Changes: rewritten in TypeScript; GLSL ES 1.00 so one program works on WebGL 2 and WebGL 1 contexts;
 * returns a cached uniform lookup instead of enumerating every active uniform.
 */

export type GL = WebGLRenderingContext | WebGL2RenderingContext;

export interface Program {
  program: WebGLProgram;
  /** Uniform location by name, looked up once. */
  uniform: (name: string) => WebGLUniformLocation | null;
}

function compile(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

/** Compiles and links a program, binding attributes to fixed locations in the given order. */
export function buildProgram(
  gl: GL,
  vertexSource: string,
  fragmentSource: string,
  attributes: readonly string[],
): Program | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  attributes.forEach((name, index) => {
    gl.bindAttribLocation(program, index, name);
  });
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const cache = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
    return cache.get(name) ?? null;
  };
  return { program, uniform };
}

/** Deterministic random numbers in [0, 1), so the ember field is the same on every visit. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Frame state handed to every pass. One object is allocated at mount and mutated each frame, so the
 * render loop allocates nothing.
 */
export interface Frame {
  /** Seconds of animation time (paused while the scene is hidden). */
  time: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Canvas size in device pixels. */
  pixelWidth: number;
  pixelHeight: number;
  /** Device pixels per CSS pixel (capped at 1.5). */
  ratio: number;
  /** Smoothed pointer, -1..1, y up; stays 0 without a fine pointer. */
  pointer: [number, number];
  /** Theme colours (RGB 0..1) read from the CSS custom properties. */
  theme: KilnTheme;
}

export interface KilnTheme {
  /** Dark "Lò đêm" (additive glow) or light "Giấy dó lúc nung" (faint dust). */
  dark: boolean;
  hot: readonly [number, number, number];
  ember: readonly [number, number, number];
  /** Ember colour slots (--kiln-e0 to --kiln-e4), flattened for `uniform3fv`; rebuilt only on a theme change. */
  palette: Float32Array;
}

/** Releases whatever a pass had created when it fails halfway through its setup. */
export function disposeAll(
  gl: GL,
  items: readonly (WebGLProgram | WebGLBuffer | WebGLTexture | WebGLFramebuffer | null)[],
) {
  for (const item of items) {
    if (!item) continue;
    if (item instanceof WebGLProgram) gl.deleteProgram(item);
    else if (item instanceof WebGLBuffer) gl.deleteBuffer(item);
    else if (item instanceof WebGLTexture) gl.deleteTexture(item);
    else if (item instanceof WebGLFramebuffer) gl.deleteFramebuffer(item);
  }
}
