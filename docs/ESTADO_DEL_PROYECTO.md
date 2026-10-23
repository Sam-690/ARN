# Estado del proyecto

Fecha de implementación: 11 de octubre de 2026 (America/Mexico_City).

## Decisión confirmada

Una empresa, con nuevos proyectos de forma continua. Interfaz web propuesta en el planteamiento; cantidad de usuarios y operación sin conexión aún por definir. Nombre de trabajo: **Obra**, reemplazable por la identidad de la empresa.

## Entrega 0.1

Se ha construido una base ejecutable con Next.js, NestJS, Prisma y PostgreSQL; no un prototipo que guarde datos en localStorage. Cubre la infraestructura inicial y un recorrido reducido que atraviesa presupuesto, compra, recepción, inventario, pago y bitácora. No equivale a dar por terminadas las seis fases del PDF.

La aplicación es local. No se ha publicado ni configurado producción. Incluye datos demostrativos explícitamente identificados, y puede contener una obra de validación cerrada creada durante la prueba de navegador.

## Reglas aplicadas

1. Los precios y cantidades usan Decimal en la base y en los cálculos del servidor. Importes monetarios se redondean a dos decimales, mitad hacia arriba; precios unitarios a cuatro decimales. Los totales de interfaz son presentaciones orientativas en JavaScript; la confirmación de operaciones usa el servidor como autoridad.
2. Aprobar un presupuesto congela su contenido. La interfaz avisa que todavía no hay revisiones; debe usarse solo con datos de prueba hasta completar ese ciclo.
3. Las compras se aprueban antes de recibir. Las recepciones aceptan cantidades parciales y no exceden lo solicitado. Las compras de servicios quedan fuera de esta versión.
4. Cada recepción actualiza cantidad y costo promedio en la misma transacción. Las salidas no admiten inventario negativo.
5. El pago no vuelve a sumar un costo. Solo registra importe aplicado a una orden cuyo material fue recibido; la aplicación no ejecuta movimientos bancarios.
6. Una obra con compras pendientes, existencias, saldo por pagar o bitácoras en borrador no puede cerrarse. Una cerrada conserva consultas y rechaza nuevas operaciones.
7. El servidor guarda el autor de cada operación. El cliente no puede suplantar el autor de una bitácora.
8. Las operaciones de escritura llevan clave de idempotencia. Reintentos con la misma clave y datos devuelven el resultado previo; la misma clave con otro contenido se rechaza.
9. Transacciones serializables y reintentos resuelven concurrencia en los saldos. Se han probado operaciones simultáneas, no solo validaciones visuales.

## Verificación de esta entrega

- Compilación de Next.js y API: correcta.
- TypeScript: sin errores.
- 4 pruebas unitarias: decimales, promedio, separación de importes, hash de contraseña.
- 13 pruebas de integración: sesión/origen, creación idempotente, APU, congelación, autorización de compra, concurrencia de recepciones, inventario, pagos, cierre y bitácora.
- Revisión manual en navegador: inicio de sesión, alta de obra, cálculo y alta de concepto, creación de compra, navegación y comportamiento adaptable.
- Dependencias de ejecución: auditoría npm sin vulnerabilidades conocidas después de actualizar Prisma a 6.19.3 y fijar deepmerge-ts 8.0.0 en su configuración.
- Vista móvil validada a 390 px, sin desbordamiento horizontal en el tablero; menú y tablas adaptables.
- Ningún formato real de la empresa se ha recibido o validado todavía.

## Siguiente etapa de implementación

1. Completar descubrimiento con presupuesto/APU real, formatos de almacén, pagos y bitácora; decidir impuestos, rendimientos y redondeo.
2. Roles por acción y obra, separación solicitante/autorizador/tesorería; administración de usuarios.
3. Revisiones de presupuesto e indirectos; asignación de consumos a partidas y comparaciones de costo real.
4. Proveedores, requisiciones, cotizaciones, comparativo y tolerancias de recepción.
5. Facturas y cuentas por pagar, anticipos, vencimientos y reversos.
6. Devoluciones, incidencias de traspaso y fletes, inventario físico y periodos cerrados. El despacho y la recepción completa de traspasos se incorporaron en el bloque 0.2.
7. Adjuntos privados y fotos, adendas de bitácora, reportes PDF e importación/exportación XLSX.
8. Paginación y agregados en servidor, CI, respaldo/restauración, monitoreo y despliegue con TLS y credenciales propias.

La prioridad de estos puntos se validará con el usuario. La revisión de permisos, recuperación de datos y prueba piloto con responsables de negocio son condiciones para pasar de esta demostración a una operación real.

### Apariencia Noche · 12 de octubre de 2026

Se aplicó a la aplicación el diseño Noche, con paletas clara y oscura, acento lima y tipografía Manrope. El selector está disponible en el inicio de sesión y en el encabezado de todos los módulos. La preferencia se guarda por navegador (`obra-appearance`), se aplica antes del primer render y se sincroniza entre pestañas. El modo inicial es oscuro; si el almacenamiento no está disponible, el selector sigue funcionando durante la sesión.

El cambio abarca navegación, paneles, tablas, estados, formularios y diálogos. No modifica las operaciones de negocio ni los datos. Se verificaron compilación de producción, tipos, cuatro pruebas unitarias existentes y el cambio de apariencia con recarga, formularios y adaptación móvil.

## Entrega 0.2 · Abastecimiento y traspasos · 12 de octubre de 2026

Primer bloque elegido por el usuario dentro de la ampliación de ocho frentes. El resto permanece planificado en [AMPLIACION_DEL_PRODUCTO.md](AMPLIACION_DEL_PRODUCTO.md).

- Necesidades por obra/material, cantidad, actividad, fecha y plazo de suministro. Consumo vinculado y cancelación con motivo; historial consultable.
- Cobertura calculada en servidor con cantidades decimales, distribución cronológica sin doble uso de existencias/compras, exclusión de compras vencidas, tardías, borradores y canceladas. Fechas en America/Mexico_City, días naturales.
- Sobrantes declarados en Almacén, ajustables y retirables antes del despacho. No se consideran consumibles localmente mientras estén liberados.
- Sugerencia de sobrantes en otras obras y preparación de compra con obra, material, cantidad y fecha. Preparar no aprueba ni despacha automáticamente.
- Despacho y recepción completa de traspasos: estado en tránsito, referencia, autor, fechas, costo promedio de salida, incorporación ponderada al destino y kardex. No se crean compras ni pagos.
- Bloqueo del cierre con necesidades abiertas o traspasos en tránsito; operaciones serializables, idempotentes y autenticadas.
- Selector por obra, búsqueda de necesidades, exportación CSV e interfaz clara/oscura adaptable.

Validación: compilación API/web, TypeScript, 9 pruebas unitarias y 20 de integración en base aislada. Incluye competencia entre despachos, consumo simultáneo, reintentos de recepción, límites, costos y bloqueo de cierre. En navegador: creación de necesidad, liberación de sobrante, alternativas, formularios de compra/traspaso prellenados y vista móvil a 390 px sin desbordamiento horizontal.

Se conserva un ejemplo identificado como ficticio: necesidad de 100 bultos de cemento para Casa Roble el 20 de octubre y liberación de 50 bultos de Los Olivos. No se despachó material ni se creó una compra durante esa revisión visual. Las pruebas de movimiento de inventario se ejecutaron en obra_control_test.

Límites de este bloque: recepción por el total despachado; incidencias, devoluciones, cancelación posterior al despacho, flete y fechas comprometidas de traslado pendientes. La cobertura no es una reserva; si cambia el inventario, se recalcula en la siguiente carga/operación. Aún no hay predicción estadística ni notificaciones externas. Continúa el piloto local con un administrador; roles por obra y aprobaciones separadas siguen pendientes.

### Navegación entre obras · 12 de octubre de 2026

- El directorio **Obras** utiliza el listado completo de la empresa, independiente de la obra seleccionada; conserva búsqueda y filtro por estado y señala la tarjeta seleccionada.
- **Ver resumen** y las tarjetas del tablero abren el resumen de la obra, sin redirigir a Presupuestos.
- **Cambiar obra** conserva el módulo y limpia búsquedas/filtros de la obra anterior, incluido Abastecimiento. El selector siempre ofrece todas las obras y la vista conjunta.
- Una franja muestra clave, nombre, ubicación y estado; distingue módulos por obra de las vistas globales Obras y Catálogo. **Ver todas las obras** abre el directorio; **Quitar selección** vuelve a la vista conjunta conservando el módulo.
- El encabezado permanece disponible al desplazar la pantalla. El contador de compras refleja la obra seleccionada; exportar Obras usa el directorio completo. Las acciones de alta por obra se deshabilitan al consultar una obra cerrada.

Verificación: compilación web y tipos correctos. Revisión en navegador del directorio completo con una selección activa, apertura en resumen, cambio de obra dentro de Compras, restablecimiento de filtros y vuelta a todas las obras. Selector y contexto comprobados a 390 px sin desbordamiento horizontal. No se modificaron registros durante esta revisión.

## Entrega 0.3 · Bitácoras con evidencia y voz · 13 de octubre de 2026

- Frente de trabajo y concepto opcional del presupuesto, validado contra la obra en servidor.
- Al guardar un registro se abre su espacio de evidencia. Fotos JPG/PNG/WebP y audios WebM/OGG/WAV/MP3/M4A, vista previa y descripción obligatoria, autor y fecha.
- Grabación con MediaRecorder, permiso de micrófono solicitado al pulsar Grabar, detener manualmente, máximo 5 minutos/8 MB y guardado explícito. Archivos externos como alternativa.
- Adendas con autoría del servidor y fecha; el texto original permanece intacto. Después del cierre, los nuevos archivos deben pertenecer a una adenda. Obras cerradas bloquean las nuevas escrituras.
- Evidencia autenticada, sin URLs públicas, descarga parcial para audio, validación de firma de formato, hash y detección de duplicados. Listados sin bytes. Límites: 8 MB/archivo, 20 archivos/40 MB y 50 adendas por bitácora.
- Transcripción opcional: consentimiento explícito para enviar cada audio a OpenAI, resultado separado para revisión y publicación como adenda. No crea movimientos, compras ni pagos.
- Bloqueo de transcripciones simultáneas por archivo, recuperación después de 5 minutos, timeout de 90 segundos y máximo 10 intentos/hora por usuario en el proceso local.

Almacenamiento del piloto: bytes en PostgreSQL, con escritura y auditoría en la misma transacción. El respaldo debe incluir esas tablas. Pendiente para producción: almacenamiento privado de objetos, permisos por obra, cuotas por empresa, procesamiento en segundo plano y límites de transcripción compartidos entre procesos. La validación de firma no equivale a decodificar o analizar completamente el archivo.

Configuración opcional en .env del servidor: OPENAI_API_KEY y TRANSCRIPTION_MODEL (predeterminado gpt-4o-mini-transcribe). Sin clave, se guardan/reproducen audios y se indica que la transcripción no está configurada. La clave nunca se entrega al navegador. Reiniciar la API después de configurar. Referencia: https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create

Validación: 12 pruebas unitarias y 24 de integración en base aislada; tipos y compilación de producción correctos. Pruebas de transporte al proveedor con fetch simulado, sin llamadas externas. En navegador: creación con frente/concepto, imagen sintética, audio WAV de un segundo de silencio (carga y reproducción), cierre y adenda posterior. Paletas clara/oscura y móvil de 390 px sin desbordamiento horizontal del diálogo. No se probó captura con un micrófono real ni transcripción con credenciales reales.

Se conserva una bitácora marcada «Prueba de evidencia · datos ficticios» en Los Olivos, con imagen/audio sintéticos y una adenda de demostración. Capturas en output/log-review.

## Entrega 0.4 · Planos e incidencias · 15 de octubre de 2026

- Nuevo módulo en el menú, filtrado por obra y compatible con la vista conjunta de la empresa. Selector de plano con clave y obra; conserva el contexto al cambiar de proyecto.
- Planos PDF con clave, nombre y revisiones numeradas automáticamente. Cada revisión conserva archivo, hash, autor, fecha, descripción y número de páginas calculado por el servidor. No existe reemplazo ni eliminación de versiones.
- Visor PDF.js local con navegación por páginas, ampliación al 150/200 %, marcadores por página y estado. No ejecuta acciones ni presenta enlaces interactivos del PDF; el original se descarga mediante sesión autenticada.
- Ubicación con clic o porcentajes accesibles desde la esquina superior izquierda. Coordenadas normalizadas respecto de la página mostrada, con su rotación propia; el zoom no altera la posición. Cada incidencia queda ligada permanentemente a su versión y página.
- Lista de incidencias de todas las versiones del plano, búsqueda por título/folio/responsable, filtros por estado y aviso de pendientes en revisiones anteriores. Seleccionar una incidencia recupera su versión y página; acceso para volver al marcador.
- Responsable por nombre, fecha límite, prioridad y estados abierta/en atención/resuelta. Historial de comentarios, inicio, reasignación/cambio de fecha, resolución y reapertura con motivo y autoría del servidor.
- Resolver exige explicación y al menos una fotografía. Fotos e historial se conservan al reabrir. Las escrituras son idempotentes y serializables; una revisión esperada evita sobrescribir una actualización concurrente.
- Cierre de obra bloqueado mientras existan incidencias sin resolver, incluidas las de versiones anteriores. Las obras cerradas conservan acceso de lectura y rechazan cambios.
- Exportación CSV de incidencias del contexto de obras, con plano, versión, página, responsable, vencimiento, estado y prioridad.

Límites del piloto: PDF sin contraseña, 15 MB y 20 páginas por versión; 20 versiones/100 MB por plano; 100 planos por obra; 200 incidencias por versión; 100 actualizaciones y 40 MB de fotos por incidencia. Hasta 3 fotos JPG/PNG/WebP por actualización, 8 MB por foto y 12 MB en total. Los bytes se almacenan en PostgreSQL y no se incluyen en los listados JSON. Las rutas de archivos requieren sesión y verifican la relación del archivo con el plano o incidencia.

Dependencias añadidas: pdf-lib 1.17.1 para validar el PDF y sus páginas; pdfjs-dist 6.4.299 para el visor. scripts/copy-pdf-assets.mjs prepara worker, fuentes, CMaps y WASM locales antes de dev/build; no usa CDN. Los archivos generados en apps/web/public/pdfjs están excluidos de Git.

Validación automatizada: 15 pruebas unitarias y 29 de integración en obra_control_test, todas aprobadas; tipos y compilación de producción correctos. Incluye PDF inválido/límite de páginas, coordenadas y fechas inválidas, autenticación de archivos, exclusión de bytes de listados, carga idempotente, versiones concurrentes, conservación de coordenadas de origen, conflictos de seguimiento, resolución obligatoriamente documentada, reapertura y bloqueo de obra cerrada.

Validación de interfaz: plano ficticio de dos páginas, marcador en página 2, nueva versión de una página, recuperación de la incidencia en su versión anterior, resolución con imagen sintética y reapertura. Coordenadas conservadas al ampliar al 200 %. Vistas clara y oscura revisadas a 1280 px y móvil a 390 px sin desbordamiento horizontal; cambio de obra comprobado sin abandonar el módulo. Se mantiene ARQ-DEMO en Los Olivos como ejemplo, explícitamente marcado como ficticio. Capturas en output/plans-review.

Pendientes de alcance: DWG/DXF y BIM, mediciones con escala, comparación visual y traslado explícito de incidencias entre revisiones, notificaciones a responsables, usuarios/roles por obra, trabajo sin conexión, almacenamiento privado de objetos y validación de PDFs en procesos aislados para producción. La asignación por nombre no envía mensajes ni concede acceso. Este bloque no modifica presupuestos, compras, inventario o pagos.

## Entrega 0.5 · Cambios de obra · 15 de octubre de 2026

- Nuevo módulo por obra y vista conjunta, búsqueda, filtro por estado y CSV. Solicitudes con motivo y propuestas numeradas con alcance, variación de costo directo, variación del importe al cliente y días naturales.
- Estados: borrador, por autorizar, aprobado, rechazado y cancelado. Revisar un borrador o rechazo crea una propuesta nueva y conserva todas las anteriores. Una propuesta enviada se decide o cancela; una aprobada no se edita ni se cancela. Sus ajustes posteriores requieren otra solicitud.
- Registro interno de autorización con persona declarada, referencia, nota, revisión autorizada y usuario que la registró. Se exige línea base aprobada. No es una firma electrónica, aprobación autenticada del cliente ni comunicación externa.
- Solo cambios aprobados afectan el presupuesto directo ajustado y el término ajustado. Se conservan conceptos, precios y fecha base. Se impide presupuesto negativo y término anterior al inicio; validación serializable también ante aprobaciones simultáneas.
- Costo directo separado del importe comercial al cliente. Valores positivos aumentan y negativos reducen; importes con dos decimales, sin impuestos. No se calcula utilidad ni se asume que ambos importes coincidan.
- Ejecución de 0 a 100 %, corregible con motivo e historial. Cobros parciales para importes comerciales positivos; créditos aplicados para negativos. Los registros usan magnitudes positivas y descuentan del saldo absoluto aprobado; importe cero no admite cobros ni créditos.
- Referencia de movimiento única por cambio, saldo validado en servidor e idempotencia. Registros de cobro/crédito son internos: no mueven dinero, no facturan y no afectan pagos a proveedores ni inventario.
- Revisiones esperadas evitan sobrescribir avances, aprobaciones o cobros concurrentes. Todo movimiento conserva autor y fecha.
- Presupuestos y Resumen muestran base, variación aprobada, costo ajustado y fecha ajustada. Las tarjetas de obras muestran presupuesto y término ajustados; CSV de obras incluye ambos valores.
- El cierre de obra exige decidir/cancelar borradores, rechazos y propuestas pendientes, y completar ejecución y liquidación de los cambios aprobados. Obras cerradas conservan consulta y bloquean escritura.

Validación: 18 pruebas unitarias y 34 de integración en base aislada, tipos y compilación correctos. Incluye centavos, propuestas sin efecto en base, aprobación sin presupuesto, rechazo/revisión, conservación de originales, aprobaciones concurrentes con límite de presupuesto, plazo inválido, cobros duplicados/simultáneos/excesivos, créditos y cierre de obra.

Ejemplo visual: CAM-1 «Adecuación de acceso · datos ficticios» de Los Olivos, revisión 2 aprobada con autorización simulada, +15,000 MXN de costo, +18,000 MXN al cliente y +3 días; 35 % ejecutado, 6,000 MXN de cobro simulado y 12,000 pendientes. La línea base de 4,185,000 se conserva; el costo ajustado es 4,200,000. El término base 2027-04-30 se conserva; el ajustado es 2027-05-03. No representa una operación real. Capturas en output/changes-review.

Límites: 200 solicitudes por obra, 30 revisiones y 200 eventos por solicitud; cada propuesta hasta ±100 millones MXN por importe y ±3,650 días. Sigue el administrador del piloto: permisos y separación de quien solicita/quien autoriza, portal del cliente, archivos de convenio/firma, impuestos, facturación, reversos formales de cobros, conciliación bancaria y programación de actividades dependientes quedan pendientes. El término ajustado suma variaciones autorizadas; no es un cálculo de ruta crítica.

Validación visual de Cambios de obra: temas claro y oscuro revisados; vista móvil de 390 × 844 sin desbordamiento horizontal (ancho del documento: 390 px). Se restauraron el tema oscuro y el tamaño normal del navegador. Capturas en output/changes-review/cambios-claro.png, cambios-oscuro.png y cambios-movil.png.

## Entrega 0.6 · Captura de documentos · 15 de octubre de 2026

El portal del cliente queda pospuesto por decisión del usuario. Se implementó la base de captura documental en su lugar.

- Bandeja por obra, búsqueda, filtro, contadores y exportación CSV. Original privado PDF (15 MB, 20 páginas) o JPG/PNG/WebP (8 MB), conservado en PostgreSQL para el piloto. Vista PDF paginada y foto junto a los campos; descarga autenticada, sin caché. No se entregan bytes en el listado.
- Duplicados: hash global del archivo y clave normalizada de tipo/proveedor/folio al revisar. Detecta el mismo archivo aun en otra obra; escaneos diferentes se cotejan al confirmar identidad. No usa RFC ni comparación visual: variantes de nombre o folio requieren cuidado del operador.
- Lectura opcional mediante Responses API de OpenAI, con archivo base64, salida estructurada, store:false, tiempo límite de 90 segundos, consentimiento explícito por archivo y límite local de 10 lecturas por usuario/hora. OPENAI_API_KEY y DOCUMENT_EXTRACTION_MODEL deben configurarse; ambos ausentes o incompletos mantienen la captura manual disponible. No se hizo una llamada real al proveedor ni se configuraron credenciales.
- Datos extraídos separados de la revisión humana; campos ausentes, ilegibles y advertencias se conservan. Ningún material se vincula automáticamente. El operador selecciona catálogo y verifica unidades, cantidades y precios netos; conversiones se documentan en notas. En esta versión se admiten materiales y MXN. Subtotal y total, cuando se proporcionan, se cotejan con aritmética decimal. Descuentos deben resolverse en precios netos antes de aplicar.
- Revisión confirmada con autor, fecha y copia de datos. Correcciones antes de aplicar reabren la revisión conservando snapshots anteriores. Revisión optimista evita sobrescrituras. Una lectura tardía no reemplaza una revisión ya confirmada. Una nueva lectura exitosa reemplaza los campos de trabajo, previa advertencia.
- Cotización revisada crea una única compra DRAFT con precios netos y fecha esperada explícita; no aprueba la compra, recibe material ni paga. Impuestos conservados como datos documentales, no sumados a compras.
- Remisión revisada requiere compra aprobada/parcial de la misma obra y proveedor, correspondencia explícita de partidas y precios coincidentes. Las cantidades repetidas para una misma partida se agrupan. Cantidades, stock, costo promedio, movimientos, estado de compra y aplicación documental cambian en una transacción serializable e idempotente. No permite exceso ni aplicación doble.
- Factura revisada se vincula como soporte a una compra de la misma obra y proveedor; no valida CFDI ni crea recepción o pago.
- Documento aplicado queda fijo y conserva la relación con la compra. Obras cerradas permiten consulta, bloquean captura/revisión/aplicación. Los documentos pendientes no bloquean cierre de obra porque no representan compromisos; compras generadas sí siguen sus reglas existentes.

Validación: 22 pruebas unitarias y 39 de integración (61 totales), compilación y tipos correctos. Pruebas cubren archivo privado, duplicados por hash/identidad, revisión, moneda/unidad/totales, idempotencia, historial, creación de compra sin efectos anticipados, concurrencia y exceso de recepción, precio distinto, factura sin pago y obra cerrada. El adaptador de extracción se probó con respuestas simuladas, incluyendo incompleta.

Prueba visual: DOC-1 cotizacion-demo.pdf, datos ficticios de Materiales Demo, DEMO-COT-001, 10 bultos a 250 MXN, subtotal 2,500, impuestos 400 y total 2,900. Captura manual cotejada en navegador; crea OC-7 en borrador por 2,500 netos en Los Olivos, sin entrada ni pago. Se revisaron temas claro/oscuro, cambio a Norte sin abandonar Documentos y vuelta a Los Olivos. Vista móvil 390 × 844 sin desbordamiento horizontal. Capturas en output/documents-review.

Límites pendientes: no hay catálogo de proveedores/RFC, equivalencias aprendidas, lectura local OCR, XML/validación SAT, notas de crédito, múltiples órdenes por documento, importes cero, moneda extranjera, descuentos globales, reversos de recepciones ni colas persistentes. Máximo 200 documentos por obra y 100 partidas por documento. Solo existe el administrador del piloto; almacenamiento de objetos, antivirus/aislamiento de archivos y permisos por obra siguen pendientes de producción. Configurar y evaluar el proveedor con documentos representativos es necesario antes de confiar en la lectura automática.

Referencias de integración: https://developers.openai.com/api/docs/guides/file-inputs y https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses.

## Entrega 0.7 · Biblioteca de experiencia · 16 de octubre de 2026

- Nuevo módulo por obra o empresa con registros, búsqueda/filtros, CSV, detalle de fuentes y grupos comparables versionados. Cada grupo define método, unidad y condiciones; clave + versión únicos. Los grupos son globales, fijos y no infieren equivalencias por nombre. Para cambiar método o condiciones se crea otra versión.
- Cada ejecución requiere obra activa y línea base aprobada; concepto de esa obra, grupo con unidad compatible, cantidad nueva (no acumulada), frente físico, periodo hasta hoy, referencia única y confirmación. El registro conserva snapshot/hash y precio unitario de la línea base. No modifica conceptos, presupuesto, compras ni pagos.
- Asignación parcial de salidas OUT ya registradas, de la misma obra y dentro del periodo (fecha de registro en America/Mexico_City). Se conserva su costo de salida. No admite entradas ni traspasos, filas repetidas o cantidades superiores al remanente. Validación serializable e idempotente ante concurrencia. No vuelve a descontar inventario. Las asignaciones de prueba también ocupan cantidad; anular libera esa atribución, sin devolver stock.
- Previene periodos solapados para el mismo concepto/frente normalizado y tipo de dato (prueba o real), salvo anulados. Frentes físicamente distintos se registran separados; el operador debe evitar declarar dos veces la misma ejecución con nombres diferentes. Cantidades superiores a la línea base pueden registrarse: son ejecución real declarada, no una ampliación automática de presupuesto.
- Cobertura explícita: solo materiales o costo directo completo declarado. Solo este último compara el costo registrado con la línea base por cantidad ejecutada. Mano de obra, equipo y otros costos se capturan netos en MXN, con referencia de soporte si tienen importe/horas. No crea nómina, rentas ni pagos. Horas-persona opcionales: suma de horas de la cuadrilla, no duración calendario.
- Nuevos registros son por validar, con prueba por defecto. Los reales requieren validación explícita de fuentes, método y condiciones para entrar en la biblioteca. Las pruebas no pueden validarse ni convertirse en reales. Retirar una muestra la excluye de promedios pero conserva asignaciones. Anular conserva historial, excluye el registro y libera atribuciones. Para corregir se anula y crea una referencia nueva. Obras cerradas permiten consulta y bloquean acciones; experiencia no bloquea el cierre.
- Promedios ponderados por cantidad ejecutada, separados por grupo/versión/cobertura. Solo reales validados. Muestra número de registros y obras, ejecución observada, rango de costo unitario y referencias individuales. Productividad usa únicamente ejecución de registros que tienen horas, junto con número de fuentes con horas. Consumo por material divide entre toda la ejecución del grupo y muestra en cuántos registros estuvo ese material. No suma unidades distintas ni promedia costos parciales con completos. Costos nominales históricos; no hay normalización por inflación, fecha o ubicación. Con menos de tres registros se señala muestra pequeña.
- El administrador del piloto registra y valida; aún no hay separación de roles o validación documental automática. La completitud de costo y comparabilidad son declaraciones revisadas por una persona. Límites: 300 versiones de grupo, 500 ejecuciones por obra y 100 asignaciones por registro; cantidades de hasta 100 millones con cuatro decimales, rubros monetarios hasta 100 millones con dos decimales. Falta paginar históricos para producción.

Validación: 25 pruebas unitarias y 43 de integración (68 totales), tipos y compilación correctos. Cubren promedio ponderado, exclusión de pruebas/pendientes/anulados, separación de versiones/cobertura, denominador de horas, unidades y concepto, presupuesto aprobado, fuente OUT, precisión, snapshots, concurrencia/idempotencia, solapamiento, retiro y anulación sin movimientos de almacén.

Validación visual: creación de MURO-DEMO versión 1, ejecución EXP-1 en Los Olivos, referencia exp-demo-001, marcada como prueba y excluida de promedios. Periodo 2026-10-02 a 2026-10-16, 20 m² y asignación de 20 bultos desde el consumo de demostración del 11 de octubre. Costos simulados: material 4,500 + mano de obra 3,200 + equipo 600 = 8,300 MXN; 415/m²; línea base 15,600; variación -7,300. 40 horas-persona simuladas, productividad 0.5 m²/h. No se generaron nuevas salidas ni pagos. Los promedios reales permanecen vacíos. Revisión clara/oscura y móvil 390 × 844 sin desbordamiento horizontal; cambio a Norte conserva el módulo y muestra cero registros. Capturas en output/experience-review.

Siguiente bloque pendiente: predicciones y optimización de abastecimiento basadas en historia real suficiente. Portal del cliente continúa pospuesto. La extracción documental externa sigue pendiente de configuración y prueba real.

## Entrega 0.8 · 16 de octubre de 2026 · Predicción y optimización

- Nuevo módulo por obra y material, con horizonte de 1–90 días naturales, plazo declarado y reserva preventiva editable. Endpoint autenticado `POST /api/supply/forecast`; cálculo con Decimal y lectura consistente RepeatableRead. No requiere migración.
- Ritmo calculado sobre hasta 28 días completos anteriores a hoy, acotado por inicio de obra. Requiere al menos 7 días observables y salidas en 3 días distintos. Incluye días sin consumo en el divisor. Si falta historia, solo calcula la planificación; sin ambas fuentes indica que no puede proyectar.
- Demanda diaria acumulada = máximo entre necesidades abiertas pendientes y tendencia, más reserva por ritmo. No suma estimaciones de la misma demanda. Necesidades vencidas entran una vez al inicio. Stock utilizable excluye sobrantes liberados; compras aprobadas/parciales aportan solo el saldo pendiente desde su fecha esperada. Compras vencidas y traspasos en tránsito no se consideran disponibilidad. La mayor brecha diaria es el aporte adicional mínimo; una entrada posterior no elimina una falta anterior.
- Fuentes visibles: salidas, necesidades y compras con fechas/folios. Proveedores agrupados por nombre normalizado, en toda la empresa para órdenes que contienen el material. Puntualidad de entrega completa respecto a fecha esperada: completas conciliadas y pendientes vencidas son evaluables; pendientes en plazo y completas sin recibos conciliables se excluyen. Los recibos antiguos se enlazan por prefijo OC generado por el servidor, obra y conciliación de cantidades por material. Fecha de registro aproxima fecha de entrega física; no es una certificación del proveedor.
- Comparador de hasta 10 alternativas para un lote y fecha explícitos. Compra: precio cotizado más flete; traslado: costo promedio del origen más flete. Solo recomienda una alternativa con soporte y confirmación del usuario, fecha vigente/a tiempo, y sobrante publicado suficiente si es traslado. Revalida saldos al comparar; no reserva. Diferencia económica entre alternativas viables, sin presentarla como ahorro realizado.
- Escenarios temporales exportables a JSON con parámetros, fecha y fuentes. Se limpian al cambiar obra/material/parámetros; cambios en alternativas invalidan la comparación anterior. Acceso a Abastecimiento mantiene la obra analizada. No escribe órdenes, inventario, pagos ni compromisos.
- Verificación: 32 pruebas unitarias y 45 de integración (77 en total), compilación de API/web correcta. Pruebas cubren ventanas históricas, aislamiento de obra/material, insuficiencia, no doble conteo, cantidades parciales, brechas anteriores, costo/flete, fechas, sobrantes, historial desconocido, autenticación y ausencia de efectos operativos.

Límites: modelo determinista de continuidad, no aprendizaje automático ni intervalo estadístico. Las salidas del piloto pueden contener demostraciones; no se convierten en historia real certificada. No usa automáticamente rendimientos de biblioteca porque no hay todavía vínculo completo entre programa de actividades, avances y material. No combina lotes parciales ni optimiza reservas entre varias obras a la vez. No capitaliza fletes ni impuestos. Los escenarios no se persisten en base de datos. Siguientes mejoras posibles: calendario por actividad y frente, recepción con fecha física estructurada, proveedores con ID, persistencia/versionado de escenarios y distribución de lotes entre obras. Portal del cliente sigue pospuesto.

Revisión visual 0.8: escenario de cemento en Los Olivos detecta historia insuficiente sin afirmar cobertura; comparación ficticia de 10 bultos recomienda $2,400 frente a $2,750 al incluir fletes. Se revisaron ambos temas, escritorio y móvil de 390 px sin desbordamiento horizontal. Cambiar de obra mantiene el módulo y descarta el escenario anterior. Consola sin errores durante la revisión. Capturas en `output/forecast-review/`. Modificar cantidad/fecha o datos de una alternativa retira su confirmación hasta cotejarla nuevamente.

## Entrega 0.9 · 16 de octubre de 2026 · Equipo, roles y obras

- Equipo interno: Administración, Responsable de obra, Compras, Almacén, Residente, Finanzas y Consulta. Un perfil por cuenta, con varias obras asignables. Administración tiene alcance global; el resto no obtiene datos de obras sin asignación. Los perfiles internos consultan costos e información de sus obras, y el rol limita operaciones; no son perfiles de cliente ni una separación por confidencialidad financiera.
- Administración crea cuentas, edita perfil/asignaciones, desactiva sin borrar historial y renueva contraseñas temporales. Creación idempotente, revisión esperada para cambios, motivo y auditoría sin secretos. No puede desactivarse ni quitarse su propio rol; debe quedar administración activa. La migración conserva las cuentas preexistentes del piloto como administradoras y las nuevas tienen Consulta por defecto.
- Cambio de contraseña obligatorio en cuentas nuevas/renovadas, mínimo 12 caracteres, contraseña actual requerida, límite de intentos y hashes con scrypt. Todas las sesiones se revocan al cambiar acceso o contraseña. Las cuentas desactivadas no inician sesión. La pantalla de acceso dejó de publicar la contraseña inicial. No se envían invitaciones ni correos; administración entrega la contraseña temporal por un canal apropiado.
- Protección de servidor con lista explícita de rutas y permisos; rutas nuevas no se autorizan por defecto. Revalidación dentro de las transacciones serializables de escritura, incluyendo reintentos idempotentes. Lecturas de proyectos, presupuestos, compras, inventarios, bitácoras, necesidades, planos, cambios, documentos y experiencia limitadas a obras asignadas. Descargas privadas verifican pertenencia por ID antes de entregar contenido. Pronósticos y cumplimiento de proveedores consideran solo obras autorizadas.
- Traspasos: consultar y operar exige ambas obras. Sobrantes de obras no autorizadas no se exponen. Auditoría general y administración de cuentas son exclusivas de Administración. Catálogo de insumos y definiciones de grupos de experiencia son compartidos; crear o alterar el catálogo/grupos requiere Administración.
- Separación de operaciones: Compras crea órdenes pero no aprueba, recibe ni paga; Almacén recibe/consume/traspasa pero no compra/paga; Finanzas registra pagos y documentos; Residente registra seguimiento sin aprobaciones ni pagos. Responsable de obra aprueba presupuesto/compras/cambios y valida experiencia, pero no paga ni administra usuarios. Aplicar cotizaciones exige permiso de compras y aplicar remisiones exige permiso de almacén, además del permiso documental.
- Interfaz: módulo Equipo y permisos solo para Administración, información del perfil, cambio de contraseña propio y controles operativos según permisos. Formularios de acceso exponen expresamente el alcance de cada perfil y sus obras.
- Validación automatizada: 35 pruebas unitarias + 51 de integración (86). Incluyen aislamiento de consultas, acceso directo por ID, adjuntos privados, traspasos entre ámbitos, historial de proveedores, ausencia de contraseñas/hashes en respuestas y auditoría, cambio obligatorio, revocación, desactivación, perfil de consulta, revisión obsoleta y protección de administración. Se prueban en la base aislada; no se crearon cuentas ficticias en la base principal.

Límites de esta entrega: una empresa; roles globales por cuenta y asignaciones por obra, sin perfiles distintos por obra. No hay invitaciones por correo, recuperación automática, MFA, SSO ni caducidad administrativa de accesos. El catálogo compartido no es confidencial entre perfiles internos. Responsables escritos en bitácoras/planos siguen siendo nombres de referencia, no asignaciones automáticas de acceso. No se puede retirar información ya descargada; la revocación bloquea solicitudes siguientes. El despliegue de producción y respaldos continúan pendientes. El portal del cliente queda fuera del alcance actual por decisión del usuario.

Revisión de interfaz 0.9: cuenta administradora conservada, formulario de nuevo usuario con siete perfiles y selección de obras, cancelación sin crear cuentas, descripciones de permisos y acceso a cambio de contraseña. Se revisaron escritorio oscuro y móvil claro de 390 px, sin desbordamiento horizontal. Capturas en `output/team-review/`. El cambio de contraseña y los perfiles limitados se validaron mediante integración en la base aislada; no se modificaron credenciales de la cuenta principal durante la revisión visual.

## 18 de octubre de 2026 — Expediente PDF de bitácoras

- Sustituida la exportación tabular de bitácoras por un expediente A4 con portada, índice, paginación, textos completos, fotografías, adendas y constancia de entrega.
- Selección de una obra, rango de fechas, nombre opcional de empresa, fotos y borradores. Descarga individual desde el detalle.
- Fotos orientadas y ajustadas sin recortar; audios referidos como anexos digitales, sin publicar transcripciones pendientes. Registros originales intactos.
- API autenticada y limitada a obras autorizadas, 30 registros / 100 MB de fotos / 400 páginas. Fuentes locales con licencia incluida.
- Pruebas unitarias y de integración cubren paginación, fotos dañadas, fechas, filtros, usuarios de consulta y acceso entre obras. Muestra ficticia revisada visualmente en `output/pdf/Expediente_bitacoras_muestra.pdf`.

## 19 de octubre de 2026 — Retiro del módulo Asistente IA

Por decisión del usuario se revirtió la incorporación del módulo Asistente IA: navegación, interfaz, endpoint, configuración y pruebas específicas. Se conservan el expediente PDF de bitácoras, el pronóstico determinista de abastecimiento y las integraciones opcionales anteriores de transcripción y lectura documental. No se modificaron registros ni el esquema de la base de datos. La incorporación del asistente queda pospuesta.

## 19 de octubre de 2026 — Captura en ventanas emergentes

Se unificaron las capturas que aún se desplegaban en la página: documentos, planos y versiones, incidencias/seguimiento, solicitudes y acciones de cambios, grupos y ejecución de experiencia, usuarios y alternativas de abastecimiento. Usan un diálogo nativo compartido con fondo bloqueado, cierre por Escape, restauración del foco, desplazamiento interno y errores visibles dentro de la ventana. El cierre se bloquea mientras hay una operación en curso. Las altas de obras, presupuesto, compras, almacén, pagos y bitácoras conservan sus ventanas existentes. Sin cambios de API ni de datos.

Verificación: compilación y tipos correctos; apertura/cierre y validación requerida comprobados en navegador para documentos, grupos, ejecución, planos/versiones, solicitudes de cambio y usuarios. Se cancelaron las capturas de comprobación sin crear registros.
