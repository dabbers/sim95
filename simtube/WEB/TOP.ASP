<%@ import file="TUBE.SPK" %>
<%
' TOP.ASP - Most Viewed: the movies watched most, most first.
VAR line AS String
VAR n AS Integer
viewer = CurrentUser()
%>
<%= Top("Most Viewed") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= BoxTop("Most Viewed") %>
<table width="100%" cellpadding="4" cellspacing="0">
<% FOR EACH line IN MostViewed(TOPSHOWN)
     n = n + 1 %>
<tr><td width="24" valign="top"><font size="4" color="#CC0000"><b><%= n %></b></font></td>
<td width="90" valign="top"><%= Thumb(VF(line, 0)) %></td>
<td valign="top"><font size="2"><a href="watch.asp?v=<%= VF(line, 0) %>"><b><%= H(VTitle(line)) %></b></a><br>
<%= Plural(Views(VF(line, 0)), "view", "views") %> &middot; <%= RunTime(line) %> &middot; <%= Stars(Rating(VF(line, 0))) %><br>
From: <%= H(NameOf(VF(line, 1))) %></font></td></tr>
<% NEXT %>
<% IF n = 0 THEN %><tr><td><font size="2" color="#808080">Nothing has been watched yet.</font></td></tr><% END IF %>
</table>
</td></tr></table>
<%= Bottom() %>
