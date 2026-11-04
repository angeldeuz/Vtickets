# Fase 06 — Reservas, checkout y compras

**Estado:** completada el 3 de noviembre de 2026. F05 ya está cerrada por confirmación del propietario.

## Primer corte

- `POST /api/v1/reservations` exige sesión con rol `CLIENTE`, `Idempotency-Key` y selección de 1 a 4 entradas. El backend rechaza tipos duplicados, cantidades no enteras, campos ajenos y cantidades que superan el límite general.
- `ReservationsService` prepara una transacción corta que bloquea evento, usuario, reservas vencidas e inventarios en un orden estable. Calcula precios e importes en centavos desde la base de datos y comprueba stock y límites por cliente.
- `GET /api/v1/reservations/{id}` y `DELETE /api/v1/reservations/{id}` consultan y liberan solo reservas propias. El worker intenta reconciliar reservas vencidas al reiniciar y durante su ciclo normal.
- `POST /api/v1/reservations/{id}/checkout` prepara una compra única desde una reserva propia y vigente; copia importes y cantidades ya fijados por el servidor. `GET /api/v1/purchases/{id}` devuelve el resumen solo a su propietario. `checkoutUrl` permanece `null` hasta integrar Stripe en F07; ninguna ruta declara la compra pagada.

## Interfaz y comportamiento

- El detalle público permite seleccionar cantidades por tipo, hasta cuatro entradas por evento. NestJS vuelve a validar límites, disponibilidad y precios.
- La compra pendiente muestra el detalle a precio fijado, el vencimiento y una opción para cancelar y liberar entradas. El pago sigue deshabilitado hasta F07.
- El catálogo descuenta solo reservas activas y vigentes, aunque el worker esté detenido. El worker libera contadores y cancela compras pendientes vencidas al reiniciar o en su siguiente ciclo.

## Verificación

- `corepack.cmd pnpm --filter @vtickets/backend db:verify-f06` ejecuta tres pruebas con PostgreSQL real. Una transacción que se revierte verifica reserva, límite, idempotencia, precio fijo, cancelación y expiración sin dejar datos. Dos conexiones prueban el bloqueo de la misma fila de inventario.
- La prueba en `Vtickets-pruebas` crea fixtures aislados y los borra al terminar. Dos clientes compiten por la última entrada: uno reserva y el otro recibe `SOLD_OUT`. Dos solicitudes concurrentes del mismo cliente respetan el límite. Dos checkout concurrentes producen una sola compra. La expiración libera una sola vez.
- Las 64 pruebas de backend, las 5 de frontend y los builds de ambas aplicaciones pasaron. La prueba de catálogo comprueba que el contador de reservas vencidas no reduzca la disponibilidad pública.
- Playwright MCP abrió el build de producción en escritorio y móvil. Verificó el selector, el error por cantidad cero con foco y `aria-invalid`, la conservación de la selección sin sesión, el retorno al evento tras iniciar sesión, la compra pendiente con contador y precio fijado, la cancelación y el estado posterior. Una cuenta temporal y sus datos de negocio se eliminaron al terminar. El inspector anterior falló con `CDP timeout`, pero la revisión visual se completó con Playwright.
