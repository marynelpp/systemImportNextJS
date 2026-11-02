-- Mínimos de reposición independientes por producto y almacén.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.Productos', N'U') IS NULL OR OBJECT_ID(N'importadora.Almacenes', N'U') IS NULL THROW 50150, 'Primero ejecute los módulos de catálogo y configuración.', 1;
IF OBJECT_ID(N'importadora.ProductoAlmacenMinimos', N'U') IS NULL
 CREATE TABLE importadora.ProductoAlmacenMinimos(
  ProductoId int NOT NULL CONSTRAINT FK_ProductoAlmacenMinimos_Producto REFERENCES importadora.Productos(Id),
  AlmacenId int NOT NULL CONSTRAINT FK_ProductoAlmacenMinimos_Almacen REFERENCES importadora.Almacenes(Id),
  CantidadMinima decimal(19,4) NOT NULL CONSTRAINT CK_ProductoAlmacenMinimos_Cantidad CHECK(CantidadMinima>=0),
  ActualizadoPorUsuarioId int NOT NULL CONSTRAINT FK_ProductoAlmacenMinimos_Usuario REFERENCES importadora.Usuarios(Id),
  ActualizadoEn datetime2 NOT NULL CONSTRAINT DF_ProductoAlmacenMinimos_ActualizadoEn DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_ProductoAlmacenMinimos PRIMARY KEY(ProductoId,AlmacenId));
COMMIT;
