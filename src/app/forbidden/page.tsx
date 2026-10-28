import Link from "next/link";

export default function Forbidden() {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md border border-line border-t-2 border-t-danger bg-white p-7">
        <h1 className="text-2xl">You do not have access to this page</h1>
        <p className="mt-2 text-steel">Your role does not include this area. If you need access, ask an administrator.</p>
        <Link href="/admin" className="btn btn-primary mt-5 no-underline">Back to the portal</Link>
      </div>
    </main>
  );
}
