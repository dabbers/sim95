<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' PUBLIC.ASP?s=ID&r=1|7|30 - a site's statistics for anybody, when its owner
' made them public: the same as the dashboard, minus every visitor's address
' (no Visiting Machines, and none in the Live box).
VAR line AS String
VAR id AS String
VAR days AS Integer
viewer = CurrentUser()
line = SiteLine(REQUEST.Query("s").Trim().Upper())
IF line <> "" AND SF(line, 4) <> "1" THEN line = ""
days = RangeOf(REQUEST.Query("r"))
%>
<% IF line = "" THEN %>
<%= Top("No Such Stats") %>
<%= Notice("There are no public statistics here. The site may keep its statistics private, or the address is wrong.") %>
<% ELSE
    id = SF(line, 0) %>
<%= Top("Public Stats for " + SF(line, 2)) %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td><font size="5"><b><%= H(SF(line, 2)) %></b></font>
<br><font size="2"><a href="<%= H(SF(line, 3)) %>"><%= H(SF(line, 3)) %></a> &middot; public statistics</font></td>
<td align="right" valign="bottom"><%= RangeBar("public.asp", id, days) %></td></tr></table>
<br>
<%= Dashboard(line, days, TRUE) %>
<%= LiveBox(id, TRUE) %>
</td></tr></table>
<% END IF %>
<%= Bottom() %>
