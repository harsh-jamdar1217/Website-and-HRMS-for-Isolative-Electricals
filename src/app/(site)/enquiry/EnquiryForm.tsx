"use client";
import Link from "next/link";
import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "@/app/actions/enquiry";
import { Field, SubmitButton } from "@/components/ui";
import { ENQUIRY_CATEGORIES } from "@/lib/status";

const initial: EnquiryState = {};

export function EnquiryForm({ defaultCategory, itemSlug, itemTitle }: { defaultCategory: string; itemSlug?: string; itemTitle?: string }) {
  const [state, action] = useActionState(submitEnquiry, initial);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const a = (id: string) => ({ id, name: id, "aria-invalid": e[id] ? true : undefined, "aria-describedby": e[id] ? `${id}-err` : undefined });

  return (
    <form action={action} noValidate className="space-y-5">
      {itemSlug && <input type="hidden" name="item" value={itemSlug} />}
      {itemTitle && <p className="border-l-4 border-amber bg-sheet p-3 text-sm">Regarding: <strong>{itemTitle}</strong></p>}
      {state.formError && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger">{state.formError}</div>}
      {Object.keys(e).length > 0 && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger">Check the highlighted fields and send again.</div>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Your name" error={e.name}><input {...a("name")} className="input" autoComplete="name" defaultValue={v.name} maxLength={100} /></Field>
        <Field id="company" label="Company" optional error={e.company}><input {...a("company")} className="input" autoComplete="organization" defaultValue={v.company} maxLength={150} /></Field>
        <Field id="email" label="Email" error={e.email}><input {...a("email")} type="email" className="input" autoComplete="email" defaultValue={v.email} /></Field>
        <Field id="phone" label="Phone" optional error={e.phone} hint="Include the country code if outside India."><input {...a("phone")} type="tel" className="input" autoComplete="tel" defaultValue={v.phone} /></Field>
      </div>

      <Field id="category" label="What is your enquiry about?" error={e.category}>
        <select {...a("category")} className="input" defaultValue={v.category || defaultCategory}>
          <option value="">Choose one</option>
          {Object.entries(ENQUIRY_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </Field>

      <Field id="message" label="Your requirement" error={e.message} hint="Include quantities, specifications and the site location if you can.">
        <textarea {...a("message")} className="input min-h-40" rows={6} defaultValue={v.message} maxLength={3000} />
      </Field>

      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" id="consent" className="mt-1 h-5 w-5 accent-navy" aria-invalid={e.consent ? true : undefined} aria-describedby={e.consent ? "consent-err" : undefined} />
          <span>I agree that Isolative Electricals may store the details above and use them to respond to this enquiry. See the <Link href="/privacy">privacy notice</Link>.</span>
        </label>
        {e.consent && <p id="consent-err" role="alert" className="err">{e.consent}</p>}
      </div>

      <SubmitButton pending="Sending...">Send enquiry</SubmitButton>
    </form>
  );
}
