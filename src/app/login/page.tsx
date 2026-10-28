import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "CANDIDATE" ? "/candidate" : user.role === "EMPLOYEE" ? "/employee" : can(user.role, "admin:access") ? "/admin" : "/");
  return (
    <main id="main" className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 inline-block text-sm font-semibold">Back to website</Link>
        <div className="border border-line border-t-2 border-t-navy bg-white p-7">
          <h1 className="text-2xl">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-steel">Staff access to the Isolative Electricals portal.</p>
          <LoginForm next={next ?? ""} />
        </div>
      </div>
    </main>
  );
}
