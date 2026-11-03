# Frontend de Vtickets

Frontend público conectado a la API de eventos de NestJS, siguiendo `plan.md` y `Vtickets_requerimientos.md`.

La dirección «Boleto claro, ciudad viva» está aplicada a portada, catálogo y detalle. Sus tokens y reglas están en [DESIGN.md](../DESIGN.md); la [revisión visual inicial](../docs/design/revision-inicial.md) documenta los problemas que motivaron el cambio.

## Ejecutar

Desde la raíz del repositorio:

```bash
corepack pnpm install
corepack pnpm dev
```

Abrir `http://localhost:3000`.

Si la instalación local de Corepack falla al verificar la firma de pnpm, usar `npx pnpm@10.28.2 install` y `npx pnpm@10.28.2 dev`.

La web usa `VTICKETS_API_URL` para consultar NestJS desde el servidor; si no se define, utiliza `http://127.0.0.1:3001/api/v1`. Copia `.env.example` a `.env.local` si la API usa otra dirección. Si la API no responde, se muestra un error y nunca aparecen eventos ficticios. La compra permanece deshabilitada hasta las fases de reservas y pagos.

La fase 03 agregó `/ingresar`, `/registro`, `/recuperar` y `/cuenta`. Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` para conectar Supabase Auth. Ambas son públicas; nunca uses una clave secreta o `service_role` con prefijo `NEXT_PUBLIC_`. La confirmación por correo para SSR necesita dirigir el enlace a `/auth/confirm?token_hash={{ .TokenHash }}&type=email`; la recuperación debe dirigir a `/auth/confirm` con `type=recovery` o al callback PKCE `/auth/callback`. Autoriza estas rutas en las URL de redirección de Supabase Auth. La cuenta consulta el perfil en NestJS y muestra un estado pendiente si la API o PostgreSQL todavía no están configurados.

## Entrega y dependencias

La fase 05 conecta landing, catálogo, búsqueda, filtros y detalle con eventos publicados. La API calcula precios y existencias desde el inventario. El recorrido y las verificaciones están en [docs/fase-05/README.md](../docs/fase-05/README.md).

La interfaz usa CSS propio y tokens compartidos en `src/app/globals.css`. `plan.md` propone Tailwind CSS y shadcn/ui para el MVP; esa decisión no cambia la dirección visual ya definida.

La carpeta `src/app` define las rutas del App Router. `layout.tsx` contiene la estructura compartida; `page.tsx` es la ruta de inicio. Las páginas consultan eventos en el servidor a través de `src/lib/events.ts`. NestJS consulta PostgreSQL y sirve las portadas desde Storage privado; el navegador pide la portada a la ruta de Next.js `eventos/[slug]/imagen`. Los enlaces entre rutas funcionan con `next/link`.

## Contrato público de lectura

`GET {VTICKETS_API_URL}/public/events` devuelve los próximos eventos publicados; `GET .../public/events/{slug}` devuelve el detalle de uno publicado. Cada evento contiene `id`, `slug`, `title`, `summary`, `description`, `category`, `startsAt`, `timezone`, `venue`, `address`, `city`, `region`, `cover` y `tickets`. Cada entrada incluye `id`, `name`, `description`, `price` en MXN, `currency`, `available` y `saleStatus`. `GET .../public/events/{slug}/cover` sirve la portada únicamente si el evento está publicado.

Al configurar la API, un error de conexión muestra un estado de error; la web nunca sustituye un fallo de API con eventos ficticios. Catálogo vacío, búsqueda sin coincidencias y evento inexistente tienen estados propios.

## Administración de eventos (fase 04)

La ruta `/admin` requiere una sesión de Supabase Auth y un perfil con rol `ADMINISTRADOR` vigente en NestJS. Usa `VTICKETS_API_URL` para conectar el panel con la API. El panel permite crear y editar borradores, categorías y recintos; publicar o suspender eventos; administrar tipos, stock e imágenes; asignar personal de acceso y consultar auditoría. Las mutaciones se envían desde Server Actions con el token de la sesión, y la API vuelve a aplicar los permisos y reglas de negocio.

Las fechas de los formularios administrativos se introducen como instantes ISO con offset, por ejemplo `2030-11-01T18:00:00-06:00`. La carga de imágenes admite 5 MiB en PNG, JPEG o WebP. Para una revisión visual completa del panel se necesita iniciar sesión como administrador en el entorno de desarrollo.
