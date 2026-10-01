<%@ import file="ASK.SPK" %>
<%
' CACHE.ASP?id=N - the page as the crawler last saw it, under a banner. Handy
' when the machine it lives on has gone away.
VAR id AS String
VAR doc AS Array OF String
id = REQUEST.Query("id")
IF DocLine(id) = "" OR id.Contains("\") OR id.Contains(".") THEN RESPONSE.Redirect("index.asp")
doc = DocLine(id).Split("|")
%>
<table width="100%" cellpadding="6" cellspacing="0" border="1"><tr><td bgcolor="#F3EEF7"><font size="2">
This is <a href="index.asp"><b>AskSim</b></a>'s copy of <a href="<%= H(doc[1]) %>"><%= H(doc[1]) %></a>
as it looked on <b><%= H(doc[3]) %></b>.
<% IF doc[4] = "gone" THEN %>
<font color="#990000"><b>The real page has not answered since <%= H(doc[5]) %>.</b></font>
<% ELSE %>
The real page may have changed since.
<% END IF %>
</font></td></tr></table>
<%= ReadOr(DATADIR + "\CACHE\" + id + ".HTM", "<p>Simms has misplaced his copy of this page. Most embarrassing.</p>") %>
