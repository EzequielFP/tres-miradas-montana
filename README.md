# Tres miradas sobre la montaña · De Watts a Wow, Grupo 2

[Abre el sitio](https://ezequielfp.github.io/tres-miradas-montana/)

Sitio del segundo grupo de videos. Cuenta, con un modelo propio de susceptibilidad por movimientos en masa, cómo se apoya la red de transmisión de Colombia sobre montañas que a veces se mueven. Es un proyecto independiente: el modelo, el inventario fotointerpretado y los cruces con las torres no son resultados de ISA.

El diseño es distinto al del Grupo 1. Usa un «documental nocturno»: degradado oscuro, titulares Archivo Black, cifras en mono ámbar, paneles translúcidos, grano de película y un obturador que cierra y abre entre páginas.

- [Portada](index.html). Curvas de nivel nocturnas de un tramo real en WebGL2, eventos del inventario que laten, líneas de la red y una lente que muestra el índice del modelo. Incluye la trilogía con tomas 3D, cifras, los tres reproductores y el mapa nacional del corredor con focos de calor.
- [01 · Ojos en la ladera](ojos.html). Balanza de puntos entre los dos inventarios en la misma área y un caso Sentinel-2 antes y después con cortina, parpadeo y lupa. También están las señales de alerta, mira–avisa–cuida y los focos de calor.
- [02 · Ver venir la montaña](montana.html). Maqueta 3D de 15 × 15 km que se pinta con cualquiera de las diez capas. Las ocho variables se separan en láminas, y hay eventos, líneas, sonda y recorrido. También están la importancia de variables, la curva de éxito, la comparación con el experto, el examen de modelos, las torres y la lluvia acumulada.
- [03 · Cinco montañas, una red](pisos.html). Un ascensor por los cinco pisos térmicos con su toma 3D, sus cifras y lo que más pesa en cada uno. También están la densidad de eventos, el modelo único frente a cinco locales y las cuatro líneas que cruzan todos los pisos.
- [Datos abiertos](datos.html). Descargas, método, fuentes y créditos.

## Lo que no se publica

- Coordenadas, identificadores o clases de torres concretas. Solo se publican conteos agregados.
- La ubicación del tramo de la maqueta, porque es el de más torres en la clase más propensa. Se muestra sin coordenadas y sin nombres de líneas. La sonda da kilómetros desde su esquina noroeste.

## Agregar los videos

Los reproductores leen [metadatos/videos.json](metadatos/videos.json) (claves `1`, `2` y `3`). Sin `src`, cada uno muestra el aviso de video en edición. Para sustituir un montaje por una nueva versión:

```
python scripts/preparar_video.py <video final.mp4> 2 --titulo "Ver venir la montaña"
```

## Regenerar los datos

```
python -X utf8 scripts/preparar_datos.py
python -X utf8 scripts/preparar_clips.py
```

- `preparar_datos.py` lee el paquete del modelo (`13_Datos_Susceptibilidad_Corredor10km`), `VIDEO4/datos`, `VIDEO4/datos_v2`, `00_PROPUESTAS/datos` y las descargas de GEE (`WATTS_WOW_GEE_G2`). Escribe la ladera (`assets/media/ladera`: alturas de 300 × 300, diez capas en WebP y una sonda de 150 × 150 por capa), el mapa nacional, los focos de calor de FIRMS recortados a Colombia, el caso Sentinel-2, los JSON de las gráficas (`assets/data`) y las tablas descargables (`archivos`). Las áreas y densidades de los pisos son las de `ANALISIS_DATOS_PROPIOS.md`.
- `preparar_clips.py` comprime diez tomas de Blender de `PRODUCCION_CINE/3D/render` (relieve, cobertura, red e inventario reales) a 720 × 1280 y 30 fps, sin audio, con un fotograma clave cada 6 para recorrerlas con el scroll.
- `construir_vendor.mjs` empaqueta Three.js (con `Points` y `Line`), GSAP y Lenis desde las copias locales de los repositorios.

## Ver localmente

Desde esta carpeta, ejecuta `python -m http.server 8000` y abre [localhost:8000](http://localhost:8000/). No hay paso de compilación.

## Estructura

- `assets/css/g2.css`: sistema visual.
- `assets/js/app.js`: scroll suave, obturador, portadas de capítulo con toma vertical que avanza con el scroll, tarjetas que se reproducen, contadores y carga diferida.
- `assets/js/portada.js`, `maqueta.js`, `ladera.js`: portada WebGL2, maqueta Three.js y datos del tramo.
- `assets/js/graficas.js`: gráficas SVG a partir de `assets/data`.
- `assets/js/pisos.js`, `inventario.js`, `comparador.js`, `reproductor.js`: ascensor, matrices de puntos y mapa, comparador Sentinel-2 y reproductor vertical.

## Créditos

Three.js 0.187.0 (MIT), GSAP 3.15.1 (licencia estándar de GSAP), Lenis 1.3.27 (MIT). Tipografías Archivo Black, Inter y JetBrains Mono (SIL OFL). Todo el movimiento respeta la preferencia de movimiento reducido del sistema.
