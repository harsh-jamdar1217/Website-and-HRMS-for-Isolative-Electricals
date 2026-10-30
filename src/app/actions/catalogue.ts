"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission } from "@/lib/auth";
import { createItem, RuleError, setItemStatus, updateItem } from "@/lib/catalogue";
import { catalogueSchema, firstError } from "@/lib/validation";

export type CatalogueFormState = { error?: string; values?: Record<string, string> };

export async function saveCatalogueAction(_prev: CatalogueFormState, fd: FormData): Promise<CatalogueFormState> {
  const user = await assertPermission("catalogue:manage");
  const id = String(fd.get("id") ?? "");
  const values = Object.fromEntries(["title", "category", "kind", "summary", "description", "highlights", "applications", "facts", "imagePath", "sortOrder"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = catalogueSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  let target = id;
  try {
    if (id) updateItem(id, parsed.data, user.id);
    else target = createItem(parsed.data, user.id).id;
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message, values };
    throw e;
  }
  revalidatePath("/products"); revalidatePath("/"); revalidatePath("/admin/catalogue");
  redirect(`/admin/catalogue/${target}?ok=${encodeURIComponent(id ? "Saved. Changes are live if the item is published." : "Created as a draft. Review it, then publish when ready.")}`);
}

export async function catalogueStatusAction(fd: FormData) {
  const user = await assertPermission("catalogue:manage");
  const id = String(fd.get("id") ?? "");
  const to = fd.get("to") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  let q = `ok=${encodeURIComponent(to === "PUBLISHED" ? "Published. It is now visible on the website." : "Unpublished. It is no longer visible on the website.")}`;
  try { setItemStatus(id, to, user.id); }
  catch (e) { if (!(e instanceof RuleError)) throw e; q = `err=${encodeURIComponent(e.message)}`; }
  revalidatePath("/products"); revalidatePath("/"); revalidatePath("/admin/catalogue");
  redirect(`/admin/catalogue/${id}?${q}`);
}
