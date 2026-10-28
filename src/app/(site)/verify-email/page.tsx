import type { Metadata } from "next";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/recruitment";
import { SubmitButton } from "@/components/ui";

export const metadata: Metadata = { title: "Confirm your email" };
export const dynamic = "force-dynamic";

/**
 * The emailed link only OPENS this page; confirming needs a button press (a POST).
 * That stops mail scanners and link previews from silently consuming the single-use token.
 */
export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string; status?: string }> }) {
  const { token, status } = await searchParams;
  return (
    <div className="wrap py-16">
      <div className={`max-w-xl border border-line border-t-2 bg-white p-8 ${status === "failed" ? "border-t-danger" : status === "done" ? "border-t-ok" : "border-t-navy"}`}>
        {status === "done" ? (
          <>
            <h1 className="text-3xl">Email confirmed</h1>
            <p className="mt-3 text-steel">Thank you. Sign in to upload your documents and send your application for review.</p>
            <Link href="/login?next=/candidate" className="btn btn-primary mt-6 no-underline">Sign in</Link>
          </>
        ) : status === "failed" ? (
          <>
            <h1 className="text-3xl">This link did not work</h1>
            <p className="mt-3 text-steel">It may have expired or already been used. Sign in and request a new confirmation email.</p>
            <Link href="/login?next=/candidate" className="btn btn-primary mt-6 no-underline">Sign in</Link>
          </>
        ) : token ? (
          <>
            <h1 className="text-3xl">Confirm your email</h1>
            <p className="mt-3 text-steel">Press the button to confirm this email address for your application.</p>
            <form action={verifyEmailAction} className="mt-6"><input type="hidden" name="token" value={token} /><SubmitButton pending="Confirming...">Confirm my email</SubmitButton></form>
          </>
        ) : (
          <><h1 className="text-3xl">Missing link</h1><p className="mt-3 text-steel">Open the link from your confirmation email.</p></>
        )}
      </div>
    </div>
  );
}
