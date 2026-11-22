"""Comprime para la web las tomas 3D de datos reales de la producción del Grupo 2.

    python -X utf8 scripts/preparar_clips.py

Las tomas son renders de Blender (PRODUCCION_CINE/3D/render) con relieve, cobertura, red STN e
inventario reales. Salen a 720 × 1280, 30 fps, sin audio y con un fotograma clave cada 6 para que
el scroll pueda recorrerlas. También guarda un póster WebP de cada una.
"""

from pathlib import Path
import subprocess

WEB = Path(__file__).resolve().parents[1]
RENDER = WEB.parent / "PRODUCCION_CINE" / "3D" / "render"
OUT = WEB / "assets" / "media" / "cine"
OUT.mkdir(parents=True, exist_ok=True)

# toma → (nombre web, segundo del póster)
CLIPS = {
    "B2_malla": ("red", 6.0),
    "B3_piso1": ("piso-1", 4.0),
    "B4_piso2": ("piso-2", 4.0),
    "B5_piso3": ("piso-3", 4.0),
    "B6_piso4": ("piso-4", 4.0),
    "B7_piso5": ("piso-5", 4.0),
    "B9_torres": ("torres", 6.0),
    "C1_ladera": ("ladera", 5.0),
    "C2_inventarios": ("inventarios", 6.0),
    "C6_ojos": ("ojos", 6.0),
}


def ffmpeg(*arguments):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, arguments)], check=True)


for source, (name, poster) in CLIPS.items():
    path = RENDER / f"{source}.mp4"
    ffmpeg("-i", path, "-an", "-vf", "scale=720:-2,fps=30", "-c:v", "libx264", "-crf", 27, "-preset", "slow",
           "-g", 6, "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT / f"{name}.mp4")
    ffmpeg("-ss", poster, "-i", path, "-frames:v", 1, "-vf", "scale=720:-2", "-c:v", "libwebp", "-quality", 80, OUT / f"{name}.webp")
    print(name, round((OUT / f"{name}.mp4").stat().st_size / 1e6, 1), "MB")
