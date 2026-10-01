<%@ import file="TRACK.SPK" %><%
' HIT.ASP?s=ID&p=PATH&t=TITLE&r=REFERRER - the tracking tag. Any page on any
' machine shows it as a picture; showing it counts a hit for site ID. It
' always answers with a picture (one white pixel, or with b=1 the 88x31
' counter), even for a site it doesn't know, which it then doesn't count.
' Nothing is counted for a visitor who opted out (optout.asp), for crawlers,
' for a site that is switched off, or with n=1 (the preview on code.asp).
'
' Kept small and quick on purpose: it imports only TRACK.SPK, appends one raw
' line, and updates the day's rollup.
VAR id AS String
VAR site AS String
VAR given AS String
VAR page AS String
VAR ref AS String
VAR here AS String
RESPONSE.Clear()
RESPONSE.ContentType = "image/x-sim95pic"
id = REQUEST.Query("s").Trim().Upper()
site = SiteLine(id)
IF site <> "" AND SF(site, 6) = "1" AND REQUEST.Query("n") = "" AND REQUEST.Cookie(OUTCOOKIE) <> "1" AND NOT IsRobot(REQUEST.Header("User-Agent")) THEN
    page = REQUEST.Query("p")
    ref = REQUEST.Query("r")
    ' Voyager sends no Referer, and Simxplorer only with a page; when one
    ' comes, it is the page the picture is on
    IF page = "" THEN page = REQUEST.Header("Referer")
    given = RecordHit(id, TIME.Date, TIME.Clock, REQUEST.From, REQUEST.Cookie(VIDCOOKIE), REQUEST.Header("User-Agent"), page, REQUEST.Query("t"), ref)
    IF given <> "" THEN RESPONSE.SetCookie(VIDCOOKIE, given)
END IF
IF REQUEST.Query("b") <> "" THEN
    ' the counter's picture is next to this page
    here = SERVER.ScriptName
    here = here.Substring(0, here.Length - here.Split("\")[here.Split("\").Count - 1].Length)
    IF site <> "" THEN
        RESPONSE.Write(Badge(ReadOr(here + "BADGE.PIC", ""), TotalHits(id)))
    ELSE
        RESPONSE.Write(Badge(ReadOr(here + "BADGE.PIC", ""), 0))
    END IF
ELSE
    RESPONSE.Write(Dot())
END IF
RESPONSE.End()
%>
