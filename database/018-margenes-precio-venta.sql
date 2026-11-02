-- Márgenes configurables para sugerir precios desde el costo aterrizado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.ConfiguracionMargenesVenta', N'U') IS NULL
BEGIN
  CREATE TABLE importadora.ConfiguracionMargenesVenta (
    Id tinyint NOT NULL CONSTRAINT PK_ConfiguracionMargenesVenta PRIMARY KEY,
    MargenMayor decimal(5,2) NOT NULL CONSTRAINT CK_ConfiguracionMargenesVenta_Mayor CHECK (MargenMayor >= 0 AND MargenMayor < 100),
    MargenDetal decimal(5,2) NOT NULL CONSTRAINT CK_ConfiguracionMargenesVenta_Detal CHECK (MargenDetal >= 0 AND MargenDetal < 100),
    ActualizadoPorUsuarioId int NULL REFERENCES importadora.Usuarios(Id),
    ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_ConfiguracionMargenesVenta_Unica CHECK (Id = 1)
  );
  INSERT importadora.ConfiguracionMargenesVenta(Id, MargenMayor, MargenDetal) VALUES(1, 35.00, 55.00);
END;

COMMIT;
