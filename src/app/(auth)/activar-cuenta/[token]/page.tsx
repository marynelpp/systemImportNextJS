import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Activar cuenta",
  robots: { index: false, follow: false },
};

export default async function ActivateAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const isTokenValid = /^[a-f0-9]{64}$/.test(token);
  return (
    <>
      <div className="eyebrow">INVITACIÓN DE EQUIPO</div>
      <h1>Activa tu cuenta.</h1>
      <p>
        Define una contraseña segura para acceder al espacio de trabajo de la
        importadora.
      </p>
      {isTokenValid ? (
        <AuthForm mode="activation" token={token} />
      ) : (
        <p className="form-message error">
          La invitación no es válida. Solicita un nuevo enlace a la persona
          administradora.
        </p>
      )}
      <p className="auth-footnote">
        El enlace de activación puede utilizarse una sola vez y vence en 7
        días.
      </p>
    </>
  );
}
