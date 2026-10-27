-- Catálogo de clientes. Ejecutar después de 011-recepcion-inventario.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.Productos', N'U') IS NULL THROW 50120, 'Primero ejecute los módulos anteriores.', 1;
IF OBJECT_ID(N'importadora.Clientes', N'U') IS NOT NULL THROW 50121, 'El módulo de clientes ya existe.', 1;

CREATE TABLE importadora.Clientes (
    Id int IDENTITY CONSTRAINT PK_Clientes PRIMARY KEY,
    Codigo varchar(20) NOT NULL CONSTRAINT UQ_Clientes_Codigo UNIQUE,
    Tipo varchar(12) NOT NULL CONSTRAINT CK_Clientes_Tipo CHECK(Tipo IN ('natural','empresa')),
    Nombre nvarchar(160) NOT NULL,
    Documento varchar(30) NULL,
    Telefono nvarchar(40) NULL,
    Email nvarchar(254) NULL,
    Direccion nvarchar(300) NULL,
    Notas nvarchar(500) NULL,
    Activo bit NOT NULL CONSTRAINT DF_Clientes_Activo DEFAULT 1,
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_Clientes_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn datetime2 NOT NULL CONSTRAINT DF_Clientes_ActualizadoEn DEFAULT SYSUTCDATETIME()
);
CREATE UNIQUE INDEX UX_Clientes_Documento ON importadora.Clientes(Documento) WHERE Documento IS NOT NULL;
CREATE INDEX IX_Clientes_Nombre ON importadora.Clientes(Activo,Nombre);
INSERT importadora.Permisos(Codigo,Descripcion) VALUES
  ('clientes.ver',N'Consultar clientes'),('clientes.administrar',N'Crear y modificar clientes');
INSERT importadora.RolPermisos(RolId,PermisoCodigo)
SELECT r.Id,p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p
WHERE (r.Nombre IN(N'Ventas',N'Consulta') AND p.Codigo='clientes.ver') OR (r.Nombre=N'Ventas' AND p.Codigo='clientes.administrar');
COMMIT;
