"use client";
import { useActionState } from "react";
import { saveCatalogueAction, type CatalogueFormState } from "@/app/actions/catalogue";
import { SubmitButton } from "@/components/ui";
import type { CatalogueItem } from "@/db/schema";

export function CatalogueForm({ item, categories }: { item?: CatalogueItem; categories: string[] }) {
  const [state, action] = useActionState(saveCatalogueAction, {} as CatalogueFormState);
  const v = state.values ?? {};
  const d = (k: keyof CatalogueItem, fallback = "") => v[k as string] ?? (item?.[k] != null ? String(item[k]) : fallback);
  return (
    <form action={action} className="panel grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
      {item && <input type="hidden" name="id" value={item.id} />}
      {state.error && <div role="alert" className="border border-danger bg-danger/10 p-3 text-sm font-medium text-danger sm:col-span-2">{state.error}</div>}
      <div className="sm:col-span-2"><label htmlFor="title" className="label">Title</label><input id="title" name="title" className="input" defaultValue={d("title")} required maxLength={120} /></div>
      <div><label htmlFor="category" className="label">Category <span className="font-normal text-steel">(the heading it appears under)</span></label>
        <input id="category" name="category" list="cats" className="input" defaultValue={d("category")} required maxLength={60} /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
      <div><label htmlFor="kind" className="label">Type</label><select id="kind" name="kind" className="input" defaultValue={d("kind", "SERVICE")}><option value="SERVICE">Service</option><option value="PRODUCT">Product</option></select></div>
      <div className="sm:col-span-2"><label htmlFor="summary" className="label">Short summary <span className="font-normal text-steel">(shown on the listing card, 20 to 300 characters)</span></label><textarea id="summary" name="summary" rows={2} className="input" defaultValue={d("summary")} required maxLength={300} /></div>
      <div className="sm:col-span-2"><label htmlFor="description" className="label">Description <span className="font-normal text-steel">(leave a blank line between paragraphs)</span></label><textarea id="description" name="description" rows={7} className="input" defaultValue={d("description")} required maxLength={4000} /></div>
      <div><label htmlFor="highlights" className="label">What is included <span className="font-normal text-steel">(one point per line)</span></label><textarea id="highlights" name="highlights" rows={5} className="input" defaultValue={d("highlights")} /></div>
      <div><label htmlFor="applications" className="label">Where it is used <span className="font-normal text-steel">(one per line)</span></label><textarea id="applications" name="applications" rows={5} className="input" defaultValue={d("applications")} /></div>
      <div className="sm:col-span-2"><label htmlFor="facts" className="label">Quick facts <span className="font-normal text-steel">(one per line, written as Label: value)</span></label><textarea id="facts" name="facts" rows={3} className="input font-mono text-sm" defaultValue={d("facts")} placeholder={"Voltage range: 11 kV to 132 kV"} /></div>
      <div><label htmlFor="imagePath" className="label">Photo <span className="font-normal text-steel">(optional)</span></label><input id="imagePath" name="imagePath" className="input font-mono text-sm" defaultValue={d("imagePath")} placeholder="/catalogue/my-photo.jpg" />
        <p className="hint">Copy the file into the <code>public/catalogue</code> folder first. Without a photo a drawn icon is shown.</p></div>
      <div><label htmlFor="sortOrder" className="label">Order within its category</label><input id="sortOrder" name="sortOrder" type="number" min={0} max={999} className="input" defaultValue={d("sortOrder", "100")} /><p className="hint">Lower numbers appear first.</p></div>
      <div className="sm:col-span-2"><SubmitButton pending="Saving...">{item ? "Save changes" : "Create as draft"}</SubmitButton></div>
    </form>
  );
}
