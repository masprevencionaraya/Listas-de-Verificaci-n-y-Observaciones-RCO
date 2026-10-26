# Auditoría — Lista de Verificación Pre-Uso de Herramientas

**Archivo auditado:** `gemini-code-1787107244296.html` (único archivo del repositorio, commit `1e5bc19`)
**Fecha:** 2026-10-26
**Alcance:** funcionalidad, integridad de datos, seguridad y privacidad, cumplimiento HSE (valor del registro como evidencia), capacidad offline, accesibilidad y mantenibilidad.

---

## Resumen ejecutivo

La aplicación es un prototipo de una sola página: un formulario de 3 puntos de control con firma en canvas, que guarda los registros en `localStorage` y ofrece un botón "Sincronizar".

**No está apta para uso en terreno en su estado actual.** El hallazgo más grave es que **"Sincronizar" no envía los datos a ningún servidor: solo los borra del dispositivo** y muestra un mensaje de éxito. Cualquier inspección registrada con esta versión se pierde de forma permanente al pulsar ese botón.

| Severidad | Cantidad |
|---|---|
| 🔴 Crítica | 3 |
| 🟠 Alta | 6 |
| 🟡 Media | 7 |
| ⚪ Baja | 5 |

---

## 🔴 Hallazgos críticos

### C1. La sincronización elimina los datos sin enviarlos (pérdida total de registros)
**Ubicación:** líneas 209–216

```js
// Simulación de envío a API REST backend
console.log('Enviando a servidor backend de Salfa...', queue);
setTimeout(() => {
  localStorage.removeItem('salfa_checklists');
  ...
  alert(`🚀 ¡Sincronización exitosa! Se han subido ${queue.length} registros al servidor.`);
}, 1000);
```

No existe ninguna llamada de red (`fetch`, `XMLHttpRequest`). Tras 1 segundo se borra toda la cola y se informa al usuario de un éxito falso. El usuario cree que sus inspecciones están respaldadas cuando en realidad se destruyeron.

**Recomendación:** implementar el envío real (`fetch` con `POST`), y borrar del dispositivo **solo los registros que el servidor confirme** (por `id`), nunca la cola completa. Mientras no exista backend, deshabilitar el botón o rotularlo claramente como "no disponible".

### C2. Condición de carrera: se borran registros creados durante la "sincronización"
**Ubicación:** línea 213

`removeItem` elimina la clave entera, no los registros que se leyeron en la línea 198. Si se guarda una inspección dentro del intervalo de espera (o, con un backend real, mientras la petición está en curso), esa inspección también se elimina sin haber sido enviada.

**Recomendación:** eliminar por `id` solo los registros confirmados; bloquear el botón mientras hay una sincronización en curso.

### C3. Se acepta una inspección sin firma
**Ubicación:** líneas 170–195

No se verifica que el canvas contenga trazos. `canvas.toDataURL()` de un canvas vacío produce una imagen en blanco válida, por lo que se guardan registros "firmados" sin firma. Para un documento de prevención esto invalida el registro como evidencia.

**Recomendación:** registrar una bandera `hasSignature` al dibujar y rechazar el envío si es falsa; agregar además el **nombre y RUT de quien firma** (hoy la firma no está asociada a ninguna persona identificada).

---

## 🟠 Hallazgos altos

### A1. Las respuestas vienen preseleccionadas en "Cumple"
**Ubicación:** líneas 63–85

Cada `<select>` tiene `CUMPLE` como primera opción, por lo que el atributo `required` no tiene efecto: se puede guardar la inspección sin revisar nada. Esto sesga el registro hacia el cumplimiento y es una debilidad conocida de las listas de verificación ("check por defecto").

**Recomendación:** agregar una primera opción vacía (`<option value="" disabled selected>Seleccione…</option>`) para forzar una respuesta consciente en cada punto.

### A2. "No Cumple" no exige observación ni acción
El repositorio se llama "Listas de Verificación y **Observaciones**", pero no hay ningún campo de observaciones. Un "No Cumple" se registra sin descripción, sin acción correctiva, sin responsable y sin evidencia fotográfica, y la herramienta no queda marcada como "fuera de servicio".

**Recomendación:** cuando un punto sea "No Cumple", mostrar y hacer obligatorio un campo de observación; mostrar una advertencia de **no uso / retirar herramienta** y opcionalmente adjuntar foto.

### A3. El registro no identifica la herramienta inspeccionada
Es un checklist "Pre-Uso de Herramientas", pero no se registra qué herramienta (tipo, código interno, N° de serie). El registro no es trazable.

**Recomendación:** agregar campos de tipo de herramienta y código/N° de serie; considerar también turno, empresa/contrato y nombre del operador.

### A4. Fallo silencioso al llenarse el almacenamiento
**Ubicación:** línea 189

`localStorage` suele tener ~5 MB por origen. Cada firma se guarda como PNG en Base64 a resolución de pantalla × `devicePixelRatio` (en celulares, 2–3×), lo que puede ocupar decenas a cientos de KB por registro. Cuando se supera la cuota, `setItem` lanza `QuotaExceededError`, que no se captura: el usuario no ve ningún mensaje, el formulario no se limpia y la inspección no se guarda. Es justamente el escenario de uso offline prolongado en faena.

**Recomendación:** envolver la escritura en `try/catch` y avisar al usuario; migrar a IndexedDB (cuota mucho mayor) y comprimir la firma (p. ej. `toDataURL('image/png')` a resolución reducida o JPEG con fondo blanco).

### A5. Datos corruptos bloquean la aplicación
**Ubicación:** línea 162

`JSON.parse` sin `try/catch`: si la clave `salfa_checklists` queda corrupta, `updatePendingCount()` lanza una excepción en la carga y ni el contador ni el guardado ni la sincronización funcionan.

**Recomendación:** capturar el error, conservar una copia del valor corrupto y reiniciar la cola de forma controlada.

### A6. La firma se borra sola mientras se firma (celulares)
**Ubicación:** líneas 130–138

`resizeCanvas()` se ejecuta en cada evento `resize`, y asignar `canvas.width` borra el contenido. En móviles el evento `resize` se dispara al mostrarse/ocultarse la barra de direcciones al hacer scroll, al rotar la pantalla y al abrir el teclado (p. ej. al volver a editar el RUT). Resultado: la firma desaparece sin aviso y, combinado con C3, se puede terminar guardando una firma vacía.

**Recomendación:** redimensionar solo si cambia el ancho real del canvas y redibujar la firma previa (guardando la imagen antes del resize), o fijar el tamaño una vez.

---

## 🟡 Hallazgos medios

### M1. No funciona realmente sin conexión
La interfaz anuncia "MODO OFFLINE", pero no hay Service Worker ni manifiesto web. Si la página se recarga o se abre sin señal (situación habitual en faena), el navegador no puede cargarla. Además Tailwind se carga desde `cdn.tailwindcss.com` (línea 7): sin red la página queda sin estilos.

**Recomendación:** convertir en PWA (Service Worker con caché de la página y recursos, `manifest.json`) y compilar Tailwind a un CSS local.

### M2. Uso del CDN de Tailwind "Play" en producción
`cdn.tailwindcss.com` es una herramienta de desarrollo (Tailwind lo indica en consola y no lo recomienda para producción): compila estilos en el navegador en cada carga, pesa más y no admite fijar versión ni integridad (SRI). Es además código de terceros con acceso total a la página, incluyendo RUT y firmas.

**Recomendación:** generar el CSS con Tailwind CLI y servirlo localmente.

### M3. Datos personales en texto plano y en consola
RUT y firma manuscrita son datos personales (Ley 19.628 y Ley 21.719 de protección de datos personales). Se guardan sin cifrar en `localStorage`, accesibles a cualquier persona que use el dispositivo, y la línea 210 los vuelca completos a la consola del navegador.

**Recomendación:** eliminar el `console.log` con datos; minimizar el tiempo que los datos permanecen en el dispositivo; si los equipos son compartidos, considerar cifrado local y un mecanismo de sesión.

### M4. RUT sin validación
**Ubicación:** línea 49

Se acepta cualquier texto. No se valida formato ni dígito verificador (módulo 11), por lo que errores de digitación quedan registrados y el registro no se puede vincular a la persona.

**Recomendación:** normalizar (quitar puntos, mayúscula en K) y validar el dígito verificador antes de guardar.

### M5. `navigator.onLine` no garantiza conectividad
`navigator.onLine === true` solo indica que hay una interfaz de red; en redes con portal cautivo o sin salida a internet marca "EN LÍNEA". Con un backend real, la sincronización debe manejar errores y reintentos en lugar de confiar en este indicador.

### M6. Fecha/hora dependiente del reloj del dispositivo y en UTC
`new Date().toISOString()` registra la hora en UTC según el reloj del equipo, que puede estar desfasado. El usuario además nunca ve la fecha del registro.

**Recomendación:** mostrar fecha/hora local en el formulario y registrar también la hora de recepción en el servidor.

### M7. No hay historial ni forma de revisar lo guardado
El usuario solo ve un contador. No puede consultar, corregir ni exportar inspecciones pendientes, lo que agrava C1: no hay forma de recuperar o respaldar los datos antes de sincronizar.

**Recomendación:** listado de registros pendientes y opción de exportar (CSV/JSON/PDF).

---

## ⚪ Hallazgos bajos

- **B1. Accesibilidad:** las etiquetas `<label>` no están asociadas a sus campos (falta `for`), los `<select>` no tienen etiqueta accesible, la firma no tiene alternativa para quien no puede dibujar, y se usa `alert()` para todos los mensajes.
- **B2. Manejadores en línea** (`onclick`, `onsubmit`): impiden aplicar una Content Security Policy estricta. Preferible `addEventListener`.
- **B3. Campo `synced` sin uso** y variable `writingIndex` con nombre engañoso (es un booleano "dibujando").
- **B4. ID de registro** `CHK-` + `Date.now()`: puede colisionar entre dispositivos al consolidar en servidor. Usar `crypto.randomUUID()`.
- **B5. Repositorio:** el único archivo tiene nombre autogenerado (`gemini-code-….html`); faltan `index.html`, `README` con propósito y forma de uso, y control de versiones del formato de registro.

---

## Plan de acción sugerido

1. **Inmediato (antes de cualquier uso real):** C1, C2, C3 — o retirar el botón "Sincronizar" hasta tener backend.
2. **Corto plazo:** A1–A6 (validez del registro y robustez del guardado).
3. **Mediano plazo:** M1–M7 (PWA real, privacidad, validación de RUT, historial).
4. **Mejora continua:** B1–B5.
