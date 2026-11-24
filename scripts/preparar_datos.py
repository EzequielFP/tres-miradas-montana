"""Prepara los datos y medios publicables del sitio del Grupo 2.

    python -X utf8 scripts/preparar_datos.py

Lee el paquete del modelo propio (13_Datos_Susceptibilidad_Corredor10km), los datos preparados
para los videos (VIDEO4/datos, VIDEO4/datos_v2), los cruces del Grupo 2 (00_PROPUESTAS/datos)
y las descargas de GEE (WATTS_WOW_GEE_G2). Escribe en assets/media, assets/data y archivos.

No exporta coordenadas, identificadores ni clases de torres individuales: solo conteos agregados.
"""

from pathlib import Path
import csv
import json
import os
import shutil
import sys

import rasterio

_proj = os.path.join(os.path.dirname(rasterio.__file__), "proj_data")
os.environ.setdefault("PROJ_DATA", _proj)
os.environ.setdefault("PROJ_LIB", _proj)

import numpy as np
from PIL import Image
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parents[1]
G2 = ROOT / "GRUPO_2"
PKG = Path(r"E:\Trabajo\GEOHAZARD\ISA_2026\Analisis_Variables\13_Datos_Susceptibilidad_Corredor10km")
V4 = ROOT / "GRUPO_2/VIDEO4" / "datos"
V4B = ROOT / "GRUPO_2/VIDEO4" / "datos_v2"
MEDIA = WEB / "assets" / "media"
DATA = WEB / "assets" / "data"
FILES = WEB / "archivos"
for folder in (MEDIA / "ladera", MEDIA / "caso", DATA, FILES):
    folder.mkdir(parents=True, exist_ok=True)


def save_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def ramp(t, stops):
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(t, [s[0] for s in stops], [hexc(s[1])[c] for s in stops])
    return out


def read_csv(path):
    with open(path, encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


# ------------------------------------------------------------------ 1. La ladera (tramo 15 × 15 km)
meta = json.loads((V4 / "tramo.json").read_text(encoding="utf-8"))
x0, y0, x1, y1 = meta["bounds_9377"]
NP = meta["px"]
zmin, zmax = meta["z_min"], meta["z_max"]
height = np.array(Image.open(V4 / "tramo_height16.png")).astype(np.float64) / 65535 * (zmax - zmin) + zmin
GRID = 300
h300 = height.reshape(GRID, NP // GRID, GRID, NP // GRID).mean(axis=(1, 3))
lo, hi = float(h300.min()), float(h300.max())
(MEDIA / "ladera" / "altura.bin").write_bytes(np.round((h300 - lo) / (hi - lo) * 65535).astype("<u2").tobytes())


def window(path):
    with rasterio.open(path) as src:
        win = from_bounds(x0, y0, x1, y1, src.transform)
        data = src.read(1, window=win, boundless=True, fill_value=src.nodata if src.nodata is not None else -9999,
                        out_shape=(NP, NP), resampling=Resampling.nearest).astype(np.float64)
        nodata = src.nodata
    valid = np.isfinite(data) & (data > -9000) & ((data != nodata) if nodata is not None else True)
    return data, valid


names = {r["codigo"]: r["nombre"] for r in read_csv(PKG / "00_documentacion" / "codigos_clases.csv") if "litogrupo" in r["capa"]}
cover_names = {r["codigo"]: r["nombre"] for r in read_csv(PKG / "00_documentacion" / "codigos_clases.csv") if "cob_esri2025" in r["capa"]}
soil_names = {r["codigo"]: r["nombre"] for r in read_csv(PKG / "00_documentacion" / "codigos_clases.csv") if "suelos_clases" in r["capa"]}
LITO = {1: "#E4D9A8", 2: "#C9A66B", 3: "#B7C27A", 4: "#8FA9A0", 5: "#D9B35C", 6: "#7FA6C2", 7: "#9A86AE", 8: "#9B8AA6", 9: "#4A5A52", 10: "#7C6A56", 11: "#5E4F6B", 12: "#2E6F95"}
COVER = {1: "#3D6E86", 2: "#2F4A2A", 4: "#6C9A8B", 5: "#A8A266", 7: "#8A8680", 8: "#A08566", 9: "#F2F2F2", 10: "#C8CCD0", 11: "#8C9A55"}
SOIL = {1: "#8DB46A", 2: "#C3CC7A", 3: "#E0BE6A", 4: "#C98A4B", 5: "#7A5238", 6: "#9AA3A8"}
INDEX = [(0, "#4E8A38"), (0.5, "#C99A3B"), (1, "#C8412B")]
CLASS3 = {1: "#4E8A38", 2: "#C99A3B", 3: "#C8412B"}

LAYERS = [
    {"id": "clase3", "nombre": "Propensión (3 clases)", "tipo": "categorica", "archivo": PKG / "06_modelo_regional/01_LightGBM/general/mapas/LightGBM_clase3.tif",
     "colores": CLASS3, "clases": {1: "Baja", 2: "Media", 3: "Alta"},
     "descripcion": "Clase del modelo propio LightGBM. En todo el corredor, «baja» es el 70 % con menor índice, «media» el 15 % siguiente y «alta» el 15 % más propenso. Los porcentajes de la leyenda son los de este tramo."},
    {"id": "indice", "nombre": "Índice de susceptibilidad", "tipo": "continua", "unidad": "", "archivo": PKG / "06_modelo_regional/01_LightGBM/general/mapas/LightGBM_indice.tif",
     "rampa": INDEX, "escala": "lineal", "fijo": [0, 1], "decimales": 2,
     "descripcion": "Índice relativo del modelo propio (0 a 1). No es una probabilidad: ordena el terreno de menos a más propenso."},
    {"id": "elevacion", "nombre": "Elevación", "tipo": "continua", "unidad": "m", "archivo": PKG / "03_variables/elevacion.tif",
     "rampa": [(0, "#4E7A3A"), (0.35, "#C9B77A"), (0.7, "#8E6B48"), (1, "#EFE6D2")], "escala": "lineal", "decimales": 0,
     "descripcion": "MDE ALOS PALSAR RTC de 12,5 m."},
    {"id": "relieve_500", "nombre": "Relieve local", "tipo": "continua", "unidad": "m", "archivo": PKG / "03_variables/relieve_500.tif",
     "rampa": [(0, "#F0E6CC"), (0.5, "#C99A3B"), (1, "#8A2F1E")], "escala": "lineal", "decimales": 0,
     "descripcion": "Diferencia entre la altura máxima y la mínima en una ventana de 512 m. Reemplaza a la pendiente, con la que es redundante."},
    {"id": "precipitacion", "nombre": "Lluvia media anual", "tipo": "continua", "unidad": "mm/año", "archivo": PKG / "03_variables/precipitacion.tif",
     "rampa": [(0, "#E6EEF0"), (0.5, "#5B9BBE"), (1, "#14405E")], "escala": "lineal", "decimales": 0,
     "descripcion": "CHIRPS, media anual 1981–2025."},
    {"id": "litogrupo", "nombre": "Geología", "tipo": "categorica", "archivo": PKG / "03_variables/litogrupo.tif", "colores": LITO, "clases": names,
     "descripcion": "Grupos litológicos de la geología 1:100.000, completada con el Atlas Geológico 1:1.000.000."},
    {"id": "cob_esri2025", "nombre": "Cobertura del suelo", "tipo": "categorica", "archivo": PKG / "03_variables/cob_esri2025.tif", "colores": COVER, "clases": cover_names,
     "descripcion": "ESRI Land Cover 2025 (10 m, llevada a 12,5 m)."},
    {"id": "suelos_clases", "nombre": "Suelos (clase agrológica)", "tipo": "categorica", "archivo": PKG / "03_variables/suelos_clases.tif", "colores": SOIL, "clases": soil_names,
     "descripcion": "Clases agrológicas del IGAC."},
    {"id": "dist_vias", "nombre": "Distancia a vías", "tipo": "continua", "unidad": "m", "archivo": PKG / "03_variables/dist_vias.tif",
     "rampa": [(0, "#A8401F"), (0.5, "#D49A5A"), (1, "#EFE6D2")], "escala": "log", "decimales": 0,
     "descripcion": "Distancia a vías IGAC 1:100.000 (máximo 5.000 m)."},
    {"id": "dist_fallas", "nombre": "Distancia a fallas", "tipo": "continua", "unidad": "m", "archivo": PKG / "03_variables/dist_fallas.tif",
     "rampa": [(0, "#4A2C63"), (0.5, "#A488B0"), (1, "#EFE6D2")], "escala": "log", "decimales": 0,
     "descripcion": "Distancia a fallas del Atlas Geológico 2020 (máximo 5.000 m)."},
]

PROBE = 150
probe_stack = []
layer_meta = []
for layer in LAYERS:
    data, valid = window(layer["archivo"])
    rgb = np.zeros((NP, NP, 3))
    entry = {k: v for k, v in layer.items() if k not in ("archivo", "rampa", "colores")}
    if layer["tipo"] == "categorica":
        codes = data.astype(int)
        present = sorted(int(c) for c in np.unique(codes[valid]))
        for code, color in layer["colores"].items():
            rgb[codes == code] = hexc(color)
        entry["clases"] = [{"codigo": c, "nombre": layer["clases"].get(c, layer["clases"].get(str(c), f"Clase {c}")), "color": layer["colores"].get(c, "#777777"),
                            "pct": round(float((codes[valid] == c).mean() * 100), 1)} for c in present]
        encoded = np.where(valid, codes, 0)
        entry["escala_sonda"] = {"tipo": "codigo"}
    else:
        values = data[valid]
        if "fijo" in layer:
            a, b = layer["fijo"]
        else:
            a, b = float(np.percentile(values, 2)), float(np.percentile(values, 98))
        if layer["escala"] == "log":
            t = np.log1p(np.clip(data, 0, None)) / np.log1p(max(b, 1))
        else:
            t = (data - a) / (b - a)
        rgb = ramp(t, layer["rampa"])
        entry["leyenda"] = {"min": round(a, 2), "max": round(b, 2), "colores": [c for _, c in layer["rampa"]], "posiciones": [p for p, _ in layer["rampa"]], "escala": layer["escala"]}
        vmin, vmax = float(values.min()), float(values.max())
        entry["escala_sonda"] = {"tipo": "lineal", "min": vmin, "max": vmax}
        encoded = np.where(valid, np.round((np.clip(data, vmin, vmax) - vmin) / max(vmax - vmin, 1e-9) * 65534) + 1, 0)
    alpha = np.where(valid, 255, 0).astype(np.uint8)
    image = Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha]), "RGBA")
    image.save(MEDIA / "ladera" / f"capa_{layer['id']}.webp", quality=82, method=6)
    step = NP // PROBE
    probe_stack.append(encoded[step // 2::step, step // 2::step].astype("<u2"))
    entry["textura"] = f"capa_{layer['id']}.webp"
    layer_meta.append(entry)
    print("capa", layer["id"], "válidos", round(float(valid.mean()), 3))
(MEDIA / "ladera" / "capas.bin").write_bytes(np.stack(probe_stack).tobytes())

shutil.copyfile(V4 / "tramo_cobertura.png", MEDIA / "ladera" / "cobertura.png")
Image.open(V4 / "tramo_cobertura.png").convert("RGB").save(MEDIA / "ladera" / "cobertura.webp", quality=82, method=6)
(MEDIA / "ladera" / "cobertura.png").unlink()

to9377 = Transformer.from_crs("EPSG:4326", "EPSG:9377", always_xy=True)

events = json.loads((V4 / "tramo_eventos.geojson").read_text(encoding="utf-8"))["features"]
ev = []
for feature in events:
    lon, lat = feature["geometry"]["coordinates"][:2]
    x, y = to9377.transform(lon, lat)
    u, v = (x - x0) / (x1 - x0), (y1 - y) / (y1 - y0)
    if 0 <= u <= 1 and 0 <= v <= 1:
        props = feature["properties"]
        ev.append([round(u, 5), round(v, 5), {"deslizamiento": 0, "flujo": 1, "caida": 2}.get(props.get("tipo"), 3),
                   1 if props.get("fuente_inv") == "ISA" else 0])
# Solo la tensión: el tramo es el de más torres en susceptibilidad muy alta, así que no se publican nombres ni coordenadas.
lines = [{"kv": l["tension_kV"], "uv": [[round(a, 4), round(b, 4)] for a, b in l["uv"]]} for l in meta["lineas"]]
save_json(MEDIA / "ladera" / "ladera.json", {
    "grid": {"width": GRID, "height": GRID, "file": "altura.bin"},
    "sonda": {"width": PROBE, "height": PROBE, "file": "capas.bin", "orden": [l["id"] for l in layer_meta]},
    "lado_m": meta["size_m"], "elevacion": [round(lo, 1), round(hi, 1)],
    "capas": layer_meta, "lineas": lines,
    "eventos": {"campos": ["u", "v", "tipo (0 deslizamiento, 1 flujo, 2 caída)", "fuente (1 inventario propio, 0 inventario nacional)"], "datos": ev},
    "fuentes": "Modelo propio LightGBM y sus variables (paquete 13_Datos_Susceptibilidad_Corredor10km, oct-2026) · inventario combinado (fotointerpretación propia + inventario nacional) · líneas de la red STN",
})
print("ladera", len(ev), "eventos,", len(lines), "líneas")

# ------------------------------------------------------------------ 2. Mapa nacional sin torres
idx = Image.open(V4B / "nacional_indice_4000.png").convert("RGBA")
net = Image.open(V4B / "nacional_red_stn_4000.png").convert("RGBA")
mapa = Image.alpha_composite(idx, net).resize((1016, 1600), Image.LANCZOS)
mapa.save(MEDIA / "nacional.webp", quality=84, method=6)
nac = json.loads((V4B / "mapa_nacional.json").read_text(encoding="utf-8"))
save_json(MEDIA / "nacional.json", {"ancho": 1016, "alto": 1600,
                                     "paleta": nac["paleta_indice"], "nota": "Índice relativo del modelo propio promediado a 100 m y la red STN. Sin torres."})

# Focos de calor NASA FIRMS (MODIS), enero a abril de 2024, sobre la misma rejilla del mapa nacional
from rasterio.warp import reproject
L, B, R, T = nac["bounds_9377"]
fire = np.zeros((1600, 1016), np.float32)
with rasterio.open(G2 / "WATTS_WOW_GEE_G2/G2_FUEGO_2024_ene_abr.tif") as src:
    days = src.read(2).astype(np.float32)
    reproject(days, fire, src_transform=src.transform, src_crs="EPSG:4326", src_nodata=-32768,
              dst_transform=rasterio.transform.from_bounds(L, B, R, T, 1016, 1600), dst_crs="EPSG:9377", resampling=Resampling.max)
# Límite de Colombia: silueta tenue del mapa y máscara de los focos (se descartan los de países vecinos)
import geopandas as gpd
from rasterio.features import rasterize
grid_transform = rasterio.transform.from_bounds(L, B, R, T, 1016, 1600)
country = gpd.read_file(r"E:/Trabajo/Limites/Colombia/Colombia.shp").to_crs("EPSG:9377")
inside = rasterize(((geom, 1) for geom in country.geometry), out_shape=(1600, 1016), transform=grid_transform, fill=0).astype(bool)
edge = inside ^ np.pad(inside, 1, mode="edge")[2:, 1:-1] | inside ^ np.pad(inside, 1, mode="edge")[1:-1, 2:]
shape = np.zeros((1600, 1016, 4), np.uint8)
shape[inside] = (255, 244, 224, 14)
shape[edge] = (255, 244, 224, 120)
Image.fromarray(shape, "RGBA").save(MEDIA / "colombia.webp", lossless=True, method=6)
fire = np.where((fire > 0) & inside, fire, 0)
t = np.clip(np.log1p(fire) / np.log1p(8), 0, 1)
rgb = ramp(t, [(0, "#F2A33A"), (0.6, "#E5533D"), (1, "#FFF4E0")])
Image.fromarray(np.dstack([rgb.astype(np.uint8), np.where(fire > 0, 235, 0).astype(np.uint8)]), "RGBA").save(MEDIA / "fuego.webp", lossless=True, method=6)
print("fuego: píxeles con foco", int((fire > 0).sum()))

# ------------------------------------------------------------------ 3. Caso Sentinel-2 (deslizamiento 005926 del inventario propio)
caso = json.loads((G2 / "PRODUCCION_CINE/REAL/render_s2/antes_despues/caso_005926_gee.json").read_text(encoding="utf-8"))
with rasterio.open(G2 / "WATTS_WOW_GEE_G2/G2_AD_005926.tif") as src:
    bands = {d: src.read(i + 1).astype(float) / 10000 for i, d in enumerate(src.descriptions)}
for label, prefix in (("antes", "a_"), ("despues", "d_")):
    rgb = np.dstack([bands[prefix + b] for b in ("B4", "B3", "B2")])
    rgb = np.clip(rgb / 0.18, 0, 1) ** (1 / 1.6)
    Image.fromarray((rgb * 255).astype(np.uint8)).resize((502, 504), Image.LANCZOS).save(MEDIA / "caso" / f"{label}.webp", quality=88)
save_json(MEDIA / "caso" / "caso.json", {k: caso[k] for k in ("tipo", "area_m2", "fecha_imagen_fotointerpretada", "significado_fecha", "resolucion_m") if k in caso} | {
    "ndvi": caso.get("ndvi") or caso.get("validacion_ndvi") or caso.get("validacion"), "fuente": "Copernicus Sentinel-2 SR (GEE), mediana por periodo"})

# ------------------------------------------------------------------ 4. Tablas para las gráficas
def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def clean(obj):
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean(v) for v in obj]
    if isinstance(obj, str) and ":\\" in obj:
        tail = obj.replace("\\", "/")
        return tail.split("13_Datos_Susceptibilidad_Corredor10km/")[-1] if "13_Datos" in tail else Path(tail).name
    return obj


for name in ("importancia_variables.json", "curva_exito.json", "auc_por_zona.json", "validacion_15_particiones.json", "torres_por_clase.json"):
    save_json(DATA / name, clean(json.loads((V4B / name).read_text(encoding="utf-8"))))
# El sitio muestra la cifra del video (78 %) en lugar del 68,1 % de las tablas: ver cifra_curva.py.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import cifra_curva  # noqa: E402
cifra_curva.fijar(DATA)
shutil.copyfile(G2 / "00_PROPUESTAS/datos/lluvia_andina.json", DATA / "lluvia_andina.json")
analisis = json.loads((G2 / "00_PROPUESTAS/datos/analisis_g2.json").read_text(encoding="utf-8"))
cruces = json.loads((G2 / "00_PROPUESTAS/datos/cruces_guiones_v2_v3.json").read_text(encoding="utf-8"))
zonas_imp = read_csv(PKG / "08_tablas/02_variables/importancia_por_zona_P4.csv")
resumen = json.loads((PKG / "00_documentacion/resumen_mapas.json").read_text(encoding="utf-8"))
# Áreas, densidades y torres de ANALISIS_DATOS_PROPIOS.md (cifras verificadas de los guiones)
ZONES = [("calido_seco", "Cálido seco", "< 1.000 m · < 1.800 mm", "#D9A441", 3.8, 25666), ("calido_humedo", "Cálido húmedo", "< 1.000 m · ≥ 1.800 mm", "#6FAE4E", 13.5, 20455),
         ("templado_seco", "Templado seco", "1.000–2.000 m · < 2.000 mm", "#C8693E", 31.3, 8127), ("templado_humedo", "Templado húmedo", "1.000–2.000 m · ≥ 2.000 mm", "#3F8FC0", 66.3, 8868),
         ("frio", "Frío y páramo", "≥ 2.000 m", "#8E9AAE", 29.7, 9905)]
col = {"calido_seco": "P4-1 · Cálido seco", "calido_humedo": "P4-2 · Cálido húmedo", "templado_seco": "P4-3 · Templado seco", "templado_humedo": "P4-4 · Templado húmedo", "frio": "P4-5 · Frío"}
towers = {t["zona_n"]: t for t in analisis["torres_por_zona"]}
# AUC del modelo único (LGBM_global) frente al entrenado dentro de cada zona (LGBM), 09_zonas_P4/auc_por_zona.csv
auc_rows = read_csv(PKG / "08_tablas/09_zonas_P4/auc_por_zona.csv")
auc = {(int(r["zona"]), r["modelo"]): num(r["AUC"]) for r in auc_rows}
ahp = {z["nombre"]: z for z in json.loads((V4B / "auc_por_zona.json").read_text(encoding="utf-8"))["zonas"]}
zones = []
for n, (key, name, rango, color, density, area) in enumerate(ZONES, start=1):
    t = towers[name]
    imp = sorted(((r["variable"], num(r[col[key]])) for r in zonas_imp), key=lambda x: -(x[1] or 0))
    cmp = ahp["Frío" if key == "frio" else name]
    zones.append({"id": key, "nombre": name, "rango": rango, "color": color, "area_km2": area,
                  "eventos_nacionales_100km2": density, "torres": t["torres"], "pct_torres": t["pct_de_torres"],
                  "torres_alta": t["alta_muy_alta"], "pct_alta": t["pct_alta_muy_alta"], "importancia": [[v, round(i, 1)] for v, i in imp],
                  "auc_unico": round(auc[(n, "LGBM_global")], 3), "auc_local": round(auc[(n, "LGBM")], 3),
                  "auc_maquina": cmp["auc_lightgbm"], "auc_experto": cmp["auc_ahp"],
                  "top20_maquina": round(cmp["eventos_top20_lightgbm_pct"], 1), "top20_experto": round(cmp["eventos_top20_ahp_pct"], 1)})
save_json(DATA / "zonas.json", {"zonas": zones, "fuente": "Cálculo propio: zonas P4 del corredor, torres de la red STN por clase del modelo propio, inventario nacional dentro del corredor e importancia por zona (importancia_por_zona_P4.csv)",
                                "nota": "«Alta» es el 15 % más propenso del corredor. La importancia indica cuánto pesa una variable en el modelo; es asociación, no causa."})
save_json(DATA / "lineas_cinco_zonas.json", {"lineas": [{k: v for k, v in l.items() if k != "ID_Linea"} for l in cruces["lineas_5_zonas"]], "por_numero_de_zonas": cruces["lineas_por_n_zonas"],
                                              "fuente": "Cálculo propio sobre la red STN y las zonas P4. Conteos agregados por línea; sin ubicación de torres."})
save_json(DATA / "torres_eventos.json", {k: analisis[k] for k in ("torres_total_con_dato", "torres_con_evento_a_100m", "torres_con_evento_a_250m", "torres_con_evento_a_500m", "torres_con_evento_a_1000m", "dist_evento_mas_cercano_m")})
inv = read_csv(PKG / "08_tablas/resumen_inventarios.csv")
RENAME = {"ISA": "propio", "COL": "nacional", "AMBOS": "combinado"}
for row in inv:
    row["inventario"] = RENAME.get(row["inventario"], row["inventario"])
save_json(DATA / "inventario.json", {"filas": inv, "nota": "propio = fotointerpretación propia; nacional = inventario nacional; combinado = ambos sin duplicar eventos a menos de 50 m. AI_10km es el corredor de 10 km; AI_geologia es el área fotointerpretada (3.045 km²)."})
modelos = read_csv(PKG / "08_tablas/03_modelos/resumen_modelos.csv")
save_json(DATA / "modelos.json", {"modelos": [{"variables": r["variables"], "modelo": r["modelo"], "auc_entrenamiento": num(r["AUC_entrenamiento_mean"]), "auc_prueba": num(r["AUC_AMBOS_mean"]),
                                                "top20": num(r["MM_en_top20_AMBOS_mean"])} for r in modelos],
                                   "nota": "Validación espacial por bloques de 10 km, 15 particiones, inventario combinado corregido."})

for src in (PKG / "08_tablas/02_variables/importancia_por_zona_P4.csv", PKG / "08_tablas/09_zonas_P4/auc_por_zona.csv", PKG / "08_tablas/resumen_inventarios.csv",
            PKG / "08_tablas/03_modelos/resumen_modelos.csv", PKG / "08_tablas/05_sensibilidad/resumen_sensibilidad.csv", PKG / "08_tablas/02_variables/tabla_variables.csv",
            PKG / "00_documentacion/codigos_clases.csv"):
    shutil.copyfile(src, FILES / src.name)
for src in ("lluvia_andina.json",):
    shutil.copyfile(DATA / src, FILES / src)
with open(FILES / "resumen_inventarios.csv", "w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(inv[0].keys()))
    writer.writeheader()
    writer.writerows(inv)
(FILES / "LEEME.md").write_text("""# Tablas descargables

Tablas del modelo propio de susceptibilidad a movimientos en masa en el corredor de 10 km de la red STN (LightGBM, oct-2026). Son cálculos nuestros, no resultados de ISA.

- `resumen_inventarios.csv`: eventos por inventario (propio = fotointerpretación propia, nacional, combinado sin duplicados a menos de 50 m) y por área (AI_10km = corredor; AI_geologia = área fotointerpretada).
- `tabla_variables.csv`: las 20 variables candidatas con su AUC individual, valor de información, importancia y colinealidad (VIF).
- `resumen_modelos.csv`: seis modelos con y sin suelos. En las columnas, AMBOS es el inventario combinado y COL el nacional. Validación espacial por bloques de 10 km, 15 particiones.
- `resumen_sensibilidad.csv`: pruebas de sensibilidad del modelo.
- `auc_por_zona.csv` e `importancia_por_zona_P4.csv`: desempeño e importancia de variables en las cinco zonas térmicas y de humedad (P4).
- `codigos_clases.csv`: significado de los códigos de las capas categóricas.
- `lluvia_andina.json`: porcentaje de píxeles andinos del corredor con más de 200 mm en 30 días y más de 600 mm en 90 días (CHIRPS, ene-2024 a sep-2026).

La susceptibilidad indica dónde el terreno es más propenso a moverse. No es una probabilidad ni un riesgo, y no dice cuándo ocurrirá un evento.
""", encoding="utf-8")
print("listo")
