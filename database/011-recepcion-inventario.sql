-- Recepción de importaciones e inventario por lote.
-- Ejecutar después de 010-compras-importaciones.sql, una sola vez.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.Importaciones', N'U') IS NULL
    THROW 50110, 'Primero ejecute 010-compras-importaciones.sql.', 1;
IF OBJECT_ID(N'importadora.RecepcionesImportacion', N'U') IS NOT NULL
    THROW 50111, 'El módulo de recepción e inventario ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.RecepcionesImportacion (
    Id int IDENTITY CONSTRAINT PK_RecepcionesImportacion PRIMARY KEY,
    ImportacionId int NOT NULL CONSTRAINT UQ_RecepcionesImportacion_Importacion UNIQUE
        CONSTRAINT FK_RecepcionesImportacion_Importacion REFERENCES importadora.Importaciones(Id),
    AlmacenId int NOT NULL CONSTRAINT FK_RecepcionesImportacion_Almacen REFERENCES importadora.Almacenes(Id),
    Fecha date NOT NULL,
    Observaciones nvarchar(500) NULL,
    RecibidoPorUsuarioId int NOT NULL CONSTRAINT FK_RecepcionesImportacion_Usuario REFERENCES importadora.Usuarios(Id),
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_RecepcionesImportacion_CreadoEn DEFAULT SYSUTCDATETIME()
);

CREATE TABLE importadora.RecepcionImportacionDetalles (
    Id int IDENTITY CONSTRAINT PK_RecepcionImportacionDetalles PRIMARY KEY,
    RecepcionId int NOT NULL CONSTRAINT FK_RecepcionImportacionDetalles_Recepcion REFERENCES importadora.RecepcionesImportacion(Id),
    OrdenCompraDetalleId int NOT NULL CONSTRAINT FK_RecepcionImportacionDetalles_Detalle REFERENCES importadora.OrdenCompraDetalles(Id),
    CantidadPedida decimal(19,4) NOT NULL CHECK(CantidadPedida > 0),
    CantidadRecibida decimal(19,4) NOT NULL CHECK(CantidadRecibida >= 0),
    CantidadFaltante decimal(19,4) NOT NULL CHECK(CantidadFaltante >= 0),
    CONSTRAINT UQ_RecepcionImportacionDetalle UNIQUE(RecepcionId, OrdenCompraDetalleId),
    CONSTRAINT CK_RecepcionImportacionDetalle_Cantidades CHECK(CantidadRecibida + CantidadFaltante = CantidadPedida)
);

CREATE TABLE importadora.ImportacionCostoDistribuciones (
    Id int IDENTITY CONSTRAINT PK_ImportacionCostoDistribuciones PRIMARY KEY,
    ImportacionId int NOT NULL CONSTRAINT FK_ImportacionCostoDistribuciones_Importacion REFERENCES importadora.Importaciones(Id),
    OrdenCompraDetalleId int NOT NULL CONSTRAINT FK_ImportacionCostoDistribuciones_Detalle REFERENCES importadora.OrdenCompraDetalles(Id),
    CostoMercancia decimal(19,4) NOT NULL CHECK(CostoMercancia >= 0),
    GastosAsignados decimal(19,4) NOT NULL CHECK(GastosAsignados >= 0),
    CostoAterrizadoTotal decimal(19,4) NOT NULL CHECK(CostoAterrizadoTotal >= 0),
    MonedaCodigo char(3) NOT NULL CONSTRAINT FK_ImportacionCostoDistribuciones_Moneda REFERENCES importadora.Monedas(Codigo),
    CONSTRAINT UQ_ImportacionCostoDistribuciones_Linea UNIQUE(ImportacionId, OrdenCompraDetalleId)
);

CREATE TABLE importadora.InventarioLotes (
    Id int IDENTITY CONSTRAINT PK_InventarioLotes PRIMARY KEY,
    AlmacenId int NOT NULL CONSTRAINT FK_InventarioLotes_Almacen REFERENCES importadora.Almacenes(Id),
    ProductoId int NOT NULL CONSTRAINT FK_InventarioLotes_Producto REFERENCES importadora.Productos(Id),
    ImportacionId int NOT NULL CONSTRAINT FK_InventarioLotes_Importacion REFERENCES importadora.Importaciones(Id),
    RecepcionDetalleId int NOT NULL CONSTRAINT UQ_InventarioLotes_RecepcionDetalle REFERENCES importadora.RecepcionImportacionDetalles(Id),
    CantidadInicial decimal(19,4) NOT NULL CHECK(CantidadInicial > 0),
    CantidadDisponible decimal(19,4) NOT NULL CHECK(CantidadDisponible >= 0),
    CostoUnitarioAterrizado decimal(19,4) NOT NULL CHECK(CostoUnitarioAterrizado >= 0),
    MonedaCodigo char(3) NOT NULL CONSTRAINT FK_InventarioLotes_Moneda REFERENCES importadora.Monedas(Codigo),
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_InventarioLotes_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_InventarioLotes_Disponible CHECK(CantidadDisponible <= CantidadInicial)
);
CREATE INDEX IX_InventarioLotes_ProductoAlmacen ON importadora.InventarioLotes(ProductoId, AlmacenId, CantidadDisponible);

CREATE TABLE importadora.InventarioMovimientos (
    Id bigint IDENTITY CONSTRAINT PK_InventarioMovimientos PRIMARY KEY,
    LoteId int NOT NULL CONSTRAINT FK_InventarioMovimientos_Lote REFERENCES importadora.InventarioLotes(Id),
    Tipo varchar(20) NOT NULL CHECK(Tipo IN ('recepcion','ajuste_entrada','ajuste_salida','venta','transferencia')),
    Cantidad decimal(19,4) NOT NULL CHECK(Cantidad <> 0),
    Referencia nvarchar(80) NULL,
    UsuarioId int NULL CONSTRAINT FK_InventarioMovimientos_Usuario REFERENCES importadora.Usuarios(Id),
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_InventarioMovimientos_CreadoEn DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_InventarioMovimientos_LoteFecha ON importadora.InventarioMovimientos(LoteId, CreadoEn DESC);

INSERT importadora.Permisos(Codigo,Descripcion) VALUES
    ('inventario.ver', N'Consultar existencias y movimientos de inventario'),
    ('inventario.administrar', N'Recibir importaciones y realizar ajustes de inventario');
INSERT importadora.RolPermisos(RolId,PermisoCodigo)
SELECT r.Id,p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p
WHERE (r.Nombre IN (N'Compras',N'Almacén') AND p.Codigo IN ('inventario.ver','inventario.administrar'))
   OR (r.Nombre=N'Consulta' AND p.Codigo='inventario.ver');

COMMIT;
