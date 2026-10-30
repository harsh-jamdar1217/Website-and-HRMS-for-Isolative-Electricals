/**
 * All company-facing facts live here so nothing is invented in page code.
 * "verified" = from public registry data; "placeholder" = must be confirmed by the company before launch.
 */
export const company = {
  legalName: "Isolative Electricals Private Limited", // verified (MCA-based directory)
  shortName: "Isolative Electricals",
  cin: "U74999PN2018PTC174904", // verified (MCA-based directory)
  incorporationYear: 2018, // inferred from CIN
  registeredAddress: "H.No. 1093, At Post Khandala, Tal. Khandala, Dist. Satara, Maharashtra 415521", // verified (registered office)
  tagline: "Electrical EPC, testing and commissioning", // drafted from the company's IndiaMART profile: confirm wording with company
  // PLACEHOLDERS: replace with real values supplied by the company
  contactEmail: "info@isolative.example",
  contactPhone: "+91 00000 00000",
  hours: "Mon-Sat, 9:30 am to 6:00 pm IST",
} as const;

/**
 * Business description, paraphrased from the company's own IndiaMART "About Us" (read 28 Oct 2026).
 * Needs the company's review before launch (see docs/content-review.md).
 */
export const profile = {
  paragraphs: [
    "Isolative Electricals Private Limited is a registered company with its office at Khandala. It specialises in the engineering and execution of EPC (engineering, procurement and construction) works for electrical installations in industrial process plants, power plants, and residential and commercial projects.",
    "The scope includes HT and LT switchgear, SPBD, VFD, UPS and battery systems, cabling, earthing, lightning protection, and switchyards from 11 kV to 132 kV. Each project is handled from basic design and engineering through procurement, supply, execution, testing and commissioning.",
    "The company also refurbishes and retrofits medium- and high-voltage panels and extra-high-voltage transformers, provides operation and maintenance support, carries out specialised testing and inspection of transformers and switchgear, and offers annual maintenance contracts for electrical installations.",
    "The team is led by engineers with more than 15 years of experience in manufacturing, project engineering and execution, and design and engineering work follows the applicable technical requirements, codes and standards.",
  ],
  lifecycle: ["Basic design and engineering", "Procurement and supply", "Project execution", "Testing and commissioning"],
} as const;
