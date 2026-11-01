# Instrucciones del proyecto Vtickets

- Antes de trabajar con Supabase, Auth, Storage o migraciones, lee `vendor/supabase-skills/supabase/SKILL.md` y las referencias pertinentes.
- Antes de diseñar o modificar PostgreSQL, índices, conexiones, concurrencia o RLS, lee `vendor/supabase-skills/supabase-postgres-best-practices/SKILL.md` y las referencias pertinentes.
- Sigue el orden de entregas y las dependencias de `plan.md` y `Vtickets_requerimientos.md`.
- Antes de instalar nuevas skills o dependencias del backend, confirma con el usuario salvo que ya lo haya autorizado en la conversación.
- En todos los formularios actuales y futuros, usa controles adecuados al dato y valida por campo. Ante un error de guardado, conserva lo escrito y los archivos elegidos, muestra el motivo junto al campo, márcalo en rojo con `aria-invalid` y enfoca el primer error. No redirijas ni limpies el formulario hasta guardar con éxito; conserva la validación del backend.
