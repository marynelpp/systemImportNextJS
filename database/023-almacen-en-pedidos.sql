-- Fija el almacén que abastece cada pedido de venta.
-- Ejecutar después de 022-transferencias-inventario.sql, una sola vez.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.PedidosVenta', N'AlmacenId') IS NULL
    ALTER TABLE importadora.PedidosVenta ADD AlmacenId int NULL
        CONSTRAINT FK_PedidosVenta_Almacen REFERENCES importadora.Almacenes(Id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.PedidosVenta') AND name=N'IX_PedidosVenta_Almacen')
    CREATE INDEX IX_PedidosVenta_Almacen ON importadora.PedidosVenta(AlmacenId,Estado);

COMMIT;
