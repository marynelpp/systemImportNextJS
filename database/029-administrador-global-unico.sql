/*
  Administrador global único.
  Solo perazaperozo@gmail.com puede alternar o consultar todas las empresas.
  Los demás usuarios siempre operan mediante UsuarioEmpresas y su rol de esa empresa.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH(N'importadora.Usuarios', N'EsAdministradorSistema') IS NULL
  ALTER TABLE importadora.Usuarios ADD EsAdministradorSistema bit NOT NULL
    CONSTRAINT DF_Usuarios_EsAdministradorSistema DEFAULT 0;

EXEC sp_executesql N'
  UPDATE importadora.Usuarios
  SET EsAdministradorSistema=CASE WHEN LOWER(Email)=N''perazaperozo@gmail.com'' THEN 1 ELSE 0 END;';

IF NOT EXISTS (SELECT 1 FROM importadora.Usuarios WHERE LOWER(Email)=N'perazaperozo@gmail.com')
  THROW 50120, 'No existe el usuario perazaperozo@gmail.com. Corrige su correo antes de ejecutar esta migración.', 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_Usuarios_AdministradorSistemaUnico' AND object_id=OBJECT_ID(N'importadora.Usuarios'))
  EXEC sp_executesql N'
    CREATE UNIQUE INDEX UX_Usuarios_AdministradorSistemaUnico
      ON importadora.Usuarios(EsAdministradorSistema) WHERE EsAdministradorSistema=1;';

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_Usuarios_AdministradorSistemaCorreo' AND parent_object_id=OBJECT_ID(N'importadora.Usuarios'))
  EXEC sp_executesql N'
    ALTER TABLE importadora.Usuarios ADD CONSTRAINT CK_Usuarios_AdministradorSistemaCorreo
      CHECK (EsAdministradorSistema=0 OR LOWER(Email)=N''perazaperozo@gmail.com'');';

COMMIT;
