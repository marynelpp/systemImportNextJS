-- Ejecutar después de 014-cobros.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.CobrosPedido', N'U') IS NULL
  THROW 50160, 'Primero debe ejecutar 014-cobros.sql.', 1;

IF OBJECT_ID(N'importadora.CobroAdjuntos', N'U') IS NULL
BEGIN
  CREATE TABLE importadora.CobroAdjuntos (
    Id bigint IDENTITY CONSTRAINT PK_CobroAdjuntos PRIMARY KEY,
    CobroPedidoId bigint NOT NULL CONSTRAINT FK_CobroAdjuntos_Cobro REFERENCES importadora.CobrosPedido(Id),
    NombreBlob nvarchar(300) NOT NULL CONSTRAINT UQ_CobroAdjuntos_Blob UNIQUE,
    NombreOriginal nvarchar(255) NOT NULL,
    TipoContenido varchar(100) NOT NULL,
    TamanoBytes int NOT NULL,
    CreadoPorUsuarioId int NOT NULL CONSTRAINT FK_CobroAdjuntos_Usuario REFERENCES importadora.Usuarios(Id),
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_CobroAdjuntos_CreadoEn DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_CobroAdjuntos_Cobro ON importadora.CobroAdjuntos(CobroPedidoId, Id);
END;

COMMIT;
