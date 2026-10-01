<%@ import file="TUBE.SPK" %>
<%
' INDEX.ASP - the front page: the newest movies, the most viewed, and the door in.
VAR problem AS String
VAR line AS String
VAR rec AS Array OF String
viewer = CurrentUser()
Seed()
SELECT CASE REQUEST.Query("e")
    CASE "login"
        problem = "That user name and password do not match. (Or you need to log in first.)"
    CASE "join"
        problem = REQUEST.Query("why")
    CASE "bye"
        problem = "You have logged out. See you soon."
    CASE "token"
        problem = "That did not come from a SimTube page, so nothing was changed."
END SELECT
%>
<%= Top("Home") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr>
<td valign="top">
<%= Notice(problem) %>
<%= BoxTop("Featured Movies") %>
<%= Grid(Newest(GRIDSIZE)) %>
<p><font size="2">Click a movie, then <b>Play</b>: Simxplorer plays it in its built-in SimPlayer.
On Voyager? <a href="getplay.asp">Get SimPlayer</a> from Vapor.</font></p>
</td>
<td width="210" valign="top" bgcolor="#EEEEEE">
<% IF viewer <> "" THEN
    rec = LoadUser(viewer) %>
<%= BoxTop("Hello, " + H(Field(rec, "name"))) %>
<p><font size="2"><a href="upload.asp"><b>Upload a movie</b></a><br>
<a href="logout.asp?<%= TokenArg() %>">Log out</a></font></p>
<% ELSE %>
<a name="login"></a>
<%= BoxTop("Log In") %>
<form action="login.asp" method="post">
<font size="2">User name:<br><input name="u" size="14"><br>
Password:<br><input type="password" name="pw" size="14"><br>
<input type="submit" value="Log In"></font>
</form>
<%= BoxTop("Sign Up") %>
<form action="join.asp" method="post">
<font size="2">Your name:<br><input name="name" size="18"><br>
User name:<br><input name="u" size="14"><br>
Password:<br><input type="password" name="pw" size="14"><br>
Again:<br><input type="password" name="pw2" size="14"><br>
<input type="submit" value="Sign Up"></font>
<p><font size="1" color="#808080">User names are 3 to 8 letters or digits.
Signing up lets you upload, rate and comment.</font></p>
</form>
<% END IF %>
<%= BoxTop("Most Viewed") %>
<table cellpadding="2" cellspacing="0">
<% FOR EACH line IN MostViewed(5) %>
<tr><td valign="top"><a href="watch.asp?v=<%= VF(line, 0) %>"><img src="thumb.asp?v=<%= VF(line, 0) %>" width="40" height="30" border="1" alt=""></a></td>
<td valign="top"><font size="1"><a href="watch.asp?v=<%= VF(line, 0) %>"><b><%= H(VTitle(line)) %></b></a><br><%= Plural(Views(VF(line, 0)), "view", "views") %></font></td></tr>
<% NEXT %>
</table>
<p><font size="1"><a href="top.asp">More...</a></font></p>
</td>
</tr></table>
<%= Bottom() %>
