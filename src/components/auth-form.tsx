"use client";
import { useActionState } from "react";
import Link from "next/link";
import { activateInvitation, login } from "@/app/actions/auth";
export function AuthForm({ mode, token }: { mode: "login" | "activation"; token?: string }) {
  const isActivation = mode === "activation";
  const [state, action, pending] = useActionState(isActivation ? activateInvitation : login, { message: "" });
  return (
    <>
      <form action={action}>
        {isActivation ? <input type="hidden" name="token" value={token} /> : <label className="field">Correo electrónico<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="nombre@empresa.com" /></label>}
        <label className="field">
          Contraseña
          <input
            type="password"
            name="password"
            autoComplete={isActivation ? "new-password" : "current-password"}
            required
            minLength={isActivation ? 12 : 1}
            maxLength={128}
            placeholder={isActivation ? "Mínimo 12 caracteres" : "Tu contraseña"}
          />
        </label>
        {isActivation && (
          <label className="field">
            Confirmar contraseña
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              placeholder="Repite tu contraseña"
            />
          </label>
        )}
        {state.message && (
          <p
            role="status"
            className={`form-message ${state.success ? "" : "error"}`}
          >
            {state.message}
          </p>
        )}
        <button className="button" disabled={pending || state.success}>
          {pending ? "Procesando…" : isActivation ? "Activar mi cuenta ↗" : "Iniciar sesión ↗"}
        </button>
      </form>
      <div className="auth-links">
        {isActivation ? <Link href="/iniciar-sesion">Volver a iniciar sesión</Link> : <>
          <span>Las cuentas se crean por invitación.</span>
          <Link href="/recuperar-acceso">Olvidé mi contraseña</Link>
        </>}
      </div>
    </>
  );
}
