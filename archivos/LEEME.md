# Tablas descargables

Tablas del modelo propio de susceptibilidad a movimientos en masa en el corredor de 10 km de la red STN (LightGBM, oct-2026). Son cálculos nuestros, no resultados de ISA.

- `resumen_inventarios.csv`: eventos por inventario (propio = fotointerpretación propia, nacional, combinado sin duplicados a menos de 50 m) y por área (AI_10km = corredor; AI_geologia = área fotointerpretada).
- `tabla_variables.csv`: las 20 variables candidatas con su AUC individual, valor de información, importancia y colinealidad (VIF).
- `resumen_modelos.csv`: seis modelos con y sin suelos. En las columnas, AMBOS es el inventario combinado y COL el nacional. Validación espacial por bloques de 10 km, 15 particiones.
- `resumen_sensibilidad.csv`: pruebas de sensibilidad del modelo.
- `auc_por_zona.csv` e `importancia_por_zona_P4.csv`: desempeño e importancia de variables en las cinco zonas térmicas y de humedad (P4).
- `codigos_clases.csv`: significado de los códigos de las capas categóricas.
- `lluvia_andina.json`: porcentaje de píxeles andinos del corredor con más de 200 mm en 30 días y más de 600 mm en 90 días (CHIRPS, ene-2024 a sep-2026).

La susceptibilidad indica dónde el terreno es más propenso a moverse. No es una probabilidad ni un riesgo, y no dice cuándo ocurrirá un evento.
