"use client";
export default function PanelError({ reset }: { reset: () => void }) {
  return (
    <section className="empty-card">
      <h2>No pudimos cargar este espacio.</h2>
      <p>
        Comprueba la conexión con SQL Server y que el script de seguridad esté
        instalado.
      </p>
      <button className="button" onClick={reset}>
        Volver a intentar
      </button>
    </section>
  );
}
