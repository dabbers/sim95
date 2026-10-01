<%@ import file="SNIFF.SPK" %><%
' TIME.ASP - what the Live Page asks for in the background: the server's
' clock and how many requests it has answered, as "14:05:09|42". A POST
' with say= is answered too, shouted back.
VAR here AS String
VAR file AS String
VAR count AS Integer
here = SERVER.ScriptName
here = here.Substring(0, here.Length - here.Split("\")[here.Split("\").Count - 1].Length)
file = here + "HITS.TXT"
IF FS.Exists(file) THEN count = Int(Val(FS.Read(file)))
count = count + 1
FS.Write(file, Str(count))
RESPONSE.ContentType = "text/plain"
IF REQUEST.Method = "POST" THEN
    RESPONSE.Write(TIME.Clock + " " + BrowserName() + " " + BrowserVersion() + " said: " + REQUEST.Form("say").Upper() + "!")
ELSE
    RESPONSE.Write(TIME.Clock + "|" + Str(count))
END IF
RESPONSE.End()
%>
