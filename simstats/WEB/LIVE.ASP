<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' LIVE.ASP?s=ID - the last 20 hits. For the site's owner they show where each
' visitor came from; for anybody else (pub=1, or not the owner) only public
' sites answer, and without addresses.
'   f=text   plain lines, newest first: what the Live box's XMLHttpRequest
'            asks for every few seconds in Simxplorer
'   w=1      a page that reloads itself every 15 seconds: a <meta> refresh
'            for Simxplorer, and a SPARK page script for Voyager, which
'            knows no <meta> refresh
VAR line AS String
VAR id AS String
VAR pub AS Bool
VAR rows AS Array OF String
VAR row AS String
viewer = CurrentUser()
line = SiteLine(REQUEST.Query("s").Trim().Upper())
pub = TRUE
IF line <> "" THEN
    IF viewer <> "" AND SF(line, 1) = viewer AND REQUEST.Query("pub") = "" THEN
        pub = FALSE
    ELSEIF SF(line, 4) <> "1" THEN
        line = ""
    END IF
END IF
IF REQUEST.Query("f") = "text" THEN
    RESPONSE.Clear()
    RESPONSE.ContentType = "text/plain"
    IF line = "" THEN
        RESPONSE.Status = "403 Forbidden"
    ELSE
        RESPONSE.Write(LiveLines(SF(line, 0), pub).Join(Chr(10)))
    END IF
    RESPONSE.End()
END IF
%><html><head><title>Live - SimStats</title><meta name="robots" content="noindex,nofollow">
<% IF REQUEST.Query("w") <> "" THEN %><meta http-equiv="refresh" content="15"><% END IF %>
</head>
<% IF REQUEST.Query("w") <> "" THEN %>
<body bgcolor="#000000" text="#00FF00" link="#FFCC00" vlink="#FFCC00" onload="Page_Load">
<script type="spark">
SUB Page_Load ()
    SYS.Sleep(15000)
    PAGE.Navigate(PAGE.Location)
END SUB
</script>
<% ELSE %>
<body bgcolor="#000000" text="#00FF00" link="#FFCC00" vlink="#FFCC00">
<% END IF %>
<% IF line = "" THEN %>
<p>There is nothing to see here: the site keeps its statistics private, or the address is wrong.</p>
<% ELSE
    id = SF(line, 0)
    rows = LiveLines(id, pub) %>
<font size="4"><b>Live: <%= H(SF(line, 2)) %></b></font> <font size="2">the last <%= LIVEROWS %> hits, as of <%= TIME.Clock %></font>
<pre><% FOR EACH row IN rows %><%= H(row) %>
<% NEXT %><% IF rows.Count = 0 THEN %>Waiting for the first visitor...<% END IF %></pre>
<font size="2"><a href="live.asp?s=<%= id %><% IF REQUEST.Query("pub") <> "" THEN %>&pub=1<% END IF %>&w=1">Reload</a><% IF REQUEST.Query("w") <> "" THEN %> (this page reloads itself every 15 seconds)<% END IF %>
<% IF pub THEN %>| <a href="public.asp?s=<%= id %>">All the stats</a><% ELSE %>| <a href="dash.asp?s=<%= id %>">All the stats</a><% END IF %></font>
<% END IF %>
</body></html>
