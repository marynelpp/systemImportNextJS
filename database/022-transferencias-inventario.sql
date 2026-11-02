-- Transferencias de inventario entre almacenes.
-- Ejecutar después de 021-reversion-y-control-cobros.sql, una sola vez.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.InventarioLotes', N'U') IS NULL
    THROW 50130, 'Primero ejecute 011-recepcion-inventario.sql.', 1;

-- Una transferencia genera un lote de destino, por lo que varios lotes pueden
-- provenir del mismo detalle de recepción.
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_InventarioLotes_RecepcionDetalle')
    ALTER TABLE importadora.InventarioLotes DROP CONSTRAINT UQ_InventarioLotes_RecepcionDetalle;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'importadora.InventarioLotes') AND name = N'IX_InventarioLotes_RecepcionDetalle')
    CREATE INDEX IX_InventarioLotes_RecepcionDetalle ON importadora.InventarioLotes(RecepcionDetalleId);

IF OBJECT_ID(N'importadora.TransferenciasInventario', N'U') IS NULL
BEGIN
    CREATE TABLE importadora.TransferenciasInventario (
        Id bigint IDENTITY CONSTRAINT PK_TransferenciasInventario PRIMARY KEY,
        Numero varchar(30) NOT NULL CONSTRAINT UQ_TransferenciasInventario_Numero UNIQUE,
        LoteOrigenId int NOT NULL CONSTRAINT FK_TransferenciasInventario_LoteOrigen REFERENCES importadora.InventarioLotes(Id),
        LoteDestinoId int NULL CONSTRAINT FK_TransferenciasInventario_LoteDestino REFERENCES importadora.InventarioLotes(Id),
        AlmacenOrigenId int NOT NULL CONSTRAINT FK_TransferenciasInventario_AlmacenOrigen REFERENCES importadora.Almacenes(Id),
        AlmacenDestinoId int NOT NULL CONSTRAINT FK_TransferenciasInventario_AlmacenDestino REFERENCES importadora.Almacenes(Id),
        Cantidad decimal(19,4) NOT NULL CONSTRAINT CK_TransferenciasInventario_Cantidad CHECK(Cantidad > 0),
        Observaciones nvarchar(300) NULL,
        CreadoPorUsuarioId int NOT NULL CONSTRAINT FK_TransferenciasInventario_Usuario REFERENCES importadora.Usuarios(Id),
        CreadoEn datetime2 NOT NULL CONSTRAINT DF_TransferenciasInventario_CreadoEn DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_TransferenciasInventario_Almacenes CHECK(AlmacenOrigenId <> AlmacenDestinoId)
    );
    CREATE INDEX IX_TransferenciasInventario_Fecha ON importadora.TransferenciasInventario(CreadoEn DESC);
END;

COMMIT;
