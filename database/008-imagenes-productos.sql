-- Ejecutar después de 004-catalogo-proveedores.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.Productos', N'U') IS NULL THROW 50080, 'Primero debe ejecutar 004-catalogo-proveedores.sql.', 1;
IF OBJECT_ID(N'importadora.ProductoImagenes', N'U') IS NOT NULL THROW 50081, 'Las imágenes de productos ya existen.', 1;
CREATE TABLE importadora.ProductoImagenes (
 Id bigint IDENTITY CONSTRAINT PK_ProductoImagenes PRIMARY KEY,
 ProductoId int NOT NULL CONSTRAINT FK_ProductoImagenes_Producto REFERENCES importadora.Productos(Id),
 NombreBlob nvarchar(300) NOT NULL CONSTRAINT UQ_ProductoImagenes_Blob UNIQUE,
 NombreOriginal nvarchar(255) NOT NULL,
 TipoContenido varchar(100) NOT NULL,
 EsPrincipal bit NOT NULL CONSTRAINT DF_ProductoImagenes_Principal DEFAULT 1,
 CreadoPorUsuarioId int NOT NULL CONSTRAINT FK_ProductoImagenes_Usuario REFERENCES importadora.Usuarios(Id),
 CreadoEn datetime2 NOT NULL CONSTRAINT DF_ProductoImagenes_CreadoEn DEFAULT SYSUTCDATETIME()
);
CREATE UNIQUE INDEX UX_ProductoImagenes_Principal ON importadora.ProductoImagenes(ProductoId) WHERE EsPrincipal=1;
COMMIT;
