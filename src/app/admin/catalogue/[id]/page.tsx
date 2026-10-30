import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogueStatusAction } from "@/app/actions/catalogue";
import { Flash } from "@/components/admin";
import { CatalogueForm } from "@/components/CatalogueForm";
import { SubmitButton } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { categoriesInUse, getItemById, imageAvailable } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Edit item" };
export const dynamic = "force-dynamic";

export default async function EditItem({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { id } = await params;
  await requirePermission("catalogue:manage", `/admin/catalogue/${id}`);
  const item = getItemById(id);
  if (!item) notFound();
  const { ok, err } = await searchParams;
  const pub = item.status === "PUBLISHED";
  return (
    <div>
      <Link href="/admin/catalogue" className="text-sm font-semibold">All items</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{item.title}</h1><span className={`badge ${pub ? "badge-RESPONDED" : "badge-NEW"}`}>{pub ? "Published" : "Draft"}</span></div>
      <Flash ok={ok} err={err} />
      <div className="mb-6 flex flex-wrap gap-2">
        <form action={catalogueStatusAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="to" value={pub ? "DRAFT" : "PUBLISHED"} /><SubmitButton className={`btn btn-sm ${pub ? "btn-ghost" : "btn-accent"}`}>{pub ? "Unpublish" : "Publish"}</SubmitButton></form>
        {pub && <Link href={`/products/${item.slug}`} className="btn btn-ghost btn-sm no-underline">View on website</Link>}
      </div>
      {item.imagePath && !imageAvailable(item.imagePath) && <p role="status" className="mb-4 max-w-3xl border border-amber-700 bg-amber/15 p-3 text-sm">The photo <code>{item.imagePath}</code> was not found in <code>public/catalogue</code>, so a drawn icon is shown instead.</p>}
      <CatalogueForm item={item} categories={categoriesInUse()} />
    </div>
  );
}
