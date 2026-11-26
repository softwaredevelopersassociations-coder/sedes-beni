# Plan de trabajo: módulo de entrega física de carnets

## 1. Propósito

Incorporar una sección para que recepción consulte los carnets sanitarios aprobados que están listos para recoger y registre, con una acción de confirmación, cuándo la persona retira físicamente el carnet.

El módulo distinguirá dos cosas que el sistema hoy maneja por separado solo de manera implícita:

- **Estado del trámite:** `Pendiente Laboratorio`, `Pendiente Medicina`, `Aprobado` o `Rechazado`.
- **Estado de entrega física:** `Pendiente de entrega` o `Entregado`.

La aprobación médica seguirá siendo el requisito que habilita la entrega. Registrar que alguien recogió el carnet no debe cambiar el estado clínico del trámite.

## 2. Situación actual del sistema

- `tramites.estado` registra el flujo clínico y termina en `Aprobado` o `Rechazado`.
- Al aprobar, `backend/src/routes/consultas.js` genera el código digital y las fechas de emisión y vencimiento.
- La pantalla `Emisión de Carnets` permite imprimir y muestra algunos trámites aprobados y también trámites aún pendientes de aprobación médica. Por eso conviene que la nueva bandeja tenga su propia consulta estricta de trámites aprobados.
- El menú lateral y el acceso por rol se controlan desde `frontend/src/components/DashboardLayout.jsx` y `frontend/src/App.jsx`.
- La base tiene `logs_auditoria` y una rutina compartida para guardar acciones de usuario.
- El backend carga `schema.sql` y registra migraciones en `backend/src/config/db.js`.

## 3. Alcance del módulo

### Incluye

1. Nueva sección **Entrega de Carnets** visible para el rol `admin`, que en el sistema actual representa recepción/administración.
2. Tabla de carnets listos para recoger, con búsqueda y filtros.
3. Check directo para pasar de pendiente a entregado, sin formulario adicional.
4. Registro del usuario autenticado y fecha/hora de entrega.
5. Auditoría de la entrega y actualización de la tabla sin recargar toda la aplicación.
6. Consulta del historial de entregados desde la misma sección.

### No incluye en la primera versión

- Cambiar el resultado de la evaluación médica.
- Registrar impresión como condición para habilitar la entrega, porque actualmente el sistema no persiste un evento de impresión.
- Revertir una entrega desde la interfaz. Una corrección excepcional debe quedar documentada y restringida a administración.
- Generar comprobantes impresos o firma digital de quien recoge. Estos pueden añadirse en una segunda fase si el procedimiento institucional los requiere.

## 4. Regla de negocio y ciclo de vida

1. El médico registra la consulta y aprueba el trámite.
2. En la misma operación que actualiza el trámite a `Aprobado`, se inicializa el estado de entrega como `Pendiente de entrega`.
3. Solo los trámites aprobados aparecen en esta bandeja. Los rechazados y los que siguen en laboratorio o medicina no pueden marcarse como entregados.
4. Recepción localiza al paciente y verifica el número de carnet físico antes de entregar el documento.
5. Al pulsar **Marcar entregado**, el backend registra `Entregado`, la fecha y hora, y el usuario que hizo la entrega. La entrega es personal; no se capturan datos de terceros.
6. El carnet permanece con `tramites.estado = 'Aprobado'`; solo cambia `estado_entrega`.

## 5. Propuesta para la tabla de la pantalla

La vista abre en **Pendientes de entrega**. Las tarjetas de resumen son las pestañas principales; en la vista de entregados se habilita un filtro por fecha.

| Columna | Contenido / comportamiento |
|---|---|
| N.º de carnet físico | `numero_carnet_sanitario`; identificador principal que recepción verifica físicamente |
| Código digital | `codigo_carnet` |
| Paciente | Nombres y apellidos |
| Cédula | Número, complemento si existe y expedición |
| Teléfono | Dato de contacto, si está registrado |
| Fecha de emisión | Fecha de aprobación/emisión |
| Válido hasta | Fecha de vencimiento |
| Estado de entrega | Etiqueta `Pendiente de entrega` o `Entregado` |
| Fecha de entrega | Fecha y hora localizadas a la zona horaria del sistema; solo en entregados |
| Entregado por | Nombre del usuario autenticado que registró la entrega |
| Acción | En pendientes: botón **Marcar entregado**. En entregados: botón compacto **Deshacer** para corregir un clic accidental |

### Controles de la tabla

- Búsqueda por nombre, apellidos, cédula, número físico o código digital.
- Pestañas principales **Pendientes de entrega** y **Entregados**, con sus contadores.
- En entregados, filtro por fecha: todas, hoy, ayer o esta semana.
- Orden por fecha de emisión y nombre; permitir priorizar los pendientes más antiguos.
- Paginación si el volumen de registros lo requiere; en la primera versión se puede seguir el patrón de listas existentes y limitar resultados desde el servidor.
- Estado vacío distinto para “no hay carnets pendientes” y “no se encontraron coincidencias”.
- En móvil, hacer la tabla desplazable horizontalmente o convertir cada fila en una tarjeta legible.
- Las acciones deben tener etiquetas accesibles, foco visible y estado bloqueado mientras se guarda.

### Acción del check

En pendientes, el botón **Marcar entregado** envía el cambio directamente al servidor. Mientras se guarda, bloquear la acción y mostrar el progreso. En entregados, **Deshacer** pide confirmación; al aceptar, registra la corrección en auditoría y devuelve el carnet a pendientes.

## 6. Persistencia propuesta

Para el MVP, ampliar `tramites`: cada trámite corresponde a un carnet y hay como máximo una entrega final. Esto evita una tabla duplicada de entrega y conserva juntos el estado clínico y el estado operativo del mismo carnet, en columnas separadas. La auditoría existente conserva el evento de cambio.

Campos sugeridos:

| Campo | Tipo sugerido | Uso |
|---|---|---|
| `estado_entrega` | `VARCHAR(30) NULL` con `CHECK` | Nulo mientras no esté aprobado; luego `Pendiente de entrega` o `Entregado` |
| `fecha_entrega` | `TIMESTAMPTZ NULL` | Momento exacto del retiro |
| `entregado_por` | `INTEGER NULL REFERENCES usuarios(id)` | Usuario de recepción que confirma el retiro |

La migración debe:

1. Agregar las columnas de forma idempotente.
2. Añadir una restricción que admita solo los dos estados de entrega previstos o `NULL`.
3. Marcar los trámites existentes con `estado = 'Aprobado'` como `Pendiente de entrega`.
4. Dejar en `NULL` el estado de entrega para trámites no aprobados.
5. Crear un índice parcial para consultar rápido los aprobados pendientes, por ejemplo sobre `estado_entrega, fecha_emision` donde `estado = 'Aprobado'`.
6. Actualizar `backend/database/schema.sql` para instalaciones nuevas y agregar la migración versionada `003_entrega_carnets.sql`.
7. Conectar la migración `003` al inicializador de `backend/src/config/db.js`, respetando su transacción y el registro en `schema_migrations`.

## 7. API propuesta

### Consultar la bandeja

`GET /api/entregas-carnets?estado=pendiente&query=...`

- Requiere autenticación y rol `admin`.
- Devuelve los datos necesarios para las columnas de la tabla, incluyendo `estado_entrega`, `fecha_entrega` y nombre del usuario que entregó.
- Solo consulta trámites `Aprobado` con estado de entrega válido.
- Acepta `estado=pendiente`, `estado=entregado` o `estado=todos` y texto de búsqueda; filtros y paginación se procesan en servidor si el volumen lo requiere.
- Orden sugerido: pendientes por emisión ascendente para poner primero los más antiguos; entregados por fecha de entrega descendente.

### Registrar entrega

`PATCH /api/entregas-carnets/:tramiteId/entregar`

No requiere cuerpo: el check registra que el titular recogió personalmente el carnet.

Comportamiento esperado:

- Requiere autenticación y rol `admin`.
- Verifica que exista el trámite, que esté `Aprobado` y que su entrega siga pendiente.
- En una transacción, bloquea la fila del trámite y guarda el estado, timestamp y usuario.
- Si otro operador ya registró la entrega, responde `409` y entrega el estado vigente; nunca debe duplicar ni sobrescribir la fecha original silenciosamente.
- Devuelve el registro actualizado para refrescar la fila.
- Registra en `logs_auditoria` la acción `ENTREGA_CARNET`, con el número físico, código digital, paciente y usuario responsable.

### Revertir una entrega por error

`PATCH /api/entregas-carnets/:tramiteId/deshacer-entrega`

- Requiere autenticación y rol `admin`; solo permite revertir un trámite aprobado que figure como `Entregado`.
- Bloquea la fila en una transacción, devuelve el estado a `Pendiente de entrega` y limpia los campos de la entrega vigente.
- Registra `ANULAR_ENTREGA_CARNET` con los datos anteriores para conservar la trazabilidad.

## 8. Cambios previstos por componente

### Backend

1. **Base de datos:** modificar `schema.sql`; crear `003_entrega_carnets.sql`; actualizar el cargador de migraciones en `src/config/db.js`.
2. **Aprobación médica:** en `src/routes/consultas.js`, al aprobar, inicializar `estado_entrega = 'Pendiente de entrega'` dentro de la transacción actual. La rama de rechazo no debe asignar un estado de entrega.
3. **Ruta nueva:** crear `src/routes/entregasCarnets.js` con listado y confirmación; aplicar `verifyToken` y `checkRole(['admin'])` en servidor.
4. **Montaje:** registrar `/api/entregas-carnets` en `src/server.js`.
5. **Auditoría y concurrencia:** usar `logAuditoria`; proteger actualización con transacción, bloqueo de fila y respuesta idempotente/conflicto.

### Frontend

1. Crear `src/pages/EntregaCarnets.jsx` con tabla, búsqueda, filtros, contadores, confirmación y estados de carga/error/vacío.
2. Añadir métodos de listado y entrega en `src/utils/api.js`.
3. Registrar la página en `src/App.jsx`.
4. Añadir el menú **Entrega de Carnets** en `src/components/DashboardLayout.jsx`, visible solo para `admin`.
5. Usar `useLiveRefresh` o el evento `sedes:data-changed` que ya emite el cliente API para actualizar la bandeja tras una entrega.
6. Seguir los componentes, estilos y formatos de fecha actuales del proyecto para mantener coherencia visual.

## 9. Plan de trabajo desglosado

Estimación inicial: **10–14 horas de desarrollo**, sujeta a revisión del estado real de la base de datos y del procedimiento de entrega.

| Fase | Tareas | Entregable | Estimación |
|---|---|---|---:|
| 1. Cerrar reglas funcionales | Confirmar rol de recepción (`admin` en el modelo actual), estados, criterio de “listo” y entrega personal con acción directa | Reglas acordadas | 0,5–1 h |
| 2. Persistencia y migración | Añadir columnas e índice al esquema; migración `003`; backfill de aprobados existentes; integrar migración en el inicializador | BD nueva y existente compatibles | 1,5–2 h |
| 3. Flujo de aprobación | Inicializar estado de entrega pendiente en la misma transacción que aprueba el carnet; conservar estado nulo para rechazados | Aprobación alimenta correctamente la bandeja | 0,5–1 h |
| 4. API y control de acceso | Implementar consulta filtrable y confirmación atómica; validar estados; auditar; manejar `404`, `409` y errores | Endpoints protegidos y registro de entrega confiable | 2–3 h |
| 5. Interfaz y navegación | Construir página y tabla; añadir búsqueda, filtros, contadores y acción directa; conectar el menú y API | Módulo navegable y usable en escritorio/móvil | 3–4 h |
| 6. Revisión funcional | Verificar permisos, datos de migración, transición, doble clic/concurrencia, visualización y actualización de contadores | Lista de aceptación cumplida y observaciones resueltas | 2–3 h |

## 10. Criterios de aceptación

- Solo los carnets con trámite `Aprobado` aparecen como listos para recoger.
- Un trámite pendiente de laboratorio, pendiente de medicina o rechazado no puede marcarse entregado, aunque se invoque la API directamente.
- Cada carnet aprobado aparece inicialmente como `Pendiente de entrega`, incluidos los aprobados antes de instalar el módulo.
- El botón registra directamente la entrega personal, guarda quién y cuándo la registró y cambia la fila a `Entregado`.
- En entregados se puede revertir un registro por error con confirmación y auditoría.
- Una entrega registrada no se duplica ni se sobrescribe con doble clic o desde otra sesión.
- La vista permite encontrar un carnet por nombre, cédula, número físico o código digital, y consultar pendientes y entregados.
- El rol `admin` puede acceder; los roles `laboratorio` y `medico` reciben denegación del servidor.
- La acción aparece en `logs_auditoria` con información suficiente para identificar el carnet y al operador.
- El estado clínico permanece `Aprobado` después de la entrega.
- Instalaciones nuevas y existentes reciben el esquema sin perder trámites ni datos.

## 11. Riesgos y decisiones que deben quedar explícitas

- **Impresión no registrada:** actualmente el sistema no guarda si el carnet fue impreso. En este plan, “listo para recoger” significa aprobado por medicina; recepción verifica que el documento físico esté efectivamente preparado antes de confirmar entrega.
- **Rol de recepción:** no existe un rol `recepcion` en el esquema. El plan usa `admin`; si se requiere separar permisos, debe añadirse un rol específico y ajustar usuarios y políticas en otro alcance.
- **Corrección de una entrega:** el MVP no permite desmarcar un carnet. Una rectificación debe conservar auditoría y requerir permiso de administración.
- **Entrega personal:** el check significa que recepción verificó que el titular recogió el carnet. No hay captura de terceros ni formulario adicional.

## 12. Orden de implementación recomendado

1. Aprobar internamente las reglas de los apartados 4 y 11.
2. Crear la migración y el esquema para tener una base persistente clara.
3. Ajustar aprobación médica y construir los endpoints protegidos.
4. Implementar página, tabla, navegación y cambio directo desde el check.
5. Revisar los criterios de aceptación con datos de prueba y en la interfaz móvil.
6. Desplegar primero en un entorno de prueba, validar el backfill y luego aplicar en la instancia operativa.
