# End-to-end HTTP smoke test. Needs: python3 + `pip install requests`, app running (npm run build && npm start -p 3100) on a freshly seeded DB (npm run db:reset).
import re, requests, sqlite3, sys, html as htmlmod
B = "http://localhost:3100"
fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if (extra and not cond) else ""))
    if not cond: fails.append(name)

def forms(html):
    out = []
    for m in re.finditer(r"<form\b(.*?)>(.*?)</form>", html, re.S):
        inputs = re.findall(r'<input\b[^>]*>', m.group(2))
        fields = []
        for i in inputs:
            n = re.search(r'name="([^"]*)"', i); v = re.search(r'value="([^"]*)"', i)
            t = re.search(r'type="([^"]*)"', i)
            if n and (t and t.group(1) == "hidden"): fields.append((htmlmod.unescape(n.group(1)), htmlmod.unescape(v.group(1)) if v else ""))
        out.append((m.group(2), fields))
    return out

def post_form(s, url, form_fields, data, **kw):
    files = {k: (None, v) for k, v in form_fields}
    files.update({k: (None, v) for k, v in data.items()})
    return s.post(url, files=files, allow_redirects=False, **kw)

def login(email, pw):
    s = requests.Session()
    html = s.get(B + "/login").text
    f = forms(html)[-1][1]
    f = [x for x in f if x[0] != "next"]
    r = post_form(s, B + "/login", f, {"email": email, "password": pw, "next": "/admin"})
    m = re.search(r"iep_session=([^;]+)", r.headers.get("set-cookie", ""))
    if m: s.headers["Cookie"] = "iep_session=" + m.group(1)
    return s, r

# 1 public pages
for p in ["/", "/about", "/products", "/contact", "/enquiry", "/privacy", "/login"]:
    r = requests.get(B + p); check(f"GET {p} -> 200", r.status_code == 200, r.status_code)
check("home shows company name", "Isolative Electricals Private Limited" in requests.get(B).text)
check("security headers set", requests.get(B).headers.get("X-Frame-Options") == "DENY")

# 2 anonymous cannot reach admin
for p in ["/admin", "/admin/enquiries", "/admin/audit", "/admin/emails", "/admin/clients"]:
    r = requests.get(B + p, allow_redirects=False)
    check(f"anonymous {p} redirected to login", r.status_code in (302, 307) and "/login" in r.headers.get("location", ""), (r.status_code, r.headers.get("location")))

# 3 enquiry validation + submission
s = requests.Session()
html = s.get(B + "/enquiry").text
ff = [f for f in forms(html) if any(n.startswith("$ACTION") for n, _ in f[1])][0][1]
r = post_form(s, B + "/enquiry", ff, {"name": "", "email": "bad", "category": "", "message": "short"})
check("invalid enquiry shows field errors", r.status_code == 200 and "Enter your full name." in r.text and "Enter a valid email address." in r.text, r.status_code)
valid = {"name": "Smoke Tester", "company": "Smoke <b>Co</b>", "email": "smoke@example.com", "phone": "+91 98765 43210", "category": "QUOTATION",
         "message": "Need a quotation for panel boards for a new shed in Satara, delivery within a month.", "consent": "on", "website": ""}
r = post_form(s, B + "/enquiry", ff, {**valid, "consent": ""} if False else {k: v for k, v in valid.items() if k != "consent"})
check("missing consent is rejected", r.status_code == 200 and "accept the privacy notice" in r.text, r.status_code)
r = post_form(s, B + "/enquiry", ff, valid)
loc = r.headers.get("location", "")
m = re.search(r"ref=(ENQ-\d{4}-[A-Z2-9]{6})", loc)
check("valid enquiry redirects to thanks with a reference", r.status_code in (302, 303) and bool(m), (r.status_code, loc))
ref = m.group(1) if m else None
t = requests.get(B + loc).text if loc else ""
check("thanks page shows the reference", ref and ref in t)
r2 = post_form(s, B + "/enquiry", ff, valid)
check("repeat submission returns the SAME reference (dedupe)", ref and ref in r2.headers.get("location", ""), r2.headers.get("location"))
r3 = post_form(s, B + "/enquiry", ff, {**valid, "website": "http://spam.example"})
check("honeypot silently accepted without storing", "ENQ-RECEIVED" in r3.headers.get("location", ""), r3.headers.get("location"))

db = sqlite3.connect("dev.db")
n = db.execute("select count(*) from enquiries where reference=?", (ref,)).fetchone()[0]
check("exactly one DB row for the enquiry", n == 1, n)
spam = db.execute("select count(*) from enquiries where email='smoke@example.com'").fetchone()[0]
check("honeypot and duplicate created no extra rows", spam == 1, spam)
st = [r[0] for r in db.execute("select status from email_logs where related_id=(select id from enquiries where reference=?)", (ref,))]
check("emails recorded as FAILED (no SMTP) but enquiry kept", len(st) == 2 and all(x == "FAILED" for x in st), st)

# 4 login
s_bad, r = login("admin@isolative.example", "wrong-password-1")
check("wrong password is rejected generically", r.status_code == 200 and "Email or password is incorrect." in r.text, r.status_code)
s_bad2, r = login("nobody@isolative.example", "whatever-pass-1")
check("unknown user gets the SAME message", "Email or password is incorrect." in r.text)
adm, r = login("admin@isolative.example", "Admin@12345")
check("admin login redirects to /admin and sets httpOnly cookie", r.status_code in (302, 303) and "iep_session" in r.headers.get("set-cookie", "") and "HttpOnly" in r.headers.get("set-cookie", ""), (r.status_code, r.headers.get("set-cookie", "")[:80]))
dash = adm.get(B + "/admin")
check("admin dashboard renders with metrics", dash.status_code == 200 and "New enquiries" in dash.text and "Failed emails" in dash.text, dash.status_code)
lst = adm.get(B + "/admin/enquiries")
check("admin list shows the new enquiry", lst.status_code == 200 and ref in lst.text)
check("search by reference works", ref in adm.get(B + "/admin/enquiries", params={"q": ref}).text)
check("status filter excludes it", ref not in adm.get(B + "/admin/enquiries", params={"status": "CLOSED"}).text)
check("audit and email pages open for admin", "Audit log" in adm.get(B + "/admin/audit").text and "Email log" in adm.get(B + "/admin/emails").text)

# 5 detail + workflow
eid = db.execute("select id from enquiries where reference=?", (ref,)).fetchone()[0]
d = adm.get(f"{B}/admin/enquiries/{eid}")
check("detail page escapes user HTML", "Smoke &lt;b&gt;Co&lt;/b&gt;" in d.text or "Smoke <b>Co</b>" not in d.text)
fs = forms(d.text)
start = [f for f in fs if ("to", "IN_PROGRESS") in f[1]][0][1]
r = post_form(adm, f"{B}/admin/enquiries/{eid}", start, {})
check("NEW -> IN_PROGRESS succeeds", r.status_code in (302, 303) and "ok=" in r.headers.get("location", ""), (r.status_code, r.headers.get("location")))
check("status persisted", db.execute("select status from enquiries where id=?", (eid,)).fetchone()[0] == "IN_PROGRESS" if not db.close() is None else True) if False else None
db = sqlite3.connect("dev.db")
check("status persisted in DB", db.execute("select status from enquiries where id=?", (eid,)).fetchone()[0] == "IN_PROGRESS")
check("audit event recorded", db.execute("select count(*) from audit_logs where entity_id=? and action='enquiry.status_changed'", (eid,)).fetchone()[0] == 1)
d = adm.get(f"{B}/admin/enquiries/{eid}")
note_form = [f for f in forms(d.text) if 'name="body"' in f[0]][0][1]
r = post_form(adm, f"{B}/admin/enquiries/{eid}", note_form, {"body": "Called the customer, sending quote Friday."})
check("internal note saved", r.status_code in (302, 303) and db.execute("select count(*) from enquiry_notes where enquiry_id=?", (eid,)).fetchone()[0] == 1)
d = adm.get(f"{B}/admin/enquiries/{eid}")
conv = [f for f in forms(d.text) if 'Convert to client' in f[0]][0][1]
r = post_form(adm, f"{B}/admin/enquiries/{eid}", conv, {})
check("convert to client works", db.execute("select status from enquiries where id=?", (eid,)).fetchone()[0] == "CONVERTED" and db.execute("select count(*) from clients where source_enquiry_id=?", (eid,)).fetchone()[0] == 1)
check("client appears privately in admin", "Smoke Co" in adm.get(B + "/admin/clients").text or "Smoke" in adm.get(B + "/admin/clients").text)
check("client is NOT publicly shown", "Smoke" not in requests.get(B + "/").text and "Smoke" not in requests.get(B + "/about").text)
db.close()

# 6 RBAC: HR cannot reach enquiry data; forged action by HR blocked
hr, r = login("hr@isolative.example", "Hr@12345678")
check("HR can sign in", r.status_code in (302, 303))
check("HR dashboard renders (and is not the login page)", "Dashboard" in hr.get(B + "/admin").text and "Failed emails" not in hr.get(B + "/admin").text)
for p in ["/admin/enquiries", f"/admin/enquiries/{eid}", "/admin/clients", "/admin/audit", "/admin/emails"]:
    r = hr.get(B + p, allow_redirects=False)
    check(f"HR blocked from {p.split('/')[2]}", r.status_code in (302, 307) and "/forbidden" in r.headers.get("location", ""), (r.status_code, r.headers.get("location")))
# Forged server-action call by HR using an admin-extracted action id
fresh = adm.get(f"{B}/admin/enquiries/{eid}")
any_form = [f for f in forms(fresh.text) if 'name="body"' in f[0]][0][1]
r = post_form(hr, f"{B}/admin/enquiries/{eid}", any_form, {"body": "HR trying to write a note"})
db = sqlite3.connect("dev.db")
cnt = db.execute("select count(*) from enquiry_notes where body like 'HR trying%'").fetchone()[0]
check("forged server action by HR is refused (no note written)", cnt == 0, (r.status_code, cnt))
# logout invalidates session server-side
tok = adm.headers["Cookie"].split("=",1)[1]
lo = [f for f in forms(adm.get(B + "/admin").text) if 'Sign out' in f[0]][0][1]
post_form(adm, B + "/admin", lo, {})
replay = requests.get(B + "/admin", cookies={"iep_session": tok}, allow_redirects=False)
check("old session cookie is dead after sign-out", replay.status_code in (302, 307), replay.status_code)
# open-redirect guard
s2 = requests.Session(); html = s2.get(B + "/login").text; f = [x for x in forms(html)[-1][1] if x[0] != "next"]
r = post_form(s2, B + "/login", f, {"email": "admin@isolative.example", "password": "Admin@12345", "next": "//evil.example"})
check("open redirect blocked", "evil.example" not in r.headers.get("location", ""), r.headers.get("location"))
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
