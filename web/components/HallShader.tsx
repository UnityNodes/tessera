"use client";

import { useEffect, useRef } from "react";

/**
 *
 *
 *
 *
 */

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform vec3  uBg;
uniform vec3  uAccent;
uniform vec3  uGold;
uniform vec3  uMagenta;

out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 sp = vec2(uv.x * aspect, uv.y);

  vec3 col = uBg;

  float t = uTime * 0.014;
  float fog1 = fbm(sp * 2.4 + vec2(t, -t * 0.6));
  float fog2 = fbm(sp * 1.3 - vec2(t * 0.7, t * 0.4) + 11.3);
  float fog = fog1 * 0.62 + fog2 * 0.38;

  float vert = smoothstep(-0.15, 1.05, uv.y);
  col += uAccent * fog * fog * vert * 0.30;

  float gold = smoothstep(1.25, 0.10, distance(sp, vec2(aspect * 0.86, 0.94)));
  col += uGold * gold * gold * (0.16 + fog * 0.22);

  float cold = smoothstep(1.35, 0.05, distance(sp, vec2(aspect * 0.12, 0.06)));
  col += uAccent * cold * cold * (0.14 + fog * 0.18);

  float mag = smoothstep(0.95, 0.0, distance(sp, vec2(aspect * 0.46, 0.52)));
  col += uMagenta * mag * mag * 0.05;

  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x0 = 0.30 + fi * 0.22;
    float lean = (fi - 1.0) * 0.16;
    float d = abs(uv.x - (x0 + lean * uv.y));
    float w = 0.030 + fi * 0.012;
    float beam = smoothstep(w, 0.0, d);
    beam *= smoothstep(1.05, 0.05, uv.y);
    beam *= 0.55 + 0.45 * sin(uTime * (0.24 + fi * 0.07) + fi * 2.1);
    beam *= 0.55 + fog * 0.75;
    col += uAccent * beam * 0.075;
  }

  vec2 m = vec2(uMouse.x * aspect, uMouse.y);
  float halo = smoothstep(0.55, 0.0, distance(sp, m));
  col += uAccent * halo * halo * 0.085;

  float vig = smoothstep(1.25, 0.35, length(uv - 0.5));
  col *= 0.55 + 0.45 * vig;

  float grain = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.020;
  col += grain;

  outColor = vec4(col, 1.0);
}
`;

function toRgb(css: string): [number, number, number] {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return [0, 0, 0];
  c.fillStyle = "#000";
  c.fillStyle = css;
  const v = c.fillStyle as string;
  if (v.startsWith("#")) {
    const n = parseInt(v.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = v.match(/[\d.]+/g);
  if (!m) return [0, 0, 0];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

function token(name: string, fallback: string): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return toRgb(raw || fallback);
}

export function HallShader() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");

    gl.uniform3fv(gl.getUniformLocation(prog, "uBg"), token("--color-bg", "#0a0d12"));
    gl.uniform3fv(gl.getUniformLocation(prog, "uAccent"), token("--color-accent", "#2b7fff"));
    gl.uniform3fv(gl.getUniformLocation(prog, "uGold"), token("--color-tier-aureus", "#f0a63c"));
    gl.uniform3fv(
      gl.getUniformLocation(prog, "uMagenta"),
      token("--color-tier-porphyry", "#e0339f"),
    );

    const SCALE = 0.5;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nw = Math.max(1, Math.round(window.innerWidth * dpr * SCALE));
      const nh = Math.max(1, Math.round(window.innerHeight * dpr * SCALE));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    resize();

    const target = { x: 0.5, y: 0.5 };
    const eased = { x: 0.5, y: 0.5 };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let running = false;
    const start = performance.now();

    const frame = (now: number) => {
      eased.x += (target.x - eased.x) * 0.045;
      eased.y += (target.y - eased.y) * 0.045;
      gl.uniform2f(uMouse, eased.x, eased.y);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const play = () => {
      if (running || reduced.matches || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const once = () => {
      gl.uniform2f(uMouse, 0.5, 0.55);
      gl.uniform1f(uTime, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    once();

    const onVisible = () => (document.hidden ? stop() : play());
    const onReduced = () => {
      stop();
      once();
      play();
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    reduced.addEventListener("change", onReduced);
    play();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisible);
      reduced.removeEventListener("change", onReduced);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
