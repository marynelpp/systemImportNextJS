/* Cierres de caja separados por empresa. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.CierresCaja',N'U') IS NULL
  THROW 50140, 'Primero ejecute 026-cierres-caja.sql.', 1;

IF COL_LENGTH(N'importadora.CierresCaja',N'EmpresaId') IS NULL
  ALTER TABLE importadora.CierresCaja ADD EmpresaId int NULL
    CONSTRAINT FK_CierresCaja_Empresa REFERENCES importadora.Empresas(Id);

DECLARE @initialCompany int=(SELECT TOP 1 Id FROM importadora.Empresas ORDER BY Id);
IF @initialCompany IS NULL THROW 50140, 'No existe una empresa inicial.', 1;

EXEC sp_executesql N'
  UPDATE importadora.CierresCaja SET EmpresaId=@company WHERE EmpresaId IS NULL;',
  N'@company int', @company=@initialCompany;

DECLARE @constraint sysname=(SELECT TOP 1 kc.name FROM sys.key_constraints kc JOIN sys.index_columns ic ON ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE kc.parent_object_id=OBJECT_ID(N'importadora.CierresCaja') AND kc.type='UQ' AND c.name=N'Fecha');
IF @constraint IS NOT NULL
BEGIN
  DECLARE @dropConstraintSql nvarchar(500)=N'ALTER TABLE importadora.CierresCaja DROP CONSTRAINT '+QUOTENAME(@constraint)+N';';
  EXEC sp_executesql @dropConstraintSql;
END;

ALTER TABLE importadora.CierresCaja ALTER COLUMN EmpresaId int NOT NULL;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.CierresCaja') AND name=N'UX_CierresCaja_Empresa_Fecha')
  CREATE UNIQUE INDEX UX_CierresCaja_Empresa_Fecha ON importadora.CierresCaja(EmpresaId,Fecha);
COMMIT;
