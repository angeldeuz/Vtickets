# Vtickets

Vtickets es una plataforma en desarrollo para publicar eventos locales y vender entradas. El objetivo del MVP es cubrir el recorrido completo: publicar un evento, reservar boletos, pagar, emitir un ticket individual con QR y validar un solo acceso por ticket.

## Estado actual

- **Web pública:** portada, catálogo, búsqueda, filtros y detalle de eventos. Sin una API configurada muestra eventos de demostración; sus precios y disponibilidad son ilustrativos y la compra está deshabilitada.
- **Identidad:** registro, inicio y cierre de sesión, recuperación y actualización de contraseña mediante Supabase Auth. El área de cuenta consulta el perfil y los roles en la API.
- **API:** base en NestJS con verificación de JWT, permisos, rutas de perfil, endpoints de salud y documentación OpenAPI.
- **Datos:** modelo de negocio en PostgreSQL, esquema Prisma, migraciones SQL versionadas y verificaciones de la fase de datos.
- **Calidad:** pruebas del backend y flujo de CI en GitHub Actions.

La administración de eventos, el inventario operativo, las reservas, los pagos, la emisión de tickets y el escaneo de QR siguen pendientes. Consulta [plan.md](plan.md) para el avance y el orden de las siguientes entregas.

## Tecnologías

TypeScript, Next.js, React, NestJS, Prisma, PostgreSQL y Supabase Auth. El proyecto usa un workspace de pnpm con `frontend/`, `backend/` y `database/`.

## Ejecutar localmente

Se requiere Node.js 24.15 o posterior y pnpm 10.28.2. Desde la raíz del repositorio:

```bash
corepack pnpm install
corepack pnpm dev
```

La web queda en `http://localhost:3000`. Para iniciar la API en otra terminal:

```bash
corepack pnpm dev:api
```

La API queda en `http://127.0.0.1:3001`; su documentación está en `/api/docs`. Copia `frontend/.env.example` a `frontend/.env.local` y `backend/.env.example` a `backend/.env` para configurar las integraciones que necesites. Las credenciales reales y los archivos `.env` no se deben subir al repositorio. Las instrucciones de configuración están en los README del [frontend](frontend/README.md) y del [backend](backend/README.md).

## Documentación

- [Requerimientos y alcance](Vtickets_requerimientos.md)
- [Plan de trabajo](plan.md)
- [Fase 01: reglas y arquitectura](docs/fase-01/README.md)
- [Fase 02: modelo de datos y contratos](docs/fase-02/README.md)
- [Fase 03: base técnica e identidad](docs/fase-03/README.md)
