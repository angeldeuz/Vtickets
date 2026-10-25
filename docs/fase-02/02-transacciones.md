# Transacciones e invariantes de concurrencia

Este diseño desarrolla F02-T02 y F02-T04 a partir de las reglas aprobadas en [fase 01](../fase-01/03-estados-y-reglas.md). Son operaciones del backend y del worker; el navegador no modifica estas tablas directamente. Cada llamada externa a Stripe o correo ocurre **fuera** de una transacción PostgreSQL.

## Orden de bloqueo

Cuando una operación necesita varias filas, usa este orden: `eventos` (lectura bloqueada compatible para compras; escritura al cancelar) → `usuarios` comprador → `reservas` → `inventarios` por `ticket_type_id` ascendente → `compras` → `pagos` → `tickets` → `accesos`. Los identificadores necesarios se descubren con una lectura previa sin bloqueo y se vuelven a comprobar después de adquirirlos. Los reintentos de una transacción abortada por deadlock o serialización deben ser acotados y usar la misma clave de idempotencia.

No se bloquea toda la tabla. Las transacciones deben ser cortas y tener tiempo máximo; el código no debe esperar una llamada HTTP mientras conserva bloqueos. La cancelación de un evento cambia su estado en una transacción corta y encola los reembolsos; el worker procesa las compras afectadas por lotes después.

## Crear reserva

1. Autenticar y autorizar el rol de cliente. Validar 1 a 4 entradas totales, cantidades positivas, tipos del mismo evento y clave de idempotencia.
2. Buscar la respuesta de una solicitud previa con `(user_id, idempotency_key)`. La misma clave y huella de petición devuelve la misma respuesta; otra huella da `409 IDEMPOTENCY_CONFLICT`.
3. Iniciar transacción. Bloquear el evento en modo compartido y verificar `published`, ventana de venta, `now() < starts_at` y ausencia de cancelación. Bloquear la fila de `usuarios` para serializar el límite de 4 por cliente y evento. Bloquear inventarios solicitados en orden ascendente.
4. Resolver reservas vencidas que afectan a esos inventarios dentro de la transacción o usar una contabilidad que descuente únicamente reservas vigentes. **No** confiar en `reserved_count` si contiene reservas vencidas aún no liberadas por el worker. Contar compras pagadas y reservas activas vigentes del comprador con los bloqueos ya adquiridos.
5. Calcular precios en servidor, verificar límites específicos del tipo y que `quantity_total - sold_count - reserved_count` alcance después de reconciliar vencimientos. Incrementar `reserved_count` con condición de capacidad; comprobar que todas las filas esperadas cambiaron.
6. Insertar `reservas` y `reserva_detalles` con importes copiados, `expires_at = created_at + interval '10 minutes'`, y guardar el resultado de idempotencia. Confirmar. El mismo conjunto de filas pasa de disponible a reservado una sola vez.

La contabilidad de vencimientos del paso 4 requiere una implementación concreta y pruebas de competencia entre expiración, reserva nueva y webhook. No basta un filtro `expires_at > now()` si el contador materializado todavía incluye unidades vencidas.

## Expirar o liberar reserva

El worker localiza reservas `active` con `expires_at <= now()` y reclama lotes con `FOR UPDATE SKIP LOCKED` o un mecanismo equivalente. Tras adquirir los bloqueos en el orden establecido, cambia cada reserva `active → expired`, resta exactamente sus cantidades de `reserved_count` y confirma. Si otro proceso ya la convirtió, expiró o liberó, no resta nada. Una liberación por rechazo definitivo usa la misma transición atómica a `cancelled`. No se decrementa por debajo de cero.

## Confirmar pago y emitir tickets

1. Recibir webhook con firma verificada en el borde HTTP. Persistir el identificador externo único y una versión segura del contenido; un duplicado recupera el resultado anterior. Conciliar referencia de pago, compra, importe y moneda MXN con los registros del servidor.
2. En una transacción corta, adquirir los bloqueos en el orden común. Marcar el intento `pagos` como confirmado una sola vez. Evaluar el tiempo de confirmación según la regla aprobada: `now() < reservas.expires_at` permite consumir la reserva; `now() >= expires_at` es cobro tardío. La decisión usa la hora del servidor bajo bloqueo, no la hora declarada por el navegador.
3. Si sigue vigente, cambiar reserva `active → converted`, pasar cantidades de `reserved_count` a `sold_count`, marcar compra `paid` y crear un ticket por unidad. `(purchase_detail_id, ordinal)` y `public_code` únicos impiden duplicación; el código comprueba además que la cantidad emitida coincide con el detalle. Insertar en la misma transacción un trabajo outbox para correo. Confirmar antes de enviar.
4. Si es tardío o el evento está cancelado, conservar el pago confirmado, dejar la compra sin tickets, pasar la reserva todavía activa a `expired` o `cancelled` y liberar su contador una sola vez. Crear una solicitud idempotente de reembolso íntegro más un trabajo outbox. El estado de devolución permanece pendiente hasta respuesta verificada del proveedor.

Si falla la emisión antes del `COMMIT`, no queda una compra pagada a medias. Si el diseño decide desacoplar la emisión, debe persistir un estado recuperable y el worker debe completarla usando las mismas claves únicas; eso exige una prueba adicional de caída entre confirmación y emisión.

## Reembolso

La solicitud se identifica con una clave estable por operación y se vincula a un pago concreto. Bajo bloqueo de compra, pago y reembolsos pertinentes se calcula el importe elegible no utilizado: suma de tickets aplicables menos devoluciones confirmadas y pendientes. El backend rechaza importes superiores o repetidos. La solicitud a Stripe se hace después del `COMMIT`, reutilizando su clave de idempotencia en cada reintento. Un webhook verificado confirma el importe devuelto y actualiza `reembolsos`, compra y tickets en una transacción. Un fallo recuperable reprograma el mismo trabajo; un caso de ticket utilizado va a revisión manual, con actor, motivo y decisión en `auditoria`.

La base actual limita `reembolsos` a una fila por compra; antes de implementar reembolsos parciales y el resto debe aplicarse la modificación descrita en [modelo y brechas](01-modelo-y-brechas.md).

## Validar acceso

1. Autenticar al personal y comprobar asignación vigente al evento solicitado. Verificar credencial QR con clave de servidor, versión, caducidad y evento, sin registrar el secreto ni exponer datos del comprador.
2. Para una credencial que identifica ticket, iniciar transacción y bloquear ticket; comprobar estado `issued`, evento no cancelado y ventana `starts_at <= now() < ends_at`. Insertar `accesos(ticket_id, scanned_by)` y actualizar ticket a `used` dentro de la misma transacción. La restricción única en `accesos.ticket_id` resuelve dos escaneos simultáneos: uno obtiene `valid`, el otro `already_used`.
3. Registrar un intento en `historial_escaneos` con resultado concreto. Los intentos con credencial desconocida o inválida también se registran sin datos sensibles. Si la respuesta al dispositivo se pierde, la consulta de resultado por identificador de intento permite recuperar el desenlace; el dispositivo no anuncia acceso válido sin confirmación del servidor.

Una transacción aceptada inserta exactamente un acceso y un historial `valid`. Si la inserción falla por unicidad, se registra `already_used` en una nueva transacción; no se modifica el acceso existente.

## Casos obligatorios de prueba

- Dos reservas del último boleto; dos reservas simultáneas del mismo cliente que excederían 4.
- Expiración repetida y carrera expiración–webhook en el instante límite.
- Webhook duplicado, fuera de orden o con importe distinto; caída antes y después del `COMMIT` de emisión.
- Reembolso repetido, parcial y posterior resto; fallo recuperable del proveedor.
- Dos escaneos del mismo QR, credencial de otro evento y retiro de asignación de personal durante una sesión.
