'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, LatheGeometry, type Mesh, ShaderMaterial, Vector2 } from 'three';
import { afterFirstFrame } from './first-frame';
import { kilnGlow, morphProfile, paintProgress } from './vase-profiles';

const SEGMENTS = 72;
/** Without any scroll the whole story still plays once, over this many seconds. */
const STORY_SECONDS = 9;

// BRAND §3.1: raw clay, the ivory glaze ground, the cobalt of men lam, and the orange of the kiln.
const CLAY = new Color('#c9ae8a');
const IVORY = new Color('#f1ebdd');
const GLAZE = new Color('#1e3a6e');
const KILN = new Color('#e0662e');

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = -view.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * view;
  }
`;

// The glaze "paints in" from the foot up along brush-like stripes; the kiln glow lights the rim.
const fragmentShader = /* glsl */ `
  uniform vec3 uClay;
  uniform vec3 uIvory;
  uniform vec3 uGlaze;
  uniform vec3 uKiln;
  uniform float uPaint;
  uniform float uGlow;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    vec3 light = normalize(vec3(0.4, 0.8, 0.6));
    float diffuse = max(dot(n, light), 0.0) * 0.75 + 0.3;
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);

    // Brush strokes: wavy bands around the body with a little grain.
    float stroke = 0.5 + 0.5 * sin(vUv.x * 6.2831 * 9.0 + sin(vUv.y * 12.0) * 1.6);
    float grain = hash(floor(vUv * vec2(180.0, 90.0))) * 0.08;
    float front = uPaint * 1.15 - vUv.y;
    float painted = smoothstep(0.0, 0.08, front + stroke * 0.06 + grain);
    float motif = smoothstep(0.55, 0.62, stroke) * step(0.25, vUv.y) * step(vUv.y, 0.8);

    // Men lam: cobalt brushwork on an ivory ground, with a band at the shoulder and the foot.
    float band = step(0.82, vUv.y) * step(vUv.y, 0.86) + step(0.12, vUv.y) * step(vUv.y, 0.15);
    vec3 glaze = mix(uIvory, uGlaze, clamp(motif * 0.9 + band, 0.0, 1.0));
    vec3 base = mix(uClay, glaze, painted);
    vec3 colour = base * diffuse + vec3(1.0) * pow(max(dot(reflect(-light, n), v), 0.0), 24.0) * 0.35 * painted;
    colour += uKiln * uGlow * (0.35 + rim * 1.4);
    gl_FragColor = vec4(colour, 1.0);
  }
`;

function latheFor(progress: number): LatheGeometry {
  const points = morphProfile(progress).map(([r, y]) => new Vector2(r, y - 1));
  return new LatheGeometry(points, SEGMENTS);
}

function Vase({ progress, onReady }: { progress: { current: number }; onReady: () => void }) {
  const mesh = useRef<Mesh>(null);
  const shown = useRef(-1);
  const invalidate = useThree((state) => state.invalidate);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uClay: { value: CLAY },
          uIvory: { value: IVORY },
          uGlaze: { value: GLAZE },
          uKiln: { value: KILN },
          uPaint: { value: 0 },
          uGlow: { value: 0 },
        },
      }),
    [],
  );
  const initial = useMemo(() => latheFor(0), []);
  const firstFrame = useMemo(() => afterFirstFrame(onReady), [onReady]);

  useEffect(
    () => () => {
      material.dispose();
      mesh.current?.geometry.dispose();
    },
    [material],
  );

  useFrame((state, delta) => {
    const target = mesh.current;
    if (!target) return;
    // Scrolling drives the story; a visitor who stays put still sees it unfold, slowly.
    const p = Math.max(progress.current, Math.min(1, state.clock.elapsedTime / STORY_SECONDS));
    // Rebuild the lathe only when the scroll moved enough to show (24 points × 73 rings is cheap).
    if (Math.abs(p - shown.current) > 0.002) {
      const old = target.geometry;
      target.geometry = latheFor(p);
      old.dispose();
      shown.current = p;
      (material.uniforms.uPaint as { value: number }).value = paintProgress(p);
      (material.uniforms.uGlow as { value: number }).value = kilnGlow(p);
    }
    // A slow turn on the wheel; with frameloop="demand" each frame asks for the next.
    target.rotation.y += delta * 0.35;
    invalidate();
    // The render for this frame follows this callback; the hero fades to the canvas only after it.
    firstFrame();
  });

  return <mesh ref={mesh} geometry={initial} material={material} />;
}

/**
 * The WebGL hero vase (PLAN E13, BRAND §6.3 #1): a LatheGeometry that turns from clay to a money jar
 * with the scroll, the blue glaze painting in, and the kiln glowing while it "fires". Loaded only by
 * {@link HeroVase} on capable devices; `progress` is a ref the scroll handler writes. `onReady` fires after
 * the first frame has been drawn, not when the canvas is created (GH#316).
 */
export default function VaseScene({
  progress,
  onReady,
}: {
  progress: { current: number };
  onReady: () => void;
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.1, 5.4], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-hidden
    >
      <Vase progress={progress} onReady={onReady} />
    </Canvas>
  );
}
