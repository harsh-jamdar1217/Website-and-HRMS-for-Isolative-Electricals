# End-to-end meetings test (45 checks). Fresh DB, app on :3100 started with SMTP_HOST="" and CRON_SECRET=test-secret-123. Uses scripts/test-setup-meetings.ts.
import re, requests, sqlite3, sys, json, subprocess, html as H, datetime as dt
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
    parts = [(k, (None, v)) for k, v in fields]
    for k, v in data.items():
        for item in (v if isinstance(v, list) else [v]): parts.append((k, (None, item)))
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
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
def ist(days=0, minutes=0):
    d = dt.datetime.now(IST) + dt.timedelta(days=days, minutes=minutes); return d.strftime("%Y-%m-%d"), d.strftime("%H:%M")
tomorrow, _ = ist(days=3)
day2, _ = ist(days=4)
out = subprocess.check_output(["node_modules/.bin/tsx", "scripts/test-setup-meetings.ts"], cwd=ROOT, text=True)
P = json.loads([l for l in out.splitlines() if l.startswith("JSON:")][0][5:]); A, Bh, C = P["a"], P["b"], P["cand"]

hr, _ = login("hr@isolative.example", "Hr@12345678"); admin, _ = login("admin@isolative.example", "Admin@12345")
check("calendar page renders", "Meetings" in hr.get(B + "/admin/meetings").text and "Mon" in hr.get(B + "/admin/meetings").text)
check("list view renders with empty state", "No upcoming meetings" in hr.get(B + "/admin/meetings?view=list").text)
check("dashboard shows the meetings tile", "Meetings, next 7 days" in hr.get(B + "/admin").text)

# ---- interview from the candidate's page
cp = hr.get(f"{B}/admin/candidates/{C['appId']}").text
check("shortlisted candidate page offers 'Schedule an interview'", "Schedule an interview" in cp)
np_ = hr.get(f"{B}/admin/meetings/new?applicationId={C['appId']}").text
check("interview form is pre-filled for the candidate and offers only the Interview type", "Ira Interviewee" in np_ and 'value="INTERVIEW"' in np_ and "Client meeting" not in np_)
nf = ff(np_, 'name="title"') or [f for f in forms(np_) if 'name="title"' in f[0]][0][1]
r = post(hr, B + "/admin/meetings/new", nf, {"title": "Interview: Ira Interviewee", "type": "INTERVIEW", "date": tomorrow, "time": "10:00", "durationMin": "60", "location": "HR room, Khandala", "meetingLink": "", "agenda": "Please bring original certificates.", "guests": ""})
iv = q("select id, uid, sequence, status from meetings where title like 'Interview:%'")
check("interview is scheduled and we are redirected to its page", r.status_code in (302, 303) and len(iv) == 1 and "/admin/meetings/" in r.headers.get("location", ""), (loc(r), iv))
iid = iv[0][0]
check("organiser + candidate are participants", q("select count(*) from meeting_participants where meeting_id=?", iid)[0][0] == 2)
inv = q("select to_address, ics_content from email_logs where template='meeting_invite' and related_id=?", iid)
check("an invitation with a calendar file was emailed to each participant", len(inv) == 2 and all("METHOD:REQUEST" in (x[1] or "") for x in inv) and {x[0] for x in inv} == {"hr@isolative.example", "ira@example.com"}, inv and [x[0] for x in inv])
check("creation is audited", q("select count(*) from audit_logs where action='meeting.created' and entity_id=?", iid)[0][0] == 1)

# ---- conflicts keep what you typed
gp = hr.get(B + "/admin/meetings/new").text
gf = [f for f in forms(gp) if 'name="title"' in f[0]][0][1]
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Overlapping sync", "type": "INTERNAL", "date": tomorrow, "time": "10:30", "durationMin": "30", "location": "Room 5", "meetingLink": "", "agenda": "", "guests": "", "participants": [A["id"]]})
check("organiser double-booking is blocked", r.status_code == 200 and "Scheduling conflict" in r.text and "Hema" not in r.text, r.status_code)
check("the form keeps what was typed after a conflict", "Overlapping sync" in r.text and "Room 5" in r.text)
check("no meeting was created by the failed attempt", q("select count(*) from meetings where title='Overlapping sync'")[0][0] == 0)
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Back to back", "type": "INTERNAL", "date": tomorrow, "time": "11:00", "durationMin": "30", "location": "Room 5", "meetingLink": "", "agenda": "", "guests": "", "participants": [A["id"]]})
check("a back-to-back meeting (starts as the other ends) is allowed", q("select count(*) from meetings where title='Back to back'")[0][0] == 1, loc(r))
b2b = q("select id from meetings where title='Back to back'")[0][0]

# ---- validation
r = post(hr, B + "/admin/meetings/new", gf, {"title": "No place", "type": "INTERNAL", "date": tomorrow, "time": "15:00", "durationMin": "30", "location": "", "meetingLink": "", "agenda": "", "guests": "", "participants": [A["id"]]})
check("a meeting needs a location or link", "Say where" in H.unescape(r.text))
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Past", "type": "INTERNAL", "date": "2020-01-01", "time": "09:00", "durationMin": "30", "location": "x", "meetingLink": "", "agenda": "", "guests": "", "participants": [A["id"]]})
check("a meeting in the past is refused", "future" in r.text)
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Client call", "type": "CLIENT", "date": day2, "time": "12:00", "durationMin": "45", "location": "", "meetingLink": "https://meet.example.com/abc", "agenda": "Quotation review", "guests": "Priya Sharma <priya@client.example>\nnot-an-email", "participants": [Bh["id"]]})
check("invalid external guest is rejected", "not a valid guest" in H.unescape(r.text))
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Client call", "type": "CLIENT", "date": day2, "time": "12:00", "durationMin": "45", "location": "", "meetingLink": "https://meet.example.com/abc", "agenda": "Quotation review", "guests": "Priya Sharma <priya@client.example>", "participants": [Bh["id"]]})
cl = q("select id from meetings where title='Client call'")
check("client meeting with an external guest is created", len(cl) == 1 and q("select count(*) from meeting_participants where meeting_id=? and user_id is null", cl[0][0])[0][0] == 1)
check("the external guest was emailed the invitation", q("select count(*) from email_logs where template='meeting_invite' and to_address='priya@client.example'")[0][0] == 1)

# ---- what participants see
ira, r = login(C["email"], "Ira#Pass123456")
cpg = ira.get(f"{B}/candidate/applications/{C['appId']}").text
check("candidate sees their interview with place and agenda", "Your interview" in cpg and "HR room, Khandala" in cpg and "original certificates" in cpg)
check("candidate does NOT see other meetings", "Back to back" not in cpg and "Client call" not in cpg)
ea, _ = login(A["email"], "Staff#Pass12345"); eb, _ = login(Bh["email"], "Staff#Pass12345")
check("employee A sees their meeting in the portal", "Back to back" in ea.get(B + "/employee").text)
check("employee A does not see employee B's meeting", "Client call" not in ea.get(B + "/employee").text and "Client call" in eb.get(B + "/employee").text)
for who, s_ in [("candidate", ira), ("employee", ea)]:
    rr = s_.get(B + "/admin/meetings", allow_redirects=False)
    check(f"{who} cannot open the meetings admin page", rr.status_code in (302, 307) and "/forbidden" in rr.headers.get("location", ""), (rr.status_code, rr.headers.get("location")))

# ---- reschedule
dp = hr.get(f"{B}/admin/meetings/{iid}").text
check("detail page shows participants and reschedule/cancel controls", re.search(r"Participants \(\D*2", dp) and "Reschedule or edit" in dp and "Cancel this meeting" in dp)
rf = [f for f in forms(dp) if 'name="durationMin"' in f[0]][0][1]
r = post(hr, f"{B}/admin/meetings/{iid}", rf, {"id": iid, "title": "Interview: Ira Interviewee", "date": tomorrow, "time": "11:00", "durationMin": "60", "location": "HR room, Khandala", "meetingLink": "", "agenda": "Please bring original certificates."})
check("rescheduling onto a colleague's meeting is blocked (11:00 is taken by Back to back)", "conflict" in loc(r).lower() and q("select sequence from meetings where id=?", iid)[0][0] == 0, loc(r))
r = post(hr, f"{B}/admin/meetings/{iid}", rf, {"id": iid, "title": "Interview: Ira Interviewee", "date": tomorrow, "time": "09:00", "durationMin": "60", "location": "HR room, Khandala", "meetingLink": "", "agenda": "Please bring original certificates."})
check("rescheduling to a free slot works; version increments", q("select sequence from meetings where id=?", iid)[0][0] == 1, loc(r))
upd = q("select ics_content from email_logs where template='meeting_update' and related_id=?", iid)
check("updated calendar entries were sent (SEQUENCE:1, same UID)", len(upd) == 2 and all("SEQUENCE:1" in x[0] and q("select uid from meetings where id=?", iid)[0][0] in x[0] for x in upd))
check("candidate page shows the new time", "9:00 am" in ira.get(f"{B}/candidate/applications/{C['appId']}").text)

# ---- calendar view
ym = tomorrow[:7]
cal = hr.get(f"{B}/admin/meetings", params={"month": ym}).text
check("calendar month grid shows the meetings", "Interview: Ira Interviewee" in cal and "Back to back" in cal)
check("list view shows meeting details", "Client call" in hr.get(B + "/admin/meetings?view=list").text)
check("bad month parameter falls back safely", hr.get(B + "/admin/meetings?month=abc").status_code == 200)

# ---- reminders
d3, t3 = ist(minutes=180)
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Starts in three hours", "type": "INTERNAL", "date": d3, "time": t3, "durationMin": "30", "location": "Room 1", "meetingLink": "", "agenda": "", "guests": "", "participants": [Bh["id"]]})
soon = q("select id from meetings where title='Starts in three hours'")
check("near-term meeting created", len(soon) == 1, loc(r))
rem = [f for f in forms(hr.get(B + "/admin/meetings").text) if "Send due reminders" in f[0]][0][1]
r = post(hr, B + "/admin/meetings", rem, {})
n1 = q("select count(*) from email_logs where template='meeting_reminder' and related_id=?", soon[0][0])[0][0]
check("reminders sent for the meeting starting soon (not for later ones)", n1 == 2 and q("select count(*) from email_logs where template='meeting_reminder' and related_id=?", iid)[0][0] == 0, (n1, loc(r)))
r = post(hr, B + "/admin/meetings", rem, {})
check("pressing the button again sends nothing new", q("select count(*) from email_logs where template='meeting_reminder' and related_id=?", soon[0][0])[0][0] == n1 and "No reminders" in loc(r), loc(r))

# ---- forged actions by non-staff
cf = [f for f in forms(dp) if 'name="reason"' in f[0]][0][1]
post(ea, f"{B}/admin/meetings/{b2b}", cf, {"id": b2b, "reason": "forged"})
check("FORGED cancel by an employee is rejected", q("select status from meetings where id=?", b2b)[0][0] == "SCHEDULED")
post(ira, f"{B}/admin/meetings/{b2b}", cf, {"id": b2b, "reason": "forged"})
check("FORGED cancel by a candidate is rejected", q("select status from meetings where id=?", b2b)[0][0] == "SCHEDULED")
before = q("select count(*) from meetings")[0][0]
post(ea, B + "/admin/meetings/new", gf, {"title": "Forged meeting", "type": "INTERNAL", "date": day2, "time": "16:00", "durationMin": "30", "location": "x", "meetingLink": "", "agenda": "", "guests": "", "participants": [Bh["id"]]})
check("FORGED create by an employee is rejected", q("select count(*) from meetings")[0][0] == before)

# ---- cancel
r = post(hr, f"{B}/admin/meetings/{iid}", cf, {"id": iid, "reason": "Panel member unavailable"})
check("cancelling marks it cancelled with the reason", q("select status, cancel_reason from meetings where id=?", iid)[0] == ("CANCELLED", "Panel member unavailable"), loc(r))
cx = q("select ics_content, body_text from email_logs where template='meeting_cancel' and related_id=?", iid)
check("cancellation emails carry a CANCEL calendar entry and the reason", len(cx) == 2 and all("METHOD:CANCEL" in x[0] and "Panel member unavailable" in x[1] for x in cx))
check("candidate no longer sees the cancelled interview", "Your interview" not in ira.get(f"{B}/candidate/applications/{C['appId']}").text)
check("cancelled meeting page says so and offers no edit forms", "Cancelled" in hr.get(f"{B}/admin/meetings/{iid}").text and "Reschedule or edit" not in hr.get(f"{B}/admin/meetings/{iid}").text)
r = post(hr, f"{B}/admin/meetings/{iid}", rf, {"id": iid, "title": "x y z", "date": tomorrow, "time": "13:00", "durationMin": "30", "location": "x", "meetingLink": "", "agenda": ""})
check("a cancelled meeting cannot be rescheduled even by a forged request", "cancelled" in loc(r).lower() and q("select status from meetings where id=?", iid)[0][0] == "CANCELLED", loc(r))
r = post(hr, B + "/admin/meetings/new", gf, {"title": "Takes the freed slot", "type": "INTERNAL", "date": tomorrow, "time": "09:00", "durationMin": "30", "location": "Room 3", "meetingLink": "", "agenda": "", "guests": "", "participants": [A["id"]]})
check("the slot freed by the cancellation can be booked again", q("select count(*) from meetings where title='Takes the freed slot'")[0][0] == 1, loc(r))
check("reschedule and cancel are audited", q("select count(*) from audit_logs where entity_id=? and action in ('meeting.rescheduled','meeting.cancelled')", iid)[0][0] == 2)
print("\nFAILED:", fails if fails else "none"); sys.exit(1 if fails else 0)
