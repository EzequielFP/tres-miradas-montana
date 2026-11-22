// Datos del tramo de 15 × 15 km de la cordillera: alturas (300 × 300), las diez capas de la
// sonda (150 × 150, una por variable) y su metadata. Lo comparten la portada y la maqueta 3D.
// El tramo se publica sin coordenadas: las posiciones van en kilómetros desde la esquina noroeste.
import { clamp, fetchJson } from "./util.js";

let cache = null;

async function binary(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo abrir ${url}`);
  return response.arrayBuffer();
}

export function sampleGrid(data, width, height, u, v) {
  const x = clamp(u, 0, 1) * (width - 1);
  const y = clamp(v, 0, 1) * (height - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0, fy = y - y0;
  const top = data[y0 * width + x0] * (1 - fx) + data[y0 * width + x1] * fx;
  const bottom = data[y1 * width + x0] * (1 - fx) + data[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

export function formatValue(layer, value) {
  const digits = layer.decimales ?? 0;
  const text = value.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return layer.unidad ? `${text} ${layer.unidad}` : text;
}

export function loadLadera() {
  cache ??= (async () => {
    const base = new URL("../media/ladera/", import.meta.url);
    const meta = await fetchJson(new URL("ladera.json", base));
    const [heights, probe] = await Promise.all([binary(new URL(meta.grid.file, base)), binary(new URL(meta.sonda.file, base))]);
    const { width, height } = meta.grid;
    const [low, high] = meta.elevacion;
    const raw = new Uint16Array(heights);
    const meters = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) meters[i] = low + (raw[i] / 65535) * (high - low);

    const pw = meta.sonda.width, ph = meta.sonda.height;
    const stack = new Uint16Array(probe);
    const layers = Object.fromEntries(meta.sonda.orden.map((id, k) => [id, stack.subarray(k * pw * ph, (k + 1) * pw * ph)]));
    const byId = Object.fromEntries(meta.capas.map((layer) => [layer.id, layer]));

    // Valor de una variable en (u, v): u de oeste a este y v de norte a sur, entre 0 y 1.
    function value(id, u, v) {
      const layer = byId[id];
      const x = Math.min(pw - 1, Math.floor(clamp(u, 0, 1) * pw));
      const y = Math.min(ph - 1, Math.floor(clamp(v, 0, 1) * ph));
      const code = layers[id][y * pw + x];
      if (!code) return null;
      if (layer.escala_sonda.tipo === "codigo") {
        const item = layer.clases.find((entry) => entry.codigo === code);
        return { code, text: item?.nombre ?? `Clase ${code}`, color: item?.color };
      }
      const { min, max } = layer.escala_sonda;
      const number = min + ((code - 1) / 65534) * (max - min);
      return { value: number, text: formatValue(layer, number) };
    }
    return { meta, base, width, height, meters, value, byId, side: meta.lado_m / 1000 };
  })();
  return cache;
}

export function texture(name) {
  return new URL(`../media/ladera/${name}`, import.meta.url).href;
}
