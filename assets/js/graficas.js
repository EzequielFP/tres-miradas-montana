// Gráficas SVG del Grupo 2. Cada <div class="chart" data-chart="tipo"> se dibuja con los JSON de
// assets/data y se anima al entrar en pantalla. Pasa el cursor sobre una marca para leer su valor.
import { clamp, fetchJson } from "./util.js";

export const NAMES = {
  relieve_500: "Relieve local", precipitacion: "Lluvia media anual", elevacion: "Elevación", litogrupo: "Geología",
  cob_esri2025: "Cobertura del suelo", dist_vias: "Distancia a vías", suelos_clases: "Suelos", dist_fallas: "Distancia a fallas",
  lineamientos: "Lineamientos", tri: "Rugosidad", northness: "Orientación norte", eastness: "Orientación este", pendiente: "Pendiente",
  curv_perfil: "Curvatura de perfil", curv_plan: "Curvatura en planta", tpi_100: "Posición topográfica 100 m", tpi_500: "Posición topográfica 500 m",
  dist_drenaje: "Distancia a drenajes", flowacc: "Acumulación de flujo", twi: "Índice de humedad",
};
const MODELS = { LGBM: "LightGBM", RF: "Bosque aleatorio", XGB: "XGBoost", GAM: "GAM", LR: "Regresión logística", WOE: "Pesos de evidencia" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const data = {};
const load = (name) => (data[name] ??= fetchJson(new URL(`../data/${name}.json`, import.meta.url)));
const fmt = (n, d = 0) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

const STYLE = `
.chart .grow { transform-box: fill-box; transform-origin: 0 50%; transform: scaleX(0); transition: transform 1.1s cubic-bezier(.2,.7,.1,1) var(--d, 0s); }
.chart .rise { transform-box: fill-box; transform-origin: 50% 100%; transform: scaleY(0); transition: transform .9s cubic-bezier(.2,.7,.1,1) var(--d, 0s); }
.chart .draw { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1.8s cubic-bezier(.4,.1,.2,1) var(--d, 0s); }
.chart .fade { opacity: 0; transition: opacity .8s var(--d, 0s); }
.chart.in .grow, .chart.in .rise { transform: none; }
.chart.in .draw { stroke-dashoffset: 0; }
.chart.in .fade { opacity: 1; }
.chart [data-tip] { cursor: crosshair; }
.chart [data-tip]:hover { filter: brightness(1.25); }
.no-motion .chart .grow, .no-motion .chart .rise { transform: none; }
.no-motion .chart .draw { stroke-dashoffset: 0; }
.no-motion .chart .fade { opacity: 1; }`;
if (!document.getElementById("chart-style")) {
  const style = document.createElement("style");
  style.id = "chart-style";
  style.textContent = STYLE;
  document.head.append(style);
}

/* ---------- Dibujantes: cada uno recibe el ancho y devuelve el SVG ---------- */
const charts = {
  // Importancia por permutación con su intervalo P5–P95 entre iteraciones.
  async importancia(w) {
    const d = await load("importancia_variables");
    const rows = [...d.variables].sort((a, b) => b.mediana_pct - a.mediana_pct);
    const left = w < 520 ? 118 : 160, right = 54, row = 38, top = 8;
    const h = top + rows.length * row + 30;
    const max = 40;
    const x = (v) => left + (v / max) * (w - left - right);
    let s = "";
    for (let t = 0; t <= max; t += 10) s += `<g class="grid"><line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${h - 24}" class="${t ? "" : "zero"}"/></g><text x="${x(t)}" y="${h - 6}" text-anchor="middle">${t} %</text>`;
    rows.forEach((v, i) => {
      const y = top + i * row + row / 2;
      const color = i === 0 ? css("--accent") : "rgba(255,244,224,.62)";
      const tip = `<b>${esc(NAMES[v.id] ?? v.nombre)}</b><br>Mediana ${fmt(v.mediana_pct, 1)} %<br>P5–P95: ${fmt(v.p5_pct, 1)}–${fmt(v.p95_pct, 1)} %`;
      s += `<text class="lbl" x="${left - 12}" y="${y + 4}" text-anchor="end">${esc(NAMES[v.id] ?? v.nombre)}</text>`;
      s += `<rect class="grow" style="--d:${i * 0.07}s" x="${x(0)}" y="${y - 9}" width="${x(v.mediana_pct) - x(0)}" height="18" rx="4" fill="${color}" data-tip="${esc(tip)}"/>`;
      const whisker = `M${x(v.p5_pct)},${y}H${x(v.p95_pct)}M${x(v.p5_pct)},${y - 5}V${y + 5}M${x(v.p95_pct)},${y - 5}V${y + 5}`;
      s += `<path class="fade" style="--d:${0.6 + i * 0.07}s" d="${whisker}" stroke="#080b0f" stroke-width="4" fill="none"/><path class="fade" style="--d:${0.6 + i * 0.07}s" d="${whisker}" stroke="#fff4e0" stroke-width="1.5" fill="none"/>`;
      s += `<text class="val fade" style="--d:${0.5 + i * 0.07}s" x="${x(Math.max(v.mediana_pct, v.p95_pct)) + 10}" y="${y + 4}">${fmt(v.mediana_pct, 1)}</text>`;
    });
    return { h, s, label: "Importancia de las ocho variables del modelo, en porcentaje" };
  },

  // Curva de éxito: área ordenada de más a menos propensa contra eventos acumulados.
  async curva(w) {
    const d = await load("curva_exito");
    const z = await load("auc_por_zona");
    const expert = z.zonas[0].eventos_top20_ahp_pct;
    const h = Math.round(clamp(w * 0.7, 280, 460));
    const l = 46, r = 16, t = 14, b = 40;
    const x = (v) => l + (v / 100) * (w - l - r);
    const y = (v) => t + (1 - v / 100) * (h - t - b);
    let s = "";
    for (let v = 0; v <= 100; v += 20) {
      s += `<g class="grid"><line x1="${x(0)}" x2="${x(100)}" y1="${y(v)}" y2="${y(v)}" class="${v ? "" : "zero"}"/><line x1="${x(v)}" x2="${x(v)}" y1="${y(0)}" y2="${y(100)}"/></g>`;
      s += `<text x="${l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text><text x="${x(v)}" y="${h - 22}" text-anchor="middle">${v}</text>`;
    }
    s += `<text x="${x(50)}" y="${h - 4}" text-anchor="middle">% del corredor, del más al menos propenso</text>`;
    s += `<text x="${l - 34}" y="${y(50)}" text-anchor="middle" transform="rotate(-90 ${l - 34} ${y(50)})">% de los eventos</text>`;
    s += `<line class="fade" x1="${x(0)}" y1="${y(0)}" x2="${x(100)}" y2="${y(100)}" stroke="rgba(255,244,224,.35)" stroke-dasharray="4 5"/><text class="fade" x="${x(62)}" y="${y(55)}" transform="rotate(${-Math.atan2(y(0) - y(100), x(100) - x(0)) * 180 / Math.PI} ${x(62)} ${y(55)})">al azar</text>`;
    const pts = d.puntos.map((p) => [x(p.area_pct), y(p.eventos_pct)]);
    const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    s += `<path d="${path}L${x(100)},${y(0)}L${x(0)},${y(0)}Z" fill="${css("--accent")}" fill-opacity=".12" class="fade"/>`;
    s += `<path class="draw" pathLength="1" d="${path}" fill="none" stroke="${css("--accent")}" stroke-width="3" stroke-linejoin="round"/>`;
    const hx = x(20), hy = y(d.destacado.eventos_pct);
    s += `<line class="fade" style="--d:1.2s" x1="${hx}" x2="${hx}" y1="${y(0)}" y2="${hy}" stroke="${css("--accent")}" stroke-dasharray="3 4"/><line class="fade" style="--d:1.2s" x1="${x(0)}" x2="${hx}" y1="${hy}" y2="${hy}" stroke="${css("--accent")}" stroke-dasharray="3 4"/>`;
    s += `<circle class="fade" style="--d:1.4s" cx="${x(20)}" cy="${y(expert)}" r="6" fill="#080b0f" stroke="rgba(255,244,224,.8)" stroke-width="2" data-tip="<b>Mapa de un experto (AHP)</b><br>20 % del área → ${fmt(expert, 0)} % de los eventos"/>`;
    s += `<text class="fade" style="--d:1.4s" x="${x(20) + 12}" y="${y(expert) + 4}">experto ${fmt(expert, 0)} %</text>`;
    pts.slice(1, -1).forEach(([px, py], i) => {
      const p = d.puntos[i + 1];
      s += `<circle class="fade" style="--d:${1 + i * 0.15}s" cx="${px}" cy="${py}" r="${p.area_pct === 20 ? 8 : 5}" fill="${css("--accent")}" stroke="#080b0f" stroke-width="2" data-tip="<b>${p.area_pct} % del corredor</b><br>${fmt(p.eventos_pct, 1)} % de los eventos"/>`;
    });
    s += `<text class="val hi fade" style="--d:1.5s" x="${hx + 14}" y="${hy - 12}" font-size="15">20 % → ${fmt(d.destacado.eventos_pct, 0)} %</text>`;
    return { h, s, label: `Curva de éxito: el 20 % del corredor más propenso concentra el ${fmt(d.destacado.eventos_pct, 0)} % de los eventos` };
  },

  // Nota con lo que ya conocía contra nota en zonas nunca vistas (15 particiones).
  async modelos(w) {
    const d = await load("modelos");
    const rows = d.modelos.filter((m) => m.variables === "con_suelos").sort((a, b) => b.auc_prueba - a.auc_prueba);
    const left = w < 520 ? 130 : 170, right = 20, row = 40, top = 26;
    const h = top + rows.length * row + 30;
    const lo = 0.75, hi = 0.97;
    const x = (v) => left + ((v - lo) / (hi - lo)) * (w - left - right);
    let s = `<text x="${left}" y="12" fill="rgba(255,244,224,.6)">○ entrenamiento</text><text x="${left + 130}" y="12" class="hi">● zonas nunca vistas</text>`;
    for (let v = 0.75; v <= 0.951; v += 0.05) s += `<g class="grid"><line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${h - 24}"/></g><text x="${x(v)}" y="${h - 6}" text-anchor="middle">${fmt(v, 2)}</text>`;
    rows.forEach((m, i) => {
      const y = top + i * row + row / 2;
      const best = m.modelo === "LGBM";
      s += `<text class="lbl" x="${left - 12}" y="${y + 4}" text-anchor="end" ${best ? `fill="${css("--accent")}"` : ""}>${MODELS[m.modelo]}</text>`;
      s += `<line class="grow" style="--d:${i * 0.08}s; transform-origin: 100% 50%" x1="${x(m.auc_prueba)}" x2="${x(m.auc_entrenamiento)}" y1="${y}" y2="${y}" stroke="rgba(255,244,224,.35)" stroke-width="2"/>`;
      s += `<circle class="fade" style="--d:${0.3 + i * 0.08}s" cx="${x(m.auc_entrenamiento)}" cy="${y}" r="6" fill="#080b0f" stroke="rgba(255,244,224,.7)" stroke-width="2" data-tip="<b>${MODELS[m.modelo]}</b><br>Entrenamiento ${fmt(m.auc_entrenamiento, 3)}"/>`;
      s += `<circle class="fade" style="--d:${0.3 + i * 0.08}s" cx="${x(m.auc_prueba)}" cy="${y}" r="7" fill="${best ? css("--accent") : "rgba(255,244,224,.85)"}" data-tip="<b>${MODELS[m.modelo]}</b><br>Zonas nunca vistas ${fmt(m.auc_prueba, 3)}<br>Pérdida ${fmt(m.auc_entrenamiento - m.auc_prueba, 3)}"/>`;
    });
    return { h, s, label: "AUC de seis modelos en entrenamiento y en zonas nunca vistas" };
  },

  // La máquina contra el experto: eventos en el 20 % más propenso, por zona.
  async experto(w) {
    const d = await load("auc_por_zona");
    const rows = d.zonas;
    const left = w < 520 ? 116 : 150, right = 46, row = 46, top = 26;
    const h = top + rows.length * row + 26;
    const x = (v) => left + (v / 100) * (w - left - right);
    let s = `<text x="${left}" y="12" class="hi">■ nuestro modelo</text><text x="${left + 140}" y="12" fill="rgba(255,244,224,.6)">■ experto (AHP)</text>`;
    for (let v = 0; v <= 100; v += 25) s += `<g class="grid"><line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${h - 22}" class="${v ? "" : "zero"}"/></g><text x="${x(v)}" y="${h - 4}" text-anchor="middle">${v} %</text>`;
    rows.forEach((z, i) => {
      const y = top + i * row + 8;
      s += `<text class="lbl" x="${left - 12}" y="${y + 13}" text-anchor="end">${esc(z.nombre === "Frío" ? "Frío y páramo" : z.nombre)}</text>`;
      s += `<rect class="grow" style="--d:${i * 0.08}s" x="${x(0)}" y="${y}" width="${x(z.eventos_top20_lightgbm_pct) - x(0)}" height="14" rx="3" fill="${css("--accent")}" data-tip="<b>${esc(z.nombre)}</b><br>Nuestro modelo: ${fmt(z.eventos_top20_lightgbm_pct, 0)} % · AUC ${fmt(z.auc_lightgbm, 3)}"/>`;
      s += `<rect class="grow" style="--d:${0.1 + i * 0.08}s" x="${x(0)}" y="${y + 17}" width="${x(z.eventos_top20_ahp_pct) - x(0)}" height="10" rx="3" fill="rgba(255,244,224,.45)" data-tip="<b>${esc(z.nombre)}</b><br>Experto: ${fmt(z.eventos_top20_ahp_pct, 0)} % · AUC ${fmt(z.auc_ahp, 3)}"/>`;
      s += `<text class="val fade" style="--d:.8s" x="${x(z.eventos_top20_lightgbm_pct) + 6}" y="${y + 12}">${fmt(z.eventos_top20_lightgbm_pct, 0)}</text>`;
    });
    return { h, s, label: "Eventos que caen en el 20 % más propenso según nuestro modelo y según un experto, por zona" };
  },

  // Torres de la red en las tres clases que usamos para comunicar (baja = 70 % del corredor con
  // menor índice, media = 15 % siguiente, alta = 15 % más propenso). Se suman las cinco clases del modelo.
  async torres(w) {
    const d = await load("torres_por_clase");
    const by = Object.fromEntries(d.clases.map((c) => [c.codigo, c.torres]));
    const total = d.con_dato;
    const rows = [
      ["Baja", "70 % del corredor con menor índice", by[1] + by[2], "#4e8a38"],
      ["Media", "15 % siguiente", by[3], "#c99a3b"],
      ["Alta", "15 % más propenso", by[4] + by[5], "#c8412b"],
    ];
    const h = w < 520 ? 140 : 120;
    let s = "", acc = 0;
    rows.forEach(([name, note, n, color], i) => {
      const x0 = (acc / total) * w, cw = (n / total) * w;
      acc += n;
      const pct = (n / total) * 100;
      s += `<rect class="grow" style="--d:${i * 0.15}s" x="${x0}" y="10" width="${Math.max(cw - 3, 1)}" height="54" rx="6" fill="${color}" data-tip="<b>${name}</b> · ${note}<br>${fmt(n)} torres · ${fmt(pct, 1)} %"/>`;
      s += `<text class="fade" style="--d:${0.6 + i * 0.1}s" x="${x0 + 10}" y="43" fill="#fff4e0" font-weight="700" font-size="14">${fmt(pct, 1)} %</text>`;
      s += `<text class="fade lbl" style="--d:${0.6 + i * 0.1}s" x="${i === 2 ? w : x0 + 2}" y="86" ${i === 2 ? `text-anchor="end"` : ""}>${name} · ${fmt(n)}</text>`;
    });
    s += `<text x="0" y="${h - 6}">${fmt(total)} torres con dato · cada una en la celda de 12,5 m que la contiene</text>`;
    return { h, s, label: "Torres de la red por clase de propensión: baja, media y alta" };
  },

  // Torres con al menos un evento del inventario cerca.
  async distancia(w) {
    const d = await load("torres_eventos");
    const rows = [["100 m", d.torres_con_evento_a_100m], ["250 m", d.torres_con_evento_a_250m], ["500 m", d.torres_con_evento_a_500m], ["1 km", d.torres_con_evento_a_1000m]];
    const left = 62, right = 120, row = 44, top = 6;
    const h = top + rows.length * row + 6;
    const x = (v) => left + (v / 30) * (w - left - right);
    let s = "";
    rows.forEach(([label, r], i) => {
      const y = top + i * row + 10;
      s += `<text class="lbl" x="${left - 12}" y="${y + 15}" text-anchor="end">${label}</text>`;
      s += `<rect x="${x(0)}" y="${y}" width="${x(30) - x(0)}" height="22" rx="4" fill="rgba(255,244,224,.05)"/>`;
      s += `<rect class="grow" style="--d:${i * 0.12}s" x="${x(0)}" y="${y}" width="${x(r.pct) - x(0)}" height="22" rx="4" fill="${i === 2 ? css("--accent") : "rgba(255,244,224,.55)"}" data-tip="<b>A menos de ${label}</b><br>${fmt(r.n)} torres · ${fmt(r.pct, 1)} %"/>`;
      s += `<text class="val fade" style="--d:${0.6 + i * 0.1}s" x="${x(r.pct) + 8}" y="${y + 15}">${fmt(r.pct, 1)} % <tspan fill="rgba(255,244,224,.55)" font-weight="400">· ${fmt(r.n)}</tspan></text>`;
    });
    return { h, s, label: "Porcentaje de torres con un evento del inventario a menos de 100 m, 250 m, 500 m y 1 km" };
  },

  // Lluvia acumulada sobre los Andes del corredor (CHIRPS), mes a mes.
  async lluvia(w, el) {
    const d = await load("lluvia_andina");
    const key = el.dataset.serie === "90" ? "andino_90d_sobre_600_pct" : "andino_30d_sobre_200_pct";
    const series = Object.entries(d[key]);
    const h = Math.round(clamp(w * 0.46, 240, 340));
    const l = 40, r = 8, t = 18, b = 44;
    const bw = (w - l - r) / series.length;
    const y = (v) => t + (1 - v / 70) * (h - t - b);
    let s = "";
    for (let v = 0; v <= 60; v += 20) s += `<g class="grid"><line x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}" class="${v ? "" : "zero"}"/></g><text x="${l - 8}" y="${y(v) + 4}" text-anchor="end">${v} %</text>`;
    const peak = Math.max(...series.map(([, v]) => v));
    series.forEach(([month, v], i) => {
      const [yy, mm] = month.split("-").map(Number);
      const x0 = l + i * bw;
      const wet = v >= 40;
      s += `<rect class="rise" style="--d:${i * 0.025}s" x="${x0 + bw * 0.14}" y="${y(v)}" width="${bw * 0.72}" height="${Math.max(y(0) - y(v), 0.5)}" rx="2" fill="${wet ? css("--cyan") : "rgba(143,211,232,.4)"}" data-tip="<b>${MONTHS[mm - 1]} ${yy}</b><br>${fmt(v, 1)} % de los píxeles andinos"/>`;
      if (mm === 1) s += `<line x1="${x0}" x2="${x0}" y1="${t}" y2="${h - b + 22}" stroke="rgba(255,244,224,.2)"/><text x="${x0 + 4}" y="${h - 8}" fill="var(--paper)" font-weight="700">${yy}</text>`;
      if (mm % 3 === 1) s += `<text x="${x0 + bw / 2}" y="${h - b + 16}" text-anchor="middle" font-size="10">${MONTHS[mm - 1]}</text>`;
      if (v === peak || (yy === 2024 && mm === 1) || (yy === 2024 && mm === 11 && key.includes("30"))) {
        s += `<text class="val fade" style="--d:1.3s" x="${x0 + bw / 2}" y="${y(v) - 6}" text-anchor="middle">${fmt(v, 0)} %</text>`;
      }
    });
    return { h, s, label: "Porcentaje de píxeles andinos del corredor por encima del valor de referencia de lluvia acumulada, por mes" };
  },

  // Inventario: lo propio y lo nacional, por tipo de movimiento.
  async inventario(w) {
    const d = await load("inventario");
    const own = d.filas.find((f) => f.inventario === "propio" && f.area === "AI_10km");
    const nat = d.filas.find((f) => f.inventario === "nacional" && f.area === "AI_10km");
    const types = [["deslizamiento", "Deslizamiento"], ["flujo", "Flujo"], ["caida", "Caída"], ["otros", "Sin tipo u otro"]];
    const value = (row, k) => (k === "otros" ? Number(row.sin_tipo) + Number(row.reptacion) + Number(row.otro) : Number(row[k]));
    const left = w < 520 ? 112 : 140, right = 70, row = 50, top = 26;
    const h = top + types.length * row + 4;
    const max = 10000;
    const x = (v) => left + (v / max) * (w - left - right);
    let s = `<text x="${left}" y="12" class="hi">■ inventario propio</text><text x="${left + 150}" y="12" fill="rgba(255,244,224,.6)">■ inventario nacional</text>`;
    types.forEach(([k, label], i) => {
      const y = top + i * row + 6;
      const a = value(own, k), b = value(nat, k);
      s += `<text class="lbl" x="${left - 12}" y="${y + 16}" text-anchor="end">${label}</text>`;
      s += `<rect class="grow" style="--d:${i * 0.1}s" x="${x(0)}" y="${y}" width="${Math.max(x(a) - x(0), 1)}" height="14" rx="3" fill="${css("--accent")}" data-tip="<b>${label}</b><br>Propio: ${fmt(a)}"/>`;
      s += `<rect class="grow" style="--d:${0.1 + i * 0.1}s" x="${x(0)}" y="${y + 18}" width="${Math.max(x(b) - x(0), 1)}" height="14" rx="3" fill="rgba(255,244,224,.45)" data-tip="<b>${label}</b><br>Nacional: ${fmt(b)}"/>`;
      s += `<text class="val fade" style="--d:.8s" x="${x(a) + 6}" y="${y + 11}">${fmt(a)}</text><text class="fade" style="--d:.8s" x="${x(b) + 6}" y="${y + 29}">${fmt(b)}</text>`;
    });
    return { h, s, label: "Eventos por tipo en el inventario propio y en el inventario nacional dentro del corredor" };
  },

  // Un solo modelo para todo el país frente a cinco modelos especializados (AUC por piso).
  async unico(w) {
    const d = await load("zonas");
    const left = w < 520 ? 116 : 150, right = 64, row = 44, top = 26;
    const h = top + d.zonas.length * row + 26;
    const lo = 0.65, hi = 0.9;
    const x = (v) => left + ((v - lo) / (hi - lo)) * (w - left - right);
    let s = `<text x="${left}" y="12" fill="rgba(255,244,224,.6)">○ modelo de un solo piso</text><text x="${left + 190}" y="12" class="hi">● modelo único</text>`;
    for (let v = 0.65; v <= 0.901; v += 0.05) s += `<g class="grid"><line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${h - 22}"/></g><text x="${x(v)}" y="${h - 4}" text-anchor="middle">${fmt(v, 2)}</text>`;
    d.zonas.forEach((z, i) => {
      const y = top + i * row + row / 2;
      s += `<text class="lbl" x="${left - 12}" y="${y + 4}" text-anchor="end">${esc(z.nombre)}</text>`;
      s += `<line class="grow" style="--d:${i * 0.08}s" x1="${x(z.auc_local)}" x2="${x(z.auc_unico)}" y1="${y}" y2="${y}" stroke="${z.color}" stroke-width="3"/>`;
      s += `<circle class="fade" style="--d:${0.3 + i * 0.08}s" cx="${x(z.auc_local)}" cy="${y}" r="6" fill="#080b0f" stroke="rgba(255,244,224,.7)" stroke-width="2" data-tip="<b>${esc(z.nombre)}</b><br>Modelo entrenado solo aquí: ${fmt(z.auc_local, 3)}"/>`;
      s += `<circle class="fade" style="--d:${0.3 + i * 0.08}s" cx="${x(z.auc_unico)}" cy="${y}" r="7" fill="${z.color}" data-tip="<b>${esc(z.nombre)}</b><br>Modelo único: ${fmt(z.auc_unico, 3)}"/>`;
      s += `<text class="val fade" style="--d:.8s" x="${x(z.auc_unico) + 12}" y="${y + 4}">${fmt(z.auc_unico, 3)}</text>`;
    });
    return { h, s, label: "AUC del modelo único y de los modelos entrenados en un solo piso" };
  },

  // Eventos del inventario nacional por 100 km² en cada piso.
  async densidad(w) {
    const d = await load("zonas");
    const h = 250;
    const l = 10, r = 10, t = 28, b = 46;
    const bw = (w - l - r) / d.zonas.length;
    const y = (v) => t + (1 - v / 70) * (h - t - b);
    let s = "";
    d.zonas.forEach((z, i) => {
      const x0 = l + i * bw;
      s += `<rect class="rise" style="--d:${i * 0.1}s" x="${x0 + bw * 0.16}" y="${y(z.eventos_nacionales_100km2)}" width="${bw * 0.68}" height="${y(0) - y(z.eventos_nacionales_100km2)}" rx="5" fill="${z.color}" data-tip="<b>${esc(z.nombre)}</b><br>${fmt(z.eventos_nacionales_100km2, 1)} eventos por 100 km²<br>${fmt(z.area_km2)} km² del corredor"/>`;
      s += `<text class="val fade" style="--d:.8s" x="${x0 + bw / 2}" y="${y(z.eventos_nacionales_100km2) - 8}" text-anchor="middle">${fmt(z.eventos_nacionales_100km2, 1)}</text>`;
      s += `<text x="${x0 + bw / 2}" y="${h - b + 18}" text-anchor="middle" fill="${z.color}" font-weight="700">Piso ${i + 1}</text><text x="${x0 + bw / 2}" y="${h - b + 34}" text-anchor="middle" font-size="10">${esc(z.nombre.replace(" y páramo", ""))}</text>`;
    });
    return { h, s, label: "Eventos del inventario nacional por cada 100 km² en cada piso" };
  },

  // Líneas de la red según cuántos pisos atraviesan.
  async pisosLineas(w) {
    const d = await load("lineas_cinco_zonas");
    const rows = Object.entries(d.por_numero_de_zonas);
    const h = 220;
    const l = 10, r = 10, t = 26, b = 40;
    const bw = (w - l - r) / rows.length;
    const max = Math.max(...rows.map(([, v]) => v));
    const y = (v) => t + (1 - v / max) * (h - t - b);
    let s = "";
    rows.forEach(([n, v], i) => {
      const x0 = l + i * bw;
      const five = n === "5";
      s += `<rect class="rise" style="--d:${i * 0.1}s" x="${x0 + bw * 0.18}" y="${y(v)}" width="${bw * 0.64}" height="${y(0) - y(v)}" rx="5" fill="${five ? css("--accent") : "rgba(255,244,224,.4)"}" data-tip="<b>${n} ${n === "1" ? "piso" : "pisos"}</b><br>${v} líneas"/>`;
      s += `<text class="val fade" style="--d:.7s" x="${x0 + bw / 2}" y="${y(v) - 8}" text-anchor="middle">${v}</text>`;
      s += `<text x="${x0 + bw / 2}" y="${h - b + 20}" text-anchor="middle" ${five ? `class="hi"` : ""}>${n} ${n === "1" ? "piso" : "pisos"}</text>`;
    });
    return { h, s, label: "Número de líneas con torres según cuántos pisos atraviesan" };
  },
};

export async function setupChart(el) {
  const type = el.dataset.chart;
  const draw = charts[type];
  if (!draw) return;
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  el.append(tip);
  let width = 0;
  async function render(force = false) {
    const w = Math.round(el.clientWidth);
    if (!w || (w === width && !force)) return;
    width = w;
    const { h, s, label } = await draw(w, el);
    el.querySelector("svg")?.remove();
    el.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${s}</svg>`);
  }
  await render();
  el.__render = () => render(true);
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    requestAnimationFrame(() => el.classList.add("in"));
    observer.disconnect();
  }, { threshold: 0.25 }).observe(el);
  let timer = 0;
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => render(), 150); }).observe(el);
  el.addEventListener("pointermove", (event) => {
    const mark = event.target.closest("[data-tip]");
    tip.classList.toggle("on", Boolean(mark));
    if (!mark) return;
    tip.innerHTML = mark.dataset.tip;
    const box = el.getBoundingClientRect();
    const px = event.clientX - box.left, py = event.clientY - box.top;
    const flip = px > box.width - 200;
    tip.style.transform = `translate(${flip ? px - 14 : px + 14}px, ${py + 14}px)${flip ? " translateX(-100%)" : ""}`;
  });
  el.addEventListener("pointerleave", () => tip.classList.remove("on"));
  // Botones de serie, por ejemplo la lluvia de 30 o 90 días.
  const group = document.querySelector(`[data-chart-for="${el.id}"]`);
  group?.querySelectorAll("[data-serie]").forEach((button) => button.addEventListener("click", async () => {
    group.querySelectorAll("[data-serie]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    el.dataset.serie = button.dataset.serie;
    el.classList.remove("in");
    await render(true);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
  }));
}
