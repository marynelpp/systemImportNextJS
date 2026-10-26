-- Ejecutar DESPUÉS de 001-seguridad.sql, una sola vez.
-- Agrega invitaciones sin modificar tablas de otros esquemas.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF SCHEMA_ID(N'importadora') IS NULL
    THROW 50010, 'Primero debe ejecutar 001-seguridad.sql.', 1;

IF OBJECT_ID(N'importadora.InvitacionesUsuario', N'U') IS NOT NULL
    THROW 50011, 'El módulo de invitaciones ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.InvitacionesUsuario (
    Id uniqueidentifier NOT NULL
        CONSTRAINT PK_InvitacionesUsuario PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),
    UsuarioId int NOT NULL
        CONSTRAINT FK_InvitacionesUsuario_Usuario
        REFERENCES importadora.Usuarios(Id),
    TokenHash char(64) NOT NULL
        CONSTRAINT UQ_InvitacionesUsuario_TokenHash UNIQUE,
    CreadoPorUsuarioId int NOT NULL
        CONSTRAINT FK_InvitacionesUsuario_CreadoPor
        REFERENCES importadora.Usuarios(Id),
    CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ExpiraEn datetime2 NOT NULL,
    UsadoEn datetime2 NULL,
    CanceladoEn datetime2 NULL,
    CONSTRAINT CK_InvitacionesUsuario_Fechas
        CHECK (ExpiraEn > CreadoEn),
    CONSTRAINT CK_InvitacionesUsuario_Estado
        CHECK (NOT (UsadoEn IS NOT NULL AND CanceladoEn IS NOT NULL))
);

CREATE INDEX IX_InvitacionesUsuario_Usuario
    ON importadora.InvitacionesUsuario(UsuarioId, CreadoEn DESC);

CREATE INDEX IX_InvitacionesUsuario_Vigencia
    ON importadora.InvitacionesUsuario(ExpiraEn)
    WHERE UsadoEn IS NULL AND CanceladoEn IS NULL;

COMMIT;
