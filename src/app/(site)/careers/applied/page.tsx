import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default function Applied() {
  return (
    <div className="wrap py-16">
      <div className="max-w-xl border border-line border-t-2 border-t-ok bg-white p-8">
        <h1 className="text-3xl">Check your email</h1>
        <p className="mt-3 text-steel">If your application was accepted, we have sent a confirmation link to your email address. Open it to confirm your email, then sign in to upload your documents.</p>
        <p className="mt-3 text-sm text-steel">The link works once and expires in 24 hours. Nothing arrived? Check spam, or sign in and request a new link.</p>
        <Link href="/login?next=/candidate" className="btn btn-primary mt-6 no-underline">Sign in</Link>
      </div>
    </div>
  );
}
