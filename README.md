# Nexo Import

Sistema de gestión para una importadora China–Venezuela. Next.js, TypeScript y SQL Server. Primera etapa: landing, acceso, usuarios, roles y auditoría.

## Inicio

Usar Node.js 24 (mínimo 22.13). Ejecutar `npm install` y `npm run dev`. Abrir http://localhost:3000.

La conexión privada vive en `.env.local`, excluido de Git. No compartir ni publicar ese archivo.

## Habilitar el acceso

1. Ejecutar los scripts de `database/` en orden: `001-seguridad.sql`, `002-invitaciones.sql` y `003-configuracion-monedas.sql`.
2. Ejecutar `npm run db:check`.
3. Ejecutar `npm run admin:create` para crear el administrador inicial con contraseña de entrada oculta.
4. Iniciar sesión y crear invitaciones desde Usuarios. Cada persona recibe un enlace para definir su propia contraseña.

Sin servicio de correo, el panel muestra un enlace único para copiar. No lo compartas por canales públicos; cuando exista dominio y correo, ese mismo enlace se enviará automáticamente. `npm run admin:reset` permite restablecer una contraseña localmente, luego de verificar al solicitante.

## Validación

`npm run lint`, `npm run build`, `npm test`.

Ver `docs/IMPLEMENTACION.md` para el alcance, decisiones, estado de pruebas y limitaciones pendientes.

La tasa USD/VES se registra desde Configuración con fecha de vigencia y fuente BCV o manual. Cada fecha conserva su propio historial.
