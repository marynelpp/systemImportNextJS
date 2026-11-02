-- Fundación multitenant. Conserva los datos actuales como la primera empresa.
-- No crea una segunda empresa hasta que la aplicación termine de aislar cada módulo.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.Empresas',N'U') IS NULL
BEGIN
  CREATE TABLE importadora.Empresas(
    Id int IDENTITY CONSTRAINT PK_Empresas PRIMARY KEY,
    Codigo varchar(20) NOT NULL CONSTRAINT UQ_Empresas_Codigo UNIQUE,
    NombreLegal nvarchar(150) NOT NULL, NombreComercial nvarchar(150) NULL, Rif nvarchar(20) NULL,
    Telefono nvarchar(30) NULL, Email nvarchar(254) NULL, Direccion nvarchar(300) NULL,
    Activa bit NOT NULL CONSTRAINT DF_Empresas_Activa DEFAULT 1,
    CreadaEn datetime2 NOT NULL CONSTRAINT DF_Empresas_CreadaEn DEFAULT SYSUTCDATETIME());
  INSERT importadora.Empresas(Codigo,NombreLegal,NombreComercial,Rif,Telefono,Email,Direccion)
  SELECT 'EMP-001',NombreLegal,NombreComercial,Rif,Telefono,Email,Direccion FROM importadora.EmpresaConfiguracion WHERE Id=1;
END;

IF OBJECT_ID(N'importadora.UsuarioEmpresas',N'U') IS NULL
BEGIN
  CREATE TABLE importadora.UsuarioEmpresas(
    UsuarioId int NOT NULL CONSTRAINT FK_UsuarioEmpresas_Usuario REFERENCES importadora.Usuarios(Id),
    EmpresaId int NOT NULL CONSTRAINT FK_UsuarioEmpresas_Empresa REFERENCES importadora.Empresas(Id),
    RolId int NOT NULL CONSTRAINT FK_UsuarioEmpresas_Rol REFERENCES importadora.Roles(Id),
    Activo bit NOT NULL CONSTRAINT DF_UsuarioEmpresas_Activo DEFAULT 1,
    AsignadoEn datetime2 NOT NULL CONSTRAINT DF_UsuarioEmpresas_AsignadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_UsuarioEmpresas PRIMARY KEY(UsuarioId,EmpresaId));
  INSERT importadora.UsuarioEmpresas(UsuarioId,EmpresaId,RolId)
  SELECT u.Id,e.Id,u.RolId FROM importadora.Usuarios u CROSS JOIN importadora.Empresas e WHERE u.RolId IS NOT NULL;
END;

DECLARE @empresaId int=(SELECT TOP 1 Id FROM importadora.Empresas ORDER BY Id);
IF @empresaId IS NULL THROW 50170,'No se pudo crear la empresa inicial.',1;

-- Entidades raíz que ya existen: se marcan con la empresa actual sin modificar sus relaciones.
IF COL_LENGTH(N'importadora.Almacenes',N'EmpresaId') IS NULL ALTER TABLE importadora.Almacenes ADD EmpresaId int NULL CONSTRAINT FK_Almacenes_Empresa REFERENCES importadora.Empresas(Id);
IF COL_LENGTH(N'importadora.Productos',N'EmpresaId') IS NULL ALTER TABLE importadora.Productos ADD EmpresaId int NULL CONSTRAINT FK_Productos_Empresa REFERENCES importadora.Empresas(Id);
IF COL_LENGTH(N'importadora.Proveedores',N'EmpresaId') IS NULL ALTER TABLE importadora.Proveedores ADD EmpresaId int NULL CONSTRAINT FK_Proveedores_Empresa REFERENCES importadora.Empresas(Id);
IF COL_LENGTH(N'importadora.Clientes',N'EmpresaId') IS NULL ALTER TABLE importadora.Clientes ADD EmpresaId int NULL CONSTRAINT FK_Clientes_Empresa REFERENCES importadora.Empresas(Id);
IF COL_LENGTH(N'importadora.OrdenesCompra',N'EmpresaId') IS NULL ALTER TABLE importadora.OrdenesCompra ADD EmpresaId int NULL CONSTRAINT FK_OrdenesCompra_Empresa REFERENCES importadora.Empresas(Id);
IF COL_LENGTH(N'importadora.PedidosVenta',N'EmpresaId') IS NULL ALTER TABLE importadora.PedidosVenta ADD EmpresaId int NULL CONSTRAINT FK_PedidosVenta_Empresa REFERENCES importadora.Empresas(Id);

-- EXEC evita que SQL Server valide EmpresaId antes de ejecutar los ALTER TABLE anteriores.
EXEC sp_executesql N'UPDATE importadora.Almacenes SET EmpresaId=@empresaId WHERE EmpresaId IS NULL;',N'@empresaId int',@empresaId;
EXEC sp_executesql N'UPDATE importadora.Productos SET EmpresaId=@empresaId WHERE EmpresaId IS NULL;',N'@empresaId int',@empresaId;
EXEC sp_executesql N'UPDATE importadora.Proveedores SET EmpresaId=@empresaId WHERE EmpresaId IS NULL;',N'@empresaId int',@empresaId;
EXEC sp_executesql N'UPDATE importadora.Clientes SET EmpresaId=@empresaId WHERE EmpresaId IS NULL;',N'@empresaId int',@empresaId;
EXEC sp_executesql N'UPDATE importadora.OrdenesCompra SET EmpresaId=@empresaId WHERE EmpresaId IS NULL;',N'@empresaId int',@empresaId;
EXEC sp_executesql N'UPDATE importadora.PedidosVenta SET EmpresaId=@empresaId WHERE EmpresaId IS NULL;',N'@empresaId int',@empresaId;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Almacenes') AND name=N'IX_Almacenes_Empresa') CREATE INDEX IX_Almacenes_Empresa ON importadora.Almacenes(EmpresaId,Activo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Productos') AND name=N'IX_Productos_Empresa') CREATE INDEX IX_Productos_Empresa ON importadora.Productos(EmpresaId,Activo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Proveedores') AND name=N'IX_Proveedores_Empresa') CREATE INDEX IX_Proveedores_Empresa ON importadora.Proveedores(EmpresaId,Activo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Clientes') AND name=N'IX_Clientes_Empresa') CREATE INDEX IX_Clientes_Empresa ON importadora.Clientes(EmpresaId,Activo);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.OrdenesCompra') AND name=N'IX_OrdenesCompra_Empresa') CREATE INDEX IX_OrdenesCompra_Empresa ON importadora.OrdenesCompra(EmpresaId,Estado);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.PedidosVenta') AND name=N'IX_PedidosVenta_Empresa') CREATE INDEX IX_PedidosVenta_Empresa ON importadora.PedidosVenta(EmpresaId,Estado);
COMMIT;
