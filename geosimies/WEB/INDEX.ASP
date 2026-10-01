<%@ import file="GEO.SPK" %>
<%
' INDEX.ASP - the front page: Cool Site of the Day, the neighborhoods, who
' just moved in, and a box to log in.
VAR problem AS String
VAR cool AS Array OF String
VAR coolLine AS String
VAR entry AS String
VAR p AS Array OF String
VAR newest AS Array OF String
VAR i AS Integer
VAR site AS String
VAR home AS String
FixUp()
viewer = CurrentUser()
SELECT CASE REQUEST.Query("e")
    CASE "login"
        problem = "Please log in first."
    CASE "bad"
        problem = "That member name and password do not match."
    CASE "bye"
        problem = "You have logged out. Come back soon!"
END SELECT
coolLine = CoolSite()
IF coolLine <> "" THEN cool = coolLine.Split("|")
newest = ReadOr(DATADIR + "\NEWEST.TXT", "").Lines()
IF viewer <> "" THEN home = HomeOf(viewer)
%>
<%= Top("Free Homepages for Everybody", "GeoSimies gives everybody on the SIM95 network a free homepage in a neighborhood: an address of your own, a page editor, templates, clip art, a hit counter, a guestbook and webrings.") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td valign="top">
<h2><font color="#000080">Welcome to GeoSimies!</font></h2>
<p>Stake your claim on the information superhighway! GeoSimies gives you a <b>FREE homepage</b>
in one of our neighborhoods, with an address of your very own. Build it right here in your browser,
add pictures, a hit counter, a guestbook, and join a webring to meet your neighbors.</p>
<% IF coolLine <> "" THEN %>
<%= BoxTop("Cool Site of the Day", "#806000") %>
<table cellpadding="6"><tr><td><a href="<%= SiteLink(cool[0], cool[1]) %>"><img src="clipart/coolsite.pic" alt="Cool Site of the Day" width="88" height="31"></a></td>
<td><font size="2"><a href="<%= SiteLink(cool[0], cool[1]) %>"><b><%= H(Unesc(cool[3])) %></b></a><br>
<%= H(Unesc(cool[4])) %><br><font color="#808080"><%= HoodInfo(cool[0], 1) %> <%= cool[1] %>, by ~<%= cool[2] %></font></font></td></tr></table>
<% END IF %>
<%= BoxTop("The Neighborhoods", "#000080") %>
<table width="100%" cellpadding="4" cellspacing="2">
<% FOR EACH entry IN Hoods()
     p = entry.Split("|") %>
<tr><td bgcolor="<%= p[3] %>" width="110"><a href="hood.asp?h=<%= p[0].Lower() %>"><font color="#FFFFFF"><b><%= p[1] %></b></font></a></td>
<td><font size="2"><%= H(p[2]) %> <font color="#808080">(<%= SiteCount(p[0]) %> homepages)</font></font></td></tr>
<% NEXT %>
</table>
</td>
<td width="260" valign="top">
<%= Notice(problem) %>
<% IF viewer <> "" THEN %>
<%= BoxTop("Welcome home, ~" + viewer, "#008000") %>
<p><font size="2"><b><a href="edit.asp">Edit my homepage</a></b><br>
<% IF home <> "" THEN %>It lives at <a href="<%= SiteLink(home.Split("|")[0], home.Split("|")[1]) %>"><%= HoodInfo(home.Split("|")[0], 1) %> <%= home.Split("|")[1] %></a>.<% END IF %></font></p>
<% ELSE %>
<%= BoxTop("Members: Log In", "#008000") %>
<form action="login.asp" method="post">
<table cellpadding="2">
<tr><td><font size="2">Member name:</font></td><td><input name="u" size="12"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="12"></td></tr>
<tr><td></td><td><input type="submit" value="Log In"></td></tr>
</table>
</form>
<p align="center"><font size="3"><b><a href="signup.asp">Get your FREE homepage now!</a></b></font></p>
<% END IF %>
<%= BoxTop("Just Moved In", "#800000") %>
<table cellpadding="2">
<% FOR i = newest.Count - 1 TO 0 STEP -1
     IF newest.Count - i > 6 THEN BREAK
     p = newest[i].Split("|")
     IF p.Count < 2 THEN CONTINUE
     site = FindSite(p[0], p[1])
     IF site = "" THEN CONTINUE %>
<tr><td><font size="2"><a href="<%= SiteLink(p[0], p[1]) %>"><%= H(SiteTitle(site)) %></a><br><font color="#808080"><%= HoodInfo(p[0], 1) %> <%= p[1] %></font></font></td></tr>
<% NEXT %>
</table>
<p><font size="2"><a href="rings.asp">Browse the webrings</a></font></p>
</td>
</tr></table>
<%= Bottom() %>
