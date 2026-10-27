import Link from "next/link";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth-shell">
      <aside className="auth-aside">
        <Link className="brand" href="/">
          <span className="brand-mark">n.</span>JJ IMPORT
        </Link>
        <div>
          <div className="eyebrow">DE ORIGEN A DESTINO</div>
          <h2>
            Tu equipo.
            <br />
            Tu operación.
            <br />
            Un mismo lugar.
          </h2>
          <p>Una visión conectada de todo lo que mueve tu importadora.</p>
        </div>
        <small>CHINA ───────── VENEZUELA</small>
      </aside>
      <section className="auth-main">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}
