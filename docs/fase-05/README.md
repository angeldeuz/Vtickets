# Fase 05 — Experiencia pública

**Estado — 3 de noviembre de 2026:** fase completada. F05-T01 a F05-T06 cerradas. El propietario probó la web pública y confirmó que la revisión visual y la navegación con teclado están bien.

El seguimiento de mejoras visuales y contenido propio antes de abrir ventas está en [pendientes-2026-11-02.md](../pendientes-2026-11-02.md).

## Recorrido de datos

1. `frontend/src/app/page.tsx`, `eventos/page.tsx` y `eventos/[slug]/page.tsx` se ejecutan en el servidor de Next.js.
2. `frontend/src/lib/events.ts` solicita `GET /api/v1/public/events` o `GET /api/v1/public/events/{slug}` a NestJS.
3. `PublicEventsController` recibe la petición sin sesión. `PublicEventsService` lee PostgreSQL con Prisma y solo devuelve eventos `published`. La cartelera omite eventos pasados; el detalle de un evento no publicado responde `404`.
4. El servicio resta reservas y entradas vendidas al inventario de cada tipo activo. Las ventanas de venta determinan `available`, `upcoming`, `sold_out` o `closed`. Los precios se convierten de centavos a MXN antes de responder.
5. Next.js genera el HTML con fecha y hora en la zona IANA del evento. La portada pasa por `eventos/[slug]/imagen`; NestJS verifica la publicación y lee el objeto del bucket privado.

La web muestra catálogo vacío, búsqueda sin coincidencias, venta futura, agotada, terminada, evento no disponible y error de API. El detalle presenta recinto, dirección, tipos, precio y existencias. Registro, ingreso y cuenta están enlazados en la cabecera. Las compras siguen deshabilitadas hasta las fases 06 y 07.

## Verificación

- `corepack pnpm --filter @vtickets/backend test public-events`: 7 pruebas de servicio y rutas HTTP pasaron.
- `corepack pnpm --filter @vtickets/frontend test`: 3 pruebas existentes pasaron.
- `corepack pnpm --filter @vtickets/frontend build`: compilación y tipos pasaron.
- API local con PostgreSQL de desarrollo: `GET /public/events` devolvió el evento publicado `concierto-recodo`; el detalle devolvió categoría, recinto, portada y boleto; el slug inexistente respondió `404`; la portada respondió `200 image/jpeg`.
- Next.js local: inicio, catálogo, detalle y portada respondieron `200` con el evento real.
- Capturas a 1440, 768 y 390 px confirmaron la composición responsive. La inspección de diseño aún reporta pocos recursos visuales para una cartelera con un solo evento y movimiento limitado. La portada cargada para el evento es una ilustración genérica; conviene sustituirla por material propio antes de abrir ventas.

No se instalaron dependencias ni se modificó el esquema de PostgreSQL.
