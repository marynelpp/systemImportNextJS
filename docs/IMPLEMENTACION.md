# Nexo Import — etapa 1

Nombre provisional. Una empresa, varios almacenes previstos, compras en China y ventas al mayor y detal en Venezuela.

## Preparar el entorno

Requiere Node.js 22.13 o superior (se validó con Node 24). La conexión está en `.env.local`, excluido de Git. No publicar ese archivo. Variables: DB_SERVER, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD. Cifrado TLS y validación del certificado habilitados. Nunca usar variables NEXT_PUBLIC para credenciales.

1. Ejecutar `database/001-seguridad.sql`, `database/002-invitaciones.sql` y después `database/003-configuracion-monedas.sql` sobre la base existente. Las migraciones son transaccionales, usan únicamente el esquema `importadora` y rechazan una segunda ejecución. No se ejecutan automáticamente.
2. `npm install`
3. `npm run db:check` — lectura de conectividad y existencia del módulo; no crea tablas.
4. `npm run admin:create` — solicita nombre, correo y contraseña oculta. Solo permite crear el primer administrador. No hay credenciales predeterminadas.
5. `npm run dev`, abrir http://localhost:3000.

## Funciones disponibles

- Landing, login, activación por invitación y logout. No hay registro público.
- El administrador registra nombre, correo y rol. Se crea un enlace opaco, único, con vencimiento de 7 días. Al activarlo, la persona define su contraseña y la cuenta pasa a activa. Renovar una invitación cancela el enlace anterior.
- Panel privado sin cifras ficticias.
- Configuración de empresa, almacenes y monedas USD/VES. El botón de sincronización consulta `https://www.bcv.org.ve/`, interpreta USD y la “Fecha Valor” oficial y guarda la tasa con fuente BCV. El BCV actualmente omite un certificado intermedio para Node; en Windows existe un respaldo con `curl.exe`/Schannel que conserva la validación TLS activa. Si el BCV no responde o modifica su publicación de forma incompatible, no altera la última tasa válida.
- Aprobación/desactivación de usuarios y asignación de un rol por usuario.
- Administrador con acceso total. Roles configurables. Las cuentas administradoras están protegidas contra modificación desde la interfaz; su contraseña puede restablecerse localmente.
- Solo el administrador modifica el conjunto de permisos; el permiso roles.administrar permite a otros roles consultar esa sección.
- El inicio del panel actúa como página de bienvenida para toda cuenta activa; panel.ver se reserva para los futuros indicadores operativos.
- Auditoría de solicitudes, cambios de acceso, configuración de roles y mantenimiento local.
- Password hashing scrypt con sal aleatoria; sesión opaca de 8 horas, solo su hash en SQL; cookie HttpOnly, SameSite=Lax y Secure en producción.
- Límites persistentes por cuenta y globales para login y registro. El límite global de registro es 30/hora y login 300/15 minutos; ajustar al volumen real antes de publicar. No se confía en cabeceras de IP recibidas del cliente.
- SQL parametrizado y comprobación de permisos en páginas y acciones. Cambiar acceso revoca sesiones.

## Sin correo por ahora

La recuperación muestra instrucciones honestas; no simula correos. El panel permite copiar el enlace de activación, pero un enlace `localhost` solo funciona en la computadora donde corre el sistema: úsalo solo para pruebas locales. Cuando el sistema tenga dominio, configurar `APP_URL=https://tu-dominio` y conectar un proveedor de correo para enviar ese mismo enlace. Para restablecer: `npm run admin:reset`, identificar previamente al solicitante, ingresar su correo y la nueva contraseña. El comando no activa usuarios pendientes. Las contraseñas no se pasan por argumentos ni se imprimen.

## Siguientes etapas

Productos y listas de precios → proveedores y compras → importaciones/recepción → inventario → clientes/pedidos → ventas/caja → reportes. No hay facturación fiscal en esta entrega. La tasa BCV se consulta bajo demanda desde Configuración; antes de publicar se añadirá una tarea programada diaria con monitoreo.

Reglas previstas: separar comprado/en tránsito/disponible; reservar al confirmar pedido y descontar físico al despachar; no descontar dos veces al vender; precio base USD, mayor/detal configurables, tasa histórica por documento y cobro; estados independientes para pedido/pago/entrega y reversos auditables.

## Verificación

`npm run lint`, `npm run build`, `npm test`. Las pruebas completas de registro/login/roles requieren instalar el script SQL y crear el administrador. No se ejecutan migraciones ni se insertan usuarios en la base real durante la verificación de código.

Antes del despliegue: HTTPS, credencial SQL de mínimo privilegio sobre el esquema, proveedor de correo, verificación de correo para invitaciones, política operativa de respaldos y limpieza periódica de sesiones vencidas y límites expirados. Dominio y hosting se definirán después.

Referencias de implementación: https://nextjs.org/docs/app/guides/authentication y https://github.com/tediousjs/node-mssql.

## Resultado de esta entrega

Conexión Azure SQL comprobada mediante una consulta de solo lectura. Tablas todavía no instaladas. Compilación, TypeScript, ESLint y prueba de hash verificados. Prueba de navegador en Edge: navegación, validación de confirmación de contraseña, redirección de panel anónimo, recuperación sin correo y ausencia de desbordamiento horizontal en móvil. No se probaron operaciones autenticadas contra SQL porque la migración está pendiente.

`npm audit` reporta dos alertas altas relacionadas con una dependencia transitiva de `mssql` (`@azure/identity` → `@azure/msal-node`, GHSA-xcx6-jx8p-x3h5). `npm audit fix` no las resolvió con las versiones compatibles publicadas. Esta aplicación usa autenticación SQL y no el flujo OAuth afectado, pero debe resolverse/revisarse antes de publicar; no se forzó un salto de versión mayor de la dependencia.
