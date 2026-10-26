import Link from "next/link";
export const metadata = { title: "Recuperar acceso" };
export default function RecoveryPage() {
  return (
    <>
      <div className="eyebrow">TE AYUDAMOS A VOLVER</div>
      <h1>Recupera tu acceso.</h1>
      <p>
        La recuperación por correo todavía no está habilitada. Comunícate
        directamente con la persona administradora para solicitar el
        restablecimiento de tu contraseña.
      </p>
      <p className="auth-footnote">
        No se enviará ningún correo desde esta pantalla.
      </p>
      <Link href="/iniciar-sesion" className="button">
        Volver a iniciar sesión
      </Link>
    </>
  );
}
