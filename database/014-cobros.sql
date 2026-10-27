-- Cobros de pedidos. Ejecutar después de 013-pedidos-ventas.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.PedidosVenta',N'U') IS NULL THROW 50140,'Primero ejecute 013-pedidos-ventas.sql.',1;
IF OBJECT_ID(N'importadora.CobrosPedido',N'U') IS NOT NULL THROW 50141,'El módulo de cobros ya existe.',1;
CREATE TABLE importadora.CobrosPedido(
 Id bigint IDENTITY PRIMARY KEY,PedidoVentaId int NOT NULL REFERENCES importadora.PedidosVenta(Id),Fecha date NOT NULL,
 Monto decimal(19,4) NOT NULL CHECK(Monto>0),MonedaCodigo char(3) NOT NULL REFERENCES importadora.Monedas(Codigo),
 Metodo varchar(20) NOT NULL CHECK(Metodo IN('efectivo','pago_movil','transferencia','zelle','punto_venta','otro')),
 Referencia nvarchar(100) NULL,Notas nvarchar(300) NULL,RegistradoPorUsuarioId int NOT NULL REFERENCES importadora.Usuarios(Id),CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE INDEX IX_CobrosPedido_PedidoFecha ON importadora.CobrosPedido(PedidoVentaId,Fecha DESC);
INSERT importadora.Permisos(Codigo,Descripcion) VALUES('cobros.administrar',N'Registrar cobros de pedidos');
INSERT importadora.RolPermisos(RolId,PermisoCodigo) SELECT r.Id,p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p WHERE r.Nombre=N'Ventas' AND p.Codigo='cobros.administrar';
COMMIT;
