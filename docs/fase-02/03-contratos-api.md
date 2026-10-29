# Contratos REST del MVP

**Estado:** diseño de F02-T06 y F02-T07, pendiente de validación OpenAPI al crear NestJS. Base: [permisos](../fase-01/02-permisos.md), [estados](../fase-01/03-estados-y-reglas.md) y [transacciones](02-transacciones.md). Todas las rutas de negocio tienen prefijo `/api/v1`. Los nombres de propiedades HTTP usan `camelCase`; el backend traduce al esquema SQL en `snake_case`.

## Convenciones

- JSON UTF-8. Identificadores opacos UUID. Importes enteros en centavos (`priceCents`, `totalCents`), moneda fija `MXN`; no se aceptan precios o totales calculados por el navegador en operaciones de compra.
- Fechas de respuesta en ISO 8601 con zona `Z`; las fechas locales que ingresa el administrador incluyen `timezone` IANA y se convierten en servidor a instantes inequívocos. Un instante local ambiguo o inexistente se rechaza.
- Rutas con sesión usan `Authorization: Bearer <access_token>` emitido por Supabase Auth. NestJS verifica firma, emisor, audiencia y expiración, busca el perfil y consulta roles/asignaciones actuales. Una sesión válida por sí sola no autoriza recursos ajenos.
- Escrituras sensibles (`POST` de reservas, checkout, reembolsos y validaciones de acceso) requieren `Idempotency-Key` opaca de 8 a 128 caracteres. La misma clave, usuario y contenido devuelve el resultado guardado; otro contenido con la misma clave produce `409 IDEMPOTENCY_CONFLICT`. El webhook usa el identificador único del proveedor, no una cabecera del navegador.
- Listados usan `limit` de 1 a 50 (20 por defecto) y `cursor` opaco, estable por `(createdAt, id)` o `(startsAt, id)` según el recurso. Respuesta: `{ "items": [...], "nextCursor": "..." }`; `nextCursor: null` cierra la lista. El cursor incluye filtro y orden para impedir reutilización en otra consulta.
- No se retornan secretos de pago, credenciales QR en listados públicos, `safe_payload` de webhooks, datos de auditoría al cliente ni perfiles completos al scanner.

## Identidad y perfil

Registro, inicio de sesión, cierre de sesión, recuperación y renovación pertenecen a Supabase Auth. El frontend llama sus APIs oficiales; NestJS no almacena contraseñas ni crea un segundo emisor de tokens. Al primer acceso autenticado, el backend crea o recupera `usuarios` por `auth_user_id` y asigna el rol `CLIENTE` de forma idempotente. Los códigos existentes son `CLIENTE`, `ADMINISTRADOR` y `ACCESO`. El administrador inicial se provisiona por procedimiento separado y auditado.

| Método y ruta | Rol | Solicitud | Respuesta |
|---|---|---|---|
| `GET /me` | Autenticado | — | `200` `{ id, fullName, phone, avatarUrl, roles, status }` del perfil propio. |
| `PATCH /me` | Autenticado | `{ fullName?, phone?, avatarUrl? }` | `200` perfil actualizado; campos de rol, estado y Auth no son editables. |
| `GET /me/roles` | Autenticado | — | `200` roles vigentes y asignaciones de eventos propias, con alcance mínimo. |

Un perfil suspendido o eliminado recibe `403 ACCOUNT_INACTIVE` en operaciones de negocio. El alta no confía en `user_metadata` para asignar permisos.

## Catálogo público

| Método y ruta | Solicitud | Respuesta |
|---|---|---|
| `GET /events` | `city?`, `category?`, `from?`, `limit?`, `cursor?` | `200` lista de eventos `published`, ordenada por `(startsAt, id)`, con título, resumen, recinto, portada y precio desde. |
| `GET /events/{slug}` | — | `200` detalle público con `id`, título, descripción, zona horaria, fechas, recinto, imágenes y tipos vendibles con disponibilidad calculada. `404` para borrador u otro evento no público. |
| `GET /categories` | — | `200` categorías activas. |

`AGOTADO` se calcula a partir de tipos vendibles e inventario; no se toma de una etiqueta persistida del evento. La disponibilidad mostrada es informativa hasta que la reserva se confirma.

## Administración de eventos

Todas las rutas de esta sección requieren rol `administrador` confirmado en el backend. Las modificaciones relevantes registran actor, antes/después permitido y motivo en auditoría.

| Método y ruta | Solicitud principal | Respuesta |
|---|---|---|
| `GET /admin/categories` y `GET /admin/venues` | `limit?` (1–100, por defecto 50), `cursor?` UUID | `200` `{ items, nextCursor }`, ordenados por `id`. |
| `POST /admin/categories` y `PATCH /admin/categories/{id}` | Nombre, slug, descripción, activo. | `201` o `200`; `409` por slug repetido. |
| `POST /admin/venues` y `PATCH /admin/venues/{id}` | Dirección, ciudad, país, zona IANA y capacidad. | `201` o `200`. |
| `POST /admin/events` | `{ title, slug, categoryId, venueId, description, startsAt, endsAt, timezone, capacityLimit }` | `201` evento `draft`. |
| `GET /admin/events` y `GET /admin/events/{id}` | Filtros de estado, cursor. | `200` eventos con datos internos autorizados. |
| `PATCH /admin/events/{id}` | Campos editables; versión o precondición para evitar pérdida de cambios. | `200` borrador actualizado; `409` si cambió el recurso. |
| `POST /admin/events/{id}/publish` | — | `200` estado `published` tras validar datos, tipos y ventanas. |
| `POST /admin/events/{id}/suspend` y `/resume` | `{ reason }` para suspensión. | `200` transición válida; `409 INVALID_STATE_TRANSITION` en otro estado. |
| `POST /admin/events/{id}/cancel` | `{ reason }` | `202` evento cancelado y trabajos de reembolso encolados; no declara devolución completada. |
| `POST /admin/events/{id}/ticket-types` y `PATCH /admin/ticket-types/{id}` | Nombre, precio en centavos, cantidad, límites y ventana. | `201` o `200`; rechaza reducir stock bajo reservas o ventas comprometidas. |
| `POST /admin/events/{id}/images` y `DELETE /admin/events/{id}/images/{imageId}` | Referencia a objeto subido mediante flujo autorizado de Storage, alt y orden. | `201` o `204`. La URL de carga se obtiene por un endpoint autorizado cuando se implemente Storage. |
| `POST /admin/events/{id}/staff` | `{ userId, roleCode: "ACCESO", startsAt?, endsAt? }` | `201` asignación; duplicado idempotente o `409` si incompatible. |
| `PATCH /admin/events/{id}/staff/{assignmentId}` | Estado y vigencia. | `200`; retirar acceso tiene efecto en la siguiente validación. |
| `GET /admin/events/{id}/sales` | Cursor y filtros. | `200` resumen y compras del evento, sin secretos de pago. |
| `GET /admin/audit` | Cursor, actor, entidad, fecha. | `200` auditoría paginada. |

## Reserva, checkout y compras del cliente

Requieren rol `cliente`, incluso si la misma cuenta tiene otros roles. Los identificadores de cliente se toman de la sesión; no se aceptan en el cuerpo.

| Método y ruta | Solicitud principal | Respuesta |
|---|---|---|
| `POST /reservations` | `{ eventId, items: [{ ticketTypeId, quantity }] }` + `Idempotency-Key` | `201` `{ id, status: "active", expiresAt, currency: "MXN", items: [{ ticketTypeId, quantity, unitPriceCents, lineTotalCents }], totalCents }`; `409 SOLD_OUT` o `LIMIT_EXCEEDED`. |
| `GET /reservations/{id}` | — | `200` solo propietario; estado y tiempo restante calculado desde `expiresAt`. |
| `DELETE /reservations/{id}` | — | `204` libera una reserva propia activa; repetir no descuenta de nuevo. |
| `POST /reservations/{id}/checkout` | `Idempotency-Key` | `201` `{ purchaseId, status: "awaiting_payment", checkoutUrl, expiresAt }`; URL de Stripe sandbox obtenida fuera de la transacción. |
| `GET /purchases` | `limit?`, `cursor?` | `200` compras propias resumidas. |
| `GET /purchases/{id}` | — | `200` compra propia con detalles, pago y reembolso resumidos; `404` para recurso ajeno. |
| `GET /purchases/{id}/tickets` | — | `200` tickets propios solo tras pago confirmado y emisión; credencial QR se recupera por ruta protegida individual. |
| `GET /tickets` y `GET /tickets/{id}` | Cursor en listado. | `200` tickets propios, estado y evento; recurso ajeno da `404`. |
| `GET /tickets/{id}/credential` | — | `200` credencial de uso personal con `Cache-Control: no-store`; nunca se expone en catálogos o logs. |

## Pagos, webhooks y reembolsos

| Método y ruta | Acceso | Solicitud y respuesta |
|---|---|---|
| `POST /webhooks/stripe` | Público en red; autenticado por firma Stripe sobre el cuerpo original. | `200` al aceptar evento nuevo o repetido. Firma inválida: `400`. El navegador no puede confirmar una compra con esta ruta. |
| `GET /admin/purchases/{id}/payments` | Administrador | `200` intentos y estados, sin datos sensibles del proveedor. |
| `POST /admin/purchases/{id}/refunds` | Administrador + `Idempotency-Key` | `{ amountCents?, reason }`; `202` `{ refundId, status: "requested" }`. Solo importe elegible y reglas de evento cancelado o cobro tardío; ticket usado requiere revisión manual. |
| `GET /admin/purchases/{id}/refunds` | Administrador | `200` historial y suma confirmada o pendiente. |
| `POST /admin/refund-reviews/{id}/decision` | Administrador + `Idempotency-Key` | `{ decision: "approve" | "reject", reason }`; `200` decisión auditada. |

La respuesta de checkout no prueba que el pago se confirmó. La compra cambia a pagada solo tras webhook verificado y conciliado. Si llega después de expirar la reserva, la respuesta pública sigue sin tickets y el reembolso queda pendiente hasta confirmación del proveedor.

## Scanner y accesos

El personal requiere asignación activa al evento en cada petición. La API devuelve datos mínimos: resultado, hora y referencia corta; nunca datos completos del comprador.

| Método y ruta | Solicitud | Respuesta |
|---|---|---|
| `POST /events/{eventId}/scans` | `{ credential, attemptId }` + `Idempotency-Key` | `200` `{ attemptId, result, scannedAt, ticketCode? }`. `result` es `valid`, `already_used`, `unknown`, `invalid`, `revoked`, `cancelled`, `refunded`, `wrong_event` o `unauthorized`. Un rechazo de QR se expresa como resultado; una falta de permiso del operador devuelve `403`. |
| `GET /events/{eventId}/scans/{attemptId}` | — | `200` resultado propio de ese intento, para recuperar una respuesta perdida. |

`attemptId` será el UUID de `historial_escaneos.id`, suministrado por el cliente y validado por el servidor, para consultar un resultado ya persistido sin volver a consumir el QR. Su clave primaria evita duplicar el intento. El servidor vincula el intento al operador autenticado y al evento; otro operador no puede consultarlo.

## Validación y errores

El backend rechaza propiedades desconocidas, UUID mal formados, cantidades no enteras, textos fuera de longitud, fechas inválidas, zonas horarias desconocidas y estados que el cliente no puede escribir. Las reglas de compra se vuelven a evaluar dentro de la transacción. No se aceptan `userId`, `status`, `priceCents` ni `totalCents` del navegador para fijar propiedad, pago o precio.

```json
{
  "error": {
    "code": "SOLD_OUT",
    "message": "Ya no hay entradas disponibles para esa selección.",
    "details": {},
    "requestId": "req_..."
  }
}
```

| HTTP | Uso |
|---|---|
| `400` | JSON incorrecto, firma de webhook inválida o cursor incompatible. |
| `401` | Falta token o el token no es válido. |
| `403` | Rol, asignación o estado de cuenta insuficiente. |
| `404` | Recurso inexistente o ajeno; evita revelar su existencia. |
| `409` | Estado incompatible, idempotencia conflictiva, inventario agotado o límite excedido. |
| `422` | Campo válido en sintaxis pero incompatible con reglas de fecha, precio o capacidad. |
| `429` | Límite de intentos; incluir `Retry-After`. |
| `500` | Error inesperado con `requestId`; sin detalles internos ni secretos. |

Las respuestas repetidas de una operación idempotente conservan su código y cuerpo originales. El `requestId` aparece también en logs estructurados. Las rutas de catálogo y administración usan paginación por cursor; las de detalle no devuelven arreglos sin límite.
