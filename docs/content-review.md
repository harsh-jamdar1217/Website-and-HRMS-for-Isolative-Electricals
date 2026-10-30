# Content review: items the company should confirm before launch

**Source.** The products/services catalogue and the About page were drafted from the company's own IndiaMART profile
(`isolative-electrical-pvt-ltd`): the About Us page, the Products & Services listing and seven linked service pages
(CT/PT testing, substation testing and commissioning, circuit breaker servicing, transformer testing, refurbishment and
retrofitting, relay testing, contracting and testing), read on 28 Oct 2026. All wording is original; only the facts come from the profile.
Everything can be edited by an administrator under **Admin > Products and services**.

## Please confirm (the profile is ambiguous or inconsistent)
| # | Item | Why it needs a decision |
|---|------|-------------------------|
| 1 | **Voltage range.** "Substation Testing and Commissioning" states 11 kV to 400 kV; the About page states switchyards from 11 kV to 132 kV. | Both may be true (testing vs EPC), but a customer will read them together. |
| 2 | **"Licensed electrical contractor" claim.** The profile says the company is a government-registered licensed contractor. | **Not published** on the site. Publish only with the licence name and number, because it is a regulated claim. |
| 3 | **Circuit breaker test list.** DCRM, power-frequency and tripping-mechanism checks come from marketplace dropdown fields on the listing. | Marketplace fields are not always accurate. Confirm the real test list. |
| 4 | **"LA" read as lightning arrester** in "Testing of LA and Isolators". | Likely, but it was inferred. |
| 5 | **HT Cable and HT Motors.** The profile lists only the name. | Is this supply, testing, repair, or all three? The entry is deliberately neutral. |
| 6 | **Electrical Substation Contactor.** Name only, no specifications. | Add ratings, makes and whether it is supplied or serviced. |
| 7 | **Categories.** "Tests on MV Switchgears" is filed under "Transformer Oil Testing Services" on IndiaMART. | I regrouped items into six categories (EPC and Contracting, Substation Work, Testing Services, Refurbishment and Retrofitting, Operation and Maintenance, HT Cable and HT Motors). Confirm the grouping suits them. |
| 8 | **"Substation Work (8)"** on IndiaMART shows only five items. | Three items may be missing. Ask whether they should be listed. |
| 9 | **Relay makes** ("Schneider" is misspelled on the listing), **150 MVA** transformer experience, **15+ years** team experience. | Stated by the company, but they should approve public use. |
| 10 | **Primary location.** IndiaMART says "Pune"; the registered office (public registry) is in Khandala, Satara. | Which should the website lead with? Do they serve Pune customers? |
| 11 | **Tagline** "Electrical EPC, testing and commissioning". | Written by us from their description. |

## Deliberately NOT used
- **Testimonials and client names** on the profile: showing a client publicly needs that client's permission.
- **Phone numbers on IndiaMART**: these are marketplace call-forwarding numbers, not necessarily the company's own. The site still shows placeholders for email and phone until the company supplies real ones.
- **GST number, turnover, employee-count band, owner names.** Not needed on the site; publish only if the company wants.

## Photos
No images were copied from IndiaMART (they belong to the company and should be supplied as original files).
To add one: copy it into `public/catalogue/`, then in Admin > Products and services enter `/catalogue/<file>.jpg` as the item's photo.
**In production, Next.js serves only files that existed when the site was built, so rebuild/redeploy after adding photos.** (`npm run dev` picks them up instantly.)
Until a photo is added, a drawn icon is shown, never a stock picture.
