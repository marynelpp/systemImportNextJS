import Link from "next/link";
export const metadata = { title: "Acceso privado" };
export default function RegisterPage() {
  return (
    <>
      <div className="eyebrow">ACCESO PRIVADO</div>
      <h1>Las cuentas se crean por invitación.</h1>
      <p>
        Solicita a la persona administradora que registre tu nombre, correo y
        rol. Recibirás un enlace para crear tu contraseña.
      </p>
      <Link href="/iniciar-sesion" className="button">Volver a iniciar sesión</Link>
    </>
  );
}
