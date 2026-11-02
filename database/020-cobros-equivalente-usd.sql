/* Los pagos pueden recibirse en Bs., pero la cuenta por cobrar se controla en USD. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.CobrosPedido', N'MontoUSD') IS NULL
BEGIN
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD MontoUSD decimal(19,4) NULL;');
  EXEC(N'UPDATE importadora.CobrosPedido SET MontoUSD=Monto WHERE MonedaCodigo=''USD'';');
END;

IF COL_LENGTH(N'importadora.CobrosPedido', N'TasaBCV') IS NULL
BEGIN
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD TasaBCV decimal(19,6) NULL;');
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD CONSTRAINT CK_CobrosPedido_TasaBCV CHECK (TasaBCV IS NULL OR TasaBCV > 0);');
END;

COMMIT;
