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
  tagline: "Electrical solutions, engineered with care", // PLACEHOLDER: confirm with company
  // PLACEHOLDERS: replace with real values supplied by the company
  contactEmail: "info@isolative.example",
  contactPhone: "+91 00000 00000",
  hours: "Mon-Sat, 9:30 am to 6:00 pm IST",
} as const;

/** Product/service catalogue stays empty until the company supplies verified content. */
export const catalogue: { name: string; summary: string }[] = [];
