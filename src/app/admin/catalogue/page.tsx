import type { Metadata } from "next";
import Link from "next/link";
import { Empty } from "@/components/admin";
import { requirePermission } from "@/lib/auth";
import { listAllItems } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Products and services" };
export const dynamic = "force-dynamic";

export default async function CatalogueAdmin() {
  await requirePermission("catalogue:manage", "/admin/catalogue");
  const rows = listAllItems();
  const published = rows.filter((r) => r.status === "PUBLISHED").length;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl">Products and services</h1><Link href="/admin/catalogue/new" className="btn btn-primary no-underline">New item</Link></div>
      <p className="mt-1 text-steel">These items form the public <Link href="/products">Products and services</Link> page. {published} of {rows.length} are published.</p>
      <div className="mt-6">
        {rows.length === 0 ? <Empty title="No items yet">Create your first item, then publish it.</Empty> : (
          <div className="overflow-x-auto border border-line bg-white"><table className="tbl">
            <thead><tr><th>Title</th><th>Category</th><th>Type</th><th>Status</th><th>Order</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><td><Link href={`/admin/catalogue/${r.id}`} className="font-semibold">{r.title}</Link><span className="block font-mono text-xs text-steel">/products/{r.slug}</span></td><td>{r.category}</td><td>{r.kind === "PRODUCT" ? "Product" : "Service"}</td>
                <td><span className={`badge ${r.status === "PUBLISHED" ? "badge-RESPONDED" : "badge-NEW"}`}>{r.status === "PUBLISHED" ? "Published" : "Draft"}</span></td><td>{r.sortOrder}</td></tr>))}</tbody>
          </table></div>)}
      </div>
    </div>
  );
}
