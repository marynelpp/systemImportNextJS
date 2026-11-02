/*
  Roles independientes por empresa.
  - Conserva las asignaciones y permisos actuales.
  - Crea una copia de cada rol para cada empresa existente.
  - Después de ejecutarla, un administrador local puede ajustar sus roles
    sin modificar los de otra importadora.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.Roles', N'EmpresaId') IS NULL
  ALTER TABLE importadora.Roles ADD EmpresaId int NULL;

/* SQL Server debe compilar el resto después de conocer la nueva columna. */
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_Roles_Empresa' AND parent_object_id=OBJECT_ID(N'importadora.Roles'))
  ALTER TABLE importadora.Roles ADD CONSTRAINT FK_Roles_Empresa FOREIGN KEY(EmpresaId) REFERENCES importadora.Empresas(Id);

/* El nombre deja de ser global: debe poder repetirse una vez por empresa. */
DECLARE @dropNombre nvarchar(max)=N'';
SELECT @dropNombre=N'ALTER TABLE importadora.Roles DROP CONSTRAINT '+QUOTENAME(kc.name)+N';'
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id AND ic.key_ordinal=1
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE kc.parent_object_id=OBJECT_ID(N'importadora.Roles') AND kc.type='UQ' AND c.name=N'Nombre';
IF @dropNombre<>N'' EXEC sys.sp_executesql @dropNombre;

IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Roles') AND name=N'UX_RolAdministrador')
  DROP INDEX UX_RolAdministrador ON importadora.Roles;

/* La migración puede reintentarse de forma segura mientras los roles viejos aún existan. */
INSERT importadora.Roles(EmpresaId,Nombre,EsAdministrador)
SELECT e.Id,r.Nombre,r.EsAdministrador
FROM importadora.Empresas e
CROSS JOIN importadora.Roles r
WHERE r.EmpresaId IS NULL
  AND NOT EXISTS(SELECT 1 FROM importadora.Roles destino WHERE destino.EmpresaId=e.Id AND destino.Nombre=r.Nombre);

INSERT importadora.RolPermisos(RolId,PermisoCodigo)
SELECT destino.Id,rp.PermisoCodigo
FROM importadora.Roles origen
JOIN importadora.RolPermisos rp ON rp.RolId=origen.Id
JOIN importadora.Roles destino ON destino.EmpresaId IS NOT NULL AND destino.Nombre=origen.Nombre
WHERE origen.EmpresaId IS NULL
  AND NOT EXISTS(SELECT 1 FROM importadora.RolPermisos actual WHERE actual.RolId=destino.Id AND actual.PermisoCodigo=rp.PermisoCodigo);

UPDATE ue
SET RolId=destino.Id
FROM importadora.UsuarioEmpresas ue
JOIN importadora.Roles origen ON origen.Id=ue.RolId AND origen.EmpresaId IS NULL
JOIN importadora.Roles destino ON destino.EmpresaId=ue.EmpresaId AND destino.Nombre=origen.Nombre;

/* Conservamos el RolId heredado apuntando a una copia real. La sesión usa UsuarioEmpresas. */
UPDATE u
SET RolId=(SELECT TOP 1 ue.RolId FROM importadora.UsuarioEmpresas ue WHERE ue.UsuarioId=u.Id AND ue.Activo=1 ORDER BY ue.EmpresaId)
FROM importadora.Usuarios u
WHERE EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue WHERE ue.UsuarioId=u.Id AND ue.Activo=1);

IF EXISTS(SELECT 1 FROM importadora.UsuarioEmpresas ue JOIN importadora.Roles r ON r.Id=ue.RolId WHERE r.EmpresaId IS NULL)
  THROW 50132, 'No se pudieron migrar todas las asignaciones de roles.', 1;

IF EXISTS(SELECT 1 FROM importadora.Usuarios u JOIN importadora.Roles r ON r.Id=u.RolId WHERE r.EmpresaId IS NULL)
  THROW 50132, 'No se pudieron migrar todos los roles de usuario.', 1;

DELETE rp
FROM importadora.RolPermisos rp
JOIN importadora.Roles r ON r.Id=rp.RolId
WHERE r.EmpresaId IS NULL;

DELETE FROM importadora.Roles WHERE EmpresaId IS NULL;

ALTER TABLE importadora.Roles ALTER COLUMN EmpresaId int NOT NULL;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Roles') AND name=N'UX_Roles_Empresa_Nombre')
  CREATE UNIQUE INDEX UX_Roles_Empresa_Nombre ON importadora.Roles(EmpresaId,Nombre);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'importadora.Roles') AND name=N'UX_Roles_Empresa_Administrador')
  CREATE UNIQUE INDEX UX_Roles_Empresa_Administrador ON importadora.Roles(EmpresaId) WHERE EsAdministrador=1;

COMMIT;
