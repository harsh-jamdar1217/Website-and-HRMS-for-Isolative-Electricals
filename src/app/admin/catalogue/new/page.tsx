import type { Metadata } from "next";
import Link from "next/link";
import { CatalogueForm } from "@/components/CatalogueForm";
import { requirePermission } from "@/lib/auth";
import { categoriesInUse } from "@/lib/catalogue";

export const metadata: Metadata = { title: "New item" };
export const dynamic = "force-dynamic";

export default async function NewItem() {
  await requirePermission("catalogue:manage", "/admin/catalogue/new");
  return (<div><Link href="/admin/catalogue" className="text-sm font-semibold">All items</Link><h1 className="mb-5 mt-2 text-3xl">New product or service</h1><CatalogueForm categories={categoriesInUse()} /></div>);
}
