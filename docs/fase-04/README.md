# Fase 04 — Eventos, inventario y administración

**Estado:** F04-T01 implementada en la rama `feature/f04-eventos-inventario`. Las tareas F04-T02 a F04-T07 siguen pendientes.

## F04-T01: categorías y ubicaciones

- `GET /api/v1/categories` devuelve solo categorías activas, sin sesión.
- `GET /api/v1/admin/categories` y `GET /api/v1/admin/venues` devuelven listas paginadas con `items` y `nextCursor`.
- `POST` y `PATCH` sobre ambas colecciones requieren token válido y rol `ADMINISTRADOR` consultado en PostgreSQL. No hay eliminación física; las categorías pueden desactivarse.
- Se validan campos desconocidos, nombres, slug en minúsculas, UUID, país ISO de dos letras, zona IANA, coordenadas y capacidad positiva. Un slug duplicado devuelve `409 CATEGORY_SLUG_EXISTS`; un ID inexistente devuelve `404`.
- Se usan las tablas, permisos y políticas RLS ya versionados en F02; esta tarea no crea migraciones ni instala dependencias.

**Verificación:** `npm.cmd --prefix backend run test` pasó 14 pruebas, incluidas solicitudes HTTP públicas, sin sesión, con rol `CLIENTE`, inválidas y con rol `ADMINISTRADOR`. `node scripts/verify-f04-catalog.mjs` desde `backend/` comprobó `INSERT`, `UPDATE` y `SELECT` con el rol de aplicación en PostgreSQL real; terminó con `ROLLBACK`.

**Siguiente:** F04-T02, gestión de eventos. La auditoría de cambios administrativos se implementará en F04-T07, antes de cerrar la fase.
