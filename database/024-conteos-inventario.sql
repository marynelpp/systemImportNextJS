-- Conteos físicos por lote y almacén.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.InventarioLotes', N'U') IS NULL THROW 50140, 'Primero ejecute 011-recepcion-inventario.sql.', 1;
IF OBJECT_ID(N'importadora.ConteosInventario', N'U') IS NULL
BEGIN
 CREATE TABLE importadora.ConteosInventario(
  Id bigint IDENTITY CONSTRAINT PK_ConteosInventario PRIMARY KEY, Numero varchar(30) NOT NULL CONSTRAINT UQ_ConteosInventario_Numero UNIQUE,
  AlmacenId int NOT NULL CONSTRAINT FK_ConteosInventario_Almacen REFERENCES importadora.Almacenes(Id), Fecha date NOT NULL,
  Estado varchar(12) NOT NULL CONSTRAINT CK_ConteosInventario_Estado CHECK(Estado IN('borrador','aplicado')) DEFAULT 'borrador',
  Observaciones nvarchar(300) NULL, CreadoPorUsuarioId int NOT NULL CONSTRAINT FK_ConteosInventario_CreadoPor REFERENCES importadora.Usuarios(Id),
  CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), AplicadoPorUsuarioId int NULL CONSTRAINT FK_ConteosInventario_AplicadoPor REFERENCES importadora.Usuarios(Id), AplicadoEn datetime2 NULL);
 CREATE TABLE importadora.ConteoInventarioDetalles(
  Id bigint IDENTITY CONSTRAINT PK_ConteoInventarioDetalles PRIMARY KEY, ConteoId bigint NOT NULL CONSTRAINT FK_ConteoInventarioDetalles_Conteo REFERENCES importadora.ConteosInventario(Id),
  LoteId int NOT NULL CONSTRAINT FK_ConteoInventarioDetalles_Lote REFERENCES importadora.InventarioLotes(Id), CantidadSistema decimal(19,4) NOT NULL CHECK(CantidadSistema>=0), CantidadFisica decimal(19,4) NULL CHECK(CantidadFisica>=0), CONSTRAINT UQ_ConteoInventarioDetalle UNIQUE(ConteoId,LoteId));
 CREATE INDEX IX_ConteosInventario_AlmacenFecha ON importadora.ConteosInventario(AlmacenId,CreadoEn DESC);
END;
COMMIT;
