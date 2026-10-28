# End-to-end employee/onboarding test (43 checks). Fresh DB (npm run db:reset), app on :3100 (npm run build && npx next start -p 3100). Uses scripts/test-setup-offer.ts to fast-forward candidates to "offer accepted".
import re, requests, sqlite3, sys, json, subprocess, html as H
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
def post(s, url, fields, data, files=None):
    parts = {k: (None, v) for k, v in fields}; parts.update({k: (None, v) for k, v in data.items()})
    if files: parts.update(files)
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
PDF = b"%PDF-1.4\n" + b"doc " * 60

out = subprocess.check_output(["node_modules/.bin/tsx", "scripts/test-setup-offer.ts", "2"], cwd=ROOT, text=True)
people = json.loads([l for l in out.splitlines() if l.startswith("JSON:")][0][5:])
X, Y = people
hr, _ = login("hr@isolative.example", "Hr@12345678")
check("HR dashboard shows 'Ready to convert'", "Ready to convert" in hr.get(B + "/admin").text)

# ---- conversion
det = hr.get(f"{B}/admin/candidates/{X['appId']}").text
check("convert panel appears for an accepted offer", "Convert to employee" in det)
cf = ff(det, "joiningDate")
r = post(hr, f"{B}/admin/candidates/{X['appId']}", cf, {"applicationId": X["appId"], "jobTitle": "Graduate Engineer", "department": "", "employmentType": "FULL_TIME", "joiningDate": "2026-11-10"})
check("conversion validates required fields", "err=" in r.headers.get("location", "") and not q("select 1 from employees"), loc(r))
r = post(hr, f"{B}/admin/candidates/{X['appId']}", cf, {"applicationId": X["appId"], "jobTitle": "Graduate Engineer", "department": "Engineering", "employmentType": "FULL_TIME", "joiningDate": "2020-01-01"})
check("a joining date far in the past is refused", "30 days" in loc(r) and not q("select 1 from employees"), loc(r))
r = post(hr, f"{B}/admin/candidates/{X['appId']}", cf, {"applicationId": X["appId"], "jobTitle": "Graduate Engineer", "department": "Engineering", "employmentType": "FULL_TIME", "joiningDate": "2026-11-10"})
empX = q("select id, employee_code, status from employees")
check("HR converts the candidate; employee record created", r.status_code in (302, 303) and "/admin/employees/" in r.headers.get("location", "") and len(empX) == 1 and empX[0][1] == "EMP-0001" and empX[0][2] == "ONBOARDING", (loc(r), empX))
eid = empX[0][0]
check("same account promoted to EMPLOYEE (no duplicate user)", q("select role from users where email=?", X["email"])[0][0] == "EMPLOYEE" and q("select count(*) from users where email=?", X["email"])[0][0] == 1)
check("application is HIRED and history preserved", q("select status from applications where id=?", X["appId"])[0][0] == "HIRED" and q("select count(*) from application_events where application_id=?", X["appId"])[0][0] >= 6)
check("6 onboarding tasks created", q("select count(*) from onboarding_tasks where employee_id=?", eid)[0][0] == 6)
check("welcome email recorded", q("select count(*) from email_logs where template='employee_welcome' and related_id=?", eid)[0][0] == 1)
r = post(hr, f"{B}/admin/candidates/{X['appId']}", cf, {"applicationId": X["appId"], "jobTitle": "Graduate Engineer", "department": "Engineering", "employmentType": "FULL_TIME", "joiningDate": "2026-11-10"})
check("a second conversion of the same person is refused", "already been converted" in loc(r) and q("select count(*) from employees")[0][0] == 1, loc(r))
det = hr.get(f"{B}/admin/candidates/{X['appId']}").text
check("candidate page now links to the employee record, convert panel gone", "Open employee record" in det and 'name="joiningDate"' not in det)
check("Y (not converted) is untouched", q("select status from applications where id=?", Y["appId"])[0][0] == "OFFER_ACCEPTED" and q("select role from users where email=?", Y["email"])[0][0] == "CANDIDATE")
check("employees list shows EMP-0001", "EMP-0001" in hr.get(B + "/admin/employees").text)

# ---- employee portal and role routing
ex, r = login(X["email"], X["password"])
check("employee signs in and lands on /employee", loc(r) == "/employee", loc(r))
pg = ex.get(B + "/employee").text
check("portal shows ID, role and checklist", "EMP-0001" in pg and "Graduate Engineer" in pg and "0 of 6 tasks done" in pg)
for path, name in [("/admin", "admin portal"), ("/admin/employees", "employee records"), ("/admin/candidates", "candidates")]:
    rr = ex.get(B + path, allow_redirects=False)
    check(f"employee cannot open {name}", rr.status_code in (302, 307) and ("/forbidden" in rr.headers.get("location", "") or "/login" in rr.headers.get("location", "")), (rr.status_code, rr.headers.get("location")))
rr = ex.get(B + "/candidate", allow_redirects=False)
check("employee is sent from /candidate to /employee", "/employee" in rr.headers.get("location", ""), rr.headers.get("location"))
ey, r = login(Y["email"], Y["password"])
rr = ey.get(B + "/employee", allow_redirects=False)
check("a still-candidate cannot open the employee portal", rr.status_code in (302, 307) and "/candidate" in rr.headers.get("location", ""), rr.headers.get("location"))

# ---- employee details
df = ff(pg, "emergencyPhone")
r = post(ex, B + "/employee", df, {"addressLine": "x", "emergencyName": "", "emergencyRelation": "", "emergencyPhone": "1"})
check("details are validated", "err=" in r.headers.get("location", ""))
check("task not completed by invalid input", q("select status from onboarding_tasks where employee_id=? and key='DETAILS'", eid)[0][0] == "PENDING")
r = post(ex, B + "/employee", df, {"addressLine": "12 Station Road, Khandala, Satara", "emergencyName": "Meena Joiner", "emergencyRelation": "Mother", "emergencyPhone": "+91 98220 12345"})
check("saving details completes the DETAILS task", q("select status from onboarding_tasks where employee_id=? and key='DETAILS'", eid)[0][0] == "DONE")

# ---- employee documents
uf = ff(ex.get(B + "/employee").text, 'name="file"')
up = lambda typ, name, data, mime="application/pdf": post(ex, B + "/employee", uf, {"type": typ}, {"file": (name, data, mime)})
r = up("BANK_PROOF", "cheque.pdf", b"not really a pdf at all")
check("disguised file rejected for employee uploads too", "err=" in r.headers.get("location", ""))
r = up("RESUME", "cv.pdf", PDF)
check("employee cannot use recruitment-only document types", "err=" in r.headers.get("location", "") and "Choose a document type" in loc(r), loc(r))
r = up("BANK_PROOF", "cheque.pdf", PDF)
check("bank proof uploaded", "ok=" in r.headers.get("location", ""), loc(r))
check("upload does NOT complete the task by itself", q("select status from onboarding_tasks where employee_id=? and key='BANK_PROOF'", eid)[0][0] == "PENDING")
bank = q("select id from documents where type='BANK_PROOF' and superseded_at is null")[0][0]
check("employee can download own document", ex.get(f"{B}/api/documents/{bank}").content == PDF)

# ---- HR reviews and completes onboarding
page = hr.get(f"{B}/admin/employees/{eid}").text
check("HR sees the document and task controls", "Bank account proof" in page and "Complete onboarding" in page)
rf = [f for f in forms(page) if ("decision", "ACCEPTED") in f[1]][0][1]
r = post(hr, f"{B}/admin/employees/{eid}", rf, {})
check("HR accepts the bank proof; task completes automatically", q("select status from onboarding_tasks where employee_id=? and key='BANK_PROOF'", eid)[0][0] == "DONE" and "/admin/employees/" in r.headers.get("location", ""), loc(r))
check("HR download of employee document is audited", hr.get(f"{B}/api/documents/{bank}").status_code == 200 and q("select count(*) from audit_logs where action='document.downloaded' and details like ?", f'%{bank}%')[0][0] == 1)
cf2 = ff(page, 'name="id"') and [f for f in forms(page) if "Complete onboarding" in f[0]][0][1]
r = post(hr, f"{B}/admin/employees/{eid}", cf2, {"id": eid})
check("cannot complete onboarding with open tasks (lists them)", "still open" in loc(r) and q("select status from employees where id=?", eid)[0][0] == "ONBOARDING", loc(r))
hrform = [f for f in forms(page) if ("key", "ID_CARD") in f[1]][0][1]
r = post(ex, f"{B}/admin/employees/{eid}", hrform, {"id": eid, "key": "ID_CARD", "done": "1"})
check("FORGED: employee cannot tick an HR task", q("select status from onboarding_tasks where employee_id=? and key='ID_CARD'", eid)[0][0] == "PENDING")
r = post(hr, f"{B}/admin/employees/{eid}", hrform, {"id": eid, "key": "BANK_PROOF", "done": "1"})
check("HR cannot tick an employee-owned task", "completed by the employee" in loc(r), loc(r))
# joining form
pg = ex.get(B + "/employee").text; uf = ff(pg, 'name="file"')
post(ex, B + "/employee", uf, {"type": "JOINING_FORM"}, {"file": ("joining.pdf", PDF + b"j", "application/pdf")})
jf = q("select id from documents where type='JOINING_FORM'")[0][0]
page = hr.get(f"{B}/admin/employees/{eid}").text
rf = [f for f in forms(page) if ("docId", jf) in f[1] and ("decision", "ACCEPTED") in f[1]][0][1]
post(hr, f"{B}/admin/employees/{eid}", rf, {})
for key in ["VERIFY_DOCS", "ID_CARD", "ORIENTATION"]:
    page = hr.get(f"{B}/admin/employees/{eid}").text
    f = [f for f in forms(page) if ("key", key) in f[1]][0][1]
    post(hr, f"{B}/admin/employees/{eid}", f, {"id": eid, "key": key, "done": "1"})
check("all six tasks are done", q("select count(*) from onboarding_tasks where employee_id=? and status='DONE'", eid)[0][0] == 6)
page = hr.get(f"{B}/admin/employees/{eid}").text
r = post(hr, f"{B}/admin/employees/{eid}", [f for f in forms(page) if "Complete onboarding" in f[0]][0][1], {"id": eid})
check("onboarding completes: employee becomes ACTIVE + email", q("select status from employees where id=?", eid)[0][0] == "ACTIVE" and q("select count(*) from email_logs where template='onboarding_complete'")[0][0] == 1, loc(r))
check("onboarding completion is audited", q("select count(*) from audit_logs where action='onboarding.completed' and entity_id=?", eid)[0][0] == 1)
pg = ex.get(B + "/employee").text
check("portal now shows Active status", ">Active<" in pg and "Completed" in pg)

# ---- second employee: cross-access
det = hr.get(f"{B}/admin/candidates/{Y['appId']}").text
r = post(hr, f"{B}/admin/candidates/{Y['appId']}", ff(det, "joiningDate"), {"applicationId": Y["appId"], "jobTitle": "Site Supervisor", "department": "Operations", "employmentType": "CONTRACT", "joiningDate": "2026-11-12"})
check("second conversion gets the next sequential ID", q("select employee_code from employees order by employee_code")[1][0] == "EMP-0002")
ey, r = login(Y["email"], Y["password"])
check("employee Y signs in to /employee", loc(r) == "/employee")
check("employee Y cannot download employee X's document (404)", ey.get(f"{B}/api/documents/{bank}").status_code == 404)
check("employee Y's portal shows only their own record", "EMP-0002" in ey.get(B + "/employee").text and "EMP-0001" not in ey.get(B + "/employee").text)
check("employee sees no recruitment-only controls", 'Send application' not in ey.get(B + "/employee").text)
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
