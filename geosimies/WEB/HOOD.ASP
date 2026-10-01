<%@ import file="GEO.SPK" %>
<%
' HOOD.ASP?h=hood - the directory: every homepage in one neighborhood, or
' (with no h) the neighborhoods themselves. These links are how AskSim's
' crawler finds members' pages.
VAR hood AS String
VAR entry AS String
VAR p AS Array OF String
VAR out AS String
VAR line AS String
VAR shown AS Integer
VAR total AS Integer
viewer = CurrentUser()
hood = REQUEST.Query("h").Upper()
IF NOT IsHood(hood) THEN hood = ""
IF hood <> "" THEN
    FOR EACH line IN ReadOr(DATADIR + "\HOODS\" + hood + ".TXT", "").Lines()
        IF line = "" THEN CONTINUE
        total = total + 1
        IF out.Length > PAGEROOM THEN CONTINUE
        out = out + SiteRow(hood + "|" + line)
        shown = shown + 1
    NEXT
END IF
%>
<% IF hood = "" THEN %>
<%= Top("The Neighborhoods", "The GeoSimies neighborhoods: free homepages about UFOs and sci-fi, movies, computers, family and pets, anime, music, sports and toys.") %>
<table width="100%" cellpadding="8"><tr><td>
<h2><font color="#000080">The Neighborhoods</font></h2>
<p>Every GeoSimies homepage lives in a neighborhood, with neighbors who like the same things.
Pick one to look around.</p>
<table width="100%" cellpadding="6" cellspacing="2">
<% FOR EACH entry IN Hoods()
     p = entry.Split("|") %>
<tr><td bgcolor="<%= p[3] %>" width="120"><a href="hood.asp?h=<%= p[0].Lower() %>"><font color="#FFFFFF" size="4"><b><%= p[1] %></b></font></a></td>
<td><%= H(p[2]) %><br><font size="2" color="#808080"><%= SiteCount(p[0]) %> homepages &middot; <a href="signup.asp?h=<%= p[0].Lower() %>">move in here</a></font></td></tr>
<% NEXT %>
</table>
</td></tr></table>
<% ELSE %>
<%= Top(HoodInfo(hood, 1) + " - " + HoodInfo(hood, 2), "Free homepages in " + HoodInfo(hood, 1) + " on GeoSimies: " + HoodInfo(hood, 2)) %>
<table width="100%" cellpadding="8" bgcolor="<%= HoodInfo(hood, 3) %>"><tr><td><font color="#FFFFFF" size="6"><b><%= HoodInfo(hood, 1) %></b></font><br>
<font color="#FFFFFF"><%= H(HoodInfo(hood, 2)) %></font></td></tr></table>
<table width="100%" cellpadding="8"><tr><td>
<p><font size="2"><%= total %> homepages live here. <a href="signup.asp?h=<%= hood.Lower() %>">Move in!</a> &middot; <a href="hood.asp">All the neighborhoods</a></font></p>
<table width="100%" cellpadding="4" cellspacing="2">
<%= out %>
</table>
<% IF total = 0 THEN %><p><font size="2" color="#808080">Nobody lives here yet. Be the first!</font></p><% END IF %>
<% IF shown < total THEN %><p><font size="2" color="#808080">...and <%= total - shown %> more.</font></p><% END IF %>
</td></tr></table>
<% END IF %>
<%= Bottom() %>
