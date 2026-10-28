"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/ui";

const initial: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initial);
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      {state.formError && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger">{state.formError}</div>}
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email" error={e.email}>
        <input id="email" name="email" type="email" autoComplete="username" defaultValue={state.email} className="input" aria-invalid={e.email ? true : undefined} />
      </Field>
      <Field id="password" label="Password" error={e.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" aria-invalid={e.password ? true : undefined} />
      </Field>
      <SubmitButton pending="Signing in...">Sign in</SubmitButton>
    </form>
  );
}
