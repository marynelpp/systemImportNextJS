-- Ejecutar después de 004-catalogo-proveedores.sql.
-- Agrega categorías iniciales; puede ejecutarse más de una vez sin duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.CategoriasProducto', N'U') IS NULL
    THROW 50050, 'Primero debe ejecutar 004-catalogo-proveedores.sql.', 1;

DECLARE @Categorias TABLE (Nombre nvarchar(100) NOT NULL PRIMARY KEY);

INSERT @Categorias (Nombre) VALUES
    -- Repuestos de carro
    (N'Carro · Motor y componentes'),
    (N'Carro · Sistema de enfriamiento'),
    (N'Carro · Combustible e inyección'),
    (N'Carro · Encendido y sistema eléctrico'),
    (N'Carro · Frenos'),
    (N'Carro · Suspensión y dirección'),
    (N'Carro · Transmisión y embrague'),
    (N'Carro · Filtros y lubricación'),
    (N'Carro · Escape'),
    (N'Carro · Iluminación'),
    (N'Carro · Carrocería y exterior'),
    (N'Carro · Interior y accesorios'),
    (N'Carro · Aire acondicionado'),
    (N'Carro · Ruedas y neumáticos'),
    -- Repuestos de moto
    (N'Moto · Motor y componentes'),
    (N'Moto · Combustible y admisión'),
    (N'Moto · Encendido y sistema eléctrico'),
    (N'Moto · Transmisión, cadena y sprockets'),
    (N'Moto · Frenos'),
    (N'Moto · Suspensión y dirección'),
    (N'Moto · Escape'),
    (N'Moto · Iluminación'),
    (N'Moto · Carenado y carrocería'),
    (N'Moto · Ruedas y neumáticos'),
    (N'Moto · Accesorios y protección');

INSERT importadora.CategoriasProducto (Nombre)
SELECT source.Nombre
FROM @Categorias source
WHERE NOT EXISTS (
    SELECT 1 FROM importadora.CategoriasProducto target WHERE target.Nombre = source.Nombre
);

COMMIT;
