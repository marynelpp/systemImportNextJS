import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ acceso?: string }>;
}) {
  const user = await requireUser(),
    params = await searchParams;
  return (
    <>
      <h1>Hola, {user.Nombre.split(" ")[0]}.</h1>
      <p>Tu operación empieza con una buena base.</p>
      {params.acceso && (
        <p role="status" className="form-message error">
          Tu rol no tiene permiso para acceder a esa función.
        </p>
      )}
      <section className="empty-card">
        <span className="badge">Etapa 02 · Configuración y monedas</span>
        <h2>Bienvenido a tu espacio de trabajo.</h2>
        <p>
          La base de acceso está lista. Aquí aparecerá el resumen de ventas,
          pedidos e inventario cuando se incorporen esos módulos.
        </p>
        {can(user, "configuracion.administrar") ? <Link className="button" href="/panel/configuracion">Configurar mi operación ↗</Link> : can(user, "usuarios.administrar") && <Link className="button" href="/panel/usuarios">Gestionar mi equipo ↗</Link>}
      </section>
      <div className="module-grid">
        {[
          [
            "Catálogo y precios",
            "La próxima etapa para organizar tus productos.",
          ],
          [
            "Compras e inventario",
            "Seguimiento desde el proveedor hasta tu almacén.",
          ],
          ["Pedidos y ventas", "Mayor, detal, cobros y entregas conectados."],
        ].map(([t, d]) => (
          <article key={t} className="module-card">
            <span className="eyebrow">PRÓXIMAMENTE</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
      </div>
    </>
  );
}
