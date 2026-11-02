import Link from "next/link";
import MobileNavigation from "@/components/mobile-navigation";
import { requireUser, can } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { changeActiveCompany } from "@/app/actions/empresas";
import { db, sql } from "@/lib/db";
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
  const companies = user.EsAdministradorSistema ? (await (await db()).request().query("SELECT Id,COALESCE(NombreComercial,NombreLegal) Nombre FROM importadora.Empresas WHERE Activa=1 ORDER BY Nombre")).recordset : (await (await db()).request().input("user", sql.Int, user.Id).query("SELECT e.Id,COALESCE(e.NombreComercial,e.NombreLegal) Nombre FROM importadora.UsuarioEmpresas ue JOIN importadora.Empresas e ON e.Id=ue.EmpresaId WHERE ue.UsuarioId=@user AND ue.Activo=1 AND e.Activa=1 ORDER BY Nombre")).recordset;
  const navigation = [
    { href: "/panel", label: "◎   Mi espacio", show: true },
    { href: "/panel/empresas", label: "◉   Empresas", show: user.EsAdministradorSistema },
    {
      href: "/panel/configuracion",
      label: "◉   Configuración",
      show: can(user, "configuracion.administrar"),
    },
    {
      href: "/panel/usuarios",
      label: "♙   Usuarios",
      show: can(user, "usuarios.administrar"),
    },
    {
      href: "/panel/roles",
      label: "◈   Roles y permisos",
      show: can(user, "roles.administrar"),
    },
    {
      href: "/panel/auditoria",
      label: "≡   Auditoría",
      show: can(user, "auditoria.ver"),
    },
    { href: "/panel/productos", label: "▦   Productos", show: can(user, "productos.ver") },
    { href: "/panel/proveedores", label: "◇   Proveedores", show: can(user, "proveedores.ver") },
    { href: "/panel/compras", label: "▣   Compras", show: can(user, "compras.ver") },
    { href: "/panel/importaciones", label: "✈   Importaciones", show: can(user, "compras.ver") },
    { href: "/panel/inventario", label: "▤   Inventario", show: can(user, "inventario.ver") },
    { href: "/panel/alertas", label: "⚠   Alertas", show: can(user, "inventario.ver") },
    { href: "/panel/clientes", label: "♧   Clientes", show: can(user, "clientes.ver") },
    { href: "/panel/pedidos", label: "▧   Pedidos y ventas", show: can(user, "pedidos.ver") },
    { href: "/panel/entregas", label: "▣   Entregas", show: can(user, "pedidos.ver") },
    { href: "/panel/caja", label: "▤   Caja y cobros", show: can(user, "pedidos.ver") },
    { href: "/panel/reportes", label: "◫   Reportes", show: can(user, "pedidos.ver") },
    { href: "/panel/rotacion", label: "↗   Rotación", show: can(user, "pedidos.ver") },
  ];

  const mobileNavigation = navigation
    .filter((item) => item.show)
    .map(({ href, label }) => ({ href, label }));

  const renderNavigationLinks = () =>
    navigation
      .filter((item) => item.show)
      .map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">n.</span>JJ IMPORT
        </Link>
        <nav className="desktop-navigation" aria-label="Módulos">
          {renderNavigationLinks()}
        </nav>
        <form action={logout}>
          <button className="button small">Cerrar sesión</button>
        </form>
        <MobileNavigation items={mobileNavigation} />
      </aside>
      <main className="workspace">
        <header className="workspace-header">
          <div className="eyebrow">ESPACIO DE TRABAJO / IMPORTADORA</div>
          {user.EsAdministradorSistema ? (
            <form action={changeActiveCompany} className="inline-form">
              <select name="companyId" defaultValue={user.EmpresaId} aria-label="Empresa activa">
                {companies.map((company) => <option key={company.Id} value={company.Id}>{company.Nombre}</option>)}
              </select>
              <button className="catalog-action">Cambiar</button>
              <span className="badge">{user.Nombre} · {user.Rol}</span>
            </form>
          ) : (
            <div className="inline-form">
              <span className="badge">{companies[0]?.Nombre ?? "Empresa activa"}</span>
              <span className="badge">{user.Nombre} · {user.Rol}</span>
            </div>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}
