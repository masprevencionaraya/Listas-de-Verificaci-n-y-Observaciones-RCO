# Control Operacional Preventivo

Aplicación web progresiva (PWA) para registrar el control operacional preventivo en terreno.
Funciona sin conexión y se instala en el celular desde el navegador ("Agregar a pantalla de inicio").

## Módulos

- **Inicio**: indicadores (inspecciones, % de cumplimiento promedio, observaciones abiertas y acciones vencidas), registros pendientes de sincronizar y actividad reciente.
- **Inspección**: listas de verificación (pre-uso de herramientas, trabajo en altura, izaje, bloqueo de energías, espacio confinado, equipos móviles, EPP/orden y aseo). Cada punto se marca como Cumple / No cumple / N/A; los "No cumple" exigen describir la desviación. Incluye fotos y firma del inspector.
- **Observación**: reporte de acto inseguro, condición insegura o buena práctica, con riesgo crítico, potencial de gravedad, acciones, responsable, fecha compromiso y fotos. Se puede generar directamente desde un "No cumple" de una inspección.
- **Registros**: búsqueda y filtros, detalle, impresión a PDF y cierre de observaciones con evidencia.
- **Ajustes**: datos del inspector, servidor de sincronización, exportación a CSV (Excel), respaldo y restauración en JSON.

## Uso local

Se sirve como archivos estáticos, sin compilación:

```bash
cd control-operacional
python3 -m http.server 8080
# abrir http://localhost:8080
```

Para uso offline e instalación en el celular debe publicarse con HTTPS (por ejemplo, GitHub Pages).

## Datos y sincronización

Los registros se guardan en IndexedDB del dispositivo. Al pulsar **Sincronizar**, los registros
pendientes se envían por `POST` al endpoint configurado en Ajustes, con el cuerpo
`{"registros": [...]}` y, si se configura, el encabezado `Authorization: Bearer <token>`.
Una respuesta 2xx marca los registros como sincronizados.

## Personalización

Las listas de verificación, riesgos críticos y turnos se editan en `templates.js`.
