<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' DASH.ASP?s=ID&r=1|7|30 - a site's statistics, for its owner: hits and
' visitors by day, hours, top pages, referrers, browsers, the machines
' visitors came from, and the last 20 hits (kept up to date by
' XMLHttpRequest in Simxplorer).
VAR line AS String
VAR id AS String
VAR days AS Integer
RequireLogin()
line = MySite(REQUEST.Query("s"))
id = SF(line, 0)
days = RangeOf(REQUEST.Query("r"))
%>
<%= Top("Stats for " + SF(line, 2)) %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td><font size="5"><b><%= H(SF(line, 2)) %></b></font>
<br><font size="2"><a href="<%= H(SF(line, 3)) %>"><%= H(SF(line, 3)) %></a></font></td>
<td align="right" valign="bottom"><%= RangeBar("dash.asp", id, days) %><br><font size="2"><a href="code.asp?s=<%= id %>">Get the code</a> | <a href="edit.asp?s=<%= id %>">Settings</a><% IF SF(line, 4) = "1" THEN %> | <a href="public.asp?s=<%= id %>">Public page</a><% END IF %></font></td></tr></table>
<% IF SF(line, 6) <> "1" THEN %><%= Notice("Counting is paused for this site: visits are not being counted. Switch it back on in Settings.") %><% END IF %>
<br>
<%= Dashboard(line, days, FALSE) %>
<%= LiveBox(id, FALSE) %>
</td></tr></table>
<%= Bottom() %>
