-- REINICIO DE DATOS OPERATIVOS + DEMOSTRACIÓN VISUAL
-- Ejecutar únicamente en desarrollo/pruebas, después de 011-recepcion-inventario.sql.
-- Conserva: usuarios, roles, permisos, sesiones, empresa, monedas, tasas, países,
-- unidades de medida y almacenes. Elimina: catálogos y toda la operación comercial.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'importadora.RecepcionesImportacion', N'U') IS NULL
    THROW 50900, 'Primero ejecute 011-recepcion-inventario.sql.', 1;

DECLARE @usuarioId int=(SELECT TOP 1 Id FROM importadora.Usuarios WHERE Estado='activo' ORDER BY Id);
DECLARE @almacenId int=(SELECT TOP 1 Id FROM importadora.Almacenes WHERE Activo=1 ORDER BY Id);
IF @usuarioId IS NULL THROW 50901, 'Debe existir un usuario activo para crear los datos demo.', 1;
IF @almacenId IS NULL THROW 50902, 'Debe existir un almacén activo para crear los datos demo.', 1;

-- Limpieza: se respeta el orden de dependencias para no afectar otros esquemas.
DELETE FROM importadora.InventarioMovimientos;
DELETE FROM importadora.InventarioLotes;
DELETE FROM importadora.ImportacionCostoDistribuciones;
DELETE FROM importadora.RecepcionImportacionDetalles;
DELETE FROM importadora.RecepcionesImportacion;
DELETE FROM importadora.ImportacionGastos;
DELETE FROM importadora.Importaciones;
DELETE FROM importadora.OrdenCompraDetalles;
DELETE FROM importadora.OrdenesCompra;
DELETE FROM importadora.ProductoImagenes;
DELETE FROM importadora.ProductoProveedores;
DELETE FROM importadora.Productos;
DELETE FROM importadora.CategoriasProducto;
DELETE FROM importadora.Proveedores;
DELETE FROM importadora.Auditoria;

DBCC CHECKIDENT ('importadora.InventarioMovimientos', RESEED, 0);
DBCC CHECKIDENT ('importadora.InventarioLotes', RESEED, 0);
DBCC CHECKIDENT ('importadora.ImportacionCostoDistribuciones', RESEED, 0);
DBCC CHECKIDENT ('importadora.RecepcionImportacionDetalles', RESEED, 0);
DBCC CHECKIDENT ('importadora.RecepcionesImportacion', RESEED, 0);
DBCC CHECKIDENT ('importadora.ImportacionGastos', RESEED, 0);
DBCC CHECKIDENT ('importadora.Importaciones', RESEED, 0);
DBCC CHECKIDENT ('importadora.OrdenCompraDetalles', RESEED, 0);
DBCC CHECKIDENT ('importadora.OrdenesCompra', RESEED, 0);
DBCC CHECKIDENT ('importadora.Productos', RESEED, 0);
DBCC CHECKIDENT ('importadora.CategoriasProducto', RESEED, 0);
DBCC CHECKIDENT ('importadora.Proveedores', RESEED, 0);

INSERT importadora.CategoriasProducto(Nombre) VALUES
  (N'Electrónica y accesorios'),(N'Hogar inteligente'),(N'Herramientas'),(N'Iluminación');

INSERT importadora.Proveedores(Codigo,Nombre,PaisCodigo,Contacto,Email,Telefono,WeChat,Direccion,Notas,Activo,PlataformaCompra,UrlTienda,UsuarioPlataforma,AgenteCompra,CasilleroConsolidacion,TerminoPago,MonedaPago,Incoterm,PuertoOrigen,NotasLogisticas) VALUES
  ('SHZ-001',N'Shenzhen Bright Tech Co., Ltd.','CN',N'Lina Zhang',N'lina@brighttech.example',N'+86 755 5550 1001',N'lina_brighttech',N'Bao''an District, Shenzhen',N'Proveedor principal de accesorios electrónicos.',1,N'Alibaba',N'https://www.alibaba.com',N'brighttech-store',N'Cargo Venezuela',N'CJ-VE-8831',N'30% anticipo / 70% antes de envío','USD','FOB',N'Shenzhen',N'Consolidar en cajas identificadas por orden.'),
  ('GZ-002',N'Guangzhou Home Supply Ltd.','CN',N'Kevin Wu',N'kevin@homesupply.example',N'+86 20 5550 2388',N'kevin_home',N'Baiyun, Guangzhou',N'Proveedor de artículos para hogar.',1,N'1688',N'https://www.1688.com',N'homesupply-1688',N'Oriental Cargo',N'GZ-BOX-174',N'Contra BL','USD','CIF',N'Guangzhou',N'Confirmar voltaje 110V antes de embarcar.'),
  ('YIW-003',N'Yiwu Tools Trading Co.','CN',N'Mei Chen',N'mei@yiwutools.example',N'+86 579 5550 6677',N'mei_tools',N'Yiwu International Trade City',N'Proveedor secundario de herramientas.',1,N'Directo',NULL,N'yiwu-tools',N'Cargo Venezuela',N'CJ-VE-8831',N'50% anticipo','USD','EXW',N'Ningbo',N'Empaque reforzado para productos metálicos.');

DECLARE @und smallint=(SELECT Id FROM importadora.UnidadesMedida WHERE Codigo='UND');
DECLARE @cj smallint=(SELECT Id FROM importadora.UnidadesMedida WHERE Codigo='CJ');
IF @und IS NULL OR @cj IS NULL THROW 50903, 'No se encontraron las unidades UND y CJ.', 1;

INSERT importadora.Productos(Codigo,Nombre,Descripcion,CategoriaId,UnidadMedidaId,PrecioMayorUSD,PrecioDetalUSD,Activo) VALUES
  ('ACC-CARG-20W',N'Cargador rápido USB-C 20W',N'Cargador compacto con puerto USB-C y carga rápida.',(SELECT Id FROM importadora.CategoriasProducto WHERE Nombre=N'Electrónica y accesorios'),@und,14.50,19.90,1),
  ('ACC-CABLE-C',N'Cable USB-C trenzado 1 m',N'Cable reforzado con conectores USB-C.',(SELECT Id FROM importadora.CategoriasProducto WHERE Nombre=N'Electrónica y accesorios'),@und,6.50,9.90,1),
  ('HOG-BOMB-WIFI',N'Bombillo inteligente WiFi',N'Bombillo LED RGB compatible con aplicación móvil.',(SELECT Id FROM importadora.CategoriasProducto WHERE Nombre=N'Hogar inteligente'),@und,19.00,27.90,1),
  ('HER-DEST-32',N'Destornillador eléctrico 32 piezas',N'Kit recargable para trabajos de precisión.',(SELECT Id FROM importadora.CategoriasProducto WHERE Nombre=N'Herramientas'),@und,29.00,42.00,1),
  ('ILU-LED-5M',N'Tira LED RGB 5 metros',N'Tira LED con control remoto y fuente incluida.',(SELECT Id FROM importadora.CategoriasProducto WHERE Nombre=N'Iluminación'),@cj,22.00,32.00,1),
  ('HOG-ORGAN-3',N'Organizador modular 3 niveles',N'Organizador plástico para cocina o baño.',(SELECT Id FROM importadora.CategoriasProducto WHERE Nombre=N'Hogar inteligente'),@und,16.00,24.00,1);

INSERT importadora.ProductoProveedores(ProductoId,ProveedorId,CodigoProveedor,CostoUSD,CantidadMinima,EsPrincipal,Activo)
SELECT p.Id,pr.Id,CONCAT('SUP-',p.Codigo),CASE p.Codigo WHEN 'ACC-CARG-20W' THEN 7.50 WHEN 'ACC-CABLE-C' THEN 3.20 WHEN 'HOG-BOMB-WIFI' THEN 11.00 WHEN 'HER-DEST-32' THEN 18.00 WHEN 'ILU-LED-5M' THEN 12.50 ELSE 8.00 END,20,1,1
FROM importadora.Productos p JOIN importadora.Proveedores pr ON pr.Codigo=CASE WHEN p.Codigo IN ('ACC-CARG-20W','ACC-CABLE-C','HOG-BOMB-WIFI') THEN 'SHZ-001' WHEN p.Codigo IN ('HER-DEST-32','ILU-LED-5M') THEN 'YIW-003' ELSE 'GZ-002' END;

INSERT importadora.OrdenesCompra(Numero,ProveedorId,Fecha,Estado,MonedaCodigo,Observaciones,CreadoPorUsuarioId) VALUES
  ('OC-000001',(SELECT Id FROM importadora.Proveedores WHERE Codigo='SHZ-001'),'2026-10-01','recibida','USD',N'Mercancía recibida para demostrar inventario y costo aterrizado.',@usuarioId),
  ('OC-000002',(SELECT Id FROM importadora.Proveedores WHERE Codigo='YIW-003'),'2026-10-18','confirmada','USD',N'Pedido en tránsito desde Ningbo.',@usuarioId),
  ('OC-000003',(SELECT Id FROM importadora.Proveedores WHERE Codigo='GZ-002'),'2026-10-26','borrador','USD',N'Borrador para probar el formulario de compras.',@usuarioId);

DECLARE @oc1 int=(SELECT Id FROM importadora.OrdenesCompra WHERE Numero='OC-000001');
DECLARE @oc2 int=(SELECT Id FROM importadora.OrdenesCompra WHERE Numero='OC-000002');
DECLARE @oc3 int=(SELECT Id FROM importadora.OrdenesCompra WHERE Numero='OC-000003');
INSERT importadora.OrdenCompraDetalles(OrdenCompraId,ProductoId,Cantidad,CostoUnitario,CantidadRecibida) VALUES
  (@oc1,(SELECT Id FROM importadora.Productos WHERE Codigo='ACC-CARG-20W'),40,7.50,40),
  (@oc1,(SELECT Id FROM importadora.Productos WHERE Codigo='ACC-CABLE-C'),80,3.20,80),
  (@oc1,(SELECT Id FROM importadora.Productos WHERE Codigo='HOG-BOMB-WIFI'),30,11.00,30),
  (@oc2,(SELECT Id FROM importadora.Productos WHERE Codigo='HER-DEST-32'),25,18.00,0),
  (@oc2,(SELECT Id FROM importadora.Productos WHERE Codigo='ILU-LED-5M'),40,12.50,0),
  (@oc3,(SELECT Id FROM importadora.Productos WHERE Codigo='HOG-ORGAN-3'),20,8.00,0);

INSERT importadora.Importaciones(OrdenCompraId,Codigo,TipoEnvio,AgenteCarga,Casillero,GuiaContenedor,FechaSalida,FechaEstimadaLlegada,FechaLlegada,Estado,Notas) VALUES
  (@oc1,'IMP-000001','maritimo',N'Cargo Venezuela',N'CJ-VE-8831',N'MSCU-DEMO-0001','2026-10-05','2026-10-20','2026-10-24','recibida',N'Recepción de demostración completada.'),
  (@oc2,'IMP-000002','maritimo',N'Cargo Venezuela',N'CJ-VE-8831',N'NINGBO-DEMO-002','2026-10-21','2026-11-12',NULL,'en_transito',N'Importación de prueba en tránsito.');

DECLARE @imp1 int=(SELECT Id FROM importadora.Importaciones WHERE Codigo='IMP-000001');
INSERT importadora.ImportacionGastos(ImportacionId,Concepto,Monto,MonedaCodigo,Fecha,TasaBCV) VALUES
  (@imp1,N'Flete marítimo',210,'USD','2026-10-08',NULL),
  (@imp1,N'Nacionalización',2700,'VES','2026-10-23',45.000000),
  (@imp1,N'Seguro de carga',30,'USD','2026-10-08',NULL);

DECLARE @recepcion table(Id int);
INSERT importadora.RecepcionesImportacion(ImportacionId,AlmacenId,Fecha,Observaciones,RecibidoPorUsuarioId)
OUTPUT INSERTED.Id INTO @recepcion VALUES(@imp1,@almacenId,'2026-10-24',N'Recepción demo: mercancía completa y verificada.',@usuarioId);
DECLARE @recepcionId int=(SELECT Id FROM @recepcion);
DECLARE @d1 int=(SELECT d.Id FROM importadora.OrdenCompraDetalles d JOIN importadora.Productos p ON p.Id=d.ProductoId WHERE d.OrdenCompraId=@oc1 AND p.Codigo='ACC-CARG-20W');
DECLARE @d2 int=(SELECT d.Id FROM importadora.OrdenCompraDetalles d JOIN importadora.Productos p ON p.Id=d.ProductoId WHERE d.OrdenCompraId=@oc1 AND p.Codigo='ACC-CABLE-C');
DECLARE @d3 int=(SELECT d.Id FROM importadora.OrdenCompraDetalles d JOIN importadora.Productos p ON p.Id=d.ProductoId WHERE d.OrdenCompraId=@oc1 AND p.Codigo='HOG-BOMB-WIFI');
INSERT importadora.RecepcionImportacionDetalles(RecepcionId,OrdenCompraDetalleId,CantidadPedida,CantidadRecibida,CantidadFaltante) VALUES
  (@recepcionId,@d1,40,40,0),(@recepcionId,@d2,80,80,0),(@recepcionId,@d3,30,30,0);
INSERT importadora.ImportacionCostoDistribuciones(ImportacionId,OrdenCompraDetalleId,CostoMercancia,GastosAsignados,CostoAterrizadoTotal,MonedaCodigo) VALUES
  (@imp1,@d1,300.0000,84.7059,384.7059,'USD'),(@imp1,@d2,256.0000,72.2824,328.2824,'USD'),(@imp1,@d3,330.0000,93.0117,423.0117,'USD');
INSERT importadora.InventarioLotes(AlmacenId,ProductoId,ImportacionId,RecepcionDetalleId,CantidadInicial,CantidadDisponible,CostoUnitarioAterrizado,MonedaCodigo)
SELECT @almacenId,p.Id,@imp1,rd.Id,rd.CantidadRecibida,rd.CantidadRecibida,cd.CostoAterrizadoTotal/rd.CantidadRecibida,'USD'
FROM importadora.RecepcionImportacionDetalles rd JOIN importadora.OrdenCompraDetalles d ON d.Id=rd.OrdenCompraDetalleId JOIN importadora.Productos p ON p.Id=d.ProductoId JOIN importadora.ImportacionCostoDistribuciones cd ON cd.OrdenCompraDetalleId=d.Id AND cd.ImportacionId=@imp1
WHERE rd.RecepcionId=@recepcionId;
INSERT importadora.InventarioMovimientos(LoteId,Tipo,Cantidad,Referencia,UsuarioId)
SELECT Id,'recepcion',CantidadInicial,'IMP-000001',@usuarioId FROM importadora.InventarioLotes WHERE ImportacionId=@imp1;
INSERT importadora.Auditoria(UsuarioId,Accion,EntidadId,Detalle) VALUES
  (@usuarioId,'datos.demo',@imp1,N'Datos de demostración cargados para catálogo, compras, importaciones e inventario.');

COMMIT;
