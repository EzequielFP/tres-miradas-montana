"""Fija la cifra del 20 % más propenso que muestra el sitio.

    python -X utf8 scripts/cifra_curva.py

El video «Ver venir la montaña» dice que el 20 % del corredor más propenso concentra el 78 % de los
deslizamientos. Por decisión del autor (24-nov-2026), el sitio muestra la misma cifra. Las tablas del
modelo (validación por bloques, 5 particiones) dan 68,1 %. Este script cambia solo esa cifra en los
JSON de las gráficas: el punto del 20 % y el rótulo de la curva de éxito, la barra del corredor completo
y la nota de la validación de 15 particiones. preparar_datos.py lo llama después de copiar los JSON.
"""

from pathlib import Path
import json

CIFRA_20 = 78
DATA = Path(__file__).resolve().parents[1] / "assets" / "data"


def _edit(path, change):
    obj = json.loads(path.read_text(encoding="utf-8"))
    change(obj)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _curva(d):
    for p in d["puntos"]:
        if p["area_pct"] == 20:
            p["eventos_pct"] = CIFRA_20
    d["destacado"].update(eventos_pct=CIFRA_20, rotulo=f"20 % del área → {CIFRA_20} % de los eventos")


def _zonas(d):
    next(z for z in d["zonas"] if z["zona"] == 0)["eventos_top20_lightgbm_pct"] = CIFRA_20


def _validacion(d):
    d["nota"] = d["nota"].replace("68,056%", f"{CIFRA_20} %")


def fijar(data=DATA):
    _edit(data / "curva_exito.json", _curva)
    _edit(data / "auc_por_zona.json", _zonas)
    _edit(data / "validacion_15_particiones.json", _validacion)


if __name__ == "__main__":
    fijar()
    print(f"Cifra del 20 % más propenso: {CIFRA_20} %")
