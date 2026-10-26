"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container section">
      <h1>No pudimos completar la carga.</h1>
      <p>La conexión puede no estar disponible. Intenta nuevamente.</p>
      <button className="button" onClick={reset}>
        Reintentar
      </button>{" "}
      <Link href="/">Volver al inicio</Link>
    </main>
  );
}
