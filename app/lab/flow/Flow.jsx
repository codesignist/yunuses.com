"use client";
import { useEffect, useRef, useState } from "react";

const VELOCITY_DISSIPATION = 0.6;
// Dye multiplicative decay — RGBA16F precision yeterli olduğu için exponential
// decay quantize olmuyor; 0.4 ≈ τ=2.5s, görsel tail ~10s'e kadar uzar.
const DYE_DISSIPATION = 0.8;
const SPLAT_RADIUS = 0.25;
const SPLAT_FORCE = 6000;
// Tayf: hue tam tur süresi.
const SPECTRUM_CYCLE_MS = 3000;

const MODES = [
  { id: "spectrum", label: "Tayf" },
  { id: "lava", label: "Lav" },
  { id: "ice", label: "Buz" },
  { id: "chaos", label: "Kaos" },
];
// Çok yüksek DPR ekranlarda fragment shader yükünü kontrol altında tutmak için
// uzun kenar buradan aşılırsa orantılı küçültürüz.
const MAX_LONG_SIDE = 1920;

const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_target;
uniform vec3 u_color;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_aspect;
out vec4 fragColor;
void main() {
  vec2 p = v_uv - u_point;
  p.x *= u_aspect;
  float falloff = exp(-dot(p, p) / u_radius);
  vec3 base = texture(u_target, v_uv).xyz;
  fragColor = vec4(base + u_color * falloff, 1.0);
}`;

const ADVECT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_velTexelSize;
uniform vec2 u_srcTexelSize;
uniform float u_dt;
uniform float u_dissipation;
out vec4 fragColor;

vec4 bilinear(sampler2D tex, vec2 uv, vec2 texel) {
  vec2 st = uv / texel - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture(tex, (iuv + vec2(0.5, 0.5)) * texel);
  vec4 b = texture(tex, (iuv + vec2(1.5, 0.5)) * texel);
  vec4 c = texture(tex, (iuv + vec2(0.5, 1.5)) * texel);
  vec4 d = texture(tex, (iuv + vec2(1.5, 1.5)) * texel);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main() {
  vec2 vel = bilinear(u_velocity, v_uv, u_velTexelSize).xy;
  vec2 coord = v_uv - u_dt * vel * u_velTexelSize;
  vec4 result = bilinear(u_source, coord, u_srcTexelSize);
  fragColor = result / (1.0 + u_dissipation * u_dt);
}`;

const DISPLAY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_dye;
uniform vec2 u_dyeTexelSize;
out vec4 fragColor;

vec3 bilinearRGB(sampler2D tex, vec2 uv, vec2 texel) {
  vec2 st = uv / texel - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec3 a = texture(tex, (iuv + vec2(0.5, 0.5)) * texel).rgb;
  vec3 b = texture(tex, (iuv + vec2(1.5, 0.5)) * texel).rgb;
  vec3 c = texture(tex, (iuv + vec2(0.5, 1.5)) * texel).rgb;
  vec3 d = texture(tex, (iuv + vec2(1.5, 1.5)) * texel).rgb;
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main() {
  vec3 c = bilinearRGB(u_dye, v_uv, u_dyeTexelSize);
  // HDR yumuşak tone-map (Reinhard) + hafif gamma — yoğun bölgeler beyaza
  // sertçe clip etmeden doysun.
  c = c / (c + vec3(1.0));
  c = pow(c, vec3(0.85));
  fragColor = vec4(c, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + log);
  }
  return shader;
}

function createProgram(gl, fragSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error("Program link error: " + log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function getUniforms(gl, program) {
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return uniforms;
}

function createFBO(gl, w, h, internalFormat, format, type, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return { tex, fbo, width: w, height: h };
}

function createDoubleFBO(gl, w, h, internalFormat, format, type, filter) {
  let a = createFBO(gl, w, h, internalFormat, format, type, filter);
  let b = createFBO(gl, w, h, internalFormat, format, type, filter);
  return {
    width: w,
    height: h,
    get read() { return a; },
    get write() { return b; },
    swap() { const t = a; a = b; b = t; },
  };
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    case 5: return [v, p, q];
  }
}

export default function Flow() {
  const canvasRef = useRef(null);
  const [unsupported, setUnsupported] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [mode, setMode] = useState("spectrum");
  // Ref olarak da tutuyoruz — pointer event handler'ları useEffect içinde
  // closure'lanıyor; state değişince effect'i yeniden çalıştırmadan ref
  // üzerinden anlık değer okunabiliyor.
  const modeRef = useRef("spectrum");
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      preserveDrawingBuffer: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      setUnsupported(true);
      return;
    }

    const haveColorBufferFloat = gl.getExtension("EXT_color_buffer_float");
    if (!haveColorBufferFloat) {
      setUnsupported(true);
      return;
    }
    // Velocity (RG16F) için manuel bilinear advect shader'ında — hardware
    // half-float linear filter'a güvenmiyoruz. Dye RGBA8 olduğundan onun
    // hardware LINEAR filtering'i her donanımda çalışır.
    const halfFloat = gl.HALF_FLOAT;

    const splatProgram = createProgram(gl, SPLAT_FS);
    const advectProgram = createProgram(gl, ADVECT_FS);
    const displayProgram = createProgram(gl, DISPLAY_FS);

    const splatU = getUniforms(gl, splatProgram);
    const advectU = getUniforms(gl, advectProgram);
    const displayU = getUniforms(gl, displayProgram);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    let velocity, dye;
    let simW, simH, dyeW, dyeH, aspect;

    function disposeDoubleFBO(d) {
      if (!d) return;
      gl.deleteTexture(d.read.tex);
      gl.deleteFramebuffer(d.read.fbo);
      gl.deleteTexture(d.write.tex);
      gl.deleteFramebuffer(d.write.fbo);
    }

    function initFBOs() {
      // Sim ve dye, canvas (DPR uygulanmış) boyutuyla aynı çözünürlükte.
      // Bu sayede ekstra upscaling olmuyor; düşük-res grid'in yarattığı
      // köşeli artefaktlar tamamen ortadan kalkıyor.
      let w = canvas.width;
      let h = canvas.height;
      const longest = Math.max(w, h);
      if (longest > MAX_LONG_SIDE) {
        const k = MAX_LONG_SIDE / longest;
        w = Math.max(1, Math.round(w * k));
        h = Math.max(1, Math.round(h * k));
      }
      simW = w; simH = h;
      dyeW = w; dyeH = h;
      aspect = canvas.clientWidth / canvas.clientHeight;
      disposeDoubleFBO(velocity);
      disposeDoubleFBO(dye);
      velocity = createDoubleFBO(gl, simW, simH, gl.RG16F, gl.RG, halfFloat, gl.NEAREST);
      // Dye RGBA16F — multiplicative decay quantize olmadan exponential
      // söner, uzun tail mümkün. Display shader'da manuel bilinear sampling.
      dye = createDoubleFBO(gl, dyeW, dyeH, gl.RGBA16F, gl.RGBA, halfFloat, gl.NEAREST);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      // !velocity koşulu: React Strict Mode/HMR'de useEffect re-mount olduğunda
      // canvas zaten doğru boyutta olabilir ama `velocity`/`dye` yeni
      // closure'da undefined; bu durumda FBO'ları yine de kurmak şart.
      if (canvas.width !== w || canvas.height !== h || !velocity) {
        canvas.width = w;
        canvas.height = h;
        initFBOs();
      }
    }

    function draw(target) {
      if (target == null) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.width, target.height);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function splat(point, deltaX, deltaY, color) {
      gl.useProgram(splatProgram);
      gl.uniform1f(splatU.u_aspect, aspect);

      // velocity splat
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(splatU.u_target, 0);
      gl.uniform2f(splatU.u_point, point.x, point.y);
      gl.uniform1f(splatU.u_radius, SPLAT_RADIUS / 100.0);
      gl.uniform3f(splatU.u_color, deltaX * SPLAT_FORCE, deltaY * SPLAT_FORCE, 0);
      draw(velocity.write);
      velocity.swap();

      // dye splat
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
      gl.uniform1i(splatU.u_target, 0);
      gl.uniform3f(splatU.u_color, color[0], color[1], color[2]);
      draw(dye.write);
      dye.swap();
    }

    function step(dt) {
      gl.disable(gl.BLEND);

      // advect velocity (source = velocity → both texelSizes are velocity)
      gl.useProgram(advectProgram);
      gl.uniform2f(advectU.u_velTexelSize, 1.0 / simW, 1.0 / simH);
      gl.uniform2f(advectU.u_srcTexelSize, 1.0 / simW, 1.0 / simH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(advectU.u_velocity, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(advectU.u_source, 1);
      gl.uniform1f(advectU.u_dt, dt);
      gl.uniform1f(advectU.u_dissipation, VELOCITY_DISSIPATION);
      draw(velocity.write);
      velocity.swap();

      // advect dye (source = dye → srcTexelSize is dye)
      gl.uniform2f(advectU.u_srcTexelSize, 1.0 / dyeW, 1.0 / dyeH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
      gl.uniform1i(advectU.u_velocity, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
      gl.uniform1i(advectU.u_source, 1);
      gl.uniform1f(advectU.u_dissipation, DYE_DISSIPATION);
      draw(dye.write);
      dye.swap();
    }

    function render() {
      gl.useProgram(displayProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
      gl.uniform1i(displayU.u_dye, 0);
      gl.uniform2f(displayU.u_dyeTexelSize, 1.0 / dyeW, 1.0 / dyeH);
      draw(null);
    }

    // pointer handling
    const pointers = new Map();
    let lastSplatTime = 0;

    function rgbToInk(rgb) {
      return [rgb[0] * 0.15, rgb[1] * 0.15, rgb[2] * 0.15];
    }

    // Stroke başında atanan renk — Kaos modunda stroke süresince sabit kalır.
    function getStrokeColor() {
      const hue = (performance.now() / 5000) % 1;
      return rgbToInk(hsvToRgb(hue, 0.9, 1.0));
    }

    // Splat anındaki renk — moda göre.
    function getSplatColor(strokeColor, now) {
      switch (modeRef.current) {
        case "spectrum": {
          const hue = (now / SPECTRUM_CYCLE_MS) % 1;
          return rgbToInk(hsvToRgb(hue, 0.9, 1.0));
        }
        case "lava": {
          // Kırmızı-ağırlıklı palette: çoğunluk doygun kırmızı (alevin asıl
          // tonu), küçük kısmı kırmızı-turuncu vurgu. Birikim noktalarında HDR
          // tone-map zaten sarıya/beyaza patlatıyor — base ton kırmızı kalsın.
          const r = Math.random();
          let hue, sat, intensity;
          if (r < 0.18) {
            // Kırmızı-turuncu vurgu noktaları
            hue = 0.025 + Math.random() * 0.035; // 0.025-0.06
            sat = 0.95 + Math.random() * 0.05;
            intensity = 0.55 + Math.random() * 0.30;
          } else {
            // Doygun kırmızı — alevin asıl rengi
            hue = 0.0 + Math.random() * 0.025; // 0.0-0.025
            sat = 1.0;
            intensity = 0.45 + Math.random() * 0.30;
          }
          const rgb = hsvToRgb(hue, sat, 1.0);
          return [rgb[0] * intensity, rgb[1] * intensity, rgb[2] * intensity];
        }
        case "ice": {
          // Lav'ın simetrik soğuk dengi: çoğunluk doygun turkuaz/cyan (buzun
          // asıl rengi), küçük kısmı ice-blue vurgu. Hue 0.45-0.62 bandı
          // turkuaz→cyan→ice-blue→derin mavi geçişini kapsıyor.
          const r = Math.random();
          let hue, sat, intensity;
          if (r < 0.18) {
            // Açık ice-blue vurgu / ışıltı
            hue = 0.55 + Math.random() * 0.07; // 0.55-0.62 (ice blue → blue)
            sat = 0.55 + Math.random() * 0.30;
            intensity = 0.55 + Math.random() * 0.30;
          } else {
            // Doygun turkuaz-cyan — buzun asıl rengi
            hue = 0.46 + Math.random() * 0.07; // 0.46-0.53 (turkuaz → cyan)
            sat = 0.95 + Math.random() * 0.05;
            intensity = 0.45 + Math.random() * 0.30;
          }
          const rgb = hsvToRgb(hue, sat, 1.0);
          return [rgb[0] * intensity, rgb[1] * intensity, rgb[2] * intensity];
        }
        case "chaos":
        default:
          return strokeColor;
      }
    }

    function pointerDown(e) {
      const id = e.pointerId ?? "mouse";
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      pointers.set(id, { x, y, down: true, color: getStrokeColor() });
      setHintVisible(false);
    }

    function pointerMove(e) {
      const id = e.pointerId ?? "mouse";
      const p = pointers.get(id);
      if (!p || !p.down) return;
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      const dx = nx - p.x;
      const dy = ny - p.y;
      if (dx === 0 && dy === 0) return;
      const now = performance.now();
      if (now - lastSplatTime > 8) {
        splat({ x: nx, y: ny }, dx, dy, getSplatColor(p.color, now));
        lastSplatTime = now;
      }
      p.x = nx; p.y = ny;
    }

    function pointerUp(e) {
      const id = e.pointerId ?? "mouse";
      pointers.delete(id);
    }

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    canvas.addEventListener("pointerleave", pointerUp);

    // initial seed splats so the screen isn't empty
    function seed() {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const x = 0.2 + Math.random() * 0.6;
        const y = 0.2 + Math.random() * 0.6;
        const angle = Math.random() * Math.PI * 2;
        const dx = Math.cos(angle) * 0.005;
        const dy = Math.sin(angle) * 0.005;
        const rgb = hsvToRgb(Math.random(), 0.9, 1.0);
        splat({ x, y }, dx, dy, [rgb[0] * 0.2, rgb[1] * 0.2, rgb[2] * 0.2]);
      }
    }

    resize();
    seed();

    let last = performance.now();
    let raf;
    function frame() {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      gl.bindVertexArray(vao);
      step(dt);
      render();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("pointerleave", pointerUp);
      disposeDoubleFBO(velocity);
      disposeDoubleFBO(dye);
      gl.deleteProgram(splatProgram);
      gl.deleteProgram(advectProgram);
      gl.deleteProgram(displayProgram);
      gl.deleteBuffer(quad);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ cursor: "crosshair" }}
      />
      {unsupported && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm px-6 text-center">
          Bu deney WebGL2 ve float texture desteği gerektiriyor — tarayıcın
          desteklemiyor gibi görünüyor.
        </div>
      )}
      {hintVisible && !unsupported && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60 text-[16px] max-md:text-[14px] tracking-wide animate-fade-in-up">
          Sürükleyerek başla
        </div>
      )}
      {!unsupported && (
        <div
          role="radiogroup"
          aria-label="Renk modu"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
        >
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setMode(m.id);
                  setHintVisible(false);
                }}
                className={`px-3 py-1.5 rounded-full text-[12px] tracking-wide transition ${
                  active
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:text-white/90"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
