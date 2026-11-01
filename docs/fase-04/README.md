# Fase 04 — Eventos, inventario y administración

**Estado:** F04-T01 a F04-T07 cerradas para el MVP. El propietario confirmó el recorrido administrativo, la publicación del evento y la visualización de la imagen cargada en la vista previa del panel.

## F04-T01: categorías y ubicaciones

- `GET /api/v1/categories` devuelve solo categorías activas, sin sesión.
- `GET /api/v1/admin/categories` y `GET /api/v1/admin/venues` devuelven listas paginadas con `items` y `nextCursor`.
- `POST` y `PATCH` sobre ambas colecciones requieren token válido y rol `ADMINISTRADOR` consultado en PostgreSQL. No hay eliminación física; las categorías pueden desactivarse.
- Se validan campos desconocidos, nombres, slug en minúsculas, UUID, país ISO de dos letras, zona IANA, coordenadas y capacidad positiva. Un slug duplicado devuelve `409 CATEGORY_SLUG_EXISTS`; un ID inexistente devuelve `404`.
- Se usan las tablas, permisos y políticas RLS ya versionados en F02; esta tarea no crea migraciones ni instala dependencias.

**Verificación:** `npm.cmd --prefix backend run test` pasó 14 pruebas, incluidas solicitudes HTTP públicas, sin sesión, con rol `CLIENTE`, inválidas y con rol `ADMINISTRADOR`. `node scripts/verify-f04-catalog.mjs` desde `backend/` comprobó `INSERT`, `UPDATE` y `SELECT` con el rol de aplicación en PostgreSQL real; terminó con `ROLLBACK`.

## F04-T02: gestión de eventos

- `GET /api/v1/admin/events` (con `limit`, `cursor` y `status`) y `GET /api/v1/admin/events/{id}` permiten consultar borradores y otros estados con rol `ADMINISTRADOR`.
- `POST /api/v1/admin/events` crea un borrador cuyo organizador es el perfil autenticado; valida categoría activa, recinto, capacidad, zona IANA, fechas con offset, slug y ventanas de venta.
- `PATCH /api/v1/admin/events/{id}` edita solo borradores y exige `updatedAt` del último GET como precondición. Un cambio concurrente devuelve `409 EVENT_CHANGED`.
- `POST /api/v1/admin/events/{id}/publish`, `/suspend` y `/resume` aplican las transiciones `draft → published → suspended → published`. La suspensión exige `{ "reason": "..." }` y registra el motivo en `auditoria` dentro de la misma transacción.
- Publicar o reanudar exige fecha futura, categoría activa, capacidad válida y al menos un tipo de boleto activo con inventario y ventana de venta correcta. La creación administrativa de tipos de boleto se incorporará en F04-T04; hasta entonces, un borrador sin tipos devuelve `400 INVALID_EVENT` al publicar.
- Se reutilizan las tablas y permisos de F02. Esta tarea no añade migraciones ni dependencias.

**Verificación:** las 24 pruebas del backend pasaron. `node scripts/verify-f04-events.mjs` desde `backend/` verificó inserción y transiciones con el rol de la API en PostgreSQL; terminó con `ROLLBACK`.

## F04-T03: imágenes de eventos

- `POST /api/v1/admin/events/{id}/images` recibe el archivo como cuerpo binario con `Content-Type: image/png`, `image/jpeg` o `image/webp`; `altText`, `isCover` y `sortOrder` son parámetros opcionales de consulta. Solo `ADMINISTRADOR` puede subir o borrar imágenes de un evento en `draft`.
- La API limita cada archivo a 5 MiB, comprueba la firma y estructura básica de la imagen y genera una ruta aleatoria dentro de `events/{eventId}/`. No acepta rutas enviadas por el cliente. `GET` lista las referencias; `GET .../{imageId}/content` permite al administrador ver la imagen del bucket privado; `DELETE .../{imageId}` borra objeto y referencia.
- `backend/scripts/ensure-event-images-bucket.mjs` crea o verifica el bucket **privado** `event-images` con límites de 5 MiB y MIME permitidos mediante Storage API. Requiere `SUPABASE_SECRET_KEY` en `backend/.env`, solo en el servidor. La API usa la clave únicamente después de verificar JWT y rol en NestJS. Las tablas internas de Storage no se modifican directamente.
- La migración [20261031004905_grant_event_images_delete.sql](../../database/migrations/20261031004905_grant_event_images_delete.sql) concede `DELETE` únicamente sobre `tickets_app.evento_imagenes` al rol de la API. Se aplicó al proyecto de desarrollo y quedó registrada en `supabase_migrations.schema_migrations` el 31 de octubre de 2026.
- En el proyecto de desarrollo, el bucket privado se creó y se verificó con el límite y los MIME esperados. `node scripts/verify-f04-storage.mjs` subió, leyó y eliminó un PNG temporal. La eliminación entre Storage y PostgreSQL no es atómica; la recuperación de fallas se resolverá con tareas durables de operación antes de usar archivos de producción.

**Verificación:** 33 pruebas del backend pasaron, incluidas pruebas HTTP y de servicio para permisos, 5 MiB, MIME falsificado, ruta generada y eliminación. `node scripts/verify-f04-image-grant.mjs` probó el `GRANT` en `Vtickets-pruebas` dentro de una transacción revertida. `node scripts/verify-f04-events.mjs` comprobó `INSERT` y `DELETE` de la referencia de imagen con el rol de la API en desarrollo y revirtió los datos. `node scripts/verify-f04-storage.mjs` subió, leyó y eliminó un PNG temporal de Storage. La ruta sin token respondió `401`. El propietario confirmó la visualización de la imagen cargada en el panel autenticado.

**Vista previa administrativa:** el panel del evento muestra las imágenes cargadas incluso después de publicar. Cada miniatura enlaza a una ruta Next.js que verifica la sesión, solicita la imagen a la API con el token del administrador y responde con caché privada deshabilitada. La cartelera pública continúa como datos de demostración hasta la fase 05; esta vista permite revisar la imagen real sin adelantar esa integración.

**Para probar una subida:** con un token de administrador y un evento en borrador:

Para repetir la configuración en otro entorno, copiar `database/dev-admin.example` a `database/.env.desarrollo` y definir ahí `DEV_ADMIN_DATABASE_URL` con la conexión administrativa del **proyecto de desarrollo**, no `Vtickets-pruebas`. Ambos archivos `.env` están ignorados por Git; no enviar sus valores por chat. Desde `backend/`, `node scripts/preflight-f04-storage.mjs` comprueba proyecto y conexión sin imprimir credenciales. La migración debe registrarse en el historial de Supabase, no aplicarse solo desde el editor SQL.

```bash
curl -X POST "http://127.0.0.1:3001/api/v1/admin/events/ID_DEL_EVENTO/images?isCover=true&altText=Portada" \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: image/png" \
  --data-binary "@portada.png"
```

La auditoría completa de cambios administrativos corresponde a F04-T07.

## F04-T04: tipos de boleto e inventario inicial

- `GET /api/v1/admin/events/{eventId}/ticket-types` lista tipos e inventario; `POST` crea un tipo en un borrador y `PATCH /api/v1/admin/ticket-types/{id}` edita un tipo de borrador. Las tres rutas requieren rol `ADMINISTRADOR` vigente.
- La API acepta precios enteros en centavos, moneda fija `MXN`, stock positivo, límites por compra y usuario entre 1 y 4, estado `active` o `paused` y fechas con offset. Rechaza campos desconocidos y ventanas que rebasen las del evento o terminen después de su inicio.
- La creación bloquea la fila del evento y guarda tipo e inventario inicial en una transacción. La suma de stock de todos los tipos no puede superar la capacidad del evento. La respuesta convierte `priceCents` a número JSON seguro.
- La edición exige el `updatedAt` de la última lectura; un cambio concurrente devuelve `409 TICKET_TYPE_CHANGED`. Rechaza bajar el stock bajo el total reservado o vendido que muestra el inventario.
- No se agregaron dependencias ni migraciones; se reutilizaron el esquema y los permisos versionados en F02.

**Verificación:** `npm.cmd --prefix backend run test` pasó 38 pruebas en 12 suites, incluidas validación HTTP, permisos y reglas del servicio. `node scripts/verify-f04-ticket-types.mjs` desde `backend/` verificó inserción y edición de tipo e inventario con el rol real de la API en PostgreSQL; terminó con `ROLLBACK`.

## F04-T05: cambios seguros de inventario

- `PATCH /api/v1/admin/ticket-types/{id}` admite, después de publicar, solo `quantityTotal` y `status` (`active` o `paused`). Precio, límites y ventanas de venta publicados permanecen estables.
- Antes de modificar stock, la transacción bloquea el evento y la fila de `inventarios`, lee `reservedCount + soldCount` y rechaza un total inferior. También impide que la suma de stock de los tipos exceda la capacidad del evento.
- `PATCH /api/v1/admin/events/{id}` no permite reducir la capacidad de un borrador por debajo del stock ya asignado. Esta comprobación comparte el bloqueo de evento con la creación y edición de tipos.
- La comprobación del inventario materializado es conservadora: las reservas expiradas se liberarán por el mecanismo durable de F06. No se habilitan aún ventas reales.

## F04-T06: panel y personal de acceso

- `/admin` lista eventos y enlaza a la creación, edición y publicación. `/admin/catalogo` crea y actualiza categorías y recintos. `/admin/eventos/{id}` gestiona borrador, estado, tipos, stock, imágenes y personal. `/admin/auditoria` muestra el historial. Las páginas usan Server Components y Server Actions; el token de sesión se envía desde el servidor a NestJS, donde se comprueba el rol vigente.
- `GET /api/v1/admin/users` devuelve hasta 100 perfiles activos con nombre e ID, y admite búsqueda por nombre. No expone correo ni datos de Auth. El panel permite seleccionar el perfil sin consultar la base de datos manualmente.
- `GET/POST /api/v1/admin/events/{id}/staff` y `PATCH /api/v1/admin/events/{id}/staff/{assignmentId}` listan, asignan, retiran o reactivan personal con rol `ACCESO`. Validan usuario activo, evento elegible, vigencia y duplicados. Retirar cambia el estado a `withdrawn`; la comprobación de acceso ya existente en `IdentityService` deja de autorizarlo en la siguiente solicitud.
- El panel acepta imágenes de hasta 5 MiB. Next.js permite el cuerpo multipart con margen de 6 MiB; NestJS valida de nuevo tamaño y firma. Los formularios muestran errores y confirmaciones después de cada operación.

## F04-T07: auditoría administrativa

- Las mutaciones de categorías, recintos, eventos, tipos de boleto, imágenes y personal guardan actor, acción, entidad y metadatos acotados. Se evita incluir credenciales, tokens, archivos o datos de pago.
- Las escrituras de negocio y auditoría se agrupan en una transacción PostgreSQL. Storage permanece como servicio externo; la eliminación de un objeto y su referencia no es atómica y conserva la limitación documentada en F04-T03.
- `GET /api/v1/admin/audit` requiere `ADMINISTRADOR` y permite paginar o filtrar por actor, entidad y fechas.

**Verificación final:** `npm.cmd run test` desde `backend/` pasó 48 pruebas en 14 suites. `npm.cmd run test` desde `frontend/` pasó 3 pruebas de paginación y auditoría; su compilación de producción pasó. `node scripts/verify-f04-ticket-types.mjs` y `node scripts/verify-f04-staff-audit.mjs` desde `backend/` comprobaron escrituras con el rol real de la API en PostgreSQL y terminaron con `ROLLBACK`. El propietario comprobó en navegador el recorrido administrativo, la publicación y la imagen cargada.

**Correcciones posteriores a la revisión:** publicar y reanudar bloquean el evento antes de leer boletos; las acciones administrativas muestran el error en el formulario sin redirigir; la auditoría guarda todos los campos editables de un boleto y prioriza nombres históricos; creación y edición de eventos cargan todas las páginas de categorías y recintos.
