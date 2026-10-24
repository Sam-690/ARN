# Obra · Control de proyectos

Primera versión funcional local de la plataforma para **una empresa y múltiples obras**. Sigue el planteamiento del PDF del proyecto y permite probar un recorrido básico antes de ampliar los controles de negocio. Los datos precargados son ficticios.

## Ejecutar en esta computadora

Requisitos: Node.js 24 LTS recomendado, npm y PostgreSQL 16 o posterior (`initdb`, `pg_ctl`, `psql`, `createdb` en PATH).

```bash
npm ci
cp .env.example .env # Solo la primera vez; conserva un .env existente
npm run setup
npm run dev
```

Abrir <http://127.0.0.1:3000>. API local: `http://127.0.0.1:4100/api/health`.

Acceso de demostración: `admin@obra.local` / `ObraLocal2026!`. Solo se crea si no existe; volver a ejecutar el seed no sustituye contraseñas ni reinicia datos. Configurar los valores `SEED_ADMIN_*` antes de la primera carga si se desea otro acceso. La página de acceso identifica explícitamente esta versión como demo.

La instancia de PostgreSQL es propia de esta carpeta, escucha **solo en 127.0.0.1:55432** y guarda datos en `.local/postgres`. No se modifica otra instalación ni otra base de datos. `npm run db:stop` detiene esta instancia. El modo local usa autenticación de PostgreSQL `trust` en loopback: otros procesos del mismo equipo pueden acceder. Es un entorno de desarrollo, no una configuración de producción.

Para volver a abrir la aplicación en otra sesión: `npm run db:start` y `npm run dev`. Detener el proceso web/API con Ctrl+C. No borrar `.local/postgres` si se quieren conservar los registros.

## Qué funciona

- Inicio y cierre de sesión con contraseña cifrada mediante scrypt, cookie HttpOnly y expiración del lado del servidor.
- Crear, listar, filtrar y cerrar obras conservando historial; bloqueo de cierre con pendientes.
- Catálogo de materiales, mano de obra y equipo.
- APU de costo directo con varios componentes, cantidades y precios guardados como instantánea; aprobación que congela la línea base.
- Órdenes de materiales con varias partidas; borrador, aprobación, recepción parcial/completa y cancelación antes de recibir.
- Recepciones que actualizan inventario; salidas a obra y costo promedio ponderado; kardex reciente.
- Registro de pagos externos, parciales o totales, limitado al valor recibido y con referencia única por orden.
- Bitácoras de texto, personal, clima e incidencias; cierre inmutable.
- Resumen, filtros por obra y exportaciones CSV compatibles con Excel. La exportación aplica el filtro de obra; los filtros locales de texto/estado solo afectan la vista.
- Auditoría en la base y comandos idempotentes; transacciones serializables con reintentos.

## Qué todavía no cubre

La primera entrega **no es el sistema completo de las 24–31 semanas del PDF**. No incluye roles granulares ni usuarios adicionales en interfaz, requisiciones, comparativos, proveedores normalizados, límites de autorización, indirectos/impuestos, revisiones presupuestales, facturas, anticipos, devoluciones, traspasos, adendas, archivos/fotos, importación XLSX, exportación PDF, trabajo sin conexión, respaldos automáticos ni despliegue remoto. Todas las acciones de esta demo corresponden a un administrador.

Los pagos son un **registro interno** y no ejecutan transferencias. El saldo por pagar se calcula sobre material recibido, no representa todavía un auxiliar fiscal de facturas. La fecha esperada de la compra no equivale a vencimiento de una factura. Las salidas se vinculan a una referencia textual; la asignación estructurada por partida es trabajo pendiente.

El listado principal carga los datos del piloto juntos; el kardex muestra los últimos 100 movimientos de la empresa. Paginación en servidor, agregados SQL, archivos, multiusuario con permisos y pruebas de volumen son requisitos antes de escalar el uso real. No existe un límite comercial de proyectos en esta versión, pero no se afirma capacidad ilimitada.

## Stack y estructura

- `apps/web`: Next.js 16 + React 19 + TypeScript; interfaz adaptable; proxy de `/api` hacia NestJS.
- `apps/api`: NestJS 11 + TypeScript, validación Zod y sesiones en base de datos.
- `prisma`: esquema relacional PostgreSQL, migración inicial y seed no destructivo.
- `tests`: cálculo decimal/contraseñas y pruebas de integración reales contra API + PostgreSQL.
- `docs/ESTADO_DEL_PROYECTO.md`: alcance implementado, decisiones y próximos hitos.

Versiones resueltas en `package-lock.json`. El servidor escucha solo en loopback. El proveedor S3, contenedores de despliegue y CI se incorporarán con la fase de publicación; no se ha creado una cuenta ni se ha publicado la aplicación.

## Verificar

```bash
npm run typecheck
npm test
npm run test:integration
npm run build
```

Las pruebas de integración arrancan una API temporal en el puerto 4101 y usan **exclusivamente `obra_control_test`**, creada en la instancia local. Reinician los registros de esa base de pruebas; no tocan `obra_control`. PostgreSQL debe estar iniciado. Validan autenticación, origen de peticiones, fechas, presupuesto congelado, idempotencia, recepciones y pagos concurrentes, stock, cierre de obra y bitácoras.

## Próximo hito

Validar esta primera versión con los formatos reales de la empresa. Luego completar roles por obra, ciclo requisición/cotización y las reglas de presupuesto antes de operar datos reales o habilitar acceso remoto. Ver el documento de estado para los criterios de salida.

### Abastecimiento y traspasos (0.2)

1. En **Abastecimiento → Planificar material**, registra obra, material, cantidad, fecha y plazo de suministro.
2. En **Almacén → Declarar sobrante**, libera la cantidad que no necesita esa obra (cero retira la liberación).
3. Vuelve a **Abastecimiento**: el faltante puede mostrar sobrantes de otra obra. **Preparar traspaso** precarga origen y destino; confirma el despacho solo cuando salga físicamente.
4. El traspaso queda **En tránsito** hasta **Confirmar recepción** por el total en destino. Luego se puede registrar consumo vinculado a la necesidad.
5. **Preparar compra** abre una orden en borrador con los datos del faltante. El usuario aún debe indicar proveedor y revisar la entrega.

La ampliación aprobada y sus fases están en `docs/AMPLIACION_DEL_PRODUCTO.md`; los límites y verificaciones, en `docs/ESTADO_DEL_PROYECTO.md`.

### Evidencia y voz en bitácoras

Guarda una bitácora para abrir su espacio de fotos/audio. Puedes indicar frente y concepto, adjuntar archivos o grabar una nota de voz. El archivo requiere descripción y confirmación antes de guardarse. Después del cierre, agrega aclaraciones mediante adendas.

La evidencia se almacena en PostgreSQL y se sirve mediante sesión autenticada (8 MB por archivo; 20 archivos y 40 MB por registro). Para transcripción opcional, configura OPENAI_API_KEY en el entorno del servidor y reinicia la API; TRANSCRIPTION_MODEL permite cambiar el modelo. Sin clave, los adjuntos y la reproducción siguen disponibles. El audio solo se envía al proveedor al confirmar la casilla y pulsar Transcribir; el texto requiere revisión antes de incorporarse como adenda.

Estado, pruebas y límites del piloto en docs/ESTADO_DEL_PROYECTO.md.

### Planos e incidencias

Desde **Planos e incidencias**, registra un PDF, selecciona una página y pulsa **Marcar incidencia**. Captura pendiente, responsable, fecha y prioridad. La lista reúne todas las revisiones del plano; seleccionar una incidencia abre su página y versión originales.

**Nueva versión** conserva las anteriores. Para resolver una incidencia se requieren una explicación y fotografías; puede reabrirse con motivo sin perder la evidencia. El CSV exporta las incidencias de la obra seleccionada o de todas las obras.

PDF: hasta 15 MB/20 páginas por revisión. El piloto admite PDF, no DWG/DXF. Los recursos del visor se copian automáticamente en predev/prebuild; ejecuta node scripts/copy-pdf-assets.mjs si ya tenías dev abierto al instalar esta versión. Aplica npm run db:migrate después de actualizar el código.

### Cambios de obra

En **Cambios de obra**, crea una solicitud con alcance, costo directo, importe al cliente y variación en días. Puedes guardar revisiones, enviar a autorización, registrar aprobación/rechazo o cancelar solicitudes no aprobadas. Una aprobación exige presupuesto base aprobado, persona que autorizó y referencia; conserva la revisión autorizada.

Presupuestos y Resumen muestran por separado la base y los ajustes aprobados. Registra avance de ejecución y cobros parciales o créditos aplicados; los registros son internos y no ejecutan operaciones bancarias. El cierre de obra verifica pendientes de decisión, ejecución y liquidación.

El piloto conserva aprobaciones declaradas por el administrador. Roles separados, firma y autorización del cliente en su portal quedan pendientes.

### Captura documental

En **Documentos**, carga PDF o foto, selecciona el original, coteja campos y relaciona cada partida con un material y su unidad. Confirma la revisión antes de aplicar: cotización → compra en borrador; remisión → recepción contra compra aprobada; factura → soporte vinculado, sin pago. Puedes corregir documentos revisados mientras no estén aplicados. El original y el historial se conservan. La captura manual funciona sin servicios externos.

La lectura automática opcional requiere `OPENAI_API_KEY` y `DOCUMENT_EXTRACTION_MODEL` en `.env`, con un modelo habilitado en tu cuenta que admita visión, PDF y Structured Outputs; reinicia la API tras configurar. La pantalla pide consentimiento para enviar cada archivo a OpenAI, que puede generar cargos. No se ha probado contra el servicio real. Documentación del proveedor: [archivos](https://developers.openai.com/api/docs/guides/file-inputs), [salida estructurada](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

Importes en MXN y precios unitarios netos; los impuestos quedan en el documento y no se agregan a las órdenes del piloto. La vinculación de factura no es validación fiscal. El portal del cliente está pospuesto.

### Biblioteca de experiencia

1. Crea un **grupo comparable** con unidad, método, condiciones y versión. Cambios de método requieren una nueva versión.
2. En una obra con presupuesto aprobado, registra la cantidad nueva ejecutada por concepto, periodo y frente. Elige prueba o ejecución real explícitamente.
3. Asigna cantidades desde salidas existentes del almacén en ese periodo. No se descuenta inventario otra vez. Para costos directos completos, captura también mano de obra/equipo/otros y referencias; horas-persona son opcionales.
4. Coteja fuentes y valida las muestras reales. Solo ellas alimentan promedios ponderados, consumos por unidad y productividad. Pruebas, anuladas y pendientes quedan excluidas.
5. Para corregir, anula con motivo y crea otra referencia. La anulación conserva historial y libera asignaciones; no devuelve material al almacén. Retirar una muestra solo la excluye de promedios.

Los promedios son referencias históricas en MXN, no rendimientos garantizados ni presupuestos nuevos. El ejemplo EXP-1 es ficticio y no alimenta la biblioteca real. Costos parciales de materiales no se comparan con el costo directo completo del presupuesto.

### Predicción y optimización de abastecimiento

1. Abre **Predicción y optimización**, selecciona obra/material y define horizonte, plazo de suministro y reserva preventiva. Pulsa **Calcular escenario**.
2. Revisa la primera brecha, la cantidad adicional y las fuentes. Con menos de 7 días observables o salidas en menos de 3 días distintos, solo se considera la planificación explícita. Sin planificación ni historia suficiente, no se puede concluir cobertura.
3. Consulta la puntualidad de proveedores y sus órdenes. Las muestras pequeñas y recepciones no conciliables se indican expresamente.
4. Ingresa cantidad/fecha y las alternativas de compra o traslado con precio, flete y soporte. Confirma los acuerdos que hayas verificado y pulsa **Comparar alternativas**. El menor costo se recomienda únicamente entre opciones completas y viables.
5. **Exportar escenario** descarga un JSON con parámetros, resultados y fuentes. El escenario es temporal; cambiar de obra o salir lo descarta. **Ir a Abastecimiento** conserva la obra elegida para continuar por los flujos habituales.

La simulación no crea operaciones ni reservas. El modelo compara planificación y continuidad del consumo, sin sumarlas. No es una predicción estadística ni una garantía de entrega; no mezcla lotes ni capitaliza flete. La historia del piloto contiene datos de demostración. No necesita proveedor externo de IA ni nuevas variables de entorno.

### Equipo, roles y permisos por obra

En **Mi empresa → Equipo y permisos**, Administración puede crear una cuenta con nombre, correo, perfil, obras y contraseña temporal (mínimo 12 caracteres). El usuario debe cambiarla en su primer acceso. No se envían correos automáticamente.

- **Administración:** todas las obras, catálogo, usuarios y operaciones.
- **Responsable de obra:** presupuestos, aprobaciones, compras, almacén y seguimiento; no pagos ni usuarios.
- **Compras:** órdenes en borrador, necesidades y documentos; no aprobación, recepción ni pagos.
- **Almacén:** recepciones, consumo, sobrantes, traspasos y necesidades.
- **Residente:** bitácoras, planos, necesidades, propuestas de cambios y registros de ejecución.
- **Finanzas:** pagos y documentos; sin crear compras ni mover inventario.
- **Consulta:** lectura y exportación.

Todos los perfiles internos pueden consultar costos de sus obras autorizadas. El catálogo de insumos y las definiciones de grupos comparables son compartidos. Sin obras asignadas, una cuenta no ve información de proyectos. Un traspaso requiere acceso a origen y destino. El catálogo, los grupos comparables y las cuentas solo se administran con el perfil Administración.

**Editar acceso** permite cambiar obras/perfil o desactivar una cuenta sin borrar historial. **Renovar contraseña** exige un nuevo cambio al ingresar. Guardar acceso o contraseña cierra las sesiones anteriores. El icono de candado de la barra superior permite cambiar la contraseña propia. No puedes quitarte tu propio acceso administrativo.

La migración `20261016020000_team_access` conserva el acceso administrativo de las cuentas existentes del piloto. Para otra instalación ejecuta `npm run db:migrate` y `npm run db:generate`. No incluye portal del cliente, correo de recuperación ni configuración de producción.

### Expediente imprimible de bitácoras

En **Bitácoras → Exportar expediente PDF**, selecciona obra y periodo, indica opcionalmente el nombre de la empresa y descarga un expediente A4. Contiene portada, índice con páginas, actividades e incidencias completas, adendas, fotografías con descripción y constancia de entrega para firmas manuscritas. Desde **Leer bitácora** también puedes descargar un registro individual.

Por defecto se incluyen solo registros cerrados; los borradores son opcionales y quedan identificados. Las fotos se orientan automáticamente y se ajustan sin recortar. Los audios se enumeran como anexos digitales; solo el texto publicado en una adenda forma parte del expediente, nunca la transcripción pendiente de revisión. No se incluyen importes del presupuesto ni información financiera.

Límites por expediente: 30 bitácoras, 100 MB de fotos originales y 400 páginas. Divide el periodo para expedientes mayores. Una foto dañada produce un error identificable; puedes corregirla o excluir expresamente las imágenes. Las descargas requieren sesión y acceso a la obra, incluidos usuarios de consulta. La exportación no modifica registros ni constituye una aprobación del cliente.

El despliegue de la API debe conservar `apps/api/assets/fonts/` junto a `dist/` (tipografía DejaVu y su licencia). La generación es local, sin enviar texto o fotografías a servicios externos. Muestra ficticia del formato: `output/pdf/Expediente_bitacoras_muestra.pdf`.

### Formato del código

Usa `npm run format` para aplicar Prettier al código, pruebas, estilos, configuración y documentación, y el formateador de Prisma al esquema. `npm run format:check` comprueba los archivos compatibles con Prettier sin modificarlos. El estilo utiliza dos espacios, comillas simples y líneas de aproximadamente 100 columnas. `.editorconfig` mantiene la indentación y los finales de línea al editar.

Se excluyen dependencias, archivos generados, entregables y migraciones ya aplicadas. El generador auxiliar de mockups en Python usa cuatro espacios y Black (`black --line-length 100 design/mockups/build.py`); los scripts Bash conservan su sintaxis y bloques con indentación legible.

### Organización por módulos

La API separa sus rutas en `apps/api/src/modules/` y la interfaz agrupa vistas, formularios y detalles en `apps/web/app/features/`. Consulta [la guía de estructura del código](docs/ESTRUCTURA_DEL_CODIGO.md) para ubicar cada responsabilidad y revisar cómo extender y verificar los módulos.
