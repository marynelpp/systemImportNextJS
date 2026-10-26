-- Ejecutar en la base existente. No modifica tablas de otros esquemas.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF SCHEMA_ID(N'importadora') IS NULL EXEC(N'CREATE SCHEMA importadora AUTHORIZATION dbo');
IF OBJECT_ID(N'importadora.Usuarios', N'U') IS NOT NULL
    THROW 50001, 'El módulo de seguridad ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.Roles (
 Id int IDENTITY PRIMARY KEY,
 Nombre nvarchar(60) NOT NULL UNIQUE,
 EsAdministrador bit NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX UX_RolAdministrador ON importadora.Roles(EsAdministrador) WHERE EsAdministrador = 1;
CREATE TABLE importadora.Permisos (
 Codigo varchar(80) PRIMARY KEY,
 Descripcion nvarchar(160) NOT NULL
);
CREATE TABLE importadora.RolPermisos (
 RolId int NOT NULL REFERENCES importadora.Roles(Id),
 PermisoCodigo varchar(80) NOT NULL REFERENCES importadora.Permisos(Codigo),
 PRIMARY KEY(RolId, PermisoCodigo)
);
CREATE TABLE importadora.Usuarios (
 Id int IDENTITY PRIMARY KEY,
 Nombre nvarchar(100) NOT NULL,
 Email nvarchar(254) NOT NULL UNIQUE,
 PasswordHash varchar(200) NOT NULL,
 Estado varchar(12) NOT NULL DEFAULT 'pendiente'
   CHECK (Estado IN ('pendiente','activo','inactivo')),
 RolId int NULL REFERENCES importadora.Roles(Id),
 CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT CK_UsuarioActivoRol CHECK (Estado <> 'activo' OR RolId IS NOT NULL)
);
CREATE TABLE importadora.Sesiones (
 TokenHash char(64) PRIMARY KEY,
 UsuarioId int NOT NULL REFERENCES importadora.Usuarios(Id),
 CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 ExpiraEn datetime2 NOT NULL
);
CREATE INDEX IX_SesionesUsuario ON importadora.Sesiones(UsuarioId);
CREATE INDEX IX_SesionesExpiracion ON importadora.Sesiones(ExpiraEn);
CREATE TABLE importadora.LimitesAcceso (
 Clave char(64) PRIMARY KEY,
 Intentos int NOT NULL,
 ReiniciaEn datetime2 NOT NULL
);
CREATE TABLE importadora.Auditoria (
 Id bigint IDENTITY PRIMARY KEY,
 UsuarioId int NULL REFERENCES importadora.Usuarios(Id),
 Accion varchar(80) NOT NULL,
 EntidadId int NULL,
 Detalle nvarchar(500) NULL,
 CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_AuditoriaFecha ON importadora.Auditoria(CreadoEn);
INSERT importadora.Roles(Nombre,EsAdministrador) VALUES
 (N'Administrador',1),(N'Compras',0),(N'Almacén',0),(N'Ventas',0),(N'Consulta',0);
INSERT importadora.Permisos(Codigo,Descripcion) VALUES
 ('panel.ver',N'Acceder al panel general'),
 ('usuarios.administrar',N'Aprobar, asignar roles y desactivar usuarios'),
 ('roles.administrar',N'Consultar roles; solo el administrador modifica permisos'),
 ('auditoria.ver',N'Consultar el historial de seguridad');
INSERT importadora.RolPermisos(RolId,PermisoCodigo)
 SELECT Id,'panel.ver' FROM importadora.Roles WHERE EsAdministrador=0;
COMMIT;
