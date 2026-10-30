"use server";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth";
import { createEnquiry } from "@/lib/enquiries";
import { rateLimit } from "@/lib/rate-limit";
import type { EnquiryCategory } from "@/lib/status";
import { enquirySchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export type EnquiryState = { errors?: FieldErrors; formError?: string; values?: Record<string, string> };

export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const values = { name: raw.name ?? "", company: raw.company ?? "", email: raw.email ?? "", phone: raw.phone ?? "", category: raw.category ?? "", message: raw.message ?? "" };

  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (raw.website) redirect("/enquiry/thanks?ref=ENQ-RECEIVED");

  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const rl = rateLimit(`enquiry:${await clientIp()}`, 5, 60 * 60_000);
  if (!rl.ok) return { formError: "You have sent several enquiries in a short time. Please try again later or email us directly.", values };

  const d = parsed.data;
  let reference: string;
  try {
    const { enquiry } = await createEnquiry({ name: d.name, company: d.company || undefined, email: d.email, phone: d.phone || undefined, category: d.category as EnquiryCategory, message: d.message, itemSlug: raw.item || undefined });
    reference = enquiry.reference;
  } catch (e) {
    console.error("[enquiry] create failed", e);
    return { formError: "We could not save your enquiry. Please try again, or email us directly.", values };
  }
  redirect(`/enquiry/thanks?ref=${encodeURIComponent(reference)}`);
}
