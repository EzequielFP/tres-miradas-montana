// Portada: curvas de nivel nocturnas del tramo de 15 × 15 km, los movimientos en masa del
// inventario como puntos que laten, las líneas de la red y una lente que muestra lo que ve
// nuestro modelo (el índice de susceptibilidad) bajo el cursor.
import { clamp, emitGeo, loadImage } from "./util.js";
import { loadLadera, sampleGrid, texture as mediaUrl } from "./ladera.js";

const vertex = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;
uniform sampler2D uHeight, uEvents, uLines, uIndex;
uniform vec2 uRes, uOrigin, uScale, uTexel, uElev, uMouse;
uniform float uTime, uScan, uIntro, uLens, uRadius, uDpr;
out vec4 color;

float hgt(vec2 uv) { return texture(uHeight, uv).r; }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = uOrigin + frag / uRes * uScale;
  float h = hgt(uv);
  float e = mix(uElev.x, uElev.y, h);

  vec3 night = vec3(0.039, 0.055, 0.075);
  vec3 ridge = vec3(0.13, 0.17, 0.21);
  vec3 paper = vec3(1.0, 0.957, 0.878);
  vec3 amber = vec3(0.949, 0.639, 0.227);
  vec3 alert = vec3(0.898, 0.325, 0.239);

  // Relieve sombreado con luz rasante del noroeste.
  float dx = hgt(uv + vec2(uTexel.x, 0.0)) - hgt(uv - vec2(uTexel.x, 0.0));
  float dy = hgt(uv + vec2(0.0, uTexel.y)) - hgt(uv - vec2(0.0, uTexel.y));
  vec3 n = normalize(vec3(-dx * 22.0, -dy * 22.0, 1.0));
  float light = clamp(dot(n, normalize(vec3(-0.6, -0.55, 0.55))), 0.0, 1.0);
  vec3 col = mix(night, ridge, pow(light, 1.6) * (0.55 + 0.45 * h));

  // Curvas cada 20 m y maestras cada 100 m.
  float c = e / 20.0;
  float minor = 1.0 - smoothstep(0.0, fwidth(c) * 1.1 * uDpr, abs(fract(c - 0.5) - 0.5));
  float ci = e / 100.0;
  float fi = fwidth(ci);
  float major = 1.0 - smoothstep(fi * 0.5 * uDpr, fi * 1.6 * uDpr, abs(fract(ci - 0.5) - 0.5));
  col = mix(col, paper, max(minor * 0.11, major * 0.3) * uIntro);

  // Barrido de altitud en ámbar.
  float scanE = mix(uElev.x - 40.0, uElev.y + 40.0, uScan);
  float band = exp(-pow((e - scanE) / 30.0, 2.0));
  col = mix(col, amber, max(minor, major) * band * 0.9 * uIntro);

  // Líneas de la red de transmisión.
  vec4 lines = texture(uLines, uv);
  col = mix(col, paper, lines.a * 0.55 * uIntro);

  // Movimientos en masa del inventario: puntos que laten.
  float ev = texture(uEvents, uv).a;
  float pulse = 0.65 + 0.35 * sin(uTime * 2.2 + uv.x * 40.0 + uv.y * 25.0);
  col = mix(col, alert, smoothstep(0.08, 0.6, ev) * pulse * uIntro);
  col += alert * smoothstep(0.0, 0.3, ev) * 0.18 * uIntro;

  // Lente del modelo.
  float d = length(frag - uMouse);
  float r = uRadius * uLens;
  float inside = 1.0 - smoothstep(r - 1.5 * uDpr, r + 0.5 * uDpr, d);
  vec4 idx = texture(uIndex, uv);
  vec3 lensCol = mix(col, idx.rgb * (0.55 + 0.6 * light), idx.a);
  lensCol = mix(lensCol, paper, max(minor * 0.08, major * 0.22));
  col = mix(col, lensCol, inside);
  float ring = 1.0 - smoothstep(0.8 * uDpr, 2.0 * uDpr, abs(d - r));
  col = mix(col, paper, ring * step(0.02, uLens) * 0.9);
  float tick = step(abs(frag.y - uMouse.y), 0.8 * uDpr) * step(r, d) * step(d, r + 14.0 * uDpr)
             + step(abs(frag.x - uMouse.x), 0.8 * uDpr) * step(r, d) * step(d, r + 14.0 * uDpr);
  col = mix(col, paper, clamp(tick, 0.0, 1.0) * uLens);

  color = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function makeTexture(gl, unit, upload) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  upload();
  return tex;
}

function boxBlur(source, width, height, radius) {
  const tmp = new Float32Array(source.length);
  const out = new Float32Array(source.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += source[y * width + clamp(x + k, 0, width - 1)];
      tmp[y * width + x] = sum / span;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[clamp(y + k, 0, height - 1) * width + x];
      out[y * width + x] = sum / span;
    }
  }
  return out;
}

export async function setupHero(root, { reduce, fine }) {
  const canvas = root.querySelector(".hero-canvas");
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return;
  const probe = root.querySelector("[data-probe]");
  const ladera = await loadLadera();
  const { meta, width, height, meters, side } = ladera;
  const [low, high] = meta.elevacion;
  const index = await loadImage(mediaUrl("capa_indice.webp"));

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Alturas normalizadas y suavizadas.
  const smooth = boxBlur(meters, width, height, 1);
  const normalized = new Float32Array(smooth.length);
  for (let i = 0; i < smooth.length; i++) normalized[i] = (smooth[i] - low) / (high - low);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  makeTexture(gl, 0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.FLOAT, normalized));

  // Eventos del inventario como puntos suaves de unos 100 m de radio.
  const evCanvas = document.createElement("canvas");
  evCanvas.width = evCanvas.height = 1024;
  const evCtx = evCanvas.getContext("2d");
  for (const [u, v] of meta.eventos.datos) {
    const x = u * 1024, y = v * 1024;
    const glow = evCtx.createRadialGradient(x, y, 0, x, y, 7);
    glow.addColorStop(0, "rgba(255,0,0,1)");
    glow.addColorStop(0.45, "rgba(255,0,0,.75)");
    glow.addColorStop(1, "rgba(255,0,0,0)");
    evCtx.fillStyle = glow;
    evCtx.fillRect(x - 7, y - 7, 14, 14);
  }
  makeTexture(gl, 1, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, evCanvas));

  // Líneas de la red dibujadas en un lienzo auxiliar.
  const lineCanvas = document.createElement("canvas");
  lineCanvas.width = lineCanvas.height = 1024;
  const ctx = lineCanvas.getContext("2d");
  ctx.lineCap = ctx.lineJoin = "round";
  for (const line of meta.lineas) {
    ctx.lineWidth = line.kv >= 500 ? 3.2 : 2;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    line.uv.forEach(([u, v], i) => (i ? ctx.lineTo(u * 1024, v * 1024) : ctx.moveTo(u * 1024, v * 1024)));
    ctx.stroke();
  }
  makeTexture(gl, 2, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lineCanvas));
  makeTexture(gl, 3, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, index));

  const uniform = Object.fromEntries(["uHeight", "uEvents", "uLines", "uIndex", "uRes", "uOrigin", "uScale", "uTexel", "uElev", "uMouse",
    "uTime", "uScan", "uIntro", "uLens", "uRadius", "uDpr"].map((name) => [name, gl.getUniformLocation(program, name)]));
  gl.uniform1i(uniform.uHeight, 0);
  gl.uniform1i(uniform.uEvents, 1);
  gl.uniform1i(uniform.uLines, 2);
  gl.uniform1i(uniform.uIndex, 3);
  gl.uniform2f(uniform.uTexel, 1 / width, 1 / height);
  gl.uniform2f(uniform.uElev, low, high);

  const state = { dpr: 1, w: 1, h: 1, mouse: [-999, -999], target: [-999, -999], lens: 0, lensTarget: 0, intro: reduce.matches ? 1 : 0,
    origin: [0, 0], scale: [1, 1], scroll: 0, visible: true, start: performance.now(), drift: [0, 0] };

  function resize() {
    state.dpr = Math.min(devicePixelRatio || 1, 1.5);
    state.w = canvas.clientWidth;
    state.h = canvas.clientHeight;
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function view(time) {
    // Encuadre tipo «cover» del tramo cuadrado, con deriva lenta y acercamiento al hacer scroll.
    const screen = state.w / state.h;
    const zoom = 1.08 + state.scroll * 0.3;
    let sx = 1 / zoom, sy = 1 / zoom;
    if (screen > 1) sy = (1 / screen) / zoom;
    else sx = screen / zoom;
    const t = reduce.matches ? 0 : time / 1000;
    const cx = 0.55 + Math.sin(t * 0.04) * 0.05 + state.drift[0];
    const cy = 0.42 + Math.cos(t * 0.033) * 0.05 + state.drift[1];
    state.scale = [sx, sy];
    state.origin = [clamp(cx - sx / 2, 0, 1 - sx), clamp(cy - sy / 2, 0, 1 - sy)];
  }

  function readout(x, y) {
    const u = state.origin[0] + (x / state.w) * state.scale[0];
    const v = state.origin[1] + (y / state.h) * state.scale[1];
    const elev = sampleGrid(meters, width, height, u, v);
    const clase = ladera.value("clase3", u, v);
    const idx = ladera.value("indice", u, v);
    if (probe) {
      const km = (value) => value.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      probe.querySelector("[data-x]").textContent = `${km(u * side)} km`;
      probe.querySelector("[data-y]").textContent = `${km(v * side)} km`;
      probe.querySelector("[data-elev]").textContent = `${Math.round(elev).toLocaleString("es-CO")} m`;
      const cls = probe.querySelector("[data-clase]");
      cls.textContent = clase ? `${clase.text}${idx ? ` · ${idx.text}` : ""}` : "Sin dato";
      cls.dataset.clase = clase?.text ?? "";
    }
    emitGeo({ x: u * side, y: v * side, elev, clase: clase ? `Propensión ${clase.text.toLowerCase()}` : "" });
  }

  function draw(now) {
    const time = now - state.start;
    view(time);
    state.lens += (state.lensTarget - state.lens) * 0.12;
    for (const i of [0, 1]) state.mouse[i] += (state.target[i] - state.mouse[i]) * (fine.matches ? 0.22 : 1);
    if (!reduce.matches) state.intro = Math.min(1, state.intro + 0.01);
    const scan = reduce.matches ? 0.55 : (Math.sin(time / 1000 * 0.38 - 1.4) * 0.5 + 0.5);
    gl.uniform2f(uniform.uRes, canvas.width, canvas.height);
    gl.uniform2f(uniform.uOrigin, ...state.origin);
    gl.uniform2f(uniform.uScale, ...state.scale);
    gl.uniform2f(uniform.uMouse, state.mouse[0] * state.dpr, state.mouse[1] * state.dpr);
    gl.uniform1f(uniform.uTime, reduce.matches ? 0 : time / 1000);
    gl.uniform1f(uniform.uScan, scan);
    gl.uniform1f(uniform.uIntro, state.intro);
    gl.uniform1f(uniform.uLens, state.lens);
    gl.uniform1f(uniform.uRadius, Math.min(170, state.w * 0.17) * state.dpr);
    gl.uniform1f(uniform.uDpr, state.dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let frame = 0;
  function loop(now) {
    frame = 0;
    if (!state.visible || document.hidden) return;
    draw(now);
    if (!reduce.matches || Math.abs(state.lens - state.lensTarget) > 0.01) frame = requestAnimationFrame(loop);
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };

  root.addEventListener("pointermove", (event) => {
    const box = canvas.getBoundingClientRect();
    state.target = [event.clientX - box.left, event.clientY - box.top];
    if (state.mouse[0] < -900) state.mouse = [...state.target];
    state.lensTarget = event.pointerType === "mouse" ? 1 : 0.8;
    state.drift = [(state.target[0] / state.w - 0.5) * -0.02, (state.target[1] / state.h - 0.5) * -0.02];
    readout(...state.target);
    wake();
  });
  root.addEventListener("pointerleave", () => {
    state.lensTarget = 0;
    emitGeo({});
    wake();
  });
  addEventListener("scroll", () => {
    state.scroll = clamp(scrollY / Math.max(root.offsetHeight, 1), 0, 1);
    wake();
  }, { passive: true });
  new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    wake();
  }).observe(root);
  document.addEventListener("visibilitychange", wake);
  new ResizeObserver(() => { resize(); wake(); }).observe(canvas);
  resize();
  readout(state.w * 0.66, state.h * 0.48);
  emitGeo({});
  root.classList.add("is-ready");
  wake();
}
