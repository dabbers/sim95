<%@ import file="REG.SPK" %>
<%
' API.ASP?do=... - what npm talks to. Answers are plain text: JSON for info
' and search, a part as it is, and for the rest "OK ..." or "ERR why" on the
' first line.
'   GET  info&p=name               the package and its versions (JSON)
'   GET  search&q=words            [{name, version, description, owner, ...}]
'   GET  part&p=name&v=1.0.0&n=1   one part of a version's bundle
'   POST adduser  (form: u, pw, email)   makes the account, or logs in to it:
'                                  OK <token>
'   GET  whoami&u=&t=              OK <name>
'   POST begin&u=&t=&p=&v=&parts=&bytes=&sum=&deps=&desc=&kw=
'                                  (the body: the README)  OK <ticket>
'   POST put&k=ticket&n=1          (the body: the part)    OK
'   POST finish&k=ticket           OK name@version
'   POST unpublish&u=&t=&p=&v=     OK
VAR act AS String
VAR p AS String
VAR v AS String
VAR u AS String
VAR line AS String
VAR lines AS Array OF String
VAR out AS Array OF String
VAR k AS Integer
VAR n AS Integer
VAR f AS String
VAR text AS String
VAR info AS String
VAR dir AS String
VAR vdir AS String
VAR total AS Integer
VAR parts AS Integer
VAR desc AS String

RESPONSE.Clear()
RESPONSE.ContentType = "text/plain"
act = REQUEST.Query("do")
p = REQUEST.Query("p").Lower().Trim()
v = REQUEST.Query("v").Trim()
MakeDirs()

SELECT CASE act
CASE "info"
    line = PkgLine(p)
    IF line = "" THEN
        RESPONSE.Status = "404 Not Found"
        RESPONSE.Write("{" + Js("error") + ":" + Js("Not found: " + p) + "}")
        RESPONSE.End()
    END IF
    FOR EACH f IN Versions(p)
        out.Add(Js(Field(f, 0)) + ":{" + Js("parts") + ":" + Field(f, 2) + "," + Js("bytes") + ":" + Field(f, 3) + "," + Js("sum") + ":" + Js(Field(f, 4)) + "," + Js("time") + ":" + Field(f, 5) + "," + Js("date") + ":" + Js(Field(f, 6)) + "," + Js("publisher") + ":" + Js(Field(f, 7)) + "," + Js("dependencies") + ":" + DepsJson(Field(f, 8)) + "}")
    NEXT
    RESPONSE.Write("{" + Js("name") + ":" + Js(p) + "," + Js("description") + ":" + Js(Field(line, 2)) + "," + Js("dist-tags") + ":{" + Js("latest") + ":" + Js(Field(line, 1)) + "}," + Js("owner") + ":" + Js(Field(line, 3)) + "," + Js("time") + ":" + Field(line, 4) + "," + Js("keywords") + ":" + Js(Field(line, 6)) + "," + Js("downloads") + ":" + Str(Downloads(p)) + "," + Js("versions") + ":{" + out.Join(",") + "}}")

CASE "search"
    FOR EACH line IN Search(REQUEST.Query("q"))
        out.Add("{" + Js("name") + ":" + Js(Field(line, 0)) + "," + Js("version") + ":" + Js(Field(line, 1)) + "," + Js("description") + ":" + Js(Field(line, 2)) + "," + Js("owner") + ":" + Js(Field(line, 3)) + "," + Js("date") + ":" + Js(Field(line, 5)) + "," + Js("keywords") + ":" + Js(Field(line, 6)) + "}")
        IF out.Count >= 50 THEN BREAK
    NEXT
    RESPONSE.Write("[" + out.Join("," + Chr(10)) + "]")

CASE "part"
    line = VersionLine(p, v)
    n = Num(REQUEST.Query("n"), 1, MAXPARTS, 0)
    IF line = "" OR n = 0 OR NOT GoodName(p) THEN
        RESPONSE.Status = "404 Not Found"
        RESPONSE.Write("ERR There is no " + p + "@" + v + " here.")
        RESPONSE.End()
    END IF
    f = PkgDir(p) + "\" + Field(line, 1) + "\" + Str(n) + ".TXT"
    IF NOT FS.Exists(f) THEN
        RESPONSE.Status = "404 Not Found"
        RESPONSE.Write("ERR " + p + "@" + v + " has no part " + Str(n) + ".")
        RESPONSE.End()
    END IF
    IF n = 1 THEN FS.Write(PkgDir(p) + "\DL.TXT", Str(Downloads(p) + 1))
    RESPONSE.Write(FS.Read(f))

CASE "adduser"
    u = REQUEST.Form("u").Lower().Trim()
    IF NOT GoodUser(u) THEN
        RESPONSE.Write("ERR A user name is 1 to " + Str(USERMAX) + " letters, digits, - and _.")
        RESPONSE.End()
    END IF
    IF REQUEST.Form("pw").Length < 4 THEN
        RESPONSE.Write("ERR A password needs at least 4 characters.")
        RESPONSE.End()
    END IF
    line = UserLine(u)
    IF line <> "" THEN
        IF Sum(Field(line, 2) + REQUEST.Form("pw")) <> Field(line, 1) THEN
            RESPONSE.Write("ERR That isn't " + u + "'s password. (The name is taken: to make a new account, choose another.)")
            RESPONSE.End()
        END IF
        RESPONSE.Write("OK " + Field(line, 3) + Chr(10) + "Logged in as " + u + ".")
        RESPONSE.End()
    END IF
    IF NOT TakeLock() THEN
        RESPONSE.Write("ERR The registry is busy: try again.")
        RESPONSE.End()
    END IF
    f = Fresh()
    info = Fresh()
    FS.Append(DATADIR + "\USERS.TXT", u + "|" + Sum(f + REQUEST.Form("pw")) + "|" + f + "|" + info + "|" + REQUEST.Form("email").Replace("|", "").Trim() + "|" + Str(TIME.Now) + Chr(10))
    DropLock()
    RESPONSE.Write("OK " + info + Chr(10) + "Welcome, " + u + "! Your account is made.")

CASE "whoami"
    u = Who(REQUEST.Query("u").Lower(), REQUEST.Query("t"))
    IF u = "" THEN
        RESPONSE.Write("ERR Not logged in.")
    ELSE
        RESPONSE.Write("OK " + u)
    END IF

CASE "begin"
    u = Who(REQUEST.Query("u").Lower(), REQUEST.Query("t"))
    parts = Num(REQUEST.Query("parts"), 1, MAXPARTS, 0)
    total = Num(REQUEST.Query("bytes"), 1, PARTMAX * MAXPARTS, 0)
    IF u = "" THEN
        RESPONSE.Write("ERR You need to log in first: npm adduser")
    ELSEIF NOT GoodName(p) THEN
        RESPONSE.Write("ERR " + Chr(34) + p + Chr(34) + " can't be a package name: 1 to 8 of a-z, 0-9, - and _ (it is a folder name on every machine).")
    ELSEIF NOT GoodVersion(v) THEN
        RESPONSE.Write("ERR " + Chr(34) + v + Chr(34) + " isn't a version like 1.0.0.")
    ELSEIF parts = 0 OR total = 0 THEN
        RESPONSE.Write("ERR A package is 1 to " + Str(MAXPARTS) + " parts, about " + Str(PARTMAX * MAXPARTS / 1000) + " KB at most.")
    ELSEIF PkgLine(p) <> "" AND Field(PkgLine(p), 3) <> u THEN
        RESPONSE.Write("ERR " + p + " belongs to " + Field(PkgLine(p), 3) + ": you can't publish it. Pick another name.")
    ELSEIF VersionLine(p, v) <> "" THEN
        RESPONSE.Write("ERR " + p + "@" + v + " is published already: change the version (npm version patch) and publish that.")
    ELSE
        ' clear away publishes that never finished
        FOR EACH f IN FS.List(DATADIR + "\UP")
            IF NOT f.EndsWith("\") THEN CONTINUE
            dir = DATADIR + "\UP\" + f.Substring(0, f.Length - 1)
            IF TIME.Now - Int(Val(Field(ReadOr(dir + "\INFO.TXT", "0"), 0))) > STALE THEN Wipe(dir)
        NEXT
        k = 0
        f = ""
        WHILE f = "" OR FS.Exists(DATADIR + "\UP\" + f)
            f = Fresh().Substring(0, 8).Upper()
            k = k + 1
            IF k > 20 THEN BREAK
        END WHILE
        dir = DATADIR + "\UP\" + f
        FS.MakeDir(dir)
        desc = REQUEST.Query("desc").Replace("|", "/").Replace(Chr(10), " ").Replace(Chr(13), "")
        IF desc.Length > 200 THEN desc = desc.Substring(0, 200)
        FS.Write(dir + "\INFO.TXT", Str(TIME.Now) + "|" + u + "|" + p + "|" + v + "|" + Str(parts) + "|" + Str(total) + "|" + REQUEST.Query("sum").Replace("|", "") + "|" + REQUEST.Query("deps").Replace("|", "") + "|" + desc + "|" + REQUEST.Query("kw").Replace("|", " ").Lower())
        FS.Write(dir + "\README.TXT", REQUEST.Body)
        RESPONSE.Write("OK " + f)
    END IF

CASE "put", "finish"
    f = REQUEST.Query("k").Upper()
    dir = DATADIR + "\UP\" + f
    IF f.Length <> 8 OR NOT Only(f, "0123456789ABCDEF") OR NOT FS.Exists(dir + "\INFO.TXT") THEN
        RESPONSE.Write("ERR That publish isn't going on (it may have taken too long): publish again.")
        RESPONSE.End()
    END IF
    info = FS.Read(dir + "\INFO.TXT")
    parts = Int(Val(Field(info, 4)))
    IF act = "put" THEN
        n = Num(REQUEST.Query("n"), 1, parts, 0)
        text = REQUEST.Body
        IF n = 0 THEN
            RESPONSE.Write("ERR There's no part " + REQUEST.Query("n") + " in this publish.")
        ELSEIF text.Length > PARTMAX THEN
            RESPONSE.Write("ERR A part can be " + Str(PARTMAX) + " characters at most.")
        ELSE
            FS.Write(dir + "\" + Str(n) + ".TXT", text)
            RESPONSE.Write("OK")
        END IF
        RESPONSE.End()
    END IF
    ' finish: every part here, and all of it
    FOR k = 1 TO parts
        IF NOT FS.Exists(dir + "\" + Str(k) + ".TXT") THEN
            RESPONSE.Write("ERR Part " + Str(k) + " of " + Str(parts) + " never arrived: publish again.")
            RESPONSE.End()
        END IF
        total = total + FS.Read(dir + "\" + Str(k) + ".TXT").Length
    NEXT
    IF total <> Int(Val(Field(info, 5))) THEN
        Wipe(dir)
        RESPONSE.Write("ERR The package arrived damaged (" + Str(total) + " of " + Field(info, 5) + " characters): publish again.")
        RESPONSE.End()
    END IF
    u = Field(info, 1)
    p = Field(info, 2)
    v = Field(info, 3)
    IF NOT TakeLock() THEN
        RESPONSE.Write("ERR The registry is busy: try npm publish again.")
        RESPONSE.End()
    END IF
    line = PkgLine(p)
    IF line <> "" AND Field(line, 3) <> u THEN
        DropLock()
        Wipe(dir)
        RESPONSE.Write("ERR " + p + " belongs to " + Field(line, 3) + ".")
        RESPONSE.End()
    END IF
    IF VersionLine(p, v) <> "" THEN
        DropLock()
        Wipe(dir)
        RESPONSE.Write("ERR " + p + "@" + v + " is published already.")
        RESPONSE.End()
    END IF
    IF NOT FS.Exists(PkgDir(p)) THEN FS.MakeDir(PkgDir(p))
    n = Num(ReadOr(PkgDir(p) + "\NEXT.TXT", "1"), 1, 999999, 1)
    FS.Write(PkgDir(p) + "\NEXT.TXT", Str(n + 1))
    vdir = PkgDir(p) + "\V" + Str(n)
    IF FS.Exists(vdir) THEN Wipe(vdir)
    FS.MakeDir(vdir)
    FOR k = 1 TO parts
        FS.Write(vdir + "\" + Str(k) + ".TXT", FS.Read(dir + "\" + Str(k) + ".TXT"))
    NEXT
    FS.Write(vdir + "\README.TXT", ReadOr(dir + "\README.TXT", ""))
    FS.Append(PkgDir(p) + "\VERSIONS.TXT", v + "|V" + Str(n) + "|" + Str(parts) + "|" + Str(total) + "|" + Field(info, 6) + "|" + Str(TIME.Now) + "|" + TIME.Date + "|" + u + "|" + Field(info, 7) + Chr(10))
    f = Latest(Versions(p))
    desc = Field(line, 2)
    text = Field(line, 6)
    IF f = v OR line = "" THEN
        desc = Field(info, 8)
        text = Field(info, 9)
    END IF
    SetPkgLine(p, p + "|" + f + "|" + desc + "|" + u + "|" + Str(TIME.Now) + "|" + TIME.Date + "|" + text)
    DropLock()
    Wipe(dir)
    RESPONSE.Write("OK " + p + "@" + v)

CASE "unpublish"
    u = Who(REQUEST.Query("u").Lower(), REQUEST.Query("t"))
    line = PkgLine(p)
    IF u = "" THEN
        RESPONSE.Write("ERR You need to log in first: npm adduser")
    ELSEIF line = "" OR VersionLine(p, v) = "" THEN
        RESPONSE.Write("ERR There is no " + p + "@" + v + " here.")
    ELSEIF Field(line, 3) <> u THEN
        RESPONSE.Write("ERR " + p + " belongs to " + Field(line, 3) + ".")
    ELSEIF NOT TakeLock() THEN
        RESPONSE.Write("ERR The registry is busy: try again.")
    ELSE
        FOR EACH f IN Versions(p)
            IF Field(f, 0) = v THEN
                Wipe(PkgDir(p) + "\" + Field(f, 1))
            ELSE
                out.Add(f)
            END IF
        NEXT
        IF out.Count = 0 THEN
            Wipe(PkgDir(p))
            SetPkgLine(p, "")
            RESPONSE.Write("OK " + p + " is gone: that was its last version.")
        ELSE
            FS.Write(PkgDir(p) + "\VERSIONS.TXT", out.Join(Chr(10)) + Chr(10))
            SetPkgLine(p, p + "|" + Latest(out) + "|" + Field(line, 2) + "|" + u + "|" + Str(TIME.Now) + "|" + TIME.Date + "|" + Field(line, 6))
            RESPONSE.Write("OK " + p + "@" + v + " is unpublished.")
        END IF
        DropLock()
    END IF

CASE ELSE
    IF act = "" THEN
        RESPONSE.Write("This is the npm registry's API. npm talks to it; people want index.asp.")
    ELSE
        RESPONSE.Write("ERR Unknown: " + act)
    END IF
END SELECT
' (and nothing after: the line break that ends this file would go out too)
RESPONSE.End()
%>