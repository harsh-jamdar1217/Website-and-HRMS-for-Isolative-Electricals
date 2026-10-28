import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Enquiry received" };

export default async function Thanks({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const valid = ref && /^ENQ-\d{4}-[A-Z2-9]{6}$/.test(ref);
  return (
    <div className="wrap py-16">
      <div className="max-w-xl border border-line border-t-2 border-t-ok bg-white p-8">
        <h1 className="text-3xl">Enquiry received</h1>
        {valid ? (
          <>
            <p className="mt-3 text-steel">Your reference number is:</p>
            <p className="mt-1 font-mono text-2xl font-bold text-navy" aria-label={`Reference ${ref}`}>{ref}</p>
            <p className="mt-4 text-steel">We have sent a confirmation to your email. Quote this number in any follow-up.</p>
          </>
        ) : (
          <p className="mt-3 text-steel">Thank you. We will reply to the email address you provided.</p>
        )}
        <Link href="/" className="btn btn-primary mt-6 no-underline">Back to home</Link>
      </div>
    </div>
  );
}
