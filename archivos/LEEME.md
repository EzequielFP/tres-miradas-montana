# Tablas descargables

Tablas del modelo propio de susceptibilidad a movimientos en masa en el corredor de 10 km de la red STN (LightGBM, oct-2026). Son cálculos nuestros, no resultados de ISA.

Están en CSV (UTF-8, se abren directamente en Excel) y, todas juntas, en `TABLAS_DEL_MODELO.xlsx`. No incluyen coordenadas ni identificadores de torres.

- `TABLAS_DEL_MODELO.xlsx`: libro de Excel con las tablas del modelo. La hoja LEEME dice qué hay en cada una.
- `resumen_inventarios.csv`: eventos por inventario y por área.
  - Inventarios: propio (fotointerpretación propia), nacional y combinado (sin duplicados a menos de 50 m).
  - Áreas: AI_10km es el corredor y AI_geologia el área fotointerpretada.
- `tabla_variables.csv`: las 25 variables candidatas con su AUC individual, valor de información, importancia y colinealidad (VIF).
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
