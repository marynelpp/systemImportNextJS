-- Ejecutar DESPUÉS de 001-seguridad.sql y 002-invitaciones.sql, una sola vez.
-- Configuración de la importadora, almacenes, monedas y tasa histórica BCV.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.Usuarios', N'U') IS NULL
    THROW 50020, 'Primero debe ejecutar 001-seguridad.sql.', 1;

IF OBJECT_ID(N'importadora.Monedas', N'U') IS NOT NULL
    THROW 50021, 'El módulo de configuración y monedas ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.EmpresaConfiguracion (
    Id tinyint NOT NULL CONSTRAINT PK_EmpresaConfiguracion PRIMARY KEY,
    NombreLegal nvarchar(150) NOT NULL,
    NombreComercial nvarchar(150) NULL,
    Rif nvarchar(20) NULL,
    Telefono nvarchar(30) NULL,
    Email nvarchar(254) NULL,
    Direccion nvarchar(300) NULL,
    ActualizadoPorUsuarioId int NULL CONSTRAINT FK_EmpresaConfiguracion_Usuario
        REFERENCES importadora.Usuarios(Id),
    ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_EmpresaConfiguracion_Unica CHECK (Id = 1)
);

CREATE TABLE importadora.Almacenes (
    Id int IDENTITY CONSTRAINT PK_Almacenes PRIMARY KEY,
    Codigo varchar(20) NOT NULL CONSTRAINT UQ_Almacenes_Codigo UNIQUE,
    Nombre nvarchar(100) NOT NULL,
    Direccion nvarchar(300) NULL,
    Activo bit NOT NULL DEFAULT 1,
    CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE importadora.Monedas (
    Codigo char(3) NOT NULL CONSTRAINT PK_Monedas PRIMARY KEY,
    Nombre nvarchar(60) NOT NULL,
    Simbolo nvarchar(10) NOT NULL,
    Decimales tinyint NOT NULL CONSTRAINT CK_Monedas_Decimales CHECK (Decimales BETWEEN 0 AND 4),
    Activa bit NOT NULL DEFAULT 1
);

CREATE TABLE importadora.TasasCambio (
    Id bigint IDENTITY CONSTRAINT PK_TasasCambio PRIMARY KEY,
    MonedaBase char(3) NOT NULL CONSTRAINT FK_TasasCambio_Base
        REFERENCES importadora.Monedas(Codigo),
    MonedaDestino char(3) NOT NULL CONSTRAINT FK_TasasCambio_Destino
        REFERENCES importadora.Monedas(Codigo),
    FechaVigencia date NOT NULL,
    Tasa decimal(19,6) NOT NULL CONSTRAINT CK_TasasCambio_Valor CHECK (Tasa > 0),
    Fuente varchar(12) NOT NULL CONSTRAINT CK_TasasCambio_Fuente CHECK (Fuente IN ('BCV', 'manual')),
    Observacion nvarchar(300) NULL,
    RegistradaPorUsuarioId int NOT NULL CONSTRAINT FK_TasasCambio_Usuario
        REFERENCES importadora.Usuarios(Id),
    CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_TasasCambio_MonedasDiferentes CHECK (MonedaBase <> MonedaDestino),
    CONSTRAINT UQ_TasasCambio_ParFecha UNIQUE (MonedaBase, MonedaDestino, FechaVigencia)
);

CREATE INDEX IX_TasasCambio_Consulta
    ON importadora.TasasCambio(MonedaBase, MonedaDestino, FechaVigencia DESC);

INSERT importadora.Monedas(Codigo, Nombre, Simbolo, Decimales) VALUES
    ('USD', N'Dólar estadounidense', N'US$', 2),
    ('VES', N'Bolívar venezolano', N'Bs.', 2);

INSERT importadora.Permisos(Codigo, Descripcion) VALUES
    ('configuracion.administrar', N'Configurar empresa, almacenes y monedas'),
    ('tasas.administrar', N'Registrar y corregir tasas de cambio');

COMMIT;
