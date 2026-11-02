-- Empresa activa por sesión.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'importadora.Sesiones',N'EmpresaId') IS NULL
 ALTER TABLE importadora.Sesiones ADD EmpresaId int NULL CONSTRAINT FK_Sesiones_Empresa REFERENCES importadora.Empresas(Id);
EXEC sp_executesql N'UPDATE s SET EmpresaId=(SELECT TOP 1 EmpresaId FROM importadora.UsuarioEmpresas ue WHERE ue.UsuarioId=s.UsuarioId AND ue.Activo=1 ORDER BY ue.EmpresaId) FROM importadora.Sesiones s WHERE s.EmpresaId IS NULL;';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Sesiones') AND name=N'IX_Sesiones_Empresa') CREATE INDEX IX_Sesiones_Empresa ON importadora.Sesiones(EmpresaId);
COMMIT;
