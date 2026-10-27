import Link from "next/link";
import MobileNavigation from "@/components/mobile-navigation";
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
  const navigation = [
    { href: "/panel", label: "◎   Mi espacio", show: true },
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
          {[

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
        <MobileNavigation items={mobileNavigation} />
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
