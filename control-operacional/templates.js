// Catálogos de la aplicación: listas de verificación y riesgos críticos.
// Para agregar una lista nueva basta con añadir un objeto a CHECKLISTS.

const CHECKLISTS = [
  {
    id: 'herramientas',
    nombre: 'Pre-uso de herramientas',
    items: [
      'Cables y enchufes sin grietas, cortes ni empalmes',
      'Cuenta con cinta del mes (código de colores)',
      'Protecciones y guardas instaladas',
      'Interruptor de hombre muerto operativo',
      'EPP específico disponible y en buen estado',
      'Herramienta adecuada para la tarea',
    ],
  },
  {
    id: 'altura',
    nombre: 'Trabajo en altura',
    items: [
      'Trabajadores con curso y examen de altura física vigente',
      'Arnés y cola de seguridad inspeccionados (cinta del mes)',
      'Punto de anclaje certificado o línea de vida instalada',
      'Andamio con tarjeta verde / plataforma con barandas',
      'Área inferior segregada y señalizada',
      'Herramientas amarradas para evitar caída de objetos',
      'Condiciones climáticas aptas (viento, lluvia)',
    ],
  },
  {
    id: 'izaje',
    nombre: 'Maniobras de izaje',
    items: [
      'Plan de izaje aprobado (crítico sobre 75% de capacidad)',
      'Operador y rigger con licencia/acreditación vigente',
      'Grúa con certificación y check list diario',
      'Elementos de izaje inspeccionados y con código de color',
      'Área de maniobra segregada, nadie bajo carga suspendida',
      'Vientos (cuerdas guía) instalados',
      'Comunicación radial definida entre operador y rigger',
    ],
  },
  {
    id: 'bloqueo',
    nombre: 'Aislación y bloqueo de energías',
    items: [
      'Energías identificadas (eléctrica, hidráulica, neumática, gravitacional)',
      'Candado y tarjeta personal instalados por cada trabajador',
      'Verificación de energía cero realizada',
      'Caja de bloqueo grupal con registro',
      'Equipos de medición en buen estado',
    ],
  },
  {
    id: 'confinado',
    nombre: 'Espacio confinado',
    items: [
      'Permiso de trabajo de espacio confinado firmado',
      'Medición de gases (O₂, LEL, CO, H₂S) registrada',
      'Ventilación forzada operativa',
      'Vigía permanente en el acceso',
      'Plan y equipo de rescate disponibles',
      'Comunicación permanente con el interior',
    ],
  },
  {
    id: 'vehiculos',
    nombre: 'Equipos móviles y vehículos',
    items: [
      'Conductor con licencia interna y municipal vigente',
      'Check list pre-uso del equipo completado',
      'Alarma de retroceso y baliza operativas',
      'Cinturones de seguridad operativos',
      'Neumáticos, luces y frenos en buen estado',
      'Pértiga y bandera (si aplica en área mina)',
    ],
  },
  {
    id: 'epp_orden',
    nombre: 'EPP, orden y aseo',
    items: [
      'Casco, lentes, zapatos y guantes en buen estado',
      'Protección auditiva/respiratoria según riesgo',
      'Pasillos y vías de evacuación despejados',
      'Materiales almacenados de forma segura',
      'Extintores vigentes y accesibles',
      'Residuos segregados en contenedores correctos',
    ],
  },
];

const RIESGOS_CRITICOS = [
  'Caída de distinto nivel',
  'Caída de objetos',
  'Contacto con energía eléctrica',
  'Liberación de energía no controlada',
  'Atrapamiento',
  'Pérdida de control de equipo móvil',
  'Volcamiento de equipo',
  'Carga suspendida',
  'Espacio confinado / atmósfera peligrosa',
  'Incendio / explosión',
  'Exposición a sustancias peligrosas',
  'Proyección de partículas',
  'Otro',
];

const TURNOS = ['Día', 'Noche', 'A', 'B', 'C'];
