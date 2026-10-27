-- Entregas de pedidos. Ejecutar después de 014-cobros.sql.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'importadora.PedidosVenta',N'U') IS NULL THROW 50150,'Primero ejecute 013-pedidos-ventas.sql.',1;
IF OBJECT_ID(N'importadora.EntregasPedido',N'U') IS NOT NULL THROW 50151,'El módulo de entregas ya existe.',1;
CREATE TABLE importadora.EntregasPedido(
 Id bigint IDENTITY PRIMARY KEY,PedidoVentaId int NOT NULL CONSTRAINT UQ_EntregasPedido UNIQUE REFERENCES importadora.PedidosVenta(Id),Fecha date NOT NULL,
 Metodo varchar(20) NOT NULL CHECK(Metodo IN('retiro','delivery','encomienda','otro')),Responsable nvarchar(120) NULL,Referencia nvarchar(120) NULL,Notas nvarchar(300) NULL,
 RegistradoPorUsuarioId int NOT NULL REFERENCES importadora.Usuarios(Id),CreadoEn datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
INSERT importadora.Permisos(Codigo,Descripcion) VALUES('entregas.administrar',N'Registrar entregas de pedidos');
INSERT importadora.RolPermisos(RolId,PermisoCodigo) SELECT r.Id,p.Codigo FROM importadora.Roles r CROSS JOIN importadora.Permisos p WHERE r.Nombre=N'Ventas' AND p.Codigo='entregas.administrar';
COMMIT;
