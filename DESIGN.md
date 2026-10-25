---
name: Vtickets
description: Cartelera local con compra de entradas clara y confiable
colors:
  canvas: "#F3F5F3"
  surface: "#FFFFFF"
  ink: "#0D1F2D"
  muted: "#536373"
  line: "#D7DEE0"
  coral: "#FB705D"
  coral-text: "#B63F30"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Arial, sans-serif"
    fontWeight: 600
    lineHeight: 1.03
    letterSpacing: "-0.04em"
  body:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "8px"
  panel: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-highlight:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
---

# Dirección de diseño de Vtickets

**Estado:** dirección definida e implementada en la vista previa pública el 25 de octubre de 2026 (portada, catálogo y detalle). Las pantallas futuras deben seguir estos tokens. [PRODUCT.md](PRODUCT.md) conserva los hechos del producto y [la revisión](docs/design/revision-inicial.md) registra la evidencia visual.

## Overview

**Concepto: «Boleto claro, ciudad viva».** La interfaz toma del boleto su forma de ordenar información: nombre del evento, fecha, recinto, tipo de entrada y precio total se leen de un vistazo. La cartelera muestra la energía cultural de Saltillo mediante el contenido de cada evento, sin ocultar datos de compra bajo decoración. La prioridad elegida por el propietario es **comprar entradas con confianza**.

La portada atrae y orienta; el catálogo ayuda a comparar; el detalle permite decidir. Administración, área del cliente y scanner heredan los mismos tokens, con menos expresión gráfica y mayor densidad funcional. El motivo del boleto se usa una vez como firma visual y, en el resto de la interfaz, solo donde ayuda a agrupar datos.

## Colors

- `ink` es el color de texto y de las acciones principales; `canvas` y `surface` separan páginas y paneles.
- `coral` identifica una acción destacada o una pieza visual de evento. El texto pequeño sobre superficies claras usa `coral-text`, no el coral brillante.
- `muted` sirve para metadatos legibles y `line` para divisiones discretas. No codificar estado, precio o disponibilidad solo mediante color.
- Los pares `ink`/`canvas`, `muted`/`canvas`, `coral-text`/`canvas` e `ink`/`coral` superan 4.5:1 en la comprobación inicial de contraste. Revalidar cualquier combinación nueva en pantalla.

## Typography

- Bricolage Grotesque da carácter a titulares cortos y nombres de eventos; DM Sans mantiene legibles descripción, navegación, formularios y datos de compra.
- Usar títulos en estilo oración, con un solo `h1` por página. Evitar etiquetas en mayúsculas sobre cada sección y frases genéricas que no informan sobre el evento.
- Escala objetivo: cuerpo 16–18 px, metadatos 14 px, ayudas nunca menores de 13 px, título de evento 36–64 px según ancho. Precio y fecha deben destacar por peso y posición, sin competir con el título.
- Los importes alineados en tablas o resúmenes usan números tabulares. Las fechas y los precios se formatean en español de México y MXN.

## Layout

- Contenedor máximo de 1180 px, márgenes de 24 px en escritorio y 16 px en móvil. La composición crece por contenido y admite títulos y nombres de recintos largos sin recortarlos.
- **Portada:** encabezado compacto; promesa concreta y acceso al catálogo arriba; un evento real destacado con fecha, recinto y precio total visibles. Si solo hay datos de demostración, mantener el aviso explícito.
- **Catálogo:** búsqueda y filtros cerca del encabezado de resultados; tarjetas con título legible, fecha, lugar, disponibilidad y precio «desde» si existe. Las ilustraciones no llevan texto superpuesto sobre formas que reduzcan contraste.
- **Detalle:** título, fecha, hora local, recinto y precio antes de repetir descripción. En escritorio, información y selección de entradas comparten el primer tramo de lectura; en móvil, el resumen de entradas sigue de cerca al título y no exige recorrer una imagen alta.
- Los filtros y la búsqueda permanecen representados en la URL. Los estados vacío, agotado, de error y de demostración indican el siguiente paso disponible.

## Elevation & Depth

La jerarquía se construye con superficies, espacio y tipografía. Reservar una sombra tenue para el panel de compra o un elemento flotante que realmente lo necesite; evitar sombra en cada tarjeta. Las piezas de arte de eventos son campos de color o imágenes aportadas y autorizadas, con una sola regla de tratamiento por conjunto.

## Shapes

Controles de 8 px y paneles de 12 px de radio. La muesca o perforación de un boleto puede aparecer en la pieza principal o en un resumen de compra; no repetirla como adorno en cada tarjeta. Los iconos acompañan datos y acciones concretas y nunca sustituyen una etiqueta necesaria.

## Components

- **Botón principal:** fondo `ink`, texto blanco, verbo específico y área táctil mínima de 44 × 44 px. El coral se reserva para una acción destacada por vista; no compiten varias llamadas con el mismo peso.
- **Tarjeta de evento:** título y datos fuera del arte, área completa enlazada, estados de hover y foco visibles, texto que envuelve sin desbordamiento.
- **Resumen de entradas:** tipo, disponibilidad, precio total y estado de venta juntos; compra deshabilitada explica cuándo estará disponible, sin parecer una acción activa.
- **Navegación:** nombre visible también en móvil; enlaces y controles alcanzables por teclado; enlace «Saltar al contenido» al inicio del documento.
- **Movimiento:** solo comunica una respuesta o cambio de estado. Transiciones breves de opacidad o transformación (aprox. 150–200 ms); ninguna animación de lectura continua ni desplazamiento obligatorio. Respetar `prefers-reduced-motion` y evitar movimiento en acciones frecuentes del scanner.

## Do's and Don'ts

- Mostrar «precio total» y disponibilidad con texto; distinguir un evento de demostración de uno publicado.
- Usar hechos reales del evento y material visual con origen claro. Si no hay fotografía, usar una composición tipográfica limpia sin simular una foto del evento.
- Comprobar portada, catálogo y detalle a 390, 768 y 1440 px antes de dar por aplicada esta dirección. Revisar foco por teclado, contraste y movimiento reducido.
- Evitar cifras inventadas, testimonios sin fuente, arte que tape títulos, duplicación de descripción, títulos cortados y llamadas a compra que aún no funcionan.
