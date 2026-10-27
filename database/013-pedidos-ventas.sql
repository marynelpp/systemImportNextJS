-- Pedidos y ventas con salida de inventario FIFO. Ejecutar después de 012-clientes.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.Clientes',N'U') IS NULL THROW 50130,'Primero ejecute 012-clientes.sql.',1;
IF OBJECT_ID(N'importadora.PedidosVenta',N'U') IS NOT NULL THROW 50131,'El módulo de pedidos ya existe.',1;
CREATE TABLE importadora.PedidosVenta(Id int IDENTITY PRIMARY KEY,Numero varchar(30) NOT NULL UNIQUE,ClienteId int NOT NULL REFERENCES importadora.Clientes(Id),Fecha date NOT NULL,Estado varchar(15) NOT NULL DEFAULT 'borrador' CHECK(Estado IN('borrador','confirmado','cancelado')),MonedaCodigo char(3) NOT NULL REFERENCES importadora.Monedas(Codigo),Observaciones nvarchar(500) NULL,CreadoPorUsuarioId int NOT NULL REFERENCES importadora.Usuarios(Id),CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),ActualizadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE importadora.PedidoVentaDetalles(Id int IDENTITY PRIMARY KEY,PedidoVentaId int NOT NULL REFERENCES importadora.PedidosVenta(Id),ProductoId int NOT NULL REFERENCES importadora.Productos(Id),Cantidad decimal(19,4) NOT NULL CHECK(Cantidad>0),PrecioUnitario decimal(19,4) NOT NULL CHECK(PrecioUnitario>=0),CONSTRAINT UQ_PedidoVentaDetalle UNIQUE(PedidoVentaId,ProductoId));
CREATE TABLE importadora.VentaLoteAsignaciones(Id bigint IDENTITY PRIMARY KEY,PedidoVentaDetalleId int NOT NULL REFERENCES importadora.PedidoVentaDetalles(Id),LoteId int NOT NULL REFERENCES importadora.InventarioLotes(Id),Cantidad decimal(19,4) NOT NULL CHECK(Cantidad>0),CostoUnitario decimal(19,4) NOT NULL CHECK(CostoUnitario>=0),CONSTRAINT UQ_VentaLote UNIQUE(PedidoVentaDetalleId,LoteId));
CREATE INDEX IX_PedidosVenta_Fecha ON importadora.PedidosVenta(Fecha DESC,Estado);
INSERT importadora.Permisos(Codigo,Descripcion) VALUES('pedidos.ver',N'Consultar pedidos y ventas'),('pedidos.administrar',N'Crear y confirmar pedidos de venta');
INSERT importadora.RolPermisos(RolId,PermisoCodigo) SELECT r.Id,p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p WHERE r.Nombre=N'Ventas' AND p.Codigo IN('pedidos.ver','pedidos.administrar');
IF NOT EXISTS(SELECT 1 FROM importadora.Clientes)
INSERT importadora.Clientes(Codigo,Tipo,Nombre,Documento,Telefono,Email,Direccion,Notas) VALUES
('CLI-001','natural',N'Andrea Morales','V-18456789','0412-5550101','andrea@example.com',N'El Rosal, Caracas',N'Cliente de demostración.'),
('CLI-002','empresa',N'Tecno Hogar 2026, C.A.','J-412345678','0212-5552233','compras@tecnohogar.example',N'Chacao, Caracas',N'Compra frecuente al mayor.'),
('CLI-003','natural',N'Carlos Rojas','V-22123456','0414-5557788',NULL,N'Valencia, Carabobo',N'Cliente de demostración.');
COMMIT;
