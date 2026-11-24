"""Arma las descargas del sitio (archivos/): tablas en CSV y un libro de Excel. Nada en JSON.

    python -X utf8 scripts/descargas.py

- Convierte a CSV los datos de las gráficas que antes se descargaban en JSON: lluvia andina, cinco pisos,
  importancia de variables y torres por clase.
- Deja todos los CSV en UTF-8 con BOM, para que Excel muestre bien las tildes.
- Copia TABLAS_DEL_MODELO.xlsx de la carpeta de datos abiertos (GRUPO_2/TRES_MIRADAS_MONTANA_DRIVE/04_DATOS),
  que arma HERRAMIENTAS/preparar_datos_abiertos_g2.py.
- Reescribe archivos/LEEME.md.

La curva de éxito no se ofrece como descarga: en el sitio lleva la cifra fijada para el video (cifra_curva.py),
y la tabla de validación del modelo va en el libro de Excel.
preparar_datos.py llama a este script al final.
"""

from pathlib import Path
import csv
import json
import shutil

WEB = Path(__file__).resolve().parents[1]
DATA = WEB / "assets" / "data"
FILES = WEB / "archivos"
LIBRO = WEB.parent / "TRES_MIRADAS_MONTANA_DRIVE" / "04_DATOS" / "TABLAS_DEL_MODELO.xlsx"


def escribir(name, header, rows):
    with open(FILES / name, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def cargar(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


# Todos los CSV que ya existen, con BOM.
for path in FILES.glob("*.csv"):
    text = path.read_text(encoding="utf-8-sig")
    path.write_text(text, encoding="utf-8-sig", newline="")

lluvia = cargar("lluvia_andina.json")
meses = sorted(lluvia["andino_30d_sobre_200_pct"])
escribir("lluvia_andina.csv", ["mes", "pct_pixeles_30d_sobre_200mm", "pct_pixeles_90d_sobre_600mm"],
         [[m, lluvia["andino_30d_sobre_200_pct"][m], lluvia["andino_90d_sobre_600_pct"].get(m, "")] for m in meses])

zonas = cargar("zonas.json")["zonas"]
campos = ["nombre", "rango", "area_km2", "eventos_nacionales_100km2", "torres", "pct_torres", "torres_alta", "pct_alta",
          "auc_unico", "auc_local", "auc_maquina", "auc_experto", "top20_maquina", "top20_experto"]
escribir("zonas_P4.csv", ["zona"] + campos + ["variable_que_mas_pesa"],
         [[i] + [z[c] for c in campos] + [z["importancia"][0][0]] for i, z in enumerate(zonas, 1)])

imp = cargar("importancia_variables.json")["variables"]
campos = ["id", "nombre", "tipo", "unidad_variable", "fuente_variable", "mediana_pct", "p5_pct", "p95_pct", "shap_mediana_pct",
          "top3_iteraciones_pct"]
escribir("importancia_variables.csv", ["variable"] + campos[1:], [[v.get(c, "") for c in campos] for v in imp])

torres = cargar("torres_por_clase.json")
escribir("torres_por_clase.csv", ["codigo", "clase", "torres", "pct_del_total"],
         [[c["codigo"], c["nombre"], c["torres"], round(c["porcentaje_del_total"], 2)] for c in torres["clases"]])

(FILES / "lluvia_andina.json").unlink(missing_ok=True)
if LIBRO.exists():
    shutil.copy2(LIBRO, FILES / LIBRO.name)

n_candidatas = sum(1 for _ in open(FILES / "tabla_variables.csv", encoding="utf-8-sig")) - 1
(FILES / "LEEME.md").write_text(f"""# Tablas descargables

Tablas del modelo propio de susceptibilidad a movimientos en masa en el corredor de 10 km de la red STN (LightGBM, oct-2026). Son cálculos nuestros, no resultados de ISA.

Están en CSV (UTF-8, se abren directamente en Excel) y, todas juntas, en `TABLAS_DEL_MODELO.xlsx`. No incluyen coordenadas ni identificadores de torres.

- `TABLAS_DEL_MODELO.xlsx`: libro de Excel con las tablas del modelo. La hoja LEEME dice qué hay en cada una.
- `resumen_inventarios.csv`: eventos por inventario y por área.
  - Inventarios: propio (fotointerpretación propia), nacional y combinado (sin duplicados a menos de 50 m).
  - Áreas: AI_10km es el corredor y AI_geologia el área fotointerpretada.
- `tabla_variables.csv`: las {n_candidatas} variables candidatas con su AUC individual, valor de información, importancia y colinealidad (VIF).
- `importancia_variables.csv`: importancia de las variables del modelo final (mediana y percentiles 5 a 95 por permutación).
- `resumen_modelos.csv`: seis modelos con y sin suelos, con validación espacial por bloques de 10 km y 15 particiones. En las columnas, AMBOS es el inventario combinado y COL el nacional.
- `resumen_sensibilidad.csv`: pruebas de sensibilidad del modelo.
- `zonas_P4.csv`: las cinco zonas por piso térmico y humedad. Trae área, densidad de eventos, torres por clase, AUC y la variable que más pesa en cada una.
- `auc_por_zona.csv` e `importancia_por_zona_P4.csv`: desempeño e importancia de las variables en las cinco zonas.
- `torres_por_clase.csv`: conteo agregado de torres por clase de susceptibilidad.
- `codigos_clases.csv`: significado de los códigos de las capas categóricas.
- `lluvia_andina.csv`: porcentaje de píxeles andinos del corredor con más de 200 mm en 30 días y más de 600 mm en 90 días (CHIRPS, ene-2024 a sep-2026).

Los datos espaciales (inventario nacional, variables, zonas y mapas de los modelos, en GeoPackage y GeoTIFF) están en la carpeta de datos abiertos de Google Drive enlazada en la página de datos.

La susceptibilidad indica dónde el terreno es más propenso a moverse. No es una probabilidad ni un riesgo, y no dice cuándo ocurrirá un evento.
""", encoding="utf-8")
print("descargas listas:", ", ".join(sorted(p.name for p in FILES.iterdir())))
