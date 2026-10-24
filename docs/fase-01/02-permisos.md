# Matriz de permisos del MVP

**Estado: borrador de F01-T02.** La autorización definitiva siempre se comprueba en NestJS. El usuario autenticado no obtiene permisos de negocio por conocer un identificador o manipular el frontend.

| Operación | Visitante | Cliente | Administrador | Personal de acceso |
|---|---|---|---|---|
| Ver catálogo y evento publicado | Sí | Sí | Sí | Sí |
| Registrarse e iniciar sesión | Sí | Sí | Sí | Sí |
| Ver y editar perfil propio | No | Sí | Sí | Sí |
| Reservar y comprar para sí | No | Sí | Sí, como cliente | No por su rol de acceso |
| Ver compras, tickets y QR propios | No | Sí | Sí, como cliente | Sí, como cliente si también tiene ese rol |
| Crear, editar, publicar o cancelar eventos | No | No | Sí | No |
| Configurar tipos, precios, stock y ventanas | No | No | Sí | No |
| Ver ventas y gestionar reembolsos | No | No | Sí | No |
| Asignar personal de acceso a un evento | No | No | Sí | No |
| Escanear y registrar acceso | No | No | No por defecto | Solo eventos asignados |
| Ver resultado inmediato del escaneo | No | No | No por defecto | Solo eventos asignados; datos mínimos |
| Ver historial de accesos y escaneos | No | No | Sí | No por defecto |
| Ver auditoría administrativa | No | No | Sí | No |

## Reglas de alcance

- El cliente solo lee sus compras, tickets y perfil. Un administrador puede consultar compras y tickets para soporte; cada consulta y cambio sensible queda auditado.
- El personal de acceso recibe asignación explícita por evento. La asignación se comprueba en cada validación; una sesión iniciada antes de retirar el permiso no conserva acceso al evento.
- El scanner devuelve un resultado claro (`válido`, `ya utilizado`, `inválido`, `evento incorrecto`, `ticket anulado`), sin revelar datos de pago, ventas ni el perfil completo del comprador.
- Una misma persona puede tener varios roles. Para comprar necesita el rol de cliente, incluso si también administra o escanea. El permiso no se infiere del rol visible en la pantalla.
- **Confirmado:** solo el administrador interno publica eventos en el MVP. Los organizadores externos pertenecen a una versión posterior.
