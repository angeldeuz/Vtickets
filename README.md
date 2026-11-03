# Vtickets

Vtickets es una plataforma en desarrollo para publicar eventos locales y vender entradas. El objetivo del MVP es cubrir el recorrido completo: publicar un evento, reservar boletos, pagar, emitir un ticket individual con QR y validar un solo acceso por ticket.

## Estado actual

- **Web pública:** portada, catálogo, búsqueda, filtros y detalle conectados con eventos publicados de la API. Si la API no responde, muestra un error; la compra sigue deshabilitada hasta las fases 06 y 07.
- **Identidad:** registro, inicio y cierre de sesión, recuperación y actualización de contraseña mediante Supabase Auth. El área de cuenta consulta el perfil y los roles en la API.
- **API:** NestJS con verificación de JWT, permisos, administración y consulta pública de eventos, rutas de perfil, endpoints de salud y documentación OpenAPI.
- **Datos:** modelo de negocio en PostgreSQL, esquema Prisma, migraciones SQL versionadas y verificaciones de la fase de datos.
- **Calidad:** pruebas del backend y flujo de CI en GitHub Actions.

Las fases 01–05 están cerradas. Reservas, pagos, emisión de tickets y escaneo de QR siguen pendientes. Consulta [plan.md](plan.md) para el avance y el orden de las siguientes entregas.

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
