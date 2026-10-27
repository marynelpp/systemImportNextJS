import Link from "next/link";
const modules = [
  [
    "01",
    "Inventario en orden",
    "Cada producto, cada almacén y cada movimiento, en un solo lugar.",
    "Productos · Almacenes · Stock",
  ],
  [
    "02",
    "De China a tu almacén",
    "Conecta proveedores, compras y embarques con el costo real de tu mercancía.",
    "Compras · Importaciones · Costos",
  ],
  [
    "03",
    "Ventas que conectan",
    "Del pedido a la entrega. Una operación continua para ventas al mayor y al detal.",
    "Clientes · Pedidos · Ventas",
  ],
];
export default function Home() {
  return (
    <main>
      <header className="site-header container">
        <Link className="brand" href="/">
          <span className="brand-mark">n.</span>JJ <span>IMPORT</span>
        </Link>
        <nav>
          <a href="#operacion">La plataforma</a>
          <a href="#flujo">Cómo funciona</a>
        </nav>
        <Link className="button small" href="/iniciar-sesion">
          Iniciar sesión ↗
        </Link>
      </header>
      <section className="hero container">
        <div>
          <div className="eyebrow">● CONECTAMOS TU OPERACIÓN</div>
          <h1>
            De origen
            <br />a destino.
            <br />
            <em>Todo bajo control.</em>
          </h1>
          <p>
            Tu importadora, conectada. Compras en China, inventario en Venezuela
            y cada venta en el mismo lugar.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/iniciar-sesion">
              Entrar a mi espacio ↗
            </Link>
            <a href="#operacion">Explorar la plataforma ↓</a>
          </div>
          <div className="hero-note">
            CHINA <span>────────</span> VENEZUELA{" "}
            <small>Una operación. Una visión.</small>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-top">
            <span>UNA VISIÓN COMPLETA</span>
            <span className="pill">Tu operación, conectada</span>
          </div>
          <div className="route-art" aria-hidden="true">
            <div className="orbit" />
            <div className="orbit second" />
            <div className="route-line" />
            <div className="location china">
              <b>CN</b>
              <span>
                Origen<small>China</small>
              </span>
            </div>
            <div className="location venezuela">
              <b>VE</b>
              <span>
                Destino<small>Venezuela</small>
              </span>
            </div>
            <div className="cargo back">JJ / CARGO</div>
            <div className="cargo front">
              JJ / IMPORT <b>↗</b>
            </div>
          </div>
          <div className="journey-card">
            <span>↗</span>
            <div>
              <strong>El siguiente paso, siempre claro.</strong>
              <p>Compra → Importa → Recibe → Vende</p>
            </div>
          </div>
          <div className="visual-bottom">
            <span>TRAZABILIDAD DE PRINCIPIO A FIN</span>
            <span>01 — 04</span>
          </div>
        </div>
      </section>
      <section className="capability-strip">
        <div className="container">
          <span>↗ &nbsp; Mayor y detal</span>
          <span>◈ &nbsp; Control de inventario</span>
          <span>⇄ &nbsp; Operación multimoneda</span>
          <span>◎ &nbsp; Acceso por roles</span>
        </div>
      </section>
      <section id="operacion" className="section container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MENOS DISPERSIÓN. MÁS CLARIDAD.</div>
            <h2>
              Todo empieza con
              <br />
              una operación organizada.
            </h2>
          </div>
          <p>
            Un espacio pensado para cada etapa de tu importadora.
            <br />
            <small>Módulos en desarrollo progresivo.</small>
          </p>
        </div>
        <div className="module-grid">
          {modules.map(([n, t, d, tags]) => (
            <article className="module-card" key={n}>
              <div className="module-number">
                {n}
                <span>↗</span>
              </div>
              <h3>{t}</h3>
              <p>{d}</p>
              <small>{tags}</small>
            </article>
          ))}
        </div>
      </section>
      <section id="flujo" className="flow-section container">
        <div>
          <div className="eyebrow">UN FLUJO, DE PRINCIPIO A FIN</div>
          <h2>
            Cada paso conectado.
            <br />
            Cada decisión con contexto.
          </h2>
        </div>
        <div className="flow-steps">
          {[
            "Compra a tus proveedores",
            "Sigue tus importaciones",
            "Recibe y organiza",
            "Vende y entrega",
          ].map((t, i) => (
            <div key={t}>
              <span>0{i + 1}</span>
              <strong>{t}</strong>
              <span>↗</span>
            </div>
          ))}
        </div>
      </section>
      <section className="cta container">
        <div>
          <div className="eyebrow">TU EQUIPO, EN EL MISMO LUGAR</div>
          <h2>
            Una nueva forma de
            <br />
            gestionar lo que viene.
          </h2>
        </div>
        <Link className="button light" href="/iniciar-sesion">
          Iniciar sesión ↗
        </Link>
      </section>
      <footer className="container footer">
        <Link className="brand" href="/">
          <span className="brand-mark">n.</span>JJ IMPORT
        </Link>
        <span>De origen a destino. Todo conectado.</span>
        <small>© {new Date().getFullYear()} Nexo Import</small>
      </footer>
    </main>
  );
}
