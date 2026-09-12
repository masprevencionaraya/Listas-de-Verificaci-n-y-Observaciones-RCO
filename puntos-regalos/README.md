# 🎁 Puntos Regalos

Aplicación web para que los papás evalúen a sus hijos en **Responsabilidades**,
**Orden y Aseo de su Habitación** y **Estudios**, sumando puntos ("Puntos
Regalos") en cada evaluación que luego se pueden canjear por premios.

## Cómo usarla

Abre `index.html` directamente en cualquier navegador (Chrome, Safari, Edge,
Firefox), en computador o celular. No requiere instalación, servidor ni
conexión a internet: es un solo archivo autocontenido y funciona sin
depender de servicios externos. Los datos se guardan en el `localStorage`
del navegador, por lo que quedan solo en ese dispositivo/navegador.

## Funcionalidades

- **Inicio**: panel con el avatar, nivel (Explorador → Aventurero → Campeón →
  Súper Estrella → Leyenda) y puntos disponibles de cada niño/a.
- **Evaluar**: checklist por categoría (Responsabilidades, Habitación,
  Estudios) con puntos por ítem cumplido, bono/descuento manual y una
  observación opcional. Al guardar se anima con confeti 🎉.
- **Premios**: catálogo de premios canjeables por puntos, con botón de canje
  que se habilita solo si el niño/a tiene puntos suficientes.
- **Historial**: registro de todas las evaluaciones y canjes, con opción de
  eliminar un registro (ajusta los puntos automáticamente).
- **Ajustes**: administración de niños/as (nombre, avatar, color), premios
  (nombre, ícono, costo) y de los puntos que vale cada ítem del checklist, más
  un botón para borrar todos los datos.

## Diseño

Colores brillantes y tipografía redondeada pensada para que sea atractiva
tanto para niños como para papás, con una barra de navegación inferior de
5 secciones, pensada primero para el celular.
