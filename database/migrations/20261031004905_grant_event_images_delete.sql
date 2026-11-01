-- F04-T03: el rol de la API necesita borrar la referencia después de eliminar
-- el objeto mediante Storage API. No se concede DELETE a otros roles ni tablas.
GRANT DELETE ON tickets_app.evento_imagenes TO tickets_app_runtime;
