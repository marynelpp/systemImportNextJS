-- Datos de demostración para Pedidos y Cobros.
-- Ejecutar después de 014-cobros.sql. Puede ejecutarse más de una vez sin duplicar la venta demo.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.CobrosPedido', N'U') IS NULL
    THROW 50910, 'Primero ejecute 014-cobros.sql.', 1;

IF NOT EXISTS(SELECT 1 FROM importadora.PedidosVenta WHERE Numero='PV-DEMO-001')
BEGIN
    DECLARE @usuarioId int=(SELECT TOP 1 Id FROM importadora.Usuarios WHERE Estado='activo' ORDER BY Id);
    DECLARE @clienteId int=(SELECT TOP 1 Id FROM importadora.Clientes WHERE Activo=1 ORDER BY Id);
    DECLARE @productoId int=(SELECT Id FROM importadora.Productos WHERE Codigo='ACC-CABLE-C');
    DECLARE @loteId int=(SELECT TOP 1 Id FROM importadora.InventarioLotes WHERE ProductoId=@productoId AND CantidadDisponible>=3 ORDER BY CreadoEn,Id);
    IF @usuarioId IS NULL OR @clienteId IS NULL OR @productoId IS NULL OR @loteId IS NULL
        THROW 50911, 'Faltan los datos base. Ejecute 900-reiniciar-datos-demo.sql antes de este script.', 1;

    DECLARE @pedido table(Id int);
    INSERT importadora.PedidosVenta(Numero,ClienteId,Fecha,Estado,MonedaCodigo,Observaciones,CreadoPorUsuarioId)
    OUTPUT INSERTED.Id INTO @pedido
    VALUES('PV-DEMO-001',@clienteId,'2026-10-27','confirmado','USD',N'Venta de demostración para revisar pedidos, inventario y cobros.',@usuarioId);

    DECLARE @pedidoId int=(SELECT Id FROM @pedido);
    DECLARE @detalle table(Id int);
    INSERT importadora.PedidoVentaDetalles(PedidoVentaId,ProductoId,Cantidad,PrecioUnitario)
    OUTPUT INSERTED.Id INTO @detalle
    VALUES(@pedidoId,@productoId,3,9.90);

    DECLARE @detalleId int=(SELECT Id FROM @detalle);
    DECLARE @costo decimal(19,4)=(SELECT CostoUnitarioAterrizado FROM importadora.InventarioLotes WHERE Id=@loteId);
    UPDATE importadora.InventarioLotes SET CantidadDisponible=CantidadDisponible-3 WHERE Id=@loteId;
    INSERT importadora.VentaLoteAsignaciones(PedidoVentaDetalleId,LoteId,Cantidad,CostoUnitario) VALUES(@detalleId,@loteId,3,@costo);
    INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId) VALUES(@loteId,'venta',-3,N'PV-DEMO-001',@usuarioId);
    INSERT importadora.CobrosPedido(PedidoVentaId,Fecha,Monto,MonedaCodigo,Metodo,Referencia,Notas,RegistradoPorUsuarioId)
    VALUES(@pedidoId,'2026-10-27',20.00,'USD','pago_movil',N'DEMO-20261027',N'Abono parcial de demostración.',@usuarioId);
    INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle) VALUES(@usuarioId,'datos.demo.venta',@pedidoId,N'Pedido y cobro de demostración creados.');
END;

COMMIT;
