-- Ejecutar después de 003-configuracion-monedas.sql, una sola vez.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.Monedas', N'U') IS NULL
    THROW 50040, 'Primero debe ejecutar 003-configuracion-monedas.sql.', 1;
IF OBJECT_ID(N'importadora.Productos', N'U') IS NOT NULL
    THROW 50041, 'El módulo de catálogo ya existe. No vuelva a ejecutar esta migración.', 1;

CREATE TABLE importadora.CategoriasProducto (
    Id int IDENTITY CONSTRAINT PK_CategoriasProducto PRIMARY KEY,
    Nombre nvarchar(100) NOT NULL CONSTRAINT UQ_CategoriasProducto_Nombre UNIQUE,
    Activa bit NOT NULL CONSTRAINT DF_CategoriasProducto_Activa DEFAULT 1,
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_CategoriasProducto_CreadoEn DEFAULT SYSUTCDATETIME()
);

CREATE TABLE importadora.Proveedores (
    Id int IDENTITY CONSTRAINT PK_Proveedores PRIMARY KEY,
    Codigo varchar(20) NOT NULL CONSTRAINT UQ_Proveedores_Codigo UNIQUE,
    Nombre nvarchar(150) NOT NULL,
    Pais nvarchar(80) NOT NULL CONSTRAINT DF_Proveedores_Pais DEFAULT N'China',
    Contacto nvarchar(100) NULL,
    Email nvarchar(254) NULL,
    Telefono nvarchar(40) NULL,
    WeChat nvarchar(100) NULL,
    Direccion nvarchar(300) NULL,
    Notas nvarchar(500) NULL,
    Activo bit NOT NULL CONSTRAINT DF_Proveedores_Activo DEFAULT 1,
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_Proveedores_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn datetime2 NOT NULL CONSTRAINT DF_Proveedores_ActualizadoEn DEFAULT SYSUTCDATETIME()
);

CREATE TABLE importadora.Productos (
    Id int IDENTITY CONSTRAINT PK_Productos PRIMARY KEY,
    Codigo varchar(40) NOT NULL CONSTRAINT UQ_Productos_Codigo UNIQUE,
    Nombre nvarchar(180) NOT NULL,
    Descripcion nvarchar(500) NULL,
    CategoriaId int NULL CONSTRAINT FK_Productos_Categoria REFERENCES importadora.CategoriasProducto(Id),
    UnidadMedida nvarchar(30) NOT NULL CONSTRAINT DF_Productos_Unidad DEFAULT N'Unidad',
    PrecioMayorUSD decimal(19,2) NULL CONSTRAINT CK_Productos_PrecioMayor CHECK (PrecioMayorUSD IS NULL OR PrecioMayorUSD >= 0),
    PrecioDetalUSD decimal(19,2) NULL CONSTRAINT CK_Productos_PrecioDetal CHECK (PrecioDetalUSD IS NULL OR PrecioDetalUSD >= 0),
    Activo bit NOT NULL CONSTRAINT DF_Productos_Activo DEFAULT 1,
    CreadoEn datetime2 NOT NULL CONSTRAINT DF_Productos_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn datetime2 NOT NULL CONSTRAINT DF_Productos_ActualizadoEn DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Productos_Categoria ON importadora.Productos(CategoriaId, Activo, Nombre);

CREATE TABLE importadora.ProductoProveedores (
    ProductoId int NOT NULL CONSTRAINT FK_ProductoProveedores_Producto REFERENCES importadora.Productos(Id),
    ProveedorId int NOT NULL CONSTRAINT FK_ProductoProveedores_Proveedor REFERENCES importadora.Proveedores(Id),
    CodigoProveedor nvarchar(80) NULL,
    CostoUSD decimal(19,4) NULL CONSTRAINT CK_ProductoProveedores_Costo CHECK (CostoUSD IS NULL OR CostoUSD >= 0),
    CantidadMinima int NULL CONSTRAINT CK_ProductoProveedores_Minimo CHECK (CantidadMinima IS NULL OR CantidadMinima > 0),
    EsPrincipal bit NOT NULL CONSTRAINT DF_ProductoProveedores_Principal DEFAULT 0,
    Activo bit NOT NULL CONSTRAINT DF_ProductoProveedores_Activo DEFAULT 1,
    ActualizadoEn datetime2 NOT NULL CONSTRAINT DF_ProductoProveedores_ActualizadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ProductoProveedores PRIMARY KEY (ProductoId, ProveedorId)
);
CREATE UNIQUE INDEX UX_ProductoProveedores_Principal ON importadora.ProductoProveedores(ProductoId) WHERE EsPrincipal=1 AND Activo=1;

INSERT importadora.Permisos(Codigo, Descripcion) VALUES
    ('productos.ver', N'Consultar catálogo de productos'),
    ('productos.administrar', N'Crear y modificar productos, categorías y precios'),
    ('proveedores.ver', N'Consultar proveedores'),
    ('proveedores.administrar', N'Crear y modificar proveedores') ;

INSERT importadora.RolPermisos(RolId, PermisoCodigo)
SELECT r.Id, p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p
WHERE (r.Nombre=N'Compras' AND p.Codigo IN ('productos.ver','productos.administrar','proveedores.ver','proveedores.administrar'))
   OR (r.Nombre=N'Almacén' AND p.Codigo='productos.ver')
   OR (r.Nombre=N'Ventas' AND p.Codigo='productos.ver')
   OR (r.Nombre=N'Consulta' AND p.Codigo IN ('productos.ver','proveedores.ver'));

COMMIT;
