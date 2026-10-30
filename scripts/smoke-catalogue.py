# End-to-end catalogue test (50 checks). Place a PNG at public/catalogue/zz-e2e.png BEFORE building (Next serves only public files present at build time). Fresh DB, app on :3100 with SMTP_HOST="".
import re, requests, sqlite3, sys, html as H
B = "http://localhost:3100"; ROOT = "/home/claude/isolative"
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
    if not cond: fails.append(name)
def forms(html):
    out = []
    for m in re.finditer(r"<form\b(.*?)>(.*?)</form>", html, re.S):
        fields = []
        for i in re.findall(r'<input\b[^>]*>', m.group(2)):
            n = re.search(r'name="([^"]*)"', i); v = re.search(r'value="([^"]*)"', i); t = re.search(r'type="([^"]*)"', i)
            if n and t and t.group(1) == "hidden": fields.append((H.unescape(n.group(1)), H.unescape(v.group(1)) if v else ""))
        out.append((m.group(2), fields))
    return out
def ff(html, needle):
    f = [f for f in forms(html) if needle in f[0]]
    return f[0][1] if f else None
def post(s, url, fields, data):
    parts = {k: (None, v) for k, v in fields}; parts.update({k: (None, v) for k, v in data.items()})
    return s.post(url, files=parts, allow_redirects=False)
def login(email, pw):
    s = requests.Session(); h = s.get(B + "/login").text
    f = [x for x in forms(h)[-1][1] if x[0] != "next"]
    r = post(s, B + "/login", f, {"email": email, "password": pw, "next": ""})
    m = re.search(r"iep_session=([^;]+)", r.headers.get("set-cookie", ""))
    if m: s.headers["Cookie"] = "iep_session=" + m.group(1)
    return s, r
def q(sql, *a):
    c = sqlite3.connect(ROOT + "/dev.db"); r = c.execute(sql, a).fetchall(); c.close(); return r
loc = lambda r: H.unescape(requests.utils.unquote(r.headers.get("location", "")))
txt = lambda t: H.unescape(re.sub(r"<[^>]+>", " ", t))

# ---------------------------------------------------------------- public listing
pp = requests.get(B + "/products"); P = pp.text
cats = ["EPC and Contracting", "Substation Work", "Testing Services", "Refurbishment and Retrofitting", "Operation and Maintenance", "HT Cable and HT Motors"]
check("products page renders", pp.status_code == 200)
check("all six categories are listed, in the company's order", all(c in P for c in cats) and [P.index(c) for c in cats] == sorted(P.index(c) for c in cats))
slugs = sorted(set(re.findall(r'href="/products/([a-z0-9-]+)"', P)))
check("all 14 services and products are listed", len(slugs) == 14, len(slugs))
check("each listing card offers 'View details' and 'Send an enquiry' links", len(re.findall(r">View details</a>", P)) == 14 and len(re.findall(r'href="/products/[a-z0-9-]+#enquiry"', P)) == 14)
check("category jump links exist", 'href="#substation-work"' in P and 'id="substation-work"' in P)
check("no invented images: icons are drawn, no external image hosts", "imimg.com" not in P and "indiamart" not in P.lower())
home = requests.get(B + "/").text
check("home page shows 'What we do' with the categories", "What we do" in home and "Substation Work" in home and "Testing Services" in home)
ab = txt(requests.get(B + "/about").text)
check("about page carries the company's real business description", "EPC" in ab and "switchyards from 11 kV to 132 kV" in ab and "How a project runs" in ab)
check("about page keeps verified registry facts", "U74999PN2018PTC174904" in ab and "Khandala" in ab)

# ---------------------------------------------------------------- every detail page
bad = []
for sl in slugs:
    r = requests.get(f"{B}/products/{sl}")
    t = r.text
    if r.status_code != 200 or 'id="enquiry"' not in t or 'name="item"' not in t or f'value="{sl}"' not in t or "Send an enquiry about" not in t: bad.append(sl)
check("all 14 detail pages render with an inline enquiry form tied to the item", not bad, bad)
rp = requests.get(B + "/products/relay-testing-and-commissioning").text
check("detail page shows highlights and quick facts from the data", "Makes handled" in rp and "ABB, Schneider" in rp and "Testing of all types of protection relays" in rp)
ep = txt(requests.get(B + "/products/erection-testing-commissioning-contracting").text)
check("detail page shows 'where it is used' tags", "Where it is used" in ep and "Lift irrigation projects" in ep)
cb = txt(requests.get(B + "/products/circuit-breaker-servicing-and-testing").text)
check("detail page lists related items from the same category", re.search(r"More in\s+Substation Work", txt(requests.get(B + "/products/ct-and-pt-testing-work").text)))
check("name-only items are honest and send visitors to an enquiry", "send an enquiry" in txt(requests.get(B + "/products/electrical-substation-contactor").text).lower())
check("unknown slug is a 404", requests.get(B + "/products/does-not-exist").status_code == 404)
check("path-trick slugs are a 404, not an error", requests.get(B + "/products/..%2F..%2Fetc%2Fpasswd").status_code == 404)

# ---------------------------------------------------------------- enquiry from a detail page
s = requests.Session(); page = s.get(f"{B}/products/relay-testing-and-commissioning").text
ef = [f for f in forms(page) if 'name="name"' in f[0]][0][1]
check("form carries the item reference as a hidden field", ("item", "relay-testing-and-commissioning") in ef)
r = post(s, f"{B}/products/relay-testing-and-commissioning", ef, {"name": "", "email": "bad", "category": "", "message": "x"})
check("validation errors show on the detail page and keep the context", r.status_code == 200 and "Enter your full name." in r.text and "Relay Testing and Commissioning" in r.text)
D = {"name": "Kiran Joshi", "company": "Sahyadri Cements", "email": "kiran@sahyadri.example", "phone": "+91 98220 11223", "category": "QUOTATION", "message": "We need all protection relays at our 33 kV substation tested and commissioned next month.", "consent": "on", "website": ""}
r = post(s, f"{B}/products/relay-testing-and-commissioning", ef, D)
m = re.search(r"ref=(ENQ-\d{4}-[A-Z2-9]{6})", loc(r))
check("valid enquiry from the item page redirects to the thank-you page with a reference", r.status_code in (302, 303) and m, loc(r))
ref = m.group(1)
row = q("select catalogue_item_id, item_title, category from enquiries where reference=?", ref)
check("enquiry is linked to the item and the title is snapshotted", row and row[0][1] == "Relay Testing and Commissioning" and row[0][0] == q("select id from catalogue_items where slug='relay-testing-and-commissioning'")[0][0], row)
mails = q("select template, body_text from email_logs where related_id=(select id from enquiries where reference=?)", ref)
check("both emails (visitor and admin) name the item", len(mails) == 2 and all("Relay Testing and Commissioning" in (x[1] or "") for x in mails), [x[0] for x in mails])
r2 = post(s, f"{B}/products/relay-testing-and-commissioning", ef, D)
check("a double-click returns the same reference (no duplicate)", ref in loc(r2) and q("select count(*) from enquiries where email='kiran@sahyadri.example'")[0][0] == 1)
ef2 = [f for f in forms(requests.get(f"{B}/products/ct-and-pt-testing-work").text) if 'name="name"' in f[0]][0][1]
r3 = post(requests.Session(), f"{B}/products/ct-and-pt-testing-work", ef2, D)
check("the same message about a different item is a separate enquiry", q("select count(*) from enquiries where email='kiran@sahyadri.example'")[0][0] == 2 and "ENQ-" in loc(r3))
# forged item values
Dm = {**D, "email": "forge@example.com"}
post(requests.Session(), B + "/enquiry", [x for x in ef if x[0] != "item"] + [("item", "../../etc/passwd")], Dm)
check("a forged item value is ignored (enquiry saved, not linked)", q("select catalogue_item_id from enquiries where email='forge@example.com'") == [(None,)])

# ---------------------------------------------------------------- /enquiry?item=
pg = requests.get(B + "/enquiry", params={"item": "transformer-testing-and-servicing"}).text
check("/enquiry?item= shows the item context", "Transformer Testing and Servicing Work" in pg and 'name="item"' in pg)
pg2 = requests.get(B + "/enquiry", params={"item": "bogus"}).text
check("/enquiry with an unknown item behaves like a normal enquiry", 'name="item"' not in pg2 and "Send an enquiry" in pg2)

# ---------------------------------------------------------------- admin sees it
admin, _ = login("admin@isolative.example", "Admin@12345")
eid = q("select id from enquiries where reference=?", ref)[0][0]
check("admin enquiry list shows what the visitor asked about", "Relay Testing and Commissioning" in admin.get(B + "/admin/enquiries").text)
dtl = admin.get(f"{B}/admin/enquiries/{eid}").text
check("admin enquiry detail shows 'Asked about' with a link to the page", "Asked about" in dtl and "/products/relay-testing-and-commissioning" in dtl)

# ---------------------------------------------------------------- admin catalogue management
cl = admin.get(B + "/admin/catalogue").text
check("admin catalogue list shows items and publish counts", re.search(r"14\s+of\s+14\s+are published", txt(cl)) and "Relay Testing and Commissioning" in cl)
nf = ff(admin.get(B + "/admin/catalogue/new").text, 'name="summary"') or []
NEW = {"title": "Thermography Inspection", "category": "Testing Services", "kind": "SERVICE", "summary": "Infrared thermography surveys of panels and switchyards to find hot spots early.", "description": "A detailed description of the thermography inspection service that is long enough to pass validation.", "highlights": "Panel surveys\nSwitchyard surveys", "applications": "Industrial plants", "facts": "Report: Provided after the survey", "imagePath": "", "sortOrder": "40"}
r = post(admin, B + "/admin/catalogue/new", nf, {**NEW, "summary": "short"})
check("invalid item is refused with a readable message, keeping the typed values", r.status_code == 200 and "at least 20 characters" in r.text and "Thermography Inspection" in r.text)
r = post(admin, B + "/admin/catalogue/new", nf, {**NEW, "imagePath": "https://evil.example/x.jpg"})
check("external image URLs are refused", "Image path" in H.unescape(r.text) or "Image path" in r.text)
r = post(admin, B + "/admin/catalogue/new", nf, {**NEW, "facts": "not a fact"})
check("malformed quick facts are refused", "Label: value" in H.unescape(r.text))
r = post(admin, B + "/admin/catalogue/new", nf, NEW)
row = q("select id, slug, status from catalogue_items where title='Thermography Inspection'")
check("a valid item is created as a DRAFT", len(row) == 1 and row[0][2] == "DRAFT" and "/admin/catalogue/" in r.headers.get("location", ""), (loc(r), row))
iid, islug = row[0][0], row[0][1]
check("draft is not visible on the website", requests.get(f"{B}/products/{islug}").status_code == 404 and "Thermography Inspection" not in requests.get(B + "/products").text)
ep = admin.get(f"{B}/admin/catalogue/{iid}").text
pf = [f for f in forms(ep) if "PUBLISHED" in [v for _, v in f[1]]][0][1]
r = post(admin, f"{B}/admin/catalogue/{iid}", pf, {})
check("publishing makes it appear on the listing, home counts and detail page", requests.get(f"{B}/products/{islug}").status_code == 200 and "Thermography Inspection" in requests.get(B + "/products").text)
ep = admin.get(f"{B}/admin/catalogue/{iid}").text
edf = [f for f in forms(ep) if 'name="summary"' in f[0]][0][1]
r = post(admin, f"{B}/admin/catalogue/{iid}", edf, {**NEW, "title": "Thermography and IR Inspection"})
check("editing changes the title but never the public URL", q("select title, slug from catalogue_items where id=?", iid)[0] == ("Thermography and IR Inspection", islug) and requests.get(f"{B}/products/{islug}").status_code == 200)
check("edits show immediately on the public detail page", "Thermography and IR Inspection" in requests.get(f"{B}/products/{islug}").text)
ep = admin.get(f"{B}/admin/catalogue/{iid}").text
upf = [f for f in forms(ep) if "DRAFT" in [v for _, v in f[1]]][0][1]
post(admin, f"{B}/admin/catalogue/{iid}", upf, {})
check("unpublishing removes it from the website again", requests.get(f"{B}/products/{islug}").status_code == 404 and "Thermography" not in requests.get(B + "/products").text)
r = post(requests.Session(), B + "/enquiry", [x for x in ef2 if x[0] != "item"] + [("item", islug)], {**D, "email": "late@example.com"})
late = q("select catalogue_item_id, item_title from enquiries where email='late@example.com'")
check("an enquiry cannot be tied to an unpublished item (saved, but not linked)", late == [(None, None)], late)
check("all catalogue changes are audited", q("select count(*) from audit_logs where entity_id=? and action like 'catalogue.%'", iid)[0][0] >= 4)

# ---------------------------------------------------------------- photos
img = q("select id from catalogue_items where slug='ct-and-pt-testing-work'")[0][0]
ep = admin.get(f"{B}/admin/catalogue/{img}").text
f_ = [f for f in forms(ep) if 'name="summary"' in f[0]][0][1]
it = q("select title, category, kind, summary, description, highlights, applications, facts, sort_order from catalogue_items where id=?", img)[0]
base = {"title": it[0], "category": it[1], "kind": it[2], "summary": it[3], "description": it[4], "highlights": it[5] or "", "applications": it[6] or "", "facts": it[7] or "", "sortOrder": str(it[8])}
post(admin, f"{B}/admin/catalogue/{img}", f_, {**base, "imagePath": "/catalogue/zz-e2e.png"})
dp = requests.get(f"{B}/products/ct-and-pt-testing-work").text
check("a photo that exists in public/catalogue is shown", 'src="/catalogue/zz-e2e.png"' in dp and requests.get(B + "/catalogue/zz-e2e.png").status_code == 200)
check("the photo is also used on the listing card", 'src="/catalogue/zz-e2e.png"' in requests.get(B + "/products").text)
post(admin, f"{B}/admin/catalogue/{img}", f_, {**base, "imagePath": "/catalogue/not-there.jpg"})
check("a missing photo file falls back to the drawn icon (no broken image)", "not-there.jpg" not in requests.get(f"{B}/products/ct-and-pt-testing-work").text)
check("admin is warned that the photo file is missing", "was not found" in admin.get(f"{B}/admin/catalogue/{img}").text)
post(admin, f"{B}/admin/catalogue/{img}", f_, {**base, "imagePath": ""})

# ---------------------------------------------------------------- access control
hr, _ = login("hr@isolative.example", "Hr@12345678")
for p in ["/admin/catalogue", "/admin/catalogue/new", f"/admin/catalogue/{iid}"]:
    rr = hr.get(B + p, allow_redirects=False)
    check(f"HR cannot open {p}", rr.status_code in (302, 307) and "/forbidden" in rr.headers.get("location", ""), (rr.status_code, rr.headers.get("location")))
n0 = q("select count(*) from catalogue_items")[0][0]
post(hr, B + "/admin/catalogue/new", nf, {**NEW, "title": "Forged By HR"})
check("FORGED create by HR is rejected", q("select count(*) from catalogue_items")[0][0] == n0)
post(hr, f"{B}/admin/catalogue/{iid}", pf, {})
check("FORGED publish by HR is rejected", q("select status from catalogue_items where id=?", iid)[0][0] == "DRAFT")
anon = requests.get(B + "/admin/catalogue", allow_redirects=False)
check("anonymous visitors are sent to sign in", anon.status_code in (302, 307) and "/login" in anon.headers.get("location", ""))
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
