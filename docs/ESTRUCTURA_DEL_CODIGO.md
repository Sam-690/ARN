# Organización del código

La aplicación conserva sus rutas HTTP, permisos, modelos de datos y flujos. La separación permite encontrar la vista, el formulario o la operación de cada módulo sin recorrer un archivo que contiene toda la aplicación.

## API: `apps/api/src`

- `main.ts`: arranque de Nest, cookies, sesión, límites de las solicitudes y autorización HTTP.
- `app.module.ts`: registro explícito de los controladores.
- `modules/*.controller.ts`: rutas agrupadas por dominio. Cada controlador mantiene el prefijo `/api`.
- `shared/database.ts`: configuración de entorno y única instancia de Prisma.
- `shared/commands.ts`: transacciones, idempotencia, auditoría y comprobación de obra activa. Las escrituras siguen revalidando el acceso dentro de la transacción.
- `shared/schemas.ts`: validaciones comunes de los registros básicos y selección de relaciones de compras.
- `shared/errors.ts`: traducción de errores al contrato HTTP existente.

Los controladores se organizan en autenticación (`auth`), usuarios (`users`), consulta inicial (`data`), obras (`projects`), catálogo (`catalog`), presupuesto (`budget`), compras y pagos de órdenes (`orders`), almacén y traspasos (`stock`), abastecimiento y pronóstico (`supply`), cambios (`changes`), documentos (`documents`), planos (`plans`), bitácoras (`logs`) y experiencia (`experience`).

Los archivos de dominio que ya existían en la raíz, como `forecast.ts`, `supply.ts`, `changes.ts`, `plans.ts` y `experience.ts`, conservan sus cálculos y validaciones. `access.ts` define las políticas; `security.ts`, las operaciones de credenciales; `log-report.ts`, la generación de expedientes PDF. Los controladores los utilizan sin duplicar esas reglas.

Para agregar una ruta: colócala en su controlador, define su política en `access.ts` y comprueba el flujo en las pruebas. Si creas un controlador nuevo, regístralo en `app.module.ts`. No crees otra instancia de Prisma ni una vía de escritura que omita las garantías de `command`.

## Interfaz: `apps/web/app`

- `page.tsx`: coordina sesión, carga de datos, selección de obra, navegación y apertura de diálogos.
- `shell/`: inicio de sesión, menú lateral, barra superior, contexto de obra y selección del formulario que muestra el diálogo principal.
- `features/`: carpetas por módulo con sus vistas, formularios, detalles y utilidades locales.
- `shared/navigation.ts`: destinos del menú y tipos de navegación y diálogo.
- `shared/presentation.tsx`: componentes pequeños y formatos usados por las vistas básicas.
- `shared/export-current.ts`: selección y descarga de exportaciones CSV; la opción de bitácoras abre el expediente PDF.
- `types.ts`: contratos de los datos recibidos de la API.
- `access.tsx`: contexto y comprobaciones de permisos de la interfaz.
- `entry-modal.tsx`: ventana emergente reutilizable con control de cierre y foco.
- `theme-switch.tsx` y `globals.css`: tema y estilos existentes.

### Carpetas de módulos

- `dashboard`: resumen general y por obra.
- `projects`: listado y captura de obras.
- `budget`: presupuesto, captura de conceptos y detalle APU.
- `orders`: compras, detalle de orden, captura y recepción.
- `inventory`: existencias y formulario de salida.
- `payments`: listado y captura de pagos.
- `materials`: catálogo y captura de insumos.
- `supply`: necesidades, sobrantes, traspasos y sus diálogos.
- `forecast`: parámetros, proyección, historial de proveedores y comparación de alternativas.
- `logs`: bitácoras, evidencias, grabador y exportación PDF.
- `plans`: visor, versiones, carga de planos, incidencias y seguimiento.
- `changes`: propuestas, detalle, ajustes de presupuesto y listado.
- `documents`: vista previa, revisión, aplicación y listado.
- `experience`: familias, registro, detalle y agrupación de experiencias.
- `team`: cuentas, permisos y cambio de contraseña.

Un archivo `index.ts` expone la entrada pública de los módulos que tienen varios componentes públicos. Los archivos `helpers.tsx` contienen formatos, etiquetas y pequeños componentes propios del módulo; se conservaron sus diferencias de presentación. No se unificaron formatos de fechas o importes que antes eran distintos.

Los componentes extraídos reciben datos y acciones mediante propiedades. El estado de los formularios básicos permanece en `shell/dialog-content.tsx` y el de la simulación en `features/forecast/forecast-panel.tsx`, para conservar el comportamiento al abrir, cerrar y actualizar los diálogos.

Para cambiar un formulario, busca `*-form.tsx` dentro de su módulo. Para cambiar una pantalla, busca `*-view.tsx` o `*-panel.tsx`. Reserva `page.tsx` para coordinar módulos, no para añadir sus tablas o formularios completos.

## Verificación

```sh
npm run format:check
npm run typecheck
node --import tsx --test tests/*.test.ts
npm run test:integration
npm run build
```

La prueba de políticas recorre los controladores de `modules/`, verifica que encuentra rutas, detecta duplicados y exige una política explícita para cada ruta protegida. Las pruebas de integración utilizan la base aislada `obra_control_test`; no deben ejecutarse contra la base de trabajo.

Para iniciar la aplicación se conserva el comando `npm run dev`. Esta reorganización no requiere migraciones ni nuevas variables de entorno.
