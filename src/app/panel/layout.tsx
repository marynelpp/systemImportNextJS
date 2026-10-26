import Link from "next/link";
import { requireUser, can } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Panel de control",
  robots: { index: false, follow: false },
};
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">n.</span>NEXO IMPORT
        </Link>
        <nav aria-label="Módulos">
          <Link href="/panel">◎ &nbsp; Mi espacio</Link>
          {can(user, "configuracion.administrar") && (
            <Link href="/panel/configuracion">◉ &nbsp; Configuración</Link>
          )}
          {can(user, "usuarios.administrar") && (
            <Link href="/panel/usuarios">♙ &nbsp; Usuarios</Link>
          )}
          {can(user, "roles.administrar") && (
            <Link href="/panel/roles">◈ &nbsp; Roles y permisos</Link>
          )}
          {can(user, "auditoria.ver") && (
            <Link href="/panel/auditoria">≡ &nbsp; Auditoría</Link>
          )}
          {[
            "Productos",
            "Proveedores",
            "Importaciones",
            "Inventario",
            "Clientes y pedidos",
            "Ventas y caja",
          ].map((t) => (
            <span key={t}>
              {t}
              <small>Próximamente</small>
            </span>
          ))}
        </nav>
        <form action={logout}>
          <button className="button small">Cerrar sesión</button>
        </form>
      </aside>
      <main className="workspace">
        <header className="workspace-header">
          <div className="eyebrow">ESPACIO DE TRABAJO / IMPORTADORA</div>
          <span className="badge">
            {user.Nombre} · {user.Rol}
          </span>
        </header>
        {children}
      </main>
    </div>
  );
}
