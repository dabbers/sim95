<%@ import file="ASK.SPK" %>
<%
' CACHE.ASP?id=N (or ?url=...) - the page as the crawler last saw it, under a banner. Handy
' when the machine it lives on has gone away.
VAR id AS String
VAR doc AS Array OF String
id = REQUEST.Query("id")
' CACHE.ASP?url=http://... finds the page by its address
IF id = "" AND REQUEST.Query("url") <> "" THEN
    id = DocIdOf(REQUEST.Query("url"))
    IF id = "" THEN RESPONSE.Redirect("index.asp?q=" + UrlEnc("site:" + REQUEST.Query("url").Replace("http://", "").Split("/")[0]))
END IF
IF DocLine(id) = "" OR id.Contains("\") OR id.Contains(".") THEN RESPONSE.Redirect("index.asp")
doc = DocLine(id).Split("|")
' banned since the crawler kept it: not shown, even before the crawler deletes it
IF BannedBy(doc[1], BanRules()) <> "" THEN
    RESPONSE.Write(TopFor("Removed - AskSim", "noindex,nofollow") + "<p>Simms has removed this page.</p><p><a href=""index.asp"">Ask another question</a></p>" + Bottom())
    RESPONSE.End()
END IF
%><meta name="robots" content="noindex,nofollow">
<table width="100%" cellpadding="6" cellspacing="0" border="1"><tr><td bgcolor="#F3EEF7"><font size="2">
This is <a href="index.asp"><b>AskSim</b></a>'s copy of <a href="<%= H(doc[1]) %>"><%= H(doc[1]) %></a>
as it looked on <b><%= H(doc[3]) %></b>.
<% IF doc[4] = "gone" THEN %>
<font color="#990000"><b>The real page has not answered since <%= H(doc[5]) %>.</b></font>
<% ELSE %>
The real page may have changed since.
<% END IF %>
</font></td></tr></table>
<%= NoPictures(ReadOr(DATADIR + "\CACHE\" + id + ".HTM", "<p>Simms keeps no copy of this page.</p>")) %>
