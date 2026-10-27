-- Compras internacionales e importaciones. Ejecutar después de 004 y 006.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.Productos',N'U') IS NULL OR OBJECT_ID(N'importadora.Proveedores',N'U') IS NULL THROW 50100,'Primero ejecute los módulos de catálogo.',1;
IF OBJECT_ID(N'importadora.OrdenesCompra',N'U') IS NOT NULL THROW 50101,'El módulo de compras ya existe.',1;
CREATE TABLE importadora.OrdenesCompra(
 Id int IDENTITY PRIMARY KEY, Numero varchar(30) NOT NULL UNIQUE, ProveedorId int NOT NULL REFERENCES importadora.Proveedores(Id),
 Fecha date NOT NULL, Estado varchar(15) NOT NULL DEFAULT 'borrador' CHECK(Estado IN('borrador','confirmada','en_transito','recibida','cancelada')),
 MonedaCodigo char(3) NOT NULL REFERENCES importadora.Monedas(Codigo), Observaciones nvarchar(1000) NULL,
 CreadoPorUsuarioId int NOT NULL REFERENCES importadora.Usuarios(Id), CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE importadora.OrdenCompraDetalles(
 Id int IDENTITY PRIMARY KEY, OrdenCompraId int NOT NULL REFERENCES importadora.OrdenesCompra(Id), ProductoId int NOT NULL REFERENCES importadora.Productos(Id),
 Cantidad decimal(19,4) NOT NULL CHECK(Cantidad>0), CostoUnitario decimal(19,4) NOT NULL CHECK(CostoUnitario>=0), CantidadRecibida decimal(19,4) NOT NULL DEFAULT 0 CHECK(CantidadRecibida>=0), CONSTRAINT UQ_OrdenDetalle UNIQUE(OrdenCompraId,ProductoId));
CREATE TABLE importadora.Importaciones(
 Id int IDENTITY PRIMARY KEY, OrdenCompraId int NOT NULL UNIQUE REFERENCES importadora.OrdenesCompra(Id), Codigo varchar(30) NOT NULL UNIQUE,
 TipoEnvio varchar(10) NOT NULL DEFAULT 'maritimo' CHECK(TipoEnvio IN('maritimo','aereo','terrestre')), AgenteCarga nvarchar(150) NULL, Casillero nvarchar(150) NULL,
 GuiaContenedor nvarchar(100) NULL, FechaSalida date NULL, FechaEstimadaLlegada date NULL, FechaLlegada date NULL, Estado varchar(15) NOT NULL DEFAULT 'preparacion' CHECK(Estado IN('preparacion','en_transito','aduana','recibida','cancelada')), Notas nvarchar(1000) NULL);
CREATE TABLE importadora.ImportacionGastos(
 Id int IDENTITY PRIMARY KEY, ImportacionId int NOT NULL REFERENCES importadora.Importaciones(Id), Concepto nvarchar(120) NOT NULL,
 Monto decimal(19,4) NOT NULL CHECK(Monto>=0), MonedaCodigo char(3) NOT NULL REFERENCES importadora.Monedas(Codigo), Fecha date NOT NULL, TasaBCV decimal(19,6) NULL CHECK(TasaBCV IS NULL OR TasaBCV>0));
INSERT importadora.Permisos(Codigo,Descripcion) VALUES('compras.ver',N'Consultar compras e importaciones'),('compras.administrar',N'Crear y administrar compras e importaciones');
INSERT importadora.RolPermisos(RolId,PermisoCodigo) SELECT r.Id,p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p WHERE r.Nombre=N'Compras' AND p.Codigo IN('compras.ver','compras.administrar');
COMMIT;
