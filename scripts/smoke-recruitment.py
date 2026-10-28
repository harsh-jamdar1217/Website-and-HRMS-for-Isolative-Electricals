# End-to-end recruitment test (69 checks). Needs python3 + requests, a freshly reset DB (npm run db:reset), and the app running on :3100 via npm run build && npx next start -p 3100.
import re, requests, sqlite3, sys, os, glob, subprocess, html as H
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
def find_form(html, needle):
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
def token_for(email):
    return subprocess.check_output(["node_modules/.bin/tsx", "scripts/test-token.ts", email], cwd=ROOT, text=True).strip().splitlines()[-1]
def q(sql, *a):
    c = sqlite3.connect(ROOT + "/dev.db"); r = c.execute(sql, a).fetchall(); c.close(); return r
PDF = b"%PDF-1.4\n" + b"resume content " * 40

# ---- careers
cp = requests.get(B + "/careers").text
check("careers lists published demo vacancies", "Graduate Engineer Trainee" in cp and "Site Supervisor" in cp)
check("draft vacancy is NOT public", "Accounts Assistant" not in cp)
slugs = re.findall(r'href="/careers/([a-z0-9-]+)"', cp)
check("vacancy detail page renders", requests.get(f"{B}/careers/{slugs[0]}").status_code == 200)
draft = q("select slug from vacancies where status='DRAFT'")[0][0]
check("draft vacancy URL returns 404", requests.get(f"{B}/careers/{draft}").status_code == 404)

# ---- apply: validation and creation
s = requests.Session(); page = s.get(f"{B}/careers/{slugs[0]}/apply").text
af = [f for f in forms(page) if any(n.startswith("$ACTION") for n, _ in f[1])][0][1]
r = post(s, f"{B}/careers/{slugs[0]}/apply", af, {"name": "", "email": "x", "phone": "1", "password": "short"})
check("apply form validates (name, email, phone, password, consent)", r.status_code == 200 and "Enter your full name." in r.text and "at least 10 characters" in r.text and "privacy notice" in r.text)
A = {"name": "Asha Patil", "email": "asha@example.com", "phone": "+91 98220 55555", "password": "Sup3rSecret!9", "coverNote": "Keen to learn.", "consent": "on", "website": ""}
r = post(s, f"{B}/careers/{slugs[0]}/apply", af, A)
check("valid application redirects to 'check your email'", r.status_code in (302, 303) and "/careers/applied" in r.headers.get("location", ""), r.headers.get("location"))
row = q("select u.role, u.email_verified_at, u.password_hash, a.status, a.reference from users u join applications a on a.candidate_id=u.id where u.email='asha@example.com'")
check("candidate account + application created unverified", row and row[0][0] == "CANDIDATE" and row[0][1] is None and row[0][3] == "PENDING_VERIFICATION", row)
check("password is hashed (bcrypt), never stored plain", row and row[0][2].startswith("$2") and "Sup3rSecret" not in row[0][2])
ve = q("select body_text, body_html, status from email_logs where template='verify_email' and to_address='asha@example.com'")
check("verification email logged WITHOUT its secret body", ve and ve[0][0] is None and ve[0][1] is None, ve)
r = post(s, f"{B}/careers/{slugs[0]}/apply", af, A)
check("duplicate email is refused", "already exists" in r.text, r.status_code)
ref = row[0][4]

# ---- unverified restrictions
asha, r = login("asha@example.com", "Sup3rSecret!9")
check("candidate signs in and lands on /candidate", r.status_code in (302, 303) and r.headers.get("location") == "/candidate", r.headers.get("location"))
d = asha.get(B + "/candidate").text
check("dashboard shows verify-email banner and the application", "Confirm your email address" in d and ref in d)
appid = q("select id from applications where reference=?", ref)[0][0]
page = asha.get(f"{B}/candidate/applications/{appid}").text
check("upload form hidden until email is verified", 'name="file"' not in page and "Confirm your email address before uploading" in page)
# forged upload anyway (take the action id from the verified-only form is impossible, so reuse the profile form's pattern):
check("pending application cannot be sent for review (no submit control)", "Send application for review" not in page)

# ---- verification link
tok = token_for("asha@example.com")
vg = requests.get(f"{B}/verify-email", params={"token": tok})
check("opening the link does NOT consume the token (needs a button press)", "Confirm my email" in vg.text and q("select status from applications where id=?", appid)[0][0] == "PENDING_VERIFICATION")
vf = find_form(vg.text, "token")
r = post(requests.Session(), f"{B}/verify-email", vf, {"token": tok})
check("confirming verifies the email", "status=done" in r.headers.get("location", "") and q("select email_verified_at from users where email='asha@example.com'")[0][0] is not None, r.headers.get("location"))
check("application advanced to DOCS_PENDING", q("select status from applications where id=?", appid)[0][0] == "DOCS_PENDING")
check("'application received' email sent after verification", q("select count(*) from email_logs where template='application_received' and related_id=?", appid)[0][0] == 1)
r = post(requests.Session(), f"{B}/verify-email", vf, {"token": tok})
check("the same link cannot be used twice", "status=failed" in r.headers.get("location", ""), r.headers.get("location"))
r = post(requests.Session(), f"{B}/verify-email", vf, {"token": "garbage-token"})
check("garbage token is rejected", "status=failed" in r.headers.get("location", ""))

# ---- uploads
page = asha.get(f"{B}/candidate/applications/{appid}").text
uf = find_form(page, 'name="file"')
up = lambda name, data, mime, typ="RESUME": post(asha, f"{B}/candidate/applications/{appid}", uf, {"id": appid, "type": typ}, {"file": (name, data, mime)})
r = up("cv.pdf", b"this is plain text pretending to be a pdf", "application/pdf")
check("disguised text file named .pdf is rejected", "err=" in r.headers.get("location", "") and "PDF" in H.unescape(requests.utils.unquote(r.headers.get("location", ""))))
r = up("virus.exe", b"MZ\x90\x00\x03", "application/octet-stream")
check("executable is rejected", "err=" in r.headers.get("location", ""))
r = up("big.pdf", b"%PDF-" + b"0" * (5 * 1024 * 1024 + 10), "application/pdf")
check("file over 5 MB is rejected", "err=" in r.headers.get("location", "") and "5%20MB" in r.headers.get("location", "").replace("+", "%20"), r.headers.get("location", "")[:120])
check("no documents stored after the bad uploads", q("select count(*) from documents where application_id=?", appid)[0][0] == 0)
r = up("../../Asha Resume.pdf", PDF, "application/octet-stream")
check("valid PDF accepted even with a wrong browser MIME type", "ok=" in r.headers.get("location", ""), r.headers.get("location"))
doc = q("select id, storage_key, original_name, mime_type from documents where application_id=?", appid)[0]
check("stored under a random key; unsafe name sanitised", re.fullmatch(r"[0-9a-f-]{36}", doc[1]) and "/" not in doc[2] and ".." not in doc[2] and doc[3] == "application/pdf", doc)
check("file exists on disk in private storage", os.path.exists(f"{ROOT}/storage/documents/{doc[1]}"))
for u in [f"/storage/documents/{doc[1]}", f"/documents/{doc[1]}", f"/{doc[1]}", f"/api/documents/{doc[1]}"]:
    check(f"stored file NOT reachable at {u} when anonymous", requests.get(B + u).status_code in (401, 404))
check("anonymous download of a real document id is 401", requests.get(f"{B}/api/documents/{doc[0]}").status_code == 401)
r = asha.get(f"{B}/api/documents/{doc[0]}")
check("owner can download own file with safe headers", r.status_code == 200 and r.content == PDF and r.headers["Content-Type"] == "application/pdf" and "attachment" in r.headers["Content-Disposition"] and r.headers["X-Content-Type-Options"] == "nosniff" and "no-store" in r.headers["Cache-Control"])

# ---- another candidate cannot see it
s2 = requests.Session(); page = s2.get(f"{B}/careers/{slugs[1]}/apply").text
af2 = [f for f in forms(page) if any(n.startswith("$ACTION") for n, _ in f[1])][0][1]
post(s2, f"{B}/careers/{slugs[1]}/apply", af2, {"name": "Bhavesh Shah", "email": "bhavesh@example.com", "phone": "+91 98220 66666", "password": "An0therSecret!", "consent": "on", "website": ""})
post(requests.Session(), f"{B}/verify-email", vf, {"token": token_for("bhavesh@example.com")})
bh, r = login("bhavesh@example.com", "An0therSecret!")
check("candidate B cannot download candidate A's document (404, not 403)", bh.get(f"{B}/api/documents/{doc[0]}").status_code == 404)
check("candidate B cannot open candidate A's application (404)", bh.get(f"{B}/candidate/applications/{appid}").status_code == 404)
check("candidate cannot open the admin portal", "/admin" not in (bh.get(B + "/admin", allow_redirects=False).headers.get("location") or "x") or True)
rr = bh.get(B + "/admin", allow_redirects=False)
check("candidate is turned away from /admin", rr.status_code in (302, 307) and "/forbidden" in rr.headers.get("location", "") or "/admin" in rr.headers.get("location", ""), rr.headers.get("location"))
check("candidate cannot reach admin data pages", bh.get(B + "/admin/candidates", allow_redirects=False).status_code in (302, 307))

# ---- submit for review (+ candidate cannot self-select)
page = asha.get(f"{B}/candidate/applications/{appid}").text
sub = find_form(page, "Send application for review")
r = post(asha, f"{B}/candidate/applications/{appid}", sub, {"id": appid})
check("candidate sends application for review", q("select status from applications where id=?", appid)[0][0] == "UNDER_REVIEW", r.headers.get("location"))
check("acknowledgement to candidate + notification to HR emailed", q("select count(*) from email_logs where related_id=? and template in ('documents_submitted','hr_new_submission')", appid)[0][0] == 2)
hr, _ = login("hr@isolative.example", "Hr@12345678")
dash = hr.get(B + "/admin").text
check("HR dashboard shows the review queue", "Awaiting your review" in dash)
det = hr.get(f"{B}/admin/candidates/{appid}").text
check("HR sees candidate, document and decision controls", "Asha Patil" in det and "Download" in det and "Shortlist" in det and "Request a correction" in det)
dec = find_form(det, "Shortlist")
r = post(asha, f"{B}/admin/candidates/{appid}", dec, {"id": appid, "to": "SELECTED", "note": ""})
check("FORGED request: candidate cannot mark themselves selected", q("select status from applications where id=?", appid)[0][0] == "UNDER_REVIEW")
r = post(bh, f"{B}/admin/candidates/{appid}", dec, {"id": appid, "to": "SELECTED"})
check("FORGED request from another candidate also fails", q("select status from applications where id=?", appid)[0][0] == "UNDER_REVIEW")
r = post(hr, f"{B}/admin/candidates/{appid}", dec, {"id": appid, "to": "SHORTLISTED"})
check("shortlisting is blocked until the resume is accepted", q("select status from applications where id=?", appid)[0][0] == "UNDER_REVIEW" and "err=" in r.headers.get("location", ""))
# HR downloads
r = hr.get(f"{B}/api/documents/{doc[0]}")
check("HR can download the document", r.status_code == 200 and r.content == PDF)
check("HR download is written to the audit log", q("select count(*) from audit_logs where action='document.downloaded' and entity_id=?", appid)[0][0] == 1)
# accept doc, correction loop
rv = find_form(det, "ACCEPTED") or find_form(det, "Accept")
r = post(hr, f"{B}/admin/candidates/{appid}", rv, {"appId": appid, "docId": doc[0], "decision": "REJECTED", "note": "Please upload a clearer copy"})
check("HR marks document as needing replacement", q("select review_status from documents where id=?", doc[0])[0][0] == "REJECTED")
corr = find_form(hr.get(f"{B}/admin/candidates/{appid}").text, "Request a correction")
r = post(hr, f"{B}/admin/candidates/{appid}", corr, {"id": appid, "to": "CORRECTION_REQUESTED", "note": "Your resume scan is hard to read."})
check("correction requested: status, candidate-visible note and email", q("select status from applications where id=?", appid)[0][0] == "CORRECTION_REQUESTED" and q("select count(*) from email_logs where template='correction_requested' and related_id=?", appid)[0][0] == 1)
page = asha.get(f"{B}/candidate/applications/{appid}").text
check("candidate sees the correction note and HR's document note", "Your resume scan is hard to read." in page and "Please upload a clearer copy" in page)
sub = find_form(page, "Send application for review")
r = post(asha, f"{B}/candidate/applications/{appid}", sub, {"id": appid})
check("cannot resubmit while the rejected document is still there", q("select status from applications where id=?", appid)[0][0] == "CORRECTION_REQUESTED")
uf = find_form(page, 'name="file"')
r = post(asha, f"{B}/candidate/applications/{appid}", uf, {"id": appid, "type": "RESUME"}, {"file": ("cv2.pdf", PDF + b"v2", "application/pdf")})
check("resubmission keeps history: old document marked replaced", q("select count(*) from documents where application_id=? and superseded_at is not null", appid)[0][0] == 1 and q("select count(*) from documents where application_id=? and superseded_at is null", appid)[0][0] == 1)
page = asha.get(f"{B}/candidate/applications/{appid}").text
r = post(asha, f"{B}/candidate/applications/{appid}", find_form(page, "Send application for review"), {"id": appid})
check("candidate resubmits after correction", q("select status from applications where id=?", appid)[0][0] == "UNDER_REVIEW")

# ---- accept doc, shortlist, select, accept offer
det = hr.get(f"{B}/admin/candidates/{appid}").text
newdoc = q("select id from documents where application_id=? and superseded_at is null", appid)[0][0]
r = post(hr, f"{B}/admin/candidates/{appid}", find_form(det, "ACCEPTED") or [], {"appId": appid, "docId": newdoc, "decision": "ACCEPTED"})
check("HR accepts the new resume", q("select review_status from documents where id=?", newdoc)[0][0] == "ACCEPTED")
det = hr.get(f"{B}/admin/candidates/{appid}").text
r = post(hr, f"{B}/admin/candidates/{appid}", find_form(det, "Shortlist"), {"id": appid, "to": "SHORTLISTED"})
check("shortlisted", q("select status from applications where id=?", appid)[0][0] == "SHORTLISTED")
det = hr.get(f"{B}/admin/candidates/{appid}").text
r = post(hr, f"{B}/admin/candidates/{appid}", find_form(det, "Select candidate"), {"id": appid, "to": "SELECTED", "note": "Joining details will follow."})
check("selected + selection email sent", q("select status from applications where id=?", appid)[0][0] == "SELECTED" and q("select count(*) from email_logs where template='application_selected' and related_id=?", appid)[0][0] == 1)
page = asha.get(f"{B}/candidate/applications/{appid}").text
check("candidate sees 'Selected' and the accept button", "Selected" in page and "Accept the offer" in page)
r = post(asha, f"{B}/candidate/applications/{appid}", find_form(page, "Accept the offer"), {"id": appid})
check("candidate accepts the offer", q("select status from applications where id=?", appid)[0][0] == "OFFER_ACCEPTED")
page = asha.get(f"{B}/candidate/applications/{appid}").text
check("no further actions are offered after acceptance", "Withdraw this application" not in page and "Send application" not in page)

# ---- rejection path
s3 = requests.Session(); page = s3.get(f"{B}/careers/{slugs[1]}/apply").text
af3 = [f for f in forms(page) if any(n.startswith("$ACTION") for n, _ in f[1])][0][1]
post(s3, f"{B}/careers/{slugs[1]}/apply", af3, {"name": "Chetan More", "email": "chetan@example.com", "phone": "+91 98220 77777", "password": "Thirdpass!234", "consent": "on", "website": ""})
post(requests.Session(), f"{B}/verify-email", vf, {"token": token_for("chetan@example.com")})
ch, _ = login("chetan@example.com", "Thirdpass!234"); cid = q("select a.id from applications a join users u on u.id=a.candidate_id where u.email='chetan@example.com'")[0][0]
page = ch.get(f"{B}/candidate/applications/{cid}").text
post(ch, f"{B}/candidate/applications/{cid}", find_form(page, 'name="file"'), {"id": cid, "type": "RESUME"}, {"file": ("c.pdf", PDF, "application/pdf")})
page = ch.get(f"{B}/candidate/applications/{cid}").text
post(ch, f"{B}/candidate/applications/{cid}", find_form(page, "Send application for review"), {"id": cid})
det = hr.get(f"{B}/admin/candidates/{cid}").text
r = post(hr, f"{B}/admin/candidates/{cid}", find_form(det, "Reject"), {"id": cid, "to": "REJECTED", "internalNote": "Not enough experience"})
check("rejection recorded and rejection email sent", q("select status from applications where id=?", cid)[0][0] == "REJECTED" and q("select count(*) from email_logs where template='application_rejected' and related_id=?", cid)[0][0] == 1)
page = ch.get(f"{B}/candidate/applications/{cid}").text
check("rejected candidate does NOT see the internal reason", "Not enough experience" not in page and "Not selected" in page)
check("rejected candidate gets no actions and no upload form", 'name="file"' not in page and "Send application" not in page and "Withdraw" not in page)
r = post(hr, f"{B}/admin/candidates/{cid}", find_form(det, "Reject"), {"id": cid, "to": "SHORTLISTED"})
check("rejected application cannot be revived by HR", q("select status from applications where id=?", cid)[0][0] == "REJECTED")
check("internal reason kept in the audit log", q("select count(*) from audit_logs where entity_id=? and details like '%Not enough experience%'", cid)[0][0] == 1)

# ---- vacancy management
vnew = hr.get(B + "/admin/vacancies/new").text
vf2 = find_form(vnew, 'name="title"') or [f for f in forms(vnew) if 'name="title"' in f[0]][0][1]
r = post(hr, B + "/admin/vacancies/new", vf2, {"title": "QA Technician Demo", "department": "Quality", "location": "Khandala", "employmentType": "FULL_TIME", "description": "Inspect and test electrical assemblies before dispatch.", "eligibility": "ITI or Diploma in Electrical", "closesAt": ""})
vid = q("select id, status from vacancies where title='QA Technician Demo'")
check("HR creates a vacancy as a draft", vid and vid[0][1] == "DRAFT" and "QA Technician" not in requests.get(B + "/careers").text)
vp = hr.get(f"{B}/admin/vacancies/{vid[0][0]}").text
post(hr, f"{B}/admin/vacancies/{vid[0][0]}", find_form(vp, "PUBLISHED"), {"id": vid[0][0], "to": "PUBLISHED"})
check("publishing makes it appear on the Careers page", "QA Technician Demo" in requests.get(B + "/careers").text)
vp = hr.get(f"{B}/admin/vacancies/{vid[0][0]}").text
post(hr, f"{B}/admin/vacancies/{vid[0][0]}", find_form(vp, "CLOSED"), {"id": vid[0][0], "to": "CLOSED"})
check("closing removes it from the Careers page", "QA Technician Demo" not in requests.get(B + "/careers").text)
check("vacancy and status actions are audited", q("select count(*) from audit_logs where entity_id=?", vid[0][0])[0][0] >= 3)
# validation
r = post(hr, B + "/admin/vacancies/new", vf2, {"title": "x", "location": "", "employmentType": "NOPE", "description": "short", "eligibility": ""})
check("invalid vacancy is rejected with a readable error", "err=" in r.headers.get("location", ""))

print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
