# Frontend de Vtickets

Vista previa del frontend público, siguiendo el stack provisional de `plan.md` y la estructura de `Vtickets_requerimientos.md`.

La dirección «Boleto claro, ciudad viva» está aplicada a portada, catálogo y detalle. Sus tokens y reglas están en [DESIGN.md](../DESIGN.md); la [revisión visual inicial](../docs/design/revision-inicial.md) documenta los problemas que motivaron el cambio.

## Ejecutar

Desde la raíz del repositorio:

```bash
corepack pnpm install
corepack pnpm dev
```

Abrir `http://localhost:3000`.

Si la instalación local de Corepack falla al verificar la firma de pnpm, usar `npx pnpm@10.28.2 install` y `npx pnpm@10.28.2 dev`.

Si no se define `VTICKETS_API_URL`, la web muestra seis eventos de demostración con un aviso visible. Los precios y la disponibilidad de esos eventos son ilustrativos. La compra permanece deshabilitada. Copia `.env.example` a `.env.local` y define la URL cuando la API esté disponible.

La fase 03 agregó `/ingresar`, `/registro`, `/recuperar` y `/cuenta`. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` para conectar Supabase Auth. Ambas son públicas; nunca uses una clave secreta o `service_role` con prefijo `NEXT_PUBLIC_`. La confirmación por correo para SSR necesita dirigir el enlace a `/auth/confirm?token_hash={{ .TokenHash }}&type=email`; la recuperación debe dirigir a `/auth/confirm` con `type=recovery` o al callback PKCE `/auth/callback`. Autoriza estas rutas en las URL de redirección de Supabase Auth. La cuenta consulta el perfil en NestJS y muestra un estado pendiente si la API o PostgreSQL todavía no están configurados.

## Entrega y dependencias

Esta entrega cubre la estructura de Next.js y una vista previa de landing, catálogo, búsqueda, filtros y detalle. Avanza la parte visual de la fase 04 del mapa maestro y F05-T01, F05-T04 y F05-T05 de `plan.md`. No se considera completada la fase 05: faltan el backend, identidad, administración de eventos y datos reales exigidos por sus dependencias y criterio de aceptación.

La interfaz usa CSS propio y tokens compartidos en `src/app/globals.css`. `plan.md` propone Tailwind CSS y shadcn/ui para el MVP; esa decisión no cambia la dirección visual ya definida.

La carpeta `src/app` define las rutas del App Router. `layout.tsx` contiene la estructura compartida; `page.tsx` es la ruta de inicio. Las páginas consultan eventos en el servidor a través de `src/lib/events.ts`. Esa función será el punto de integración con NestJS, de modo que el navegador no necesita consultar directamente la base de datos. Los enlaces entre rutas funcionan con `next/link`.

## Contrato provisional de lectura

`GET {VTICKETS_API_URL}/public/events` debe devolver un arreglo JSON de eventos publicados. Cada objeto incluye `id`, `slug`, `title`, `category`, `date` (`YYYY-MM-DD`), `time` (`HH:mm`), `venue`, `city`, `description`, `artwork` (una de `coral`, `lime`, `violet`, `blue`, `orange`, `pink`) y `tickets` (arreglo de `{ name, price, available }`). Es un contrato visual provisional: debe revisarse en F02-T06 antes de integrar la API real. La API debe filtrar los eventos no publicados y calcular precios y disponibilidad del lado del servidor.

Al configurar la API, un error de conexión muestra un estado de error; la web nunca sustituye un fallo de API con eventos ficticios. Catálogo vacío, búsqueda sin coincidencias y evento inexistente tienen estados propios.
