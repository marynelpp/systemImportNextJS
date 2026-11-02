-- Precio de venta elegido por pedido. Ejecutar después de 016-comprobantes-cobros.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.PedidosVenta', N'TipoPrecio') IS NULL
BEGIN
  EXEC(N'ALTER TABLE importadora.PedidosVenta ADD TipoPrecio varchar(10) NULL;');
  EXEC(N'UPDATE importadora.PedidosVenta SET TipoPrecio = ''detal'' WHERE TipoPrecio IS NULL;');
  EXEC(N'ALTER TABLE importadora.PedidosVenta ALTER COLUMN TipoPrecio varchar(10) NOT NULL;');
  EXEC(N'ALTER TABLE importadora.PedidosVenta ADD CONSTRAINT CK_PedidosVenta_TipoPrecio CHECK (TipoPrecio IN (''detal'', ''mayor''));');
END;

COMMIT;
