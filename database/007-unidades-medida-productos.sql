-- Ejecutar después de 004-catalogo-proveedores.sql.
-- Convierte la unidad de medida del producto en un catálogo.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.Productos', N'U') IS NULL
    THROW 50070, 'Primero debe ejecutar 004-catalogo-proveedores.sql.', 1;
IF OBJECT_ID(N'importadora.UnidadesMedida', N'U') IS NOT NULL
    THROW 50071, 'El catálogo de unidades ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.UnidadesMedida (
    Id smallint IDENTITY CONSTRAINT PK_UnidadesMedida PRIMARY KEY,
    Codigo varchar(12) NOT NULL CONSTRAINT UQ_UnidadesMedida_Codigo UNIQUE,
    Nombre nvarchar(60) NOT NULL CONSTRAINT UQ_UnidadesMedida_Nombre UNIQUE,
    Activa bit NOT NULL CONSTRAINT DF_UnidadesMedida_Activa DEFAULT 1
);

INSERT importadora.UnidadesMedida(Codigo,Nombre) VALUES
    ('UND',N'Unidad'), ('PAR',N'Par'), ('JGO',N'Juego'), ('KIT',N'Kit'),
    ('CJ',N'Caja'), ('PQT',N'Paquete'), ('BLT',N'Bolsa'), ('MET',N'Metro'),
    ('LTR',N'Litro'), ('KGM',N'Kilogramo'), ('RLL',N'Rollo');

ALTER TABLE importadora.Productos ADD UnidadMedidaId smallint NULL;
EXEC sp_executesql N'
    UPDATE importadora.Productos
    SET UnidadMedidaId = (SELECT Id FROM importadora.UnidadesMedida WHERE Codigo = ''UND'');';
ALTER TABLE importadora.Productos ALTER COLUMN UnidadMedidaId smallint NOT NULL;
ALTER TABLE importadora.Productos ADD CONSTRAINT FK_Productos_UnidadMedida
    FOREIGN KEY(UnidadMedidaId) REFERENCES importadora.UnidadesMedida(Id);
ALTER TABLE importadora.Productos DROP CONSTRAINT DF_Productos_Unidad;
ALTER TABLE importadora.Productos DROP COLUMN UnidadMedida;

COMMIT;
