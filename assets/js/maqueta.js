// Maqueta 3D de un tramo de 15 × 15 km del corredor: relieve de yeso que se pinta con cualquiera
// de las diez capas (las ocho variables, el índice y la clase de nuestro modelo), las ocho
// variables separadas en láminas flotantes, los eventos del inventario, las líneas de la red con
// un pulso de energía y una sonda que lee todas las variables bajo el cursor.
// El tramo va sin coordenadas: la sonda da kilómetros desde la esquina noroeste.
import * as T from "../vendor/three-lite.js";
import { gsap } from "../vendor/motion.js";
import { clamp, emitGeo } from "./util.js";
import { loadLadera, sampleGrid, texture as mediaUrl } from "./ladera.js";

const FLOOR = -0.7; // fondo de la maqueta (unidades del mundo; 1 unidad = 1 km)
const VARIABLES = ["elevacion", "relieve_500", "precipitacion", "litogrupo", "cob_esri2025", "suelos_clases", "dist_vias", "dist_fallas"];

const terrainVertex = `
attribute float aElev;
attribute vec2 aGrad;
uniform float uExag;
uniform float uBase;
varying vec2 vUv;
varying float vElev;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec3 p = position;
  p.y = (aElev - uBase) / 1000.0 * uExag;
  float k = uExag / 1000.0;
  vNormal = normalize(vec3(-aGrad.x * k, 1.0, -aGrad.y * k));
  vUv = uv;
  vElev = aElev;
  vWorld = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const terrainFragment = `
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uHasA;
uniform float uHasB;
uniform float uMix;
uniform float uContours;
uniform float uReveal;
uniform vec3 uLight;
uniform vec3 uProbe;
uniform vec3 uFog;
uniform vec3 uAccent;
varying vec2 vUv;
varying float vElev;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vDepth;

void main() {
  vec3 n = normalize(vNormal);
  float lambert = max(dot(n, normalize(uLight)), 0.0);
  float rim = pow(1.0 - max(n.y, 0.0), 2.0);
  vec3 clay = vec3(0.86, 0.83, 0.77);
  vec4 a = texture2D(uTexA, vUv);
  vec4 b = texture2D(uTexB, vUv);
  vec3 la = mix(clay, a.rgb, a.a * uHasA);
  vec3 lb = mix(clay, b.rgb, b.a * uHasB);
  vec3 base = mix(la, lb, uMix);
  base = mix(clay, base, uReveal);
  vec3 col = base * (0.34 + 0.78 * lambert) + vec3(0.05, 0.07, 0.1) * rim;

  // Curvas de nivel cada 50 m y maestras cada 250 m.
  float c = vElev / 50.0;
  float line = 1.0 - smoothstep(0.0, fwidth(c) * 1.2, abs(fract(c - 0.5) - 0.5));
  float cm = vElev / 250.0;
  float major = 1.0 - smoothstep(0.0, fwidth(cm) * 1.6, abs(fract(cm - 0.5) - 0.5));
  col = mix(col, vec3(0.06, 0.07, 0.09), max(line * 0.32, major * 0.6) * uContours);

  // Sonda: anillo de 250 m bajo el cursor.
  float d = length(vWorld.xz - uProbe.xy);
  float ring = (1.0 - smoothstep(0.015, 0.035, abs(d - 0.25))) * uProbe.z;
  col = mix(col, uAccent, ring);
  col = mix(col, uAccent, (1.0 - smoothstep(0.025, 0.05, d)) * uProbe.z);

  col = mix(col, uFog, smoothstep(26.0, 60.0, vDepth) * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

const sideVertex = `
attribute float aElev;
attribute float aBottom;
uniform float uExag;
uniform float uBase;
varying float vElev;
varying float vShade;
void main() {
  vec3 p = position;
  p.y = aBottom > 0.5 ? ${FLOOR.toFixed(2)} : (aElev - uBase) / 1000.0 * uExag;
  vElev = aBottom > 0.5 ? uBase + ${FLOOR.toFixed(2)} * 1000.0 / uExag : aElev;
  vShade = dot(normalize(normal), normalize(vec3(-0.5, 0.4, 0.7))) * 0.5 + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const sideFragment = `
varying float vElev;
varying float vShade;
void main() {
  float band = mod(floor(vElev / 100.0), 2.0);
  vec3 col = mix(vec3(0.17, 0.19, 0.22), vec3(0.13, 0.15, 0.18), band);
  float c = vElev / 100.0;
  float line = 1.0 - smoothstep(0.0, fwidth(c) * 1.3, abs(fract(c - 0.5) - 0.5));
  col = mix(col, vec3(0.95, 0.9, 0.8), line * 0.18);
  col *= 0.7 + 0.4 * vShade;
  gl_FragColor = vec4(col, 1.0);
}`;

const sheetVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const sheetFragment = `
uniform sampler2D uTex;
uniform float uOpacity;
uniform float uHover;
uniform vec3 uAccent;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uTex, vUv);
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.006, min(e.x, e.y));
  vec3 col = mix(t.rgb, uAccent, uHover * 0.18);
  float alpha = t.a * 0.86;
  col = mix(col, mix(vec3(1.0, 0.96, 0.88), uAccent, uHover), edge);
  alpha = max(alpha, edge * 0.9);
  gl_FragColor = vec4(col, alpha * uOpacity);
}`;

const pointVertex = `
attribute float aSource;
attribute float aSeed;
uniform float uTime;
uniform float uSize;
uniform float uShow;
varying float vSource;
varying float vPulse;
void main() {
  vSource = aSource;
  vPulse = 0.6 + 0.4 * sin(uTime * 2.4 + aSeed * 6.28);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * uShow * (0.75 + 0.25 * vPulse) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const pointFragment = `
uniform vec3 uOwn;
uniform vec3 uNational;
uniform float uShow;
varying float vSource;
varying float vPulse;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = 1.0 - smoothstep(0.16, 0.24, d);
  float glow = (1.0 - smoothstep(0.0, 0.5, d)) * 0.55;
  vec3 col = vSource > 0.5 ? uOwn : uNational;
  float a = max(core, glow * vPulse) * uShow;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * (0.8 + 0.6 * core), a);
}`;

const lineVertex = `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const lineFragment = `
uniform float uTime;
uniform float uShow;
uniform vec3 uAccent;
uniform float uKv;
varying float vT;
void main() {
  float pulse = smoothstep(0.9, 1.0, fract(vT * 0.4 - uTime * 0.25));
  vec3 col = mix(vec3(1.0, 0.96, 0.88), uAccent, pulse);
  gl_FragColor = vec4(col, (0.55 + 0.45 * pulse) * uShow);
}`;

function buildSides(grid, size) {
  const { width, height, meters } = grid;
  const edges = [
    { count: width, at: (i) => [i, 0], normal: [0, 0, -1] },
    { count: height, at: (i) => [width - 1, i], normal: [1, 0, 0] },
    { count: width, at: (i) => [width - 1 - i, height - 1], normal: [0, 0, 1] },
    { count: height, at: (i) => [0, height - 1 - i], normal: [-1, 0, 0] },
  ];
  const positions = [], elevs = [], bottoms = [], normals = [], index = [];
  for (const edge of edges) {
    const start = positions.length / 3;
    for (let i = 0; i < edge.count; i++) {
      const [gx, gy] = edge.at(i);
      const x = (gx / (width - 1) - 0.5) * size;
      const z = (gy / (height - 1) - 0.5) * size;
      const elev = meters[gy * width + gx];
      positions.push(x, 0, z, x, 0, z);
      elevs.push(elev, elev);
      bottoms.push(0, 1);
      normals.push(...edge.normal, ...edge.normal);
      if (i > 0) {
        const a = start + (i - 1) * 2, b = start + i * 2;
        index.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new T.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("aElev", new T.BufferAttribute(new Float32Array(elevs), 1));
  geometry.setAttribute("aBottom", new T.BufferAttribute(new Float32Array(bottoms), 1));
  return geometry;
}

const hex = (value) => new T.Vector3(...[1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255));

export async function setupMaqueta(root, { reduce, fine }) {
  const host = root.querySelector(".t3d-canvas");
  const status = root.querySelector("[data-t3d-status]");
  const probeTip = root.querySelector(".t3d-probe");
  const labelsLayer = root.querySelector(".t3d-labels");
  const compass = root.querySelector(".compass svg");
  const card = root.querySelector("[data-layer-card]");
  const probeList = root.querySelector("[data-probe-list]");
  status.textContent = "Cargando el relieve y las capas…";

  const grid = await loadLadera();
  const { meta, width, height, meters, byId, side } = grid;
  const [low, high] = meta.elevacion;
  const size = side; // 15 unidades = 15 km
  const accent = hex(getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#f2a33a");

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = T.NoToneMapping;
  const loader = new T.TextureLoader();
  const textures = new Map();
  const loadTexture = (id) => {
    if (!textures.has(id)) {
      textures.set(id, loader.loadAsync(mediaUrl(byId[id].textura)).then((texture) => {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = T.LinearMipmapLinearFilter;
        texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
        return texture;
      }));
    }
    return textures.get(id);
  };
  const first = await loadTexture("indice");

  // Malla del relieve: misma rejilla que altura.bin, fila 0 al norte (−z).
  const geometry = new T.PlaneGeometry(size, size, width - 1, height - 1);
  geometry.rotateX(-Math.PI / 2);
  const grad = new Float32Array(width * height * 2);
  const cell = size / (width - 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const xl = meters[y * width + Math.max(x - 1, 0)], xr = meters[y * width + Math.min(x + 1, width - 1)];
      const zu = meters[Math.max(y - 1, 0) * width + x], zd = meters[Math.min(y + 1, height - 1) * width + x];
      grad[i * 2] = (xr - xl) / (cell * ((x > 0) + (x < width - 1)));
      grad[i * 2 + 1] = (zd - zu) / (cell * ((y > 0) + (y < height - 1)));
    }
  }
  geometry.setAttribute("aElev", new T.BufferAttribute(meters, 1));
  geometry.setAttribute("aGrad", new T.BufferAttribute(grad, 2));

  const base = Math.floor((low - 80) / 10) * 10;
  const exag = { value: reduce.matches ? 2 : 0.05 };
  const uniforms = {
    uTexA: { value: first }, uTexB: { value: first }, uHasA: { value: 1 }, uHasB: { value: 1 }, uMix: { value: 0 },
    uContours: { value: 0 }, uReveal: { value: reduce.matches ? 1 : 0 },
    uLight: { value: new T.Vector3(-0.55, 0.8, -0.3) }, uProbe: { value: new T.Vector3(0, 0, 0) },
    uFog: { value: new T.Vector3(0.035, 0.05, 0.065) }, uAccent: { value: accent },
    uExag: exag, uBase: { value: base },
  };
  const terrainMaterial = new T.ShaderMaterial({ uniforms, vertexShader: terrainVertex, fragmentShader: terrainFragment });
  const sideMaterial = new T.ShaderMaterial({ uniforms: { uExag: exag, uBase: uniforms.uBase }, vertexShader: sideVertex, fragmentShader: sideFragment, side: T.DoubleSide });
  const scene = new T.Scene();
  const model = new T.Group();
  for (const mesh of [new T.Mesh(geometry, terrainMaterial), new T.Mesh(buildSides(grid, size), sideMaterial)]) {
    mesh.frustumCulled = false;
    model.add(mesh);
  }
  scene.add(model);

  const yOf = (m) => (m - base) / 1000 * exag.value;
  const elevAt = (x, z) => sampleGrid(meters, width, height, x / size + 0.5, z / size + 0.5);
  const time = { value: 0 };

  // Eventos del inventario: rojo el propio, blanco cálido el nacional.
  const events = meta.eventos.datos;
  const evPositions = new Float32Array(events.length * 3);
  const evSource = new Float32Array(events.length);
  const evSeed = new Float32Array(events.length);
  const evElev = new Float32Array(events.length);
  events.forEach(([u, v, , own], i) => {
    evPositions[i * 3] = (u - 0.5) * size;
    evPositions[i * 3 + 2] = (v - 0.5) * size;
    evElev[i] = sampleGrid(meters, width, height, u, v);
    evSource[i] = own;
    evSeed[i] = Math.random();
  });
  const evGeometry = new T.BufferGeometry();
  evGeometry.setAttribute("position", new T.BufferAttribute(evPositions, 3));
  evGeometry.setAttribute("aSource", new T.BufferAttribute(evSource, 1));
  evGeometry.setAttribute("aSeed", new T.BufferAttribute(evSeed, 1));
  const pointUniforms = { uTime: time, uSize: { value: 300 * renderer.getPixelRatio() }, uShow: { value: 0 },
    uOwn: { value: hex("#e5533d") }, uNational: { value: hex("#fff4e0") } };
  const points = new T.Points(evGeometry, new T.ShaderMaterial({ uniforms: pointUniforms, vertexShader: pointVertex, fragmentShader: pointFragment,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  points.frustumCulled = false;
  model.add(points);

  // Líneas de la red a unos 45 m sobre el terreno (altura típica de un conductor).
  const lineUniforms = { uTime: time, uShow: { value: 0 }, uAccent: { value: accent } };
  const lines = meta.lineas.map((line) => {
    const pts = [];
    for (let i = 0; i < line.uv.length - 1; i++) {
      const [u0, v0] = line.uv[i], [u1, v1] = line.uv[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) * width));
      for (let s = 0; s < steps; s++) pts.push([u0 + ((u1 - u0) * s) / steps, v0 + ((v1 - v0) * s) / steps]);
    }
    pts.push(line.uv.at(-1));
    const positions = new Float32Array(pts.length * 3);
    const along = new Float32Array(pts.length);
    const elev = new Float32Array(pts.length);
    let total = 0;
    pts.forEach(([u, v], i) => {
      positions[i * 3] = (u - 0.5) * size;
      positions[i * 3 + 2] = (v - 0.5) * size;
      elev[i] = sampleGrid(meters, width, height, u, v) + 45;
      if (i) total += Math.hypot(u - pts[i - 1][0], v - pts[i - 1][1]);
      along[i] = total * side;
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    geo.setAttribute("aT", new T.BufferAttribute(along, 1));
    const mesh = new T.Line(geo, new T.ShaderMaterial({ uniforms: { ...lineUniforms, uKv: { value: line.kv } }, vertexShader: lineVertex, fragmentShader: lineFragment, transparent: true, depthWrite: false }));
    mesh.frustumCulled = false;
    model.add(mesh);
    return { mesh, positions, elev };
  });

  function placeOverlays() {
    for (let i = 0; i < events.length; i++) evPositions[i * 3 + 1] = yOf(evElev[i]) + 0.03;
    evGeometry.attributes.position.needsUpdate = true;
    for (const line of lines) {
      for (let i = 0; i < line.elev.length; i++) line.positions[i * 3 + 1] = yOf(line.elev[i]);
      line.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }
  placeOverlays();

  // Las ocho variables como láminas que se separan sobre la maqueta.
  const sheets = VARIABLES.map((id, i) => {
    const sheetUniforms = { uTex: { value: first }, uOpacity: { value: 0 }, uHover: { value: 0 }, uAccent: { value: accent } };
    const mesh = new T.Mesh(new T.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new T.ShaderMaterial({
      uniforms: sheetUniforms, vertexShader: sheetVertex, fragmentShader: sheetFragment, transparent: true, depthWrite: false, side: T.DoubleSide,
    }));
    mesh.visible = false;
    mesh.renderOrder = 2 + i;
    model.add(mesh);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "t3d-label";
    label.textContent = `${String(i + 1).padStart(2, "0")} · ${byId[id].nombre}`;
    label.style.opacity = 0;
    label.tabIndex = -1;
    labelsLayer.append(label);
    return { id, mesh, uniforms: sheetUniforms, label, lift: { value: 0 } };
  });

  const camera = new T.PerspectiveCamera(30, 1, 0.1, 200);
  const home = { position: new T.Vector3(15, 15.5, 21), target: new T.Vector3(0, 0.2, 0.6) };
  camera.position.copy(reduce.matches ? home.position : new T.Vector3(0.01, 44, 0.6));
  host.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Maqueta 3D de un tramo de 15 por 15 kilómetros del corredor, con las capas de nuestro modelo");
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.copy(home.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enableZoom = false;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 4;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.autoRotateSpeed = -0.3;
  controls.update();

  let viewW = 1, viewH = 1;
  function resize() {
    viewW = host.clientWidth;
    viewH = host.clientHeight;
    if (!viewW || !viewH) return;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.fov = viewW < 700 ? 46 : 30;
    camera.updateProjectionMatrix();
  }

  /* ---------- Capa activa y leyenda ---------- */
  const format = (n, digits = 0) => n.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  function legend(layer) {
    if (!layer) {
      return `<p class="kicker"><b>Capa</b> Yeso</p><h3>Solo el relieve</h3><p>Modelo de elevación ALOS PALSAR de 12,5 m, sin datos encima. Elige una capa para pintarlo.</p>`;
    }
    let body = "";
    if (layer.tipo === "categorica") {
      body = `<ul class="legend-classes">${layer.clases.filter((c) => c.pct >= 0.1).map((c) => `<li><i style="background:${c.color}"></i><span>${c.nombre}</span><span>${format(c.pct, 1)} %</span></li>`).join("")}</ul>`;
    } else {
      const { min, max, colores, posiciones, escala } = layer.leyenda;
      const stops = colores.map((c, i) => `${c} ${posiciones[i] * 100}%`).join(", ");
      const unit = layer.unidad ? ` ${layer.unidad}` : "";
      const digits = layer.decimales ?? 0;
      body = `<div class="legend-bar" style="background:linear-gradient(90deg, ${stops})"></div><div class="legend-scale"><span>${format(min, digits)}${unit}</span><span>${escala === "log" ? "escala logarítmica" : ""}</span><span>${format(max, digits)}${unit}</span></div>`;
    }
    const kind = layer.id === "clase3" || layer.id === "indice" ? "Resultado del modelo" : "Variable";
    return `<p class="kicker"><b>${kind}</b> ${layer.tipo === "categorica" ? "categórica" : "continua"}</p><h3>${layer.nombre}</h3><p>${layer.descripcion}</p>${body}`;
  }

  let current = "indice";
  let switching = Promise.resolve();
  function setLayer(id) {
    current = id;
    root.querySelectorAll("[data-capa]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.capa === id)));
    card.innerHTML = legend(byId[id]);
    probeList?.querySelectorAll("li").forEach((li) => li.classList.toggle("on", li.dataset.id === id));
    switching = switching.then(async () => {
      const tex = id === "yeso" ? null : await loadTexture(id);
      if (id !== current) return;
      uniforms.uTexB.value = tex ?? first;
      uniforms.uHasB.value = tex ? 1 : 0;
      await gsap.fromTo(uniforms.uMix, { value: 0 }, { value: 1, duration: reduce.matches ? 0 : 0.7, ease: "power2.inOut" });
      uniforms.uTexA.value = uniforms.uTexB.value;
      uniforms.uHasA.value = uniforms.uHasB.value;
      uniforms.uMix.value = 0;
    });
  }
  root.querySelectorAll("[data-capa]").forEach((button) => button.addEventListener("click", () => {
    if (exploded) collapse(button.dataset.capa);
    else setLayer(button.dataset.capa);
  }));

  /* ---------- Sonda ---------- */
  if (probeList) {
    probeList.innerHTML = ["clase3", "indice", ...VARIABLES].map((id) => `<li data-id="${id}"><span>${byId[id].nombre}</span><b>—</b></li>`).join("");
  }
  const raycaster = new T.Raycaster();
  const ndc = new T.Vector2();
  function pick(clientX, clientY) {
    const box = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const { origin, direction } = raycaster.ray;
    const top = yOf(high) + 0.01;
    if (direction.y >= 0 && origin.y > top) return null;
    let t = origin.y > top ? (top - origin.y) / direction.y : 0;
    const step = 0.03;
    let prev = null;
    for (let i = 0; i < 2400; i++, t += step) {
      const x = origin.x + direction.x * t, y = origin.y + direction.y * t, z = origin.z + direction.z * t;
      if (y < FLOOR) return null;
      if (Math.abs(x) <= size / 2 && Math.abs(z) <= size / 2) {
        if (y <= yOf(elevAt(x, z))) {
          let a = prev ?? t - step, b = t;
          for (let k = 0; k < 8; k++) {
            const m = (a + b) / 2;
            if (origin.y + direction.y * m <= yOf(elevAt(origin.x + direction.x * m, origin.z + direction.z * m))) b = m; else a = m;
          }
          return { x: origin.x + direction.x * b, z: origin.z + direction.z * b };
        }
        prev = t;
      }
    }
    return null;
  }
  let probeTarget = 0;
  renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.buttons || exploded) return;
    const hit = pick(event.clientX, event.clientY);
    probeTarget = hit ? 1 : 0;
    probeTip.classList.toggle("on", Boolean(hit));
    if (!hit) return;
    const u = hit.x / size + 0.5, v = hit.z / size + 0.5;
    const elev = elevAt(hit.x, hit.z);
    uniforms.uProbe.value.set(hit.x, hit.z, uniforms.uProbe.value.z);
    const values = Object.fromEntries(["clase3", "indice", ...VARIABLES].map((id) => [id, grid.value(id, u, v)]));
    probeList?.querySelectorAll("li").forEach((li) => { li.querySelector("b").textContent = values[li.dataset.id]?.text ?? "Sin dato"; });
    const here = current === "yeso" ? null : values[current];
    const km = (n) => format(n, 1);
    probeTip.innerHTML = `E ${km(u * side)} km · S ${km(v * side)} km · ${format(Math.round(elev))} m${here ? `<br><b>${byId[current].nombre}:</b> ${here.text}` : ""}`;
    const box = root.getBoundingClientRect();
    const flip = event.clientX - box.left > box.width - 260;
    probeTip.style.transform = `translate(${event.clientX - box.left + (flip ? -16 : 16)}px, ${event.clientY - box.top + 16}px)${flip ? " translateX(-100%)" : ""}`;
    emitGeo({ x: u * side, y: v * side, elev, clase: values.clase3 ? `Propensión ${values.clase3.text.toLowerCase()}` : "" });
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    probeTarget = 0;
    probeTip.classList.remove("on");
    emitGeo({});
  });

  /* ---------- Capas separadas ---------- */
  let exploded = false;
  const gap = () => 0.95 + exag.value * 0.08;
  const sheetTop = () => yOf(high) + 0.5;
  async function explode() {
    exploded = true;
    stopTour();
    root.classList.add("is-exploded");
    root.querySelector('[data-t3d-toggle="capas"]').setAttribute("aria-pressed", "true");
    probeTarget = 0;
    probeTip.classList.remove("on");
    const texs = await Promise.all(VARIABLES.map(loadTexture));
    if (!exploded) return;
    sheets.forEach((sheet, i) => {
      sheet.uniforms.uTex.value = texs[i];
      sheet.mesh.visible = true;
      sheet.label.tabIndex = 0;
      gsap.to(sheet.lift, { value: 1, duration: reduce.matches ? 0 : 1.4, ease: "expo.out", delay: reduce.matches ? 0 : i * 0.07 });
      gsap.to(sheet.uniforms.uOpacity, { value: 1, duration: reduce.matches ? 0 : 0.8, delay: reduce.matches ? 0 : i * 0.07 });
    });
    setLayer("indice");
    const wide = viewW > 900;
    fly({ x: wide ? 29 : 31, y: 12 + gap() * 4.4, z: wide ? 37 : 40 }, { x: 0, y: sheetTop() + gap() * 2.9, z: 0 }, 2);
  }
  function collapse(nextLayer) {
    exploded = false;
    root.classList.remove("is-exploded");
    root.querySelector('[data-t3d-toggle="capas"]').setAttribute("aria-pressed", "false");
    sheets.forEach((sheet, i) => {
      sheet.label.tabIndex = -1;
      gsap.to(sheet.lift, { value: 0, duration: reduce.matches ? 0 : 0.9, ease: "power3.in", delay: reduce.matches ? 0 : (sheets.length - i) * 0.04 });
      gsap.to(sheet.uniforms.uOpacity, { value: 0, duration: reduce.matches ? 0 : 0.5, delay: reduce.matches ? 0 : 0.5 + (sheets.length - i) * 0.04,
        onComplete: () => { if (!exploded) sheet.mesh.visible = false; } });
    });
    if (nextLayer) setLayer(nextLayer);
    fly(home.position, home.target, 1.8);
  }
  sheets.forEach((sheet) => {
    sheet.label.addEventListener("click", () => collapse(sheet.id));
    sheet.label.addEventListener("pointerenter", () => gsap.to(sheet.uniforms.uHover, { value: 1, duration: 0.3 }));
    sheet.label.addEventListener("pointerleave", () => gsap.to(sheet.uniforms.uHover, { value: 0, duration: 0.3 }));
  });
  const projected = new T.Vector3();
  function placeSheets() {
    const top = sheetTop();
    sheets.forEach((sheet, i) => {
      const y = yOf(low) + (top + gap() * i - yOf(low)) * sheet.lift.value;
      sheet.mesh.position.y = y;
      if (!sheet.mesh.visible) { sheet.label.style.opacity = 0; return; }
      projected.set(-size / 2, y, size / 2).project(camera);
      sheet.label.style.opacity = Math.min(sheet.lift.value * 1.4, 1);
      sheet.label.style.pointerEvents = sheet.lift.value > 0.6 ? "auto" : "none";
      const px = (projected.x * 0.5 + 0.5) * viewW;
      const room = px > 230;
      sheet.label.style.transform = `translate(${px}px, ${(-projected.y * 0.5 + 0.5) * viewH}px) translate(${room ? "calc(-100% - 10px)" : "10px"}, -50%)`;
    });
  }

  /* ---------- Controles ---------- */
  const overlays = { eventos: pointUniforms.uShow, lineas: lineUniforms.uShow, curvas: uniforms.uContours };
  root.querySelectorAll("[data-t3d-toggle]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.t3dToggle;
    if (key === "capas") { exploded ? collapse() : explode(); return; }
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    gsap.to(overlays[key], { value: on ? 1 : 0, duration: 0.6 });
  }));
  const exagInput = root.querySelector("[data-t3d-exag]");
  const exagLabel = root.querySelector("[data-t3d-exag-label]");
  exagInput.addEventListener("input", () => {
    gsap.to(exag, { value: Number(exagInput.value), duration: 0.5, ease: "power2.out", onUpdate: placeOverlays });
    exagLabel.textContent = `×${format(Number(exagInput.value), 1)}`;
  });

  let tour = null;
  function stopTour() {
    tour?.kill();
    tour = null;
    controls.enabled = !root.classList.contains("is-touch") || root.classList.contains("is-active");
    root.querySelector('[data-t3d-act="tour"]')?.setAttribute("aria-pressed", "false");
  }
  function fly(position, target, duration = 2.2) {
    return gsap.timeline()
      .to(camera.position, { ...position, duration, ease: "power2.inOut" }, 0)
      .to(controls.target, { ...target, duration, ease: "power2.inOut" }, 0);
  }
  function dolly(factor) {
    stopTour();
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
    offset.setLength(clamp(offset.length(), controls.minDistance, controls.maxDistance));
    gsap.to(camera.position, { x: controls.target.x + offset.x, y: controls.target.y + offset.y, z: controls.target.z + offset.z, duration: 0.6, ease: "power2.out" });
  }
  // Zona más propensa del tramo: centro de las celdas con el índice más alto.
  const hot = (() => {
    let sx = 0, sz = 0, n = 0;
    for (let j = 0; j < 150; j++) {
      for (let i = 0; i < 150; i++) {
        const value = grid.value("indice", (i + 0.5) / 150, (j + 0.5) / 150);
        if (value && value.value > 0.9) { sx += (i + 0.5) / 150; sz += (j + 0.5) / 150; n++; }
      }
    }
    return n ? { x: (sx / n - 0.5) * size, z: (sz / n - 0.5) * size } : { x: 0, z: 0 };
  })();
  const actions = {
    tour() {
      if (tour) { stopTour(); return; }
      if (exploded) collapse();
      controls.enabled = false;
      controls.autoRotate = false;
      root.querySelector('[data-t3d-act="tour"]').setAttribute("aria-pressed", "true");
      const y = yOf(elevAt(hot.x, hot.z));
      tour = gsap.timeline({ onComplete: stopTour })
        .add(fly({ x: 0.01, y: 30, z: 0.5 }, { x: 0, y: 0, z: 0 }, 2.2))
        .add(() => setLayer("clase3"), "-=0.6")
        .add(fly({ x: hot.x + 3.2, y: y + 2.4, z: hot.z + 4.2 }, { x: hot.x, y, z: hot.z }, 2.8), "+=0.8")
        .add(() => { if (pointUniforms.uShow.value < 0.5) root.querySelector('[data-t3d-toggle="eventos"]').click(); }, "+=0.4")
        .add(fly({ x: hot.x - 4, y: y + 2.8, z: hot.z + 2.5 }, { x: hot.x, y, z: hot.z }, 3.2), "+=1")
        .add(fly(home.position, home.target, 2.6), "+=1");
    },
    in: () => dolly(0.75),
    out: () => dolly(1.3),
    reset() { stopTour(); if (exploded) collapse(); else fly(home.position, home.target, 1.6); },
  };
  root.querySelectorAll("[data-t3d-act]").forEach((button) => button.addEventListener("click", () => actions[button.dataset.t3dAct]()));
  renderer.domElement.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    dolly(event.deltaY > 0 ? 1.12 : 0.89);
  }, { passive: false });

  // Táctil: el modelo no captura el dedo hasta que la persona lo activa.
  const touch = !fine.matches;
  const activate = root.querySelector("[data-t3d-activate]");
  root.classList.toggle("is-touch", touch);
  controls.enabled = !touch;
  activate.addEventListener("click", () => {
    const on = !root.classList.contains("is-active");
    root.classList.toggle("is-active", on);
    controls.enabled = on;
    activate.textContent = on ? "Listo, volver al scroll" : "Tocar para explorar en 3D";
  });

  let idle = 0;
  controls.addEventListener("start", () => { controls.autoRotate = false; idle = 0; stopTour(); });
  controls.addEventListener("end", () => { idle = performance.now(); });

  /* ---------- Render solo cuando la escena está en pantalla ---------- */
  let visible = false;
  let running = false;
  const startTime = performance.now();
  function frame() {
    if (!visible) { running = false; return; }
    requestAnimationFrame(frame);
    time.value = reduce.matches ? 0 : (performance.now() - startTime) / 1000;
    uniforms.uProbe.value.z += (probeTarget - uniforms.uProbe.value.z) * 0.2;
    if (!tour && !exploded && !reduce.matches && idle && performance.now() - idle > 6000) controls.autoRotate = true;
    controls.update();
    compass.style.transform = `rotate(${(controls.getAzimuthalAngle() * 180) / Math.PI}deg)`;
    placeSheets();
    renderer.render(scene, camera);
  }
  function start() {
    if (running || !visible) return;
    running = true;
    requestAnimationFrame(frame);
  }
  let introPlayed = reduce.matches;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
    if (visible && !introPlayed && entry.intersectionRatio > 0.35) {
      introPlayed = true;
      gsap.timeline({ onComplete: () => { idle = performance.now(); } })
        .to(exag, { value: 2, duration: 2.4, ease: "expo.out", onUpdate: placeOverlays }, 0.1)
        .to(camera.position, { ...home.position, duration: 3.2, ease: "power3.inOut" }, 0)
        .to(uniforms.uReveal, { value: 1, duration: 1.8, ease: "power2.inOut" }, 1.4)
        .to(lineUniforms.uShow, { value: 1, duration: 1 }, 2.2);
    }
  }, { threshold: [0, 0.35] }).observe(root);
  new ResizeObserver(resize).observe(host);
  resize();
  if (reduce.matches) {
    exag.value = 2;
    lineUniforms.uShow.value = 1;
    placeOverlays();
  }
  setLayer("indice");
  root.classList.add("is-ready");
  status.textContent = "";
  start();
}
