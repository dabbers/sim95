<%@ import file="BOOK.SPK" %>
<%
' PEOPLE.ASP?q=text - everybody on SimBook, or everybody whose name matches.
VAR q AS String
VAR lines AS Array OF String
VAR line AS String
VAR p AS Array OF String
VAR found AS Integer
RequireLogin()
q = REQUEST.Query("q").Trim()
lines = ReadOr(DATADIR + "\PEOPLE.TXT", "").Lines()
%>
<%= Top("People") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Search") %>
<form action="people.asp" method="get">
<p><input name="q" size="30" value="<%= H(q) %>"> <input type="submit" value="Search"></p>
</form>
<%= BoxTop("People on SimBook") %>
<table cellpadding="4">
<% FOR EACH line IN lines
     p = line.Split("|")
     IF p.Count < 2 THEN CONTINUE
     IF q <> "" AND NOT (p[0].Contains(q.Lower()) OR Unesc(p[1]).Lower().Contains(q.Lower())) THEN CONTINUE
     found = found + 1
     IF found > 200 THEN BREAK %>
<tr><td><font size="2"><a href="profile.asp?u=<%= p[0] %>"><b><%= H(Unesc(p[1])) %></b></a></font></td>
<td><font size="2" color="#808080"><%= p[0] %><% IF IsFriend(viewer, p[0]) THEN %> &middot; your friend<% END IF %></font></td></tr>
<% NEXT %>
</table>
<% IF found = 0 THEN %><p><font size="2" color="#808080">Nobody found.</font></p><% END IF %>
</td></tr></table>
<%= Bottom() %>
