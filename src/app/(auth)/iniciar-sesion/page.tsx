import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Iniciar sesión" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activada?: string }>;
}) {
  const { activada } = await searchParams;
  return (
    <>
      <div className="eyebrow">TU ESPACIO DE TRABAJO</div>
      <h1>Qué bueno tenerte aquí.</h1>
      <p>Ingresa tus datos para continuar con tu operación.</p>
      {activada === "1" && (
        <p className="form-message">
          Tu cuenta fue activada. Ya puedes iniciar sesión.
        </p>
      )}
      <AuthForm mode="login" />
      <div className="auth-footnote">
        Acceso exclusivo para miembros autorizados de la importadora.
      </div>
    </>
  );
}
