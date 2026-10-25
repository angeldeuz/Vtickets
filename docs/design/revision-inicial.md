# Revisión visual inicial

**Fecha:** 25 de octubre de 2026. **Alcance:** portada, catálogo y detalle de la vista previa Next.js. Se inspeccionaron el código y capturas locales a 1440 × 1000 y 390 × 844 px. La dirección resultante está en [DESIGN.md](../../DESIGN.md); los hechos del producto están en [PRODUCT.md](../../PRODUCT.md).

## Lectura del producto

El catálogo real de Vtickets comenzará en Saltillo y mostrará precios finales en MXN. El propietario eligió **comprar entradas con confianza** como prioridad. El frontend actual es una demostración con eventos de Ciudad de México y compra deshabilitada; no se evaluó como un checkout terminado.

Las skills de diseño usadas para esta revisión fueron `frontend-design`, `design-taste-frontend`, `impeccable` y `web-design-guidelines`. La exploración de Taste Skill propuso una página inspirada en un objeto impreso; se retuvo el **boleto como estructura de información**, porque pertenece al producto. Se descartaron el rosa como color dominante, el carrusel de fotografías y un pie animado: el proyecto ya tiene azul/coral reconocibles, no tiene fotografías propias y la tarea principal exige lectura estable. Impeccable detectó el uso repetido de Space Grotesk; el nuevo sistema propone Bricolage Grotesque para titulares y conserva DM Sans para lectura. La guía de interfaz de Vercel orientó las comprobaciones de foco, navegación, movimiento y desbordamiento.

## Hallazgos priorizados

| Prioridad | Evidencia | Consecuencia | Decisión para implementación |
|---|---|---|---|
| Alta | `frontend/src/app/globals.css:5` y `frontend/src/app/globals.css:6`: a 390 px, la portada y el detalle cortan titulares, aviso, navegación y arte por el borde derecho. | Se pierde información y la interfaz parece rota en móvil. | Corregir anchos mínimos y desbordamiento de grid/flex; probar 390, 768 y 1440 px antes de añadir pantallas. |
| Alta | `frontend/src/app/globals.css:3`: las formas oscuras del póster y las tarjetas atraviesan el texto; se confirmó en capturas de portada, catálogo y detalle. | Nombres de eventos difíciles de leer. | Dejar el nombre y los datos fuera de la ilustración o asegurar un campo de contraste estable. |
| Alta | `frontend/src/app/layout.tsx:14` y `frontend/src/app/globals.css:3`: no hay enlace para saltar al contenido y los enlaces carecen de una regla general `:focus-visible`. | Recorrido por teclado poco claro. | Añadir salto a `<main>` y foco visible consistente para enlaces, botones y filtros. |
| Media | `frontend/src/app/page.tsx:13` y `frontend/src/app/eventos/[slug]/page.tsx:19`: la portada prioriza frases generales y ornamento; en el detalle, precio y tipos de entrada quedan bajo el primer tramo visual. | Cuesta verificar rápidamente qué evento se ofrece y cuánto cuesta. | Mostrar evento, fecha, recinto, precio total y estado de venta antes de las descripciones largas. |
| Media | `frontend/src/app/eventos/page.tsx:17`: los enlaces de categoría reconstruyen la URL sin el término `q`. | Se pierde la búsqueda al filtrar. | Conservar búsqueda y categoría juntas en la URL. |
| Media | `frontend/src/components/site-header.tsx:13` y `frontend/src/app/globals.css:3`: en móvil el texto del enlace de acción se lleva a `font-size: 0`. | El significado de la acción depende solo del icono. | Mantener una etiqueta corta visible y revisar el espacio del encabezado. |
| Media | `frontend/src/app/globals.css:3`: hay movimiento en botones y tarjetas sin variante de `prefers-reduced-motion`. | La preferencia del usuario no se respeta. | Definir animación breve y opcional; quitar desplazamientos cuando se solicita menos movimiento. |
| Baja | `frontend/src/app/page.tsx:13`: el arte, las cifras de pasos y las etiquetas en mayúsculas se repiten en varias secciones. | La portada pierde jerarquía y especificidad local. | Reservar una pieza gráfica memorable y usar titulares y datos propios de los eventos. |

## Secuencia de aplicación

1. **Antes de ampliar F03:** corregir el recorte móvil, el foco y el salto al contenido; introducir tokens compartidos de [DESIGN.md](../../DESIGN.md) en el frontend. Son fundamentos de cualquier pantalla nueva.
2. **F04 y F05:** ajustar portada, catálogo, tarjetas y detalle con eventos publicados y material visual autorizado. Conectar búsqueda, filtros y disponibilidad a la API sin usar cifras de demostración como prueba comercial.
3. **F06–F09:** aplicar la misma jerarquía a reserva, pago, Mis Tickets y scanner; mantener la interfaz del personal sobria y rápida. Diseñar animaciones solo para cambios de estado que las necesiten.

## Aplicación posterior — 25 de octubre de 2026

Se implementó la dirección en la portada, el catálogo y el detalle de la vista previa. El evento destacado y las tarjetas muestran título, fecha, lugar y precio total fuera del arte; el detalle coloca los tipos de entrada junto a los datos del evento. La búsqueda conserva la categoría y los filtros conservan la búsqueda. Se añadieron el salto al contenido, foco visible, etiquetas móviles y una variante de movimiento reducido. Los avisos identifican los datos de demostración y la compra deshabilitada.

Se verificaron compilación y tipos del frontend, además de capturas locales de escritorio y móvil. La implementación visual no completa las funciones de F03 a F05 ni habilita venta de entradas.

## Límites de la revisión inicial

Se verificó el render estático de tres rutas y se ejecutó el detector de Impeccable sobre `frontend/src`; ese detector señaló dos ocurrencias de Space Grotesk en el diseño anterior. No se realizaron pruebas completas de teclado, lector de pantalla, formularios ni compra, pues esos flujos todavía no existen. Las capturas son locales y no se guardaron como activos del producto.
