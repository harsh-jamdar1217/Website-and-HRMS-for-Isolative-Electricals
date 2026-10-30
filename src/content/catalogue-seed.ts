/**
 * Initial catalogue, drafted from the company's own IndiaMART profile and its linked service pages
 * (company profile "About Us" plus seven service pages, read on 28 Oct 2026). Wording is original; facts are theirs.
 *
 * Rules followed:
 *  - nothing is added that the company's pages do not state;
 *  - where the profile lists only a NAME, the entry says so and sends the visitor to an enquiry;
 *  - items marked  // CONFIRM  need the company's sign-off before launch (see docs/content-review.md).
 * Everything here is editable later in Admin > Products and services.
 */
export type SeedItem = {
  slug: string; title: string; category: string; kind: "SERVICE" | "PRODUCT"; summary: string; description: string;
  highlights?: string[]; applications?: string[]; facts?: [string, string][]; sortOrder: number;
};

/** Category display order. */
export const CATEGORY_ORDER = ["EPC and Contracting", "Substation Work", "Testing Services", "Refurbishment and Retrofitting", "Operation and Maintenance", "HT Cable and HT Motors"] as const;

export const SEED_ITEMS: SeedItem[] = [
  // ---------------------------------------------------------------- EPC and Contracting
  {
    slug: "electrical-epc-works", title: "Electrical EPC Works", category: "EPC and Contracting", kind: "SERVICE", sortOrder: 10,
    summary: "Complete electrical installations from design to commissioning for industrial plants, power plants and commercial or residential projects.",
    description: "Isolative Electricals takes on electrical installations as a single point of responsibility. Work begins with basic design and engineering and continues through procurement and supply, project execution, and testing and commissioning.\n\nThe team undertakes installations for industrial process plants, power plants, and residential and commercial projects. Design and engineering work is carried out to meet the technical requirements, codes and standards that apply to each project.",
    highlights: ["Basic design and engineering", "Procurement and supply of equipment", "Installation and project execution", "Testing and commissioning", "Compliance with applicable technical requirements, codes and standards"],
    applications: ["Industrial process plants", "Power plants", "Residential projects", "Commercial projects"],
    facts: [["Equipment covered", "HT and LT switchgear, SPBD, VFD, UPS, battery systems, cabling, earthing and lightning protection"], ["Switchyards", "11 kV to 132 kV"]],
  },
  {
    slug: "erection-testing-commissioning-contracting", title: "Erection, Testing and Commissioning Contracting", category: "EPC and Contracting", kind: "SERVICE", sortOrder: 20,
    summary: "Contract erection, testing and commissioning for power projects, HV and EHV switchyards, and industrial electrification.",
    description: "For customers who already have the design and equipment, Isolative Electricals provides contracting teams for erection, testing and commissioning.\n\nThis covers power projects, high-voltage and extra-high-voltage switchyards with their transmission lines, and the electrification of industrial, commercial and public facilities.",
    highlights: ["Erection, testing and commissioning of thermal, co-generation, biomass and solar power plants", "HV and EHV switchyards and transmission lines at 11, 22, 33, 66 and 132 kV", "Electrification of industrial and commercial facilities"],
    applications: ["Engineering and automobile industries", "Pharmaceutical and manufacturing industries", "Foundries", "Housing and commercial projects", "Heavy engineering projects", "Real estate and utilities", "Government and semi-government organisations", "Lift irrigation projects"],
    facts: [["Switchyard voltage levels", "11 kV, 22 kV, 33 kV, 66 kV and 132 kV"]],
  },
  // ---------------------------------------------------------------- Substation Work
  {
    slug: "substation-testing-and-commissioning", title: "Substation Testing and Commissioning", category: "Substation Work", kind: "SERVICE", sortOrder: 10,
    summary: "Erection, commissioning, testing and servicing of substations, including annual maintenance contract work.",
    description: "Isolative Electricals carries out erection, commissioning, testing and servicing work for substations, and can continue the relationship through an annual maintenance contract (AMC) so the installation stays in good condition after handover.",
    highlights: ["Substation erection", "Commissioning", "Testing and servicing", "Annual maintenance contract (AMC) work"],
    facts: [["Voltage range", "11 kV to 400 kV"]], // CONFIRM: the company's About page states EPC switchyards of 11 to 132 kV
  },
  {
    slug: "ct-and-pt-testing-work", title: "CT and PT Testing Work", category: "Substation Work", kind: "SERVICE", sortOrder: 20,
    summary: "Testing of all types of current transformers (CT) and potential transformers (PT), with erection and commissioning support.",
    description: "Current and potential transformers feed the measurement and protection systems of a substation, so they need to be tested before energisation and checked periodically afterwards. Isolative Electricals tests all types of CTs and PTs and can also help with their erection and commissioning.",
    highlights: ["Testing of all types of CTs and PTs", "Erection and commissioning support"],
    applications: ["Commercial", "Residential", "Industrial"],
  },
  {
    slug: "circuit-breaker-servicing-and-testing", title: "Circuit Breaker Servicing and Testing Work", category: "Substation Work", kind: "SERVICE", sortOrder: 30,
    summary: "Servicing and testing of air, vacuum and SF6 circuit breakers.",
    description: "Circuit breakers have to operate correctly on the day a fault occurs. Isolative Electricals services and tests the main breaker types found in substations and plants, including the mechanical and electrical checks that show whether a breaker is healthy.\n\nCharges depend on the breaker, so please send the details in an enquiry to receive a quotation.",
    highlights: ["Air circuit breaker (ACB) testing", "Vacuum circuit breaker (VCB) testing", "SF6 breaker servicing", "Dynamic contact resistance measurement (DCRM)", "Power frequency and tripping mechanism checks"], // CONFIRM test list
    facts: [["Breaker types", "Air, vacuum and SF6"], ["Charges", "Depend on the breaker; request a quotation"]],
  },
  {
    slug: "transformer-testing-and-servicing", title: "Transformer Testing and Servicing Work", category: "Substation Work", kind: "SERVICE", sortOrder: 40,
    summary: "Testing, servicing, erection and commissioning of power and distribution transformers, including oil testing.",
    description: "Isolative Electricals tests and services power and distribution transformers of all kinds and also handles their erection and commissioning. Oil testing is part of the offer, with support for collecting the oil samples.\n\nThe team has experience with transformers up to 150 MVA.",
    highlights: ["Testing of power and distribution transformers", "Servicing", "Erection and commissioning", "Transformer oil testing with sampling support"],
    facts: [["Experience", "Transformers up to 150 MVA"]],
  },
  {
    slug: "electrical-substation-contactor", title: "Electrical Substation Contactor", category: "Substation Work", kind: "PRODUCT", sortOrder: 50,
    summary: "Contactors for electrical substation applications. Send us your requirement for specifications and pricing.",
    description: "This item is part of the range listed by Isolative Electricals. Specifications depend on the application, so please send an enquiry with the rating you need, the quantity and the site details. The team will reply with the options and a quotation.",
  },
  // ---------------------------------------------------------------- Testing Services
  {
    slug: "relay-testing-and-commissioning", title: "Relay Testing and Commissioning", category: "Testing Services", kind: "SERVICE", sortOrder: 10,
    summary: "Testing and commissioning of protection relays of all types and makes.",
    description: "Protection relays decide when a fault is cleared, so they must be tested and set correctly. Isolative Electricals tests and commissions all types of protection relays and works with the common makes used in Indian substations and plants.",
    highlights: ["Testing of all types of protection relays", "Commissioning of relays"],
    facts: [["Makes handled", "ABB, Schneider, Siemens, CG, Ashida, Woodward, C&S and others"]],
  },
  {
    slug: "mv-switchgear-testing", title: "Testing of MV Switchgears", category: "Testing Services", kind: "SERVICE", sortOrder: 20,
    summary: "Specialised testing and inspection of medium-voltage and low-voltage switchgear.",
    description: "Isolative Electricals offers specialised testing and inspection of switchgear as part of its testing services for transformers, LT and MV switchgear and wider electrical systems. Send an enquiry with the switchgear details and the site, and the team will come back with what is needed.",
  },
  {
    slug: "la-and-isolator-testing", title: "Testing of Lightning Arresters and Isolators", category: "Testing Services", kind: "SERVICE", sortOrder: 30,
    summary: "Testing of lightning arresters (LA) and isolators.", // CONFIRM: "LA" read as lightning arrester
    description: "Lightning arresters and isolators protect and sectionalise an electrical network, and routine testing confirms that they are ready to do their job. Send an enquiry with the equipment details and the site to arrange testing.",
  },
  // ---------------------------------------------------------------- Refurbishment and Retrofitting
  {
    slug: "refurbishment-and-retrofitting", title: "Refurbishment and Retrofitting Service", category: "Refurbishment and Retrofitting", kind: "SERVICE", sortOrder: 10,
    summary: "Refurbishment and retrofitting of switchgear, transformers and HT capacitors, plus fault studies and health monitoring.",
    description: "Ageing electrical equipment does not always need replacing. Isolative Electricals refurbishes and retrofits medium- and high-voltage panels and transformers, repairs HT capacitors, and studies faults in an electrical system to suggest remedies.",
    highlights: ["HT and LV switchgear panels", "HT and LT switchgears", "Power and distribution transformers", "Repairs of HT capacitors", "Services to avoid single phasing in the system", "Study of faults in the electrical system, with suggested remedies", "Health monitoring of electrical systems"],
  },
  // ---------------------------------------------------------------- Operation and Maintenance
  {
    slug: "operation-and-maintenance-support", title: "Operation and Maintenance Support", category: "Operation and Maintenance", kind: "SERVICE", sortOrder: 10,
    summary: "Operation and maintenance of switchyards and medium- and low-voltage distribution systems, with commissioning support for complex networks.",
    description: "Isolative Electricals provides operation and maintenance support across a range of industries. This includes running and maintaining switchyards and MV and LV distribution systems, and supporting the commissioning of complex electrical networks.",
    highlights: ["Operation and maintenance of switchyards", "Operation and maintenance of MV and LV distribution systems", "Commissioning support for complex electrical networks"],
  },
  {
    slug: "annual-maintenance-contracts", title: "Annual Maintenance Contracts (AMC)", category: "Operation and Maintenance", kind: "SERVICE", sortOrder: 20,
    summary: "Annual maintenance contracts for electrical installations.",
    description: "An annual maintenance contract keeps an electrical installation inspected, tested and serviced throughout the year instead of only after a failure. Send an enquiry with the installation details and the team will propose a contract.",
    highlights: ["Annual maintenance of electrical installations"],
  },
  // ---------------------------------------------------------------- HT Cable and HT Motors
  {
    slug: "ht-cable-and-ht-motors", title: "HT Cable and HT Motors", category: "HT Cable and HT Motors", kind: "PRODUCT", sortOrder: 10,
    summary: "Enquire about HT cable and HT motor requirements.", // CONFIRM: supply, testing or both?
    description: "HT cables and HT motors are part of the range listed by Isolative Electricals. Please share your requirement, including voltage, rating, quantity and site, and the team will come back with the available options.",
  },
];
