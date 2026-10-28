import type { Metadata } from "next";
import { company } from "@/content/company";

export const metadata: Metadata = { title: "Privacy notice" };

export default function Privacy() {
  return (
    <div className="wrap max-w-3xl py-12">
      <h1 className="text-4xl">Privacy notice</h1>
      <p className="mt-2 text-sm text-steel">Draft for review by the company. Not yet legal advice.</p>
      <div className="mt-6 space-y-5 text-ink">
        <section><h2 className="text-xl">What we collect</h2><p className="mt-1">When you send an enquiry we store your name, email, optional phone and company, and the message you write.</p></section>
        <section><h2 className="text-xl">Why we use it</h2><p className="mt-1">Only to respond to your enquiry and to manage the resulting business relationship. We do not sell your data.</p></section>
        <section><h2 className="text-xl">Who can see it</h2><p className="mt-1">Authorised {company.shortName} administrators. Access is limited by role and recorded in an audit log.</p></section>
        <section><h2 className="text-xl">How long we keep it</h2><p className="mt-1">Retention periods will be confirmed by the company. You may ask us to correct or delete your enquiry at {company.contactEmail}.</p></section>
      </div>
    </div>
  );
}
