"use client";
import Link from "next/link";
import { useActionState } from "react";
import { applyAction, type ApplyState } from "@/app/actions/recruitment";
import { Field, SubmitButton } from "@/components/ui";

export function ApplyForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(applyAction, {} as ApplyState);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const a = (id: string) => ({ id, name: id, "aria-invalid": e[id] ? true : undefined, "aria-describedby": e[id] ? `${id}-err` : undefined });
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      {state.formError && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger">{state.formError}</div>}
      {Object.keys(e).length > 0 && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger">Check the highlighted fields and try again.</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Full name" error={e.name}><input {...a("name")} className="input" autoComplete="name" defaultValue={v.name} /></Field>
        <Field id="phone" label="Mobile number" error={e.phone}><input {...a("phone")} type="tel" className="input" autoComplete="tel" defaultValue={v.phone} /></Field>
        <Field id="email" label="Email" error={e.email} hint="We send a confirmation link to this address."><input {...a("email")} type="email" className="input" autoComplete="email" defaultValue={v.email} /></Field>
        <Field id="password" label="Create a password" error={e.password} hint="At least 10 characters, with letters and numbers."><input {...a("password")} type="password" className="input" autoComplete="new-password" /></Field>
      </div>
      <Field id="coverNote" label="Why are you interested?" optional error={e.coverNote}><textarea {...a("coverNote")} className="input min-h-28" rows={4} maxLength={1500} defaultValue={v.coverNote} /></Field>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-5 w-5 accent-navy" aria-invalid={e.consent ? true : undefined} />
          <span>I agree that Isolative Electricals may store my details and documents to assess my application. See the <Link href="/privacy">privacy notice</Link>.</span>
        </label>
        {e.consent && <p role="alert" className="err">{e.consent}</p>}
      </div>
      <SubmitButton pending="Submitting...">Submit application</SubmitButton>
    </form>
  );
}
