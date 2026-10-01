<%@ import file="GEO.SPK" %>
<%
' SIGNUP.ASP?h=hood - pick a neighborhood and an address, and move in.
VAR hood AS String
viewer = CurrentUser()
IF viewer <> "" THEN RESPONSE.Redirect("edit.asp")
hood = REQUEST.Query("h").Upper()
IF NOT IsHood(hood) THEN hood = "AREA95"
%>
<%= Top("Get a Free Homepage", "Sign up for a free GeoSimies homepage: pick a neighborhood, claim an address, and start building.") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<h2><font color="#000080">Homestead with GeoSimies!</font></h2>
<p>It's FREE and it takes a minute. Pick the neighborhood that suits you, and you get an
address there, like <b>Area95 1001</b>, and a homepage at <tt><%= H(SiteUrl()) %>area95/1001/</tt>
(and <tt><%= H(SiteUrl()) %>~yourname/</tt> for short).</p>
<%= Notice(REQUEST.Query("why")) %>
<form action="join.asp" method="post">
<table cellpadding="3">
<tr><td><font size="2">Your name:</font></td><td><input name="name" size="30"></td></tr>
<tr><td><font size="2">Member name:</font></td><td><input name="u" size="10"> <font size="1" color="#808080">3 to 7 letters or digits</font></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="12"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="12"></td></tr>
<tr><td><font size="2">Neighborhood:</font></td><td><select name="h"><%= HoodOptions(hood) %></select></td></tr>
<tr><td><font size="2">Address:</font></td><td><input name="n" size="6"> <font size="1" color="#808080">a number from <%= FIRSTNUM %> to <%= LASTNUM %>; leave it empty for the next free one</font></td></tr>
<tr><td><font size="2">Homepage title:</font></td><td><input name="title" size="40"></td></tr>
<tr><td><font size="2">Start from:</font></td><td><select name="tpl"><%= TemplateOptions() %></select></td></tr>
<tr><td></td><td><input type="submit" value="Move In!"></td></tr>
</table>
</form>
</td><td width="300" valign="top">
<%= BoxTop("The Neighborhoods", "#000080") %>
<% VAR entry AS String
   FOR EACH entry IN Hoods() %>
<p><font size="2"><b><a href="hood.asp?h=<%= entry.Split("|")[0].Lower() %>"><%= entry.Split("|")[1] %></a></b>: <%= H(entry.Split("|")[2]) %><br>
<font color="#808080">next free address: <%= FreeNumber(entry.Split("|")[0]) %></font></font></p>
<% NEXT %>
</td></tr></table>
<%= Bottom() %>
