/* Historial de auditoría separado por empresa. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.Auditoria', N'EmpresaId') IS NULL
  ALTER TABLE importadora.Auditoria ADD EmpresaId int NULL;
GO

/* Los eventos de creación de empresa ya contienen el Id de la empresa. */
UPDATE a SET EmpresaId=e.Id
FROM importadora.Auditoria a
JOIN importadora.Empresas e ON a.Accion='empresa.creada' AND a.EntidadId=e.Id
WHERE a.EmpresaId IS NULL;

/* El historial anterior pertenece a la importadora que existía antes del multitenant. */
DECLARE @empresaInicial int=(SELECT TOP 1 Id FROM importadora.Empresas ORDER BY Id);
IF @empresaInicial IS NULL THROW 50133, 'No existe una empresa para asociar la auditoría.', 1;
UPDATE importadora.Auditoria SET EmpresaId=@empresaInicial WHERE EmpresaId IS NULL;

IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Auditoria_Empresa' AND parent_object_id=OBJECT_ID(N'importadora.Auditoria'))
  ALTER TABLE importadora.Auditoria ADD CONSTRAINT FK_Auditoria_Empresa FOREIGN KEY(EmpresaId) REFERENCES importadora.Empresas(Id);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Auditoria') AND name=N'IX_Auditoria_Empresa_Fecha')
  CREATE INDEX IX_Auditoria_Empresa_Fecha ON importadora.Auditoria(EmpresaId,CreadoEn DESC);

COMMIT;
