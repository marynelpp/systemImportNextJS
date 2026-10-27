-- Ejecutar después de 006-catalogo-paises-proveedores.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.Proveedores',N'U') IS NULL THROW 50090,'Primero debe ejecutar 004-catalogo-proveedores.sql.',1;
IF COL_LENGTH(N'importadora.Proveedores',N'PlataformaCompra') IS NOT NULL THROW 50091,'El detalle comercial ya existe.',1;
ALTER TABLE importadora.Proveedores ADD
 PlataformaCompra nvarchar(80) NULL, -- Alibaba, 1688, AliExpress, directo, etc.
 UrlTienda nvarchar(500) NULL,
 UsuarioPlataforma nvarchar(120) NULL,
 AgenteCompra nvarchar(150) NULL,
 CasilleroConsolidacion nvarchar(150) NULL,
 TerminoPago nvarchar(120) NULL, -- anticipo, contra entrega, crédito
 MonedaPago char(3) NULL CONSTRAINT FK_Proveedores_Moneda REFERENCES importadora.Monedas(Codigo),
 Incoterm varchar(10) NULL, -- EXW, FOB, CIF, etc.
 PuertoOrigen nvarchar(100) NULL,
 NotasLogisticas nvarchar(1000) NULL;
COMMIT;
