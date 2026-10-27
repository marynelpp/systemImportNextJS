-- Ejecutar después de 004-catalogo-proveedores.sql.
-- Convierte el país del proveedor en un catálogo normalizado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.Proveedores', N'U') IS NULL
    THROW 50060, 'Primero debe ejecutar 004-catalogo-proveedores.sql.', 1;
IF OBJECT_ID(N'importadora.Paises', N'U') IS NOT NULL
    THROW 50061, 'El catálogo de países ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.Paises (
    Codigo char(2) NOT NULL CONSTRAINT PK_Paises PRIMARY KEY,
    Nombre nvarchar(100) NOT NULL CONSTRAINT UQ_Paises_Nombre UNIQUE,
    Activo bit NOT NULL CONSTRAINT DF_Paises_Activo DEFAULT 1
);

INSERT importadora.Paises(Codigo,Nombre) VALUES
    ('ZZ',N'Por definir'), ('CN',N'China'), ('VE',N'Venezuela'),
    ('US',N'Estados Unidos'), ('MX',N'México'), ('CO',N'Colombia'),
    ('PA',N'Panamá'), ('BR',N'Brasil'), ('AR',N'Argentina'), ('CL',N'Chile'),
    ('PE',N'Perú'), ('EC',N'Ecuador'), ('DO',N'República Dominicana'),
    ('ES',N'España'), ('DE',N'Alemania'), ('IT',N'Italia'), ('FR',N'Francia'),
    ('PT',N'Portugal'), ('TR',N'Turquía'), ('IN',N'India'), ('JP',N'Japón'),
    ('KR',N'Corea del Sur'), ('TW',N'Taiwán'), ('TH',N'Tailandia'),
    ('VN',N'Vietnam'), ('AE',N'Emiratos Árabes Unidos'), ('CA',N'Canadá');

ALTER TABLE importadora.Proveedores ADD PaisCodigo char(2) NULL;
EXEC sp_executesql N'
    UPDATE importadora.Proveedores
    SET PaisCodigo = CASE LOWER(LTRIM(RTRIM(Pais)))
        WHEN N''china'' THEN ''CN'' WHEN N''venezuela'' THEN ''VE''
        WHEN N''estados unidos'' THEN ''US'' WHEN N''usa'' THEN ''US''
        WHEN N''méxico'' THEN ''MX'' WHEN N''mexico'' THEN ''MX''
        WHEN N''colombia'' THEN ''CO'' WHEN N''panamá'' THEN ''PA''
        ELSE ''ZZ'' END;';
ALTER TABLE importadora.Proveedores ALTER COLUMN PaisCodigo char(2) NOT NULL;
ALTER TABLE importadora.Proveedores ADD CONSTRAINT FK_Proveedores_Pais
    FOREIGN KEY(PaisCodigo) REFERENCES importadora.Paises(Codigo);
ALTER TABLE importadora.Proveedores DROP CONSTRAINT DF_Proveedores_Pais;
ALTER TABLE importadora.Proveedores DROP COLUMN Pais;

COMMIT;
