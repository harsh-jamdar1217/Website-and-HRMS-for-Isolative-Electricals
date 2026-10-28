import type { Metadata, Viewport } from "next";
import "./globals.css";
import { company } from "@/content/company";

export const metadata: Metadata = {
  title: { default: company.legalName, template: `%s | ${company.shortName}` },
  description: `${company.legalName}, Khandala, Satara, Maharashtra. Send a product or quotation enquiry.`,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#12324A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-amber focus:px-3 focus:py-2 focus:font-semibold focus:text-navy">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
