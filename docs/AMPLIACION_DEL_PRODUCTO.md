# Ampliación aprobada · 12 de octubre de 2026

Una empresa, múltiples obras, crecimiento continuo. Se aprueban los ocho frentes propuestos. El usuario eligió abastecimiento y traspasos como primer bloque. La aprobación del alcance no equivale a que todos los módulos estén implementados.

## Orden de implementación y aceptación

1. **Abastecimiento y traspasos — base implementada.** Necesidades de material por obra, fecha y plazo de suministro; cobertura con inventario utilizable y compras aprobadas; faltantes explicables; publicación explícita de sobrantes; despacho y recepción de traspasos con costo y trazabilidad. Aceptación: los insumos no se duplican entre necesidades, una compra tardía no resuelve un faltante anterior, no se consume ni despacha más de la existencia utilizable, los reintentos no duplican movimientos, no se cierra una obra con tránsito o necesidades abiertas.
2. **Bitácora con evidencia y voz — base implementada; transcripción configurable.** Adjuntos privados, frentes y conceptos; grabación/transcripción, borrador revisable y cierre con adendas. Aceptación: la evidencia pertenece a la obra y las transcripciones no publican ni afectan inventario sin confirmación. Requiere almacenamiento de archivos, permisos y proveedor de transcripción configurado.
3. **Incidencias sobre planos — base implementada.** Versiones de planos, marcadores por página, responsable, vencimiento y evidencia de resolución. Aceptación: una nueva revisión no pierde las incidencias ni sus coordenadas de origen.
4. **Cambios de obra — base implementada.** Solicitud, propuesta de costo/plazo, autorización, revisiones y seguimiento de ejecución/cobro. Aceptación: un cambio sin aprobar no altera la línea base; todo ajuste conserva autor e historial.
5. **Portal del cliente — fuera del alcance actual por decisión del usuario.** Acceso por proyecto, publicación selectiva de avances, evidencia e hitos, aprobación de cambios. Aceptación: el servidor nunca entrega costos internos ni datos de otras obras al cliente. Requiere roles y administración de acceso antes de publicarlo.
6. **Captura asistida de documentos — base implementada; lectura automática configurable.** Remisiones y cotizaciones por PDF/foto, extracción, equivalencias de catálogo, comparación y revisión. Aceptación: detectar duplicados, conservar el original, marcar campos inciertos y confirmar antes de crear recepciones. Requiere archivos privados y proveedor de extracción configurado.
7. **Biblioteca de experiencia — base implementada.** Cantidades ejecutadas y consumos/costos asignados a conceptos, versiones y condiciones de trabajo. Aceptación: mostrar rendimientos con su fuente y tamaño de muestra; excluir datos de prueba y conceptos no comparables.
8. **Predicciones y optimización de abastecimiento — base implementada.** Sobre la planificación explícita del bloque 1, incorporar ritmos históricos, confiabilidad de proveedores, alternativas y comparación compra/traslado con flete y fechas confirmadas. Aceptación: explicar datos y supuestos y distinguir pronóstico de compromiso real.

La bitácora, las alertas, los sobrantes, los planos, los cambios, el portal, la captura documental y el aprendizaje quedan todos en alcance. Las alertas iniciales serán cálculos deterministas; las predicciones dependerán de historia de consumos y avance suficiente.

## Arquitectura

Se conserva Next.js/React para la web adaptable, NestJS para la API, Prisma y PostgreSQL para datos y transacciones. Los cálculos de cantidades/costos y validaciones residen en el servidor. Las escrituras de inventario son serializables e idempotentes. Se incorporarán almacenamiento privado de objetos y trabajos en segundo plano para documentos/audio cuando corresponda. Cada integración externa será configurable; sin credenciales el producto debe indicar que no está habilitada.

## Reglas del primer bloque

- Planificar una necesidad no compra ni reserva material. Las necesidades abiertas se evalúan juntas, por fecha, contra el saldo utilizable de cada obra/material.
- Publicar un sobrante separa esa cantidad del consumo local. Puede corregirse o retirarse antes del despacho. El despacho reduce simultáneamente existencia y cantidad liberada.
- Una cantidad en tránsito no es existencia del destino. Recibirla incorpora el costo de salida al promedio ponderado del destino. El traspaso no crea pagos ni nuevas compras.
- Las compras pendientes solo cuentan si están aprobadas y su entrega esperada no está vencida y ocurre a tiempo. Las entregas vencidas se muestran como incertidumbre; no se suponen recibidas.
- El consumo ligado a una necesidad reduce su saldo pendiente. Cancelar una necesidad no cambia inventario. El historial conserva consumos y cancelaciones.
- La sugerencia de otra obra indica sobrantes declarados; no garantiza plazo ni ahorro. Flete, logística y reprogramación se definirán en una iteración posterior.

## Estado y límites

El bloque 5 queda fuera del alcance actual por decisión del usuario. El bloque 6 tiene carga privada, revisión, equivalencias manuales y aplicación a compras/recepciones; la lectura externa requiere configuración. El bloque 7 permite registros de ejecución, asignación de consumos, costos directos declarados, versiones comparables y muestras reales validadas. El bloque 8 incorpora proyección determinista por material, puntualidad de proveedores con fuentes conciliadas y comparación de alternativas completas con flete y fechas confirmadas. No incluye todavía distribución de lotes entre obras ni programación por actividad; sus límites están en ESTADO_DEL_PROYECTO.md. El bloque 4 permite solicitudes, revisiones, registro interno de autorización, costo y plazo ajustados, ejecución y seguimiento de cobros/créditos. El bloque 3 ya permite cargar versiones PDF, ubicar incidencias, dar seguimiento, resolver con fotos y reabrir conservando historial. El bloque 2 incorpora evidencia privada, grabación de voz, adendas y una integración opcional de transcripción; no se ha probado con el servicio externo ni con un micrófono real. El bloque 1 básico quedó implementado, migrado y verificado con 9 pruebas unitarias, 20 de integración y revisión de interfaz. Sus límites operativos se detallan en ESTADO_DEL_PROYECTO.md. La aplicación sigue siendo un piloto local; publicar el portal o usar información real requiere permisos por obra, respaldo y configuración de producción.

## Base de equipo interno · 16 de octubre de 2026

Usuarios, siete perfiles internos, asignación de obras, desactivación y contraseñas temporales implementados. Los permisos se validan en API, datos y archivos; se revocan sesiones al cambiar acceso. Cada perfil interno consulta costos de sus obras y tiene operaciones delimitadas. No habilita acceso de clientes. Producción, respaldos y las ampliaciones avanzadas de predicción continúan pendientes.
