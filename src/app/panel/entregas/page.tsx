import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, sql } from "@/lib/db";
import { formatVenezuelanDate } from "@/lib/dates";
import { listingParams } from "@/lib/listing";
import ListControls, { ListPagination } from "@/components/list-controls";

type SearchParams = Promise<{
  q?: string | string[];
  page?: string | string[];
  limit?: string | string[];
}>;

export default async function DeliveriesPage({ searchParams }: { searchParams: SearchParams }) {
  const user=await requireUser("pedidos.ver");

  const pool = await db();
  const { query, page, limit, offset } = listingParams(await searchParams);

  const [countResult, pendingResult, deliveriesResult] = await Promise.all([
    pool
      .request()
      .input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query)
      .query(`
        SELECT COUNT(*) AS Total
        FROM importadora.EntregasPedido e
        INNER JOIN importadora.PedidosVenta p ON p.Id = e.PedidoVentaId
        INNER JOIN importadora.Clientes c ON c.Id = p.ClienteId
        WHERE p.EmpresaId=@company AND (@query = ''
          OR p.Numero LIKE '%' + @query + '%'
          OR c.Nombre LIKE '%' + @query + '%'
          OR e.Metodo LIKE '%' + @query + '%'
          OR e.Responsable LIKE '%' + @query + '%')
      `),
    pool.request().input("company",sql.Int,user.EmpresaId).query(`
      SELECT p.Id, p.Numero, c.Nombre AS Cliente, p.Fecha
      FROM importadora.PedidosVenta p
      INNER JOIN importadora.Clientes c ON c.Id = p.ClienteId
      WHERE p.EmpresaId=@company AND p.Estado = 'confirmado'
        AND NOT EXISTS (
          SELECT 1 FROM importadora.EntregasPedido e WHERE e.PedidoVentaId = p.Id
        )
      ORDER BY p.Fecha DESC, p.Id DESC
    `),
    pool
      .request()
      .input("company",sql.Int,user.EmpresaId).input("query", sql.NVarChar(100), query)
      .input("offset", sql.Int, offset)
      .input("limit", sql.Int, limit)
      .query(`
        SELECT
          e.Id AS EntregaId,
          e.Fecha,
          e.Metodo,
          e.Responsable,
          e.Notas,
          p.Id AS PedidoId,
          p.Numero,
          c.Nombre AS Cliente
        FROM importadora.EntregasPedido e
        INNER JOIN importadora.PedidosVenta p ON p.Id = e.PedidoVentaId
        INNER JOIN importadora.Clientes c ON c.Id = p.ClienteId
        WHERE p.EmpresaId=@company AND (@query = ''
          OR p.Numero LIKE '%' + @query + '%'
          OR c.Nombre LIKE '%' + @query + '%'
          OR e.Metodo LIKE '%' + @query + '%'
          OR e.Responsable LIKE '%' + @query + '%')
        ORDER BY e.Fecha DESC, e.Id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `),
  ]);

  const total = countResult.recordset[0].Total as number;
  const pending = pendingResult.recordset as Array<{ Id: number; Numero: string; Cliente: string; Fecha: Date }>;
  const deliveries = deliveriesResult.recordset as Array<{
    EntregaId: number;
    Fecha: Date;
    Metodo: string;
    Responsable: string | null;
    Notas: string | null;
    PedidoId: number;
    Numero: string;
    Cliente: string;
  }>;

  return (
    <main className="page-stack">
      <div>
        <p className="eyebrow">DESPACHO</p>
        <h1>Entregas</h1>
        <p className="muted">Registra la entrega al cliente y conserva su historial de despacho.</p>
      </div>

      <section className="empty-card">
        <div className="section-heading">
          <div>
            <h2>Pedidos pendientes de entrega</h2>
            <p className="muted">Pedidos confirmados que todavía no han sido despachados.</p>
          </div>
        </div>
        {pending.length === 0 ? (
          <p className="muted">No hay pedidos pendientes de entrega.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th aria-label="Acciones" /></tr></thead>
              <tbody>
                {pending.map((item) => (
                  <tr key={item.Id}>
                    <td>{item.Numero}</td>
                    <td>{item.Cliente}</td>
                    <td>{formatVenezuelanDate(item.Fecha)}</td>
                    <td><Link className="table-action" href={`/panel/pedidos/${item.Id}`}>Registrar entrega</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="empty-card">
        <div className="section-heading">
          <div>
            <h2>Entregas registradas</h2>
            <p className="muted">Consulta el historial por pedido, cliente, método o responsable.</p>
          </div>
        </div>
        <ListControls
          basePath="/panel/entregas"
          query={query}
          page={page}
          total={total}
          limit={limit}
          includePagination={false}
          placeholder="Buscar pedido, cliente, método o responsable"
        />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Método</th><th>Responsable</th><th>Notas</th></tr></thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr><td colSpan={6} className="muted">No hay entregas que coincidan con la búsqueda.</td></tr>
              ) : deliveries.map((item) => (
                <tr key={item.EntregaId}>
                  <td>{formatVenezuelanDate(item.Fecha)}</td>
                  <td><Link className="table-action" href={`/panel/pedidos/${item.PedidoId}`}>{item.Numero}</Link></td>
                  <td>{item.Cliente}</td>
                  <td>{item.Metodo}</td>
                  <td>{item.Responsable || "—"}</td>
                  <td>{item.Notas || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPagination basePath="/panel/entregas" query={query} page={page} total={total} limit={limit} />
        </div>
      </section>
    </main>
  );
}
