import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    redirect(
      user.role === "CANDIDATE"
        ? "/candidate"
        : user.role === "EMPLOYEE"
          ? "/employee"
          : can(user.role, "admin:access")
            ? "/admin"
            : "/"
    );
  }

  return (
    <main
      id="main"
      className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:grid lg:place-items-center"
    >
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-[#102f46] p-10 text-white lg:flex">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-20 h-80 w-80 rounded-full border-[40px] border-white/5"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-2xl"
          />

          <div className="relative">
            <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-lg font-bold">
              IE
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Isolative Electricals
            </p>
            <h1 className="mt-5 max-w-sm text-4xl font-semibold leading-tight">
              Your work, connected.
            </h1>
            <p className="mt-4 max-w-sm leading-7 text-slate-300">
              A secure workspace for employees, candidates, and company
              operations.
            </p>
          </div>

          <p className="relative text-sm text-slate-400">
            Isolative Electricals Private Limited
          </p>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center px-6 py-10 sm:px-10 lg:px-14">
          <Link
            href="/"
            className="mb-10 inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-[#102f46]"
          >
            <span aria-hidden="true">←</span>
            Back to website
          </Link>

          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Staff portal
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sign in with your company account to continue.
            </p>
          </div>

          <LoginForm next={next ?? ""} />

          <p className="mt-8 text-center text-xs leading-5 text-slate-500">
            Access is restricted to authorized users. Keep your password
            confidential.
          </p>
        </section>
      </div>
    </main>
  );
}