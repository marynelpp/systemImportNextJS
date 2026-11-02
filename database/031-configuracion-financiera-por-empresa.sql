/* Márgenes y tasas de cambio independientes por importadora. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.ConfiguracionMargenesVenta',N'U') IS NULL OR OBJECT_ID(N'importadora.TasasCambio',N'U') IS NULL
  THROW 50150, 'Primero ejecute los módulos de configuración y márgenes.', 1;

DECLARE @initialCompany int=(SELECT TOP 1 Id FROM importadora.Empresas ORDER BY Id);
IF @initialCompany IS NULL THROW 50150, 'No existe una empresa inicial.', 1;

IF COL_LENGTH(N'importadora.ConfiguracionMargenesVenta',N'EmpresaId') IS NULL
  ALTER TABLE importadora.ConfiguracionMargenesVenta ADD EmpresaId int NULL CONSTRAINT FK_Margenes_Empresa REFERENCES importadora.Empresas(Id);

EXEC sp_executesql N'UPDATE importadora.ConfiguracionMargenesVenta SET EmpresaId=@company WHERE EmpresaId IS NULL;',N'@company int',@company=@initialCompany;

DECLARE @marginPk sysname=(SELECT TOP 1 name FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID(N'importadora.ConfiguracionMargenesVenta') AND type='PK');
IF @marginPk IS NOT NULL
BEGIN
  DECLARE @dropMarginSql nvarchar(500)=N'ALTER TABLE importadora.ConfiguracionMargenesVenta DROP CONSTRAINT '+QUOTENAME(@marginPk)+N';';
  EXEC sp_executesql @dropMarginSql;
END;

EXEC sp_executesql N'ALTER TABLE importadora.ConfiguracionMargenesVenta ALTER COLUMN EmpresaId int NOT NULL;';
EXEC sp_executesql N'ALTER TABLE importadora.ConfiguracionMargenesVenta ADD CONSTRAINT PK_ConfiguracionMargenesVenta PRIMARY KEY(EmpresaId,Id);';

EXEC sp_executesql N'
  INSERT importadora.ConfiguracionMargenesVenta(Id,EmpresaId,MargenMayor,MargenDetal)
  SELECT 1,e.Id,35.00,55.00 FROM importadora.Empresas e
  WHERE NOT EXISTS(SELECT 1 FROM importadora.ConfiguracionMargenesVenta m WHERE m.EmpresaId=e.Id AND m.Id=1);';

IF COL_LENGTH(N'importadora.TasasCambio',N'EmpresaId') IS NULL
  ALTER TABLE importadora.TasasCambio ADD EmpresaId int NULL CONSTRAINT FK_TasasCambio_Empresa REFERENCES importadora.Empresas(Id);

EXEC sp_executesql N'UPDATE importadora.TasasCambio SET EmpresaId=@company WHERE EmpresaId IS NULL;',N'@company int',@company=@initialCompany;

DECLARE @rateUq sysname=(SELECT TOP 1 kc.name FROM sys.key_constraints kc JOIN sys.index_columns ic ON ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE kc.parent_object_id=OBJECT_ID(N'importadora.TasasCambio') AND kc.type='UQ' AND c.name=N'FechaVigencia');
IF @rateUq IS NOT NULL
BEGIN
  DECLARE @dropRateSql nvarchar(500)=N'ALTER TABLE importadora.TasasCambio DROP CONSTRAINT '+QUOTENAME(@rateUq)+N';';
  EXEC sp_executesql @dropRateSql;
END;

EXEC sp_executesql N'ALTER TABLE importadora.TasasCambio ALTER COLUMN EmpresaId int NOT NULL;';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.TasasCambio') AND name=N'UX_TasasCambio_Empresa_ParFecha')
  EXEC sp_executesql N'CREATE UNIQUE INDEX UX_TasasCambio_Empresa_ParFecha ON importadora.TasasCambio(EmpresaId,MonedaBase,MonedaDestino,FechaVigencia);';

COMMIT;
