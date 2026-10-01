<%@ import file="TRACK.SPK" %>
<%@ import file="STATS.SPK" %>
<%
' INDEX.ASP - the front door: what SimStats is, and the way in. Signed in, it
' is My Sites: every site you count, with today's hits, and a form to add one.
VAR problem AS String
VAR line AS String
VAR mine AS Array OF String
VAR id AS String
indexable = TRUE
viewer = CurrentUser()
SELECT CASE REQUEST.Query("e")
    CASE "login"
        problem = "That user name and password do not match. (Or you need to log in first.)"
    CASE "join", "site"
        problem = REQUEST.Query("why")
    CASE "bye"
        problem = "You have logged out. Come back soon!"
    CASE "token"
        problem = "That did not come from a SimStats page, so nothing was changed."
    CASE "gone"
        problem = "The site was deleted, with all its statistics."
END SELECT
IF viewer <> "" THEN mine = SitesOf(viewer)
%>
<%= Top("Free Web Statistics") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td valign="top">
<%= Notice(problem) %>
<% IF viewer <> "" THEN %>
<%= BoxTop("My Sites") %>
<% IF mine.Count = 0 THEN %>
<p><font size="2">You aren't counting any sites yet. Add your first one below: it takes ten seconds.</font></p>
<% ELSE %>
<table width="100%" cellpadding="3" cellspacing="0">
<tr bgcolor="#E8F0F8"><td><font size="2"><b>Site</b></font></td><td align="right"><font size="2"><b>Today</b></font></td><td align="right"><font size="2"><b>7 days</b></font></td><td align="right"><font size="2"><b>All time</b></font></td><td></td></tr>
<% FOR EACH line IN mine
    id = SF(line, 0) %>
<tr><td><font size="2"><a href="dash.asp?s=<%= id %>"><b><%= H(SF(line, 2)) %></b></a><br><font size="1"><%= H(SF(line, 3)) %><% IF SF(line, 6) <> "1" THEN %> <font color="#CC0000">(paused)</font><% END IF %><% IF SF(line, 4) = "1" THEN %> (public)<% END IF %></font></font></td>
<td align="right"><font size="2"><%= Commas(HitsIn(id, 1)) %></font></td><td align="right"><font size="2"><%= Commas(HitsIn(id, 7)) %></font></td><td align="right"><font size="2"><%= Commas(TotalHits(id)) %></font></td>
<td align="right"><font size="2"><a href="dash.asp?s=<%= id %>">Stats</a> | <a href="code.asp?s=<%= id %>">Get the code</a> | <a href="edit.asp?s=<%= id %>">Settings</a></font></td></tr>
<% NEXT %>
</table>
<% END IF %>
<br>
<%= BoxTop("Add a Site") %>
<form action="addsite.asp" method="post"><%= TokenField() %>
<table cellpadding="3"><tr><td><font size="2">Name:</font></td><td><input name="name" size="30" maxlength="<%= MAXNAME %>"></td></tr>
<tr><td><font size="2">Address:</font></td><td><input name="url" size="30" maxlength="<%= MAXURL %>" value="http://"></td></tr>
<tr><td></td><td><input type="submit" value="Start Counting"></td></tr></table>
</form>
<% ELSE %>
<%= BoxTop("Who's visiting YOUR web site?") %>
<p><font size="3">Find out with <b>SimStats</b>, the FREE web statistics service for the SIM95 network.
Paste one line of HTML into your pages and see, live:</font></p>
<ul><font size="2">
<li><b>How many hits</b> and <b>unique visitors</b> you get, day by day</li>
<li>Your <b>most popular pages</b></li>
<li><b>Where your visitors come from</b> (referrers)</li>
<li>Which <b>browsers</b> they use: Voyager? Simxplorer?</li>
<li>What <b>time of day</b> they surf, and which machines they surf from</li>
<li>The <b>last 20 hits</b>, as they happen</li>
<li>A <b>hit counter</b> for your page, in classic LED style</li>
</font></ul>
<p><font size="2">It works on any page, on any machine: your homepage, your GeoSimies site, your SimHost.
No software to install, no banner ads, no cost. Ever.</font></p>
<p align="center"><img src="hit.asp?s=00000000&b=1&n=1" width="88" height="31" alt="A SimStats counter"></p>
<% END IF %>
</td>
<td width="220" valign="top" bgcolor="#EEEEEE">
<% IF viewer <> "" THEN %>
<%= BoxTop("Hello, " + H(NameOf(viewer))) %>
<p><font size="2"><a href="logout.asp?<%= TokenArg() %>">Log out</a></font></p>
<% ELSE %>
<%= BoxTop("Log In") %>
<form action="login.asp" method="post">
<font size="2">User name:<br><input name="u" size="14"><br>
Password:<br><input type="password" name="pw" size="14"><br>
<input type="submit" value="Log In"></font>
</form>
<a name="join"></a>
<%= BoxTop("Sign Up FREE") %>
<form action="join.asp" method="post">
<font size="2">Your name:<br><input name="name" size="18"><br>
User name:<br><input name="u" size="14"><br>
Password:<br><input type="password" name="pw" size="14"><br>
Again:<br><input type="password" name="pw2" size="14"><br>
<input type="submit" value="Sign Up"></font>
<p><font size="1" color="#808080">User names are 3 to 8 letters or digits.</font></p>
</form>
<% END IF %>
<%= BoxTop("For Visitors") %>
<p><font size="1">SimStats counts visits to the sites that use it. <a href="privacy.htm">What we keep</a>, and
<a href="optout.asp">how to not be counted</a>.</font></p>
<p><font size="1"><a href="admin.asp">Machine owner</a></font></p>
</td>
</tr></table>
<%= Bottom() %>
