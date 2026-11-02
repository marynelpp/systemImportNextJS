/* Conserva el historial de cobros: un pago se revierte, nunca se borra. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.CobrosPedido', N'Estado') IS NULL
BEGIN
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD Estado varchar(12) NOT NULL CONSTRAINT DF_CobrosPedido_Estado DEFAULT ''activo'';');
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD CONSTRAINT CK_CobrosPedido_Estado CHECK (Estado IN (''activo'',''revertido''));');
END;

IF COL_LENGTH(N'importadora.CobrosPedido', N'RevertidoEn') IS NULL
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD RevertidoEn datetime2 NULL;');
IF COL_LENGTH(N'importadora.CobrosPedido', N'RevertidoPorUsuarioId') IS NULL
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD RevertidoPorUsuarioId int NULL REFERENCES importadora.Usuarios(Id);');
IF COL_LENGTH(N'importadora.CobrosPedido', N'MotivoReversion') IS NULL
  EXEC(N'ALTER TABLE importadora.CobrosPedido ADD MotivoReversion nvarchar(300) NULL;');

COMMIT;
