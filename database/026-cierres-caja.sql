-- Apertura y cierre diario de caja expresado en USD.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.CobrosPedido', N'U') IS NULL THROW 50160, 'Primero ejecute el módulo de cobros.', 1;
IF OBJECT_ID(N'importadora.CierresCaja', N'U') IS NULL
 CREATE TABLE importadora.CierresCaja(
  Id bigint IDENTITY CONSTRAINT PK_CierresCaja PRIMARY KEY, Fecha date NOT NULL CONSTRAINT UQ_CierresCaja_Fecha UNIQUE,
  Estado varchar(12) NOT NULL CONSTRAINT CK_CierresCaja_Estado CHECK(Estado IN('abierto','cerrado')) DEFAULT 'abierto',
  SaldoInicialUSD decimal(19,4) NOT NULL CONSTRAINT CK_CierresCaja_Inicial CHECK(SaldoInicialUSD>=0),
  CobrosUSD decimal(19,4) NULL, MontoDeclaradoUSD decimal(19,4) NULL, Observaciones nvarchar(300) NULL,
  AbiertoPorUsuarioId int NOT NULL CONSTRAINT FK_CierresCaja_AbiertoPor REFERENCES importadora.Usuarios(Id), AbiertoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CerradoPorUsuarioId int NULL CONSTRAINT FK_CierresCaja_CerradoPor REFERENCES importadora.Usuarios(Id), CerradoEn datetime2 NULL);
COMMIT;
