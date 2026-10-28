import type { Metadata } from "next";
import { ENQUIRY_CATEGORIES } from "@/lib/status";
import { EnquiryForm } from "./EnquiryForm";

export const metadata: Metadata = { title: "Send an enquiry" };

export default async function EnquiryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const preset = category && category in ENQUIRY_CATEGORIES ? category : "";
  return (
    <div className="wrap grid gap-10 py-12 lg:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="text-4xl">Send an enquiry</h1>
        <p className="mt-3 max-w-prose text-steel">Tell us what you need. You will receive a reference number by email, and our team will reply to the same address.</p>
        <div className="mt-8 max-w-2xl"><EnquiryForm defaultCategory={preset} /></div>
      </div>
      <aside className="h-fit border border-line border-t-2 border-t-navy bg-white p-5 text-sm">
        <h2 className="text-base">Helpful details</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-steel">
          <li>What you need, and how many</li>
          <li>Where it will be installed or used</li>
          <li>When you need it</li>
          <li>Any drawings or specifications you can describe</li>
        </ul>
        <p className="mt-4 text-steel">File attachments are not supported yet. Describe your requirement and we will ask for documents by email if needed.</p>
      </aside>
    </div>
  );
}
