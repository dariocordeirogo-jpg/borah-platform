"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
  type AuthState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-green focus:ring-2 focus:ring-green/20 aria-[invalid=true]:border-danger";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {errors[0]}
    </p>
  );
}

function PasswordField({
  name,
  autoComplete,
  errors,
  label = "Senha",
}: {
  name: string;
  autoComplete: string;
  errors?: string[];
  label?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={errors?.length ? `${name}-erro` : undefined}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      <FieldError id={`${name}-erro`} errors={errors} />
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <Button type="submit" variant="outline" size="lg" className="w-full border-line text-ink hover:bg-surface">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
        </svg>
        Continuar com Google
      </Button>
    </form>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" /> ou com e-mail <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function Alert({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-xl bg-green-soft px-4 py-3 text-sm text-green-deep">
        {state.message}
      </p>
    );
  return null;
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <>
      <GoogleButton next={next} />
      <Divider />
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Alert state={state} />
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            aria-describedby={state.fieldErrors?.email ? "email-erro" : undefined}
            className={inputClass}
          />
          <FieldError id="email-erro" errors={state.fieldErrors?.email} />
        </div>
        <PasswordField name="password" autoComplete="current-password" errors={state.fieldErrors?.password} />
        <Link href="/recuperar-senha" className="-mt-2 block text-right text-sm font-medium text-green-deep hover:underline">
          Esqueci minha senha
        </Link>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-green-deep hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, {});
  if (state.message) {
    return (
      <div className="space-y-6">
        <Alert state={state} />
        <Link href="/entrar" className="block text-center text-sm font-semibold text-green-deep hover:underline">
          Já confirmei, quero entrar
        </Link>
      </div>
    );
  }
  return (
    <>
      <GoogleButton next="/conta" />
      <Divider />
      <form action={action} className="space-y-4" noValidate>
        <Alert state={state} />
        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
            Nome
          </label>
          <input
            id="displayName"
            name="displayName"
            autoComplete="name"
            required
            aria-invalid={state.fieldErrors?.displayName ? true : undefined}
            aria-describedby={state.fieldErrors?.displayName ? "displayName-erro" : undefined}
            className={inputClass}
          />
          <FieldError id="displayName-erro" errors={state.fieldErrors?.displayName} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            aria-describedby={state.fieldErrors?.email ? "email-erro" : undefined}
            className={inputClass}
          />
          <FieldError id="email-erro" errors={state.fieldErrors?.email} />
        </div>
        <PasswordField name="password" autoComplete="new-password" errors={state.fieldErrors?.password} />
        <p className="-mt-2 text-xs text-muted">Mínimo de 8 caracteres, com letras e números.</p>
        <div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="acceptTerms"
              className="mt-0.5 h-5 w-5 rounded accent-[#168447]"
              aria-describedby={state.fieldErrors?.acceptTerms ? "terms-erro" : undefined}
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" className="font-semibold text-green-deep underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="font-semibold text-green-deep underline">
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          <FieldError id="terms-erro" errors={state.fieldErrors?.acceptTerms} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-green-deep hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  if (state.message) {
    return (
      <div className="space-y-6">
        <Alert state={state} />
        <Link href="/entrar" className="block text-center text-sm font-semibold text-green-deep hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alert state={state} />
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-mail da conta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? "email-erro" : undefined}
          className={inputClass}
        />
        <FieldError id="email-erro" errors={state.fieldErrors?.email} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Enviar link
      </Button>
      <Link href="/entrar" className="block text-center text-sm text-muted hover:text-green-deep">
        Lembrei a senha
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Alert state={state} />
      <PasswordField name="password" label="Nova senha" autoComplete="new-password" errors={state.fieldErrors?.password} />
      <p className="-mt-2 text-xs text-muted">Mínimo de 8 caracteres, com letras e números.</p>
      <PasswordField name="confirm" label="Repita a nova senha" autoComplete="new-password" errors={state.fieldErrors?.confirm} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Salvar nova senha
      </Button>
    </form>
  );
}
