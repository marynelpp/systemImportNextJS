/* Tasa BCV confirmada para cada pedido en bolívares.
   La tasa se guarda al crear el pedido y no se recalcula después. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.PedidosVenta', N'TasaBCV') IS NULL
BEGIN
  EXEC(N'ALTER TABLE importadora.PedidosVenta ADD TasaBCV decimal(19,6) NULL;');
  EXEC(N'ALTER TABLE importadora.PedidosVenta
    ADD CONSTRAINT CK_PedidosVenta_TasaBCV CHECK (TasaBCV IS NULL OR TasaBCV > 0);');
END;

COMMIT;
