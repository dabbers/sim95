<%@ import file="BOOK.SPK" %>
<%
' INDEX.ASP - the front door: sign in, or sign up. Members go straight to their feed.
VAR problem AS String
viewer = CurrentUser()
IF viewer <> "" THEN RESPONSE.Redirect("home.asp")
SELECT CASE REQUEST.Query("e")
    CASE "login"
        problem = "That user name and password do not match."
    CASE "join"
        problem = REQUEST.Query("why")
    CASE "bye"
        problem = "You have logged out. See you soon."
END SELECT
%>
<%= Top("Welcome") %>
<table width="100%" cellpadding="10" cellspacing="0"><tr>
<td width="55%" valign="top">
<h2><font color="#3B5998">Welcome to SimBook</font></h2>
<p>SimBook is an online directory that connects people on the SIM95 network.</p>
<p>You can use SimBook to:</p>
<ul>
<li>Look up people on the network</li>
<li>See who your friends are, and who their friends are</li>
<li>Write on your friends' Walls</li>
<li>Tell everybody what you are up to</li>
</ul>
<p><font size="2" color="#808080">Everything you write is kept on <%= H(SERVER.Name) %>'s
disk in C:\BOOKDATA, one plain text file at a time.</font></p>
</td>
<td width="45%" valign="top">
<%= Notice(problem) %>
<%= BoxTop("Login") %>
<form action="login.asp" method="post">
<table cellpadding="3">
<tr><td><font size="2">User name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Login"></td></tr>
</table>
</form>
<%= BoxTop("Register") %>
<form action="join.asp" method="post">
<table cellpadding="3">
<tr><td><font size="2">Full name:</font></td><td><input name="name" size="20"></td></tr>
<tr><td><font size="2">User name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Register"></td></tr>
</table>
<p><font size="1" color="#808080">User names are 3 to 8 letters or digits.</font></p>
</form>
</td>
</tr></table>
<%= Bottom() %>
