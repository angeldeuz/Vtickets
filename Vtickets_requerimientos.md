# Mapa Maestro — Plataforma Web de Venta de Tickets

## Introducción

Este documento define la arquitectura, módulos, roles, modelo conceptual de datos, flujos principales, estructura del proyecto y plan de desarrollo para una plataforma web de venta de tickets para eventos locales.

La recomendación para la primera versión es utilizar una **arquitectura de monolito modular**, con frontend separado, una API backend central y una base de datos relacional. Esto permite desarrollar rápidamente el MVP sin introducir la complejidad operativa de microservicios, manteniendo al mismo tiempo límites claros entre módulos para una futura evolución.

### Regla central del sistema

> El pago genera una compra; una compra pagada genera tickets; cada ticket tiene una identidad única; cada ticket admite como máximo un acceso válido.

---

# 1. Arquitectura general

```text
                         ┌──────────────────────────┐
                         │       USUARIOS           │
                         │ Cliente / Admin / Acceso │
                         └────────────┬─────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────┐
│                         FRONTEND                          │
│                                                           │
│  Web pública │ Mi cuenta │ Checkout │ Admin │ Scanner QR │
└────────────────────────────┬──────────────────────────────┘
                             │ HTTPS / API
                             ▼
┌───────────────────────────────────────────────────────────┐
│                       BACKEND / API                       │
│                                                           │
│ Auth      Eventos       Inventario      Compras           │
│ Usuarios  Checkout      Pagos           Tickets           │
│ QR        Accesos       Notificaciones  Auditoría         │
└───────────────┬───────────────┬───────────────┬───────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼─────┐ ┌──────▼────────┐
        │ Base de datos│ │ Proveedor   │ │ Almacenamiento│
        │ PostgreSQL / │ │ de pagos    │ │ imágenes      │
        │ SQL Server   │ │             │ │               │
        └──────────────┘ └─────────────┘ └───────────────┘
                │
        ┌───────▼────────┐
        │ Email / avisos │
        └────────────────┘
```

## Frontend

Responsable de toda la interacción con el usuario.

### Web pública

- Landing Page.
- Catálogo de eventos.
- Detalle del evento.
- Login y registro.

### Área del cliente

- Perfil.
- Historial de compras.
- Mis tickets.
- Visualización de QR.

### Checkout

- Selección de boletos.
- Resumen de compra.
- Pago.
- Confirmación.

### Backoffice

- Panel administrativo.
- Gestión de eventos.
- Ventas.
- Usuarios.
- Personal de acceso.

Además, se contará con una interfaz **Scanner** especialmente diseñada para teléfonos móviles.

## Backend / API

Es el corazón del sistema y donde deben existir las reglas importantes del negocio.

Nunca se debe confiar únicamente en el frontend para validar:

- Precio.
- Disponibilidad.
- Permisos.
- Estado del pago.
- Validez del QR.
- Cantidad máxima de boletos.
- Estado del ticket.

El backend debe volver a comprobar todas estas reglas.

## Base de datos

Se recomienda utilizar una base de datos relacional debido a las relaciones fuertes existentes entre las entidades.

```text
Usuario
   ↓
Compra
   ↓
DetalleCompra
   ↓
Ticket
   ↓
Acceso
```

También:

```text
Evento
  ↓
TipoTicket
  ↓
Inventario
```

Para comenzar se recomienda **PostgreSQL** o **SQL Server**.

## Autenticación y autorización

Responsable de:

- Registro.
- Inicio de sesión.
- Sesiones o tokens.
- Recuperación de contraseña.
- Roles.
- Permisos.
- Protección de endpoints.

No basta con ocultar botones en el frontend. Los permisos deben comprobarse también en el backend.

Por ejemplo:

```text
POST /admin/eventos
```

Debe validar que el usuario autenticado realmente tenga permisos administrativos.

## Servicio de pagos

Debe existir una capa independiente para la integración con proveedores de pago.

```text
PaymentService
      │
      ├── Crear pago
      ├── Consultar pago
      ├── Procesar webhook
      └── Reembolsar
```

Esto permitirá cambiar de proveedor en el futuro sin reconstruir todo el sistema de compras.

La fuente definitiva para emitir tickets será la **confirmación real del proveedor de pagos**, normalmente recibida mediante webhook.

## Servicio QR

Será responsable de generar la representación QR de una credencial segura asociada al ticket.

Un QR no debería contener simplemente:

```text
TicketId = 1523
```

porque sería fácil de adivinar o manipular.

Debe utilizarse un identificador criptográficamente aleatorio o un token firmado.

## Correo y notificaciones

Responsable de:

- Confirmación de compra.
- Envío de tickets.
- Cancelaciones.
- Reembolsos.
- Cambios importantes del evento.

## Almacenamiento de imágenes

Las imágenes no deberían almacenarse directamente en la base de datos.

La base de datos guardará únicamente una referencia:

```text
Evento
   │
   └── ImagenURL
```

Los archivos deberán almacenarse en un servicio de almacenamiento de objetos y, posteriormente, podrán distribuirse mediante CDN.

---

# 2. Módulos del sistema

El proyecto se divide en dominios funcionales.

| Dominio | Módulos |
|---|---|
| Público | Landing, catálogo, detalle del evento |
| Identidad | Registro, login, perfil |
| Eventos | Eventos, categorías, ubicaciones |
| Inventario | Tipos de ticket, precios, disponibilidad |
| Venta | Selección, reserva, checkout |
| Pagos | Pago, webhook, reembolso |
| Compras | Compra, detalle, historial |
| Tickets | Generación, QR, Mis Tickets |
| Accesos | Scanner, validación, historial |
| Administración | Eventos, ventas, usuarios |
| Comunicación | Emails y notificaciones |
| Seguridad | Roles, permisos, auditoría |

Esta división permitirá desarrollar y probar cada módulo de forma independiente.

---

# 3. Roles y permisos

## Cliente

Puede:

- Consultar eventos.
- Registrarse.
- Iniciar sesión.
- Editar su perfil.
- Seleccionar tickets.
- Comprar.
- Consultar sus propias compras.
- Consultar sus propios tickets.
- Mostrar sus códigos QR.

Nunca podrá consultar compras o tickets pertenecientes a otros usuarios.

## Administrador

Puede:

- Crear eventos.
- Editar eventos.
- Publicar y despublicar eventos.
- Cancelar eventos.
- Configurar tipos de boleto.
- Configurar precios.
- Configurar inventario.
- Consultar ventas.
- Consultar tickets.
- Administrar usuarios.
- Gestionar personal.
- Consultar accesos.
- Gestionar reembolsos.

## Personal de acceso

Debe contar con permisos limitados.

Puede:

- Iniciar sesión.
- Seleccionar un evento autorizado.
- Abrir el scanner.
- Escanear códigos QR.
- Validar tickets.
- Registrar entradas.
- Consultar el resultado inmediato del escaneo.

No necesita acceso a precios, ventas completas ni configuración administrativa.

## Roles futuros

Posteriormente pueden introducirse permisos más granulares:

- SuperAdmin.
- Organizador.
- AdministradorEvento.
- Taquilla.
- Acceso.
- Soporte.

Esto será especialmente importante cuando diferentes organizadores puedan publicar sus propios eventos.

---

# 4. Estructura de carpetas

```text
/plataforma-tickets
│
├── /frontend
│   ├── /public
│   │
│   ├── /src
│   │   ├── /app
│   │   ├── /assets
│   │   ├── /components
│   │   ├── /layouts
│   │   ├── /pages
│   │   │
│   │   ├── /modules
│   │   │   ├── /auth
│   │   │   ├── /events
│   │   │   ├── /checkout
│   │   │   ├── /payments
│   │   │   ├── /tickets
│   │   │   ├── /profile
│   │   │   ├── /purchases
│   │   │   ├── /scanner
│   │   │   └── /admin
│   │   │
│   │   ├── /services
│   │   ├── /hooks
│   │   ├── /store
│   │   ├── /types
│   │   ├── /utils
│   │   ├── /routes
│   │   └── /config
│   │
│   └── /tests
│
├── /backend
│   ├── /src
│   │   ├── /modules
│   │   │   ├── /auth
│   │   │   ├── /users
│   │   │   ├── /events
│   │   │   ├── /categories
│   │   │   ├── /locations
│   │   │   ├── /ticket-types
│   │   │   ├── /inventory
│   │   │   ├── /reservations
│   │   │   ├── /orders
│   │   │   ├── /payments
│   │   │   ├── /tickets
│   │   │   ├── /qr
│   │   │   ├── /access
│   │   │   ├── /notifications
│   │   │   ├── /admin
│   │   │   └── /audit
│   │   │
│   │   ├── /common
│   │   ├── /config
│   │   ├── /database
│   │   ├── /middleware
│   │   ├── /security
│   │   ├── /integrations
│   │   └── /jobs
│   │
│   └── /tests
│
├── /database
│   ├── /migrations
│   ├── /seeds
│   ├── /diagrams
│   └── /scripts
│
├── /docs
│   ├── /architecture
│   ├── /api
│   ├── /database
│   ├── /security
│   └── /business-rules
│
├── /scripts
│   ├── /development
│   └── /deployment
│
├── /infrastructure
│   ├── /docker
│   └── /deploy
│
├── README.md
└── .env.example
```

El backend estará organizado principalmente **por dominio**, evitando una única carpeta gigantesca para controllers, services o repositories.

---

# 5. Modelo conceptual de base de datos

## Entidades principales

```text
Usuarios
Roles
UsuarioRoles

Categorias
Ubicaciones
Eventos
EventoImagenes

TiposTicket
ReservasInventario

Compras
DetalleCompra
Pagos

Tickets

Accesos
HistorialEscaneos

Notificaciones
Auditoria
```

## Usuarios

Representa la identidad de una persona dentro del sistema.

Responsabilidades:

- Datos personales.
- Email.
- Credenciales.
- Estado de la cuenta.
- Fechas de registro.

## Roles

Define los permisos asignados a los usuarios.

Relación:

```text
Usuario ──< UsuarioRoles >── Rol
```

## Categorías

Permite clasificar los eventos.

Ejemplos:

- Concierto.
- Festival.
- Teatro.
- Deportes.
- Comedia.
- Conferencia.

Una categoría puede contener muchos eventos.

## Ubicaciones

Representa el recinto donde se realizará el evento.

Información principal:

- Nombre.
- Dirección.
- Ciudad.
- Estado.
- Coordenadas.
- Capacidad.

Esta separación permite preparar la plataforma para expandirse a otras ciudades.

## Eventos

Entidad principal de publicación.

Conceptualmente:

```text
Evento
 ├── Categoria
 ├── Ubicacion
 ├── Nombre
 ├── Descripcion
 ├── FechaInicio
 ├── FechaFin
 ├── Estado
 └── Otros datos
```

Estados sugeridos:

```text
BORRADOR
PUBLICADO
AGOTADO
CANCELADO
FINALIZADO
```

## TiposTicket

Un evento puede ofrecer distintos tipos de entrada.

Ejemplo:

```text
General       $400
Preferente    $700
VIP          $1,200
```

Cada tipo de ticket tendrá:

- Precio.
- Stock.
- Máximo por compra.
- Inicio de venta.
- Fin de venta.
- Estado.

## Compras

Representa la orden completa realizada por un cliente.

```text
Compra
 ├── Usuario
 ├── Total
 ├── Estado
 └── Fecha
```

Estados sugeridos:

```text
PENDIENTE
PAGANDO
PAGADA
FALLIDA
CANCELADA
REEMBOLSADA
PARCIALMENTE_REEMBOLSADA
```

## DetalleCompra

Guarda los conceptos que formaron parte de la compra.

Ejemplo:

```text
Compra #1005

2 × General       $800
1 × VIP         $1,200
-----------------------
Total           $2,000
```

Debe guardar el precio que realmente fue cobrado, evitando depender posteriormente del precio actual configurado en `TiposTicket`.

## Pagos

Registra la comunicación financiera con el proveedor.

```text
Pago
 ├── Compra
 ├── Proveedor
 ├── PaymentId externo
 ├── Importe
 ├── Estado
 └── Fecha
```

## Tickets

Cada entrada individual debe generar un ticket independiente.

Si una persona compra tres entradas:

```text
Compra #1005
     │
     ├── Ticket A
     ├── Ticket B
     └── Ticket C
```

No se generará un único QR para toda la compra.

Cada ticket tendrá conceptualmente:

```text
Ticket
 ├── Id interno
 ├── PublicId único
 ├── Compra
 ├── TipoTicket
 ├── Evento
 ├── QRToken
 ├── Estado
 ├── FechaEmision
 └── FechaUso
```

Estados:

```text
VALIDO
UTILIZADO
CANCELADO
REEMBOLSADO
```

El `PublicId` y/o `QRToken` deberán ser únicos y difíciles de predecir.

## Accesos

Representa una entrada válida al evento.

```text
Ticket
   │
   └── Acceso
          ├── Fecha/hora
          ├── Personal que escaneó
          ├── Evento
          └── Datos relevantes del dispositivo
```

Debe existir una restricción que impida registrar dos accesos válidos para un ticket de entrada única.

## HistorialEscaneos

Guarda todos los intentos de lectura, sean válidos o inválidos.

Ejemplo:

```text
12:01  VÁLIDO
12:02  YA UTILIZADO
12:05  YA UTILIZADO
12:06  YA UTILIZADO
12:30  YA UTILIZADO
```

Esto será útil para seguridad, soporte y auditoría.

---

# 6. Flujo completo de compra

## Flujo normal

```text
Usuario
   ↓
Consulta evento
   ↓
Selecciona tipo de ticket
   ↓
Selecciona cantidad
   ↓
Backend comprueba inventario
   ↓
Reserva temporal
   ↓
Checkout
   ↓
Creación de Compra PENDIENTE
   ↓
Proveedor de pago
   ↓
Usuario realiza pago
   ↓
Webhook
   ↓
Backend verifica pago
   ↓
Compra = PAGADA
   ↓
Generación de tickets
   ↓
Generación de credenciales QR
   ↓
Tickets disponibles en "Mis Tickets"
   ↓
Correo de confirmación
```

## Reservas temporales

La reserva temporal es fundamental para controlar compras simultáneas.

Ejemplo:

```text
Quedan 2 boletos VIP.
```

Dos usuarios podrían intentar comprar esos mismos boletos simultáneamente.

El servidor debe controlar el inventario y crear una reserva temporal:

```text
Reserva:
2 × VIP
Expira: 10 minutos
```

Durante ese tiempo los boletos reservados dejan de estar disponibles para otros compradores.

Si el usuario no completa el proceso:

```text
Reserva expira
       ↓
Inventario vuelve a estar disponible
```

## Pago fallido

```text
Pago rechazado
↓
Compra = FALLIDA
↓
No generar tickets
↓
Liberar reserva
```

## Boletos agotados

Si todavía no existe una reserva:

```text
Verificar stock
↓
No disponible
↓
No permitir continuar
```

Una reserva creada correctamente debe proteger ese inventario durante el checkout.

## Límite de tickets

La regla debe comprobarse en backend.

Ejemplo:

```text
VIP

Máximo por usuario: 4
Ya compró: 3
Intenta comprar: 2

Resultado:
RECHAZADO
```

No debe depender únicamente del selector mostrado en el frontend.

## Evento cancelado

```text
Evento → CANCELADO

↓
Bloquear nuevas ventas
↓
Invalidar/cancelar tickets según política
↓
Identificar compras afectadas
↓
Iniciar proceso de reembolso
↓
Notificar clientes
```

## Reembolso

```text
Administrador solicita reembolso
↓
Backend solicita refund
↓
Proveedor procesa
↓
Webhook confirma
↓
Pago = REEMBOLSADO
↓
Ticket = REEMBOLSADO
↓
QR deja de ser válido
```

---

# 7. Flujo de validación QR

```text
Personal de acceso
        ↓
Login
        ↓
Selecciona evento
        ↓
Abre cámara
        ↓
Escanea QR
        ↓
Frontend obtiene token
        ↓
POST /validar-ticket
        ↓
Backend
        ↓
Busca ticket
        ↓
Valida firma/token
        ↓
Comprueba evento
        ↓
Comprueba estado
        ↓
Registra acceso atómicamente
        ↓
Respuesta
```

## Ticket válido

```text
┌────────────────────────┐
│       ✓ VÁLIDO         │
│                        │
│ General                │
│ Ticket #ABC...         │
│ Entrada autorizada     │
└────────────────────────┘
```

## Ticket utilizado

```text
┌────────────────────────┐
│    ✕ YA UTILIZADO      │
│                        │
│ Entrada registrada     │
│ 20:43                  │
└────────────────────────┘
```

## Ticket inexistente

```text
┌────────────────────────┐
│      ✕ INVÁLIDO        │
│                        │
│ QR no reconocido       │
└────────────────────────┘
```

## Prevención del doble escaneo

Dos empleados podrían escanear simultáneamente el mismo QR.

La operación de:

```text
VALIDO → UTILIZADO
```

debe ser **atómica y transaccional**.

Solo uno de los dispositivos podrá registrar el acceso correctamente. El segundo deberá recibir la respuesta `YA UTILIZADO`.

La base de datos también debe participar en esta garantía mediante restricciones y transacciones adecuadas.

---

# 8. Plan de trabajo dividido en fases

## Fase 1 — Planeación y arquitectura

### Objetivo

Establecer las reglas fundamentales del sistema.

### Módulos involucrados

Todos los módulos a nivel conceptual.

### Tareas principales

- Definir arquitectura.
- Seleccionar stack tecnológico.
- Definir dominios.
- Documentar reglas de negocio.
- Definir estados.
- Definir roles y permisos.
- Crear diagramas iniciales.

### Dependencias

Ninguna.

### Resultado esperado

Documento maestro y arquitectura aprobada.

---

## Fase 2 — Base de datos

### Objetivo

Diseñar el modelo de información.

### Módulos involucrados

- Usuarios.
- Eventos.
- Tickets.
- Compras.
- Pagos.
- Accesos.

### Tareas principales

- Modelo entidad-relación.
- Claves primarias y foráneas.
- Índices.
- Constraints.
- Auditoría.
- Estrategia de migraciones.

### Dependencias

Fase 1.

### Resultado esperado

Modelo de datos listo para implementación.

---

## Fase 3 — Backend y autenticación

### Objetivo

Construir la base de la API.

### Módulos involucrados

- Auth.
- Usuarios.
- Roles.
- Permisos.

### Tareas principales

- Registro.
- Login.
- Sesiones o tokens.
- Recuperación de contraseña.
- Middleware de autorización.
- Protección de API.

### Dependencias

Fases 1 y 2.

### Resultado esperado

Usuarios autenticados y autorización funcional.

---

## Fase 4 — Frontend público

### Objetivo

Permitir descubrir eventos.

### Módulos involucrados

- Landing.
- Catálogo.
- Detalle del evento.
- Registro.
- Login.

### Dependencias

API básica.

### Resultado esperado

Los visitantes pueden encontrar y consultar eventos.

---

## Fase 5 — Administración de eventos

### Objetivo

Permitir alimentar la plataforma sin modificar código.

### Módulos involucrados

- Administración.
- Eventos.
- Categorías.
- Ubicaciones.
- Imágenes.
- TiposTicket.
- Inventario.

### Dependencias

Autenticación y permisos.

### Resultado esperado

El administrador puede crear y publicar un evento completo.

---

## Fase 6 — Sistema de compra

### Objetivo

Construir la lógica comercial.

### Módulos involucrados

- Selección de tickets.
- Inventario.
- Reservas.
- Checkout.
- Compras.
- DetalleCompra.

### Tareas principales

- Selección de entradas.
- Control de disponibilidad.
- Límites por usuario.
- Reservas temporales.
- Expiración de reservas.
- Creación de órdenes.
- Control de concurrencia.

### Dependencias

Eventos y usuarios.

### Resultado esperado

Compra preparada para recibir el pago.

---

## Fase 7 — Integración de pagos

### Objetivo

Cobrar de manera segura.

### Módulos involucrados

- Payments.
- Checkout.
- Webhooks.

### Tareas principales

- Crear intención de pago.
- Recibir resultado.
- Validar webhook.
- Implementar idempotencia.
- Confirmar compra.
- Gestionar errores.
- Reembolsos básicos.

### Dependencias

Fase 6.

### Resultado esperado

Una compra puede pasar realmente al estado `PAGADA`.

---

## Fase 8 — Tickets y QR

### Objetivo

Emitir entradas únicamente después del pago confirmado.

### Flujo

```text
Pago confirmado
↓
Tickets
↓
Identificador único
↓
Token QR
↓
QR
↓
Mis Tickets
```

### Dependencias

Sistema de pagos.

### Resultado esperado

El comprador obtiene sus entradas digitales.

---

## Fase 9 — Scanner y accesos

### Objetivo

Permitir utilizar los tickets en el evento.

### Módulos involucrados

- Scanner.
- Validación.
- Accesos.
- HistorialEscaneos.

### Dependencias

Tickets.

### Resultado esperado

Un QR válido permite una entrada y no puede reutilizarse.

---

## Fase 10 — Pruebas y seguridad

### Objetivo

Intentar romper el sistema antes de producción.

### Casos críticos

- Compras simultáneas.
- Doble escaneo.
- Manipulación de precios.
- QR falsos.
- Replay de QR.
- Webhooks falsos.
- Webhooks duplicados.
- Permisos incorrectos.
- Rate limiting.
- Sesiones.
- Reservas expiradas.

### Dependencias

Sistema funcional completo.

### Resultado esperado

MVP candidato a producción.

---

## Fase 11 — Despliegue

### Objetivo

Llevar el sistema a producción.

### Incluye

- Dominio.
- HTTPS.
- Frontend.
- API.
- Base de datos.
- Storage.
- Backups.
- Logs.
- Monitoring.
- Variables secretas.
- CI/CD.

### Resultado esperado

Plataforma pública operativa.

---

## Fase 12 — Evolución

### Objetivo

Ampliar la plataforma una vez validado el negocio.

Posibles funcionalidades:

- Más ciudades.
- Organizadores externos.
- Mapas de asientos.
- Promociones.
- Cupones.
- Transferencias.
- Apple Wallet.
- Google Wallet.
- Analytics.
- Aplicación móvil.
- Check-in offline.
- Venta en taquilla.

---

# 9. Funcionalidades del MVP

El objetivo del MVP es completar correctamente el siguiente flujo:

```text
ADMIN
  │
  ▼
Crear evento
  │
  ▼
Crear tipo de boleto
  │
  ▼
Publicar
  │
  ▼
CLIENTE
  │
  ▼
Ver evento
  │
  ▼
Seleccionar boletos
  │
  ▼
Checkout
  │
  ▼
Pagar
  │
  ▼
Ticket + QR
  │
  ▼
PERSONAL ACCESO
  │
  ▼
Escanear
  │
  ▼
Validar
  │
  ▼
ENTRADA
```

## Incluido en el MVP

- Registro y login.
- Roles básicos.
- Landing Page.
- Catálogo de eventos.
- Detalle del evento.
- Administración de eventos.
- Tipos de boleto.
- Precios.
- Stock.
- Límite por compra.
- Selección de tickets.
- Reserva temporal.
- Checkout.
- Pago.
- Webhooks.
- Compra.
- Tickets individuales.
- QR seguro.
- Mis Tickets.
- Historial de compras.
- Email de confirmación.
- Scanner móvil.
- Validación.
- Prevención de doble acceso.
- Historial básico de accesos.
- Cancelación.
- Reembolso básico.
- Logs.
- Auditoría administrativa esencial.

---

# 10. Funcionalidades para versiones futuras

Se recomienda dejar fuera del MVP:

- Selección gráfica de asientos.
- Aplicación iOS/Android.
- Scanner offline.
- Google Wallet.
- Apple Wallet.
- Marketplace y reventa.
- Transferencia de tickets.
- Tickets dinámicos.
- Precios dinámicos.
- Códigos promocionales avanzados.
- Programa de fidelidad.
- Venta física.
- Múltiples organizadores.
- Comisiones configurables.
- Pagos divididos.
- Facturación avanzada.
- Dashboard BI.
- Recomendaciones.
- Sistema de afiliados.
- Lista de espera.
- Eventos recurrentes avanzados.
- Multiidioma.
- Multimoneda.

La selección gráfica de asientos debería evitarse inicialmente debido a la complejidad adicional que introduce en el control de inventario y concurrencia.

---

# 11. Riesgos técnicos importantes

## Inventario y concurrencia

Dos personas no deben poder comprar el último boleto al mismo tiempo.

El control debe diseñarse desde:

```text
Base de datos → Backend → Reserva → Checkout
```

## Pagos

Nunca se debe emitir un ticket porque el navegador indique que el pago fue exitoso.

La confirmación debe provenir del proveedor de pagos y procesarse de forma idempotente.

## QR y doble acceso

Una captura del QR puede copiarse, pero solamente el primer uso válido debe producir un acceso.

Los intentos posteriores deben ser rechazados.

## Webhooks duplicados

Los proveedores pueden enviar el mismo evento varias veces.

Si llega dos veces:

```text
payment_success
```

el sistema no debe generar dos juegos de tickets.

El procesamiento debe ser idempotente.

## Seguridad administrativa

El panel administrativo es uno de los puntos más sensibles.

Debe existir:

- Autorización en backend.
- Auditoría.
- Principio de mínimo privilegio.
- Protección de endpoints.
- Registro de acciones importantes.

## Consideraciones adicionales

Desde el principio deberán contemplarse:

- Expiración correcta de reservas.
- Secretos fuera del repositorio.
- HTTPS obligatorio.
- Rate limiting.
- Validación de inputs.
- Protección de archivos.
- Backups.
- Logs.
- Monitoreo.
- Diseño responsive.
- Escaneo desde teléfonos.
- Escalabilidad para múltiples ciudades.

---

# 12. Orden recomendado para comenzar el desarrollo

No se recomienda comenzar por la Landing Page.

El orden sugerido es:

```text
01. Reglas del negocio
        ↓
02. Modelo de datos
        ↓
03. Arquitectura Backend
        ↓
04. Usuarios / Auth / Roles
        ↓
05. Eventos
        ↓
06. Tipos de ticket
        ↓
07. Inventario
        ↓
08. Panel Admin básico
        ↓
09. Catálogo público
        ↓
10. Detalle evento
        ↓
11. Reservas temporales
        ↓
12. Compra / Checkout
        ↓
13. Pagos
        ↓
14. Webhooks
        ↓
15. Generación Tickets
        ↓
16. QR
        ↓
17. Mis Tickets
        ↓
18. Scanner
        ↓
19. Validación de acceso
        ↓
20. Emails
        ↓
21. Reembolsos / cancelaciones
        ↓
22. Seguridad + pruebas
        ↓
23. Producción
```

---

# Arquitectura objetivo del MVP

```text
                        PLATAFORMA TICKETS
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
       CLIENTE              ADMIN              ACCESO
          │                    │                    │
     Web pública            Backoffice           Scanner
     Mi cuenta              Eventos              móvil
     Checkout               Inventario             │
     Tickets                Ventas                 │
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                            API REST
                               │
       ┌───────────────┬───────┼────────┬───────────────┐
       │               │       │        │               │
      Auth          Eventos  Compras   Tickets        Accesos
       │               │       │        │               │
       └───────────────┴───────┼────────┴───────────────┘
                               │
                          Base de datos
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
           Pagos             Storage           Email
             │
          Webhooks
```

---

# Conclusión

Esta estructura permite dividir el proyecto en piezas suficientemente independientes para convertir posteriormente cada fase en:

```text
Fase
 ↓
Épica
 ↓
Historia de usuario
 ↓
Tarea técnica
 ↓
Endpoint / Pantalla / Tabla
 ↓
Pruebas
```

Antes de comenzar a escribir código, los siguientes documentos recomendados son:

1. **Reglas de negocio completas.**
2. **Modelo entidad-relación de la base de datos.**

En ellos deberán definirse con precisión los estados y transiciones permitidas para:

- Eventos.
- Compras.
- Pagos.
- Reservas.
- Tickets.
- Accesos.

Esto permitirá construir posteriormente el checkout, pagos y sistema QR sobre reglas estables y evitar cambios estructurales costosos durante el desarrollo.
