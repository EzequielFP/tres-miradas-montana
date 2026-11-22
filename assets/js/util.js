export const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
export const temperature = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
const dateFormat = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const palette = {
  night: "#080b0f", paper: "#fff4e0", text: "#ece5d6", text2: "#b8b1a3", muted: "#8b877e", line: "rgba(255,244,224,.12)",
  amber: "#f2a33a", alert: "#e5533d", cyan: "#8fd3e8", leaf: "#8fcb6b",
  baja: "#4e8a38", media: "#c99a3b", alta: "#c8412b",
  pisos: ["#d9a441", "#6fae4e", "#c8693e", "#3f8fc0", "#8e9aae"],
};
export const decimal = (digits) => new Intl.NumberFormat("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function emitGeo(detail) {
  dispatchEvent(new CustomEvent("g2:geo", { detail }));
}
export async function loadImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}
export const monthLabel = (value) => dateFormat.format(new Date(`${value}-01T00:00:00Z`));
export const dayLabel = (value) => dayFormat.format(new Date(`${value}T00:00:00Z`));
export const numeric = (value) => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : null;

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo abrir ${url}`);
  return response.json();
}

export function canvasContext(canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { ctx, width, height };
}
export async function readCsv(path, limit = Infinity) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  const content = await response.text();
  const rows = parseCsv(content.replace(/^\uFEFF/, ""), limit + 1);
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function parseCsv(content, limit) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < content.length && rows.length < limit; i += 1) {
    const char = content[i];
    if (char === '"') {
      if (quoted && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (char === "\r" && content[i + 1] === "\n") i += 1;
    } else {
      field += char;
    }
  }

  if (rows.length < limit && (row.length || field)) rows.push([...row, field]);
  return rows;
}
