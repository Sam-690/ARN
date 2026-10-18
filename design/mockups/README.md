# Propuestas visuales · Obra

Mockups aislados, sin conexiones a la API ni a PostgreSQL. No se modificaron `apps/web`, `apps/api` ni las reglas del sistema.

1. **Plano:** fondo claro, azul, navegación lateral y tablas compactas. Adecuado para uso operativo intensivo.
2. **Estudio:** fondo marfil, terracota y olivo, títulos serif, navegación horizontal y tarjetas de proyectos. Una presencia más editorial.
3. **Noche:** fondo grafito, acento lima, navegación lateral y superficies oscuras. Una dirección técnica con indicadores destacados.

La galería permite comparar Resumen y Compras en las tres propuestas. Los controles restantes son representaciones visuales; no son nuevas funciones. Todos los importes son datos ficticios ya utilizados en la demostración inicial, sin la obra de QA.

Abrir `index.html` o servir esta carpeta con `python3 -m http.server 3001 --bind 127.0.0.1 --directory design/mockups` desde la raíz. La galería escala los diseños de escritorio para compararlos en el panel; la adaptación final de cada pantalla y dispositivo se implementará una vez elegido el estilo.

`build.py` genera las tres páginas a partir de contenido compartido. `style.css` contiene las tres direcciones. `view.js` permite alternar únicamente las vistas de mockup. No se necesita instalar dependencias; las fuentes web tienen alternativas del sistema.

## Claro y oscuro

La propuesta Noche admite dos apariencias con la misma distribución y los mismos datos. El selector está disponible tanto en la galería como en la cabecera del mockup. La preferencia se conserva en localStorage bajo una clave exclusiva de los mockups; no cambia la aplicación real.
