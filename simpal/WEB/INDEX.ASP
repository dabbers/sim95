<%@ import file="PAL.SPK" %>
<%
' INDEX.ASP - the front door: log in, or sign up and get the welcome bonus.
' Members go straight to their account.
VAR problem AS String
VAR nextPage AS String
viewer = CurrentUser()
IF viewer <> "" THEN RESPONSE.Redirect("home.asp")
nextPage = REQUEST.Query("next")
SELECT CASE REQUEST.Query("e")
    CASE "login"
        problem = "That user name and password do not match."
    CASE "join"
        problem = REQUEST.Query("why")
    CASE "bye"
        problem = "You have logged out. Thank you for using SimPal!"
END SELECT
%>
<%= Top("Welcome") %>
<table width="100%" cellpadding="10" cellspacing="0"><tr>
<td width="55%" valign="top">
<h2><font color="#003087">Send money to anyone with a SimPal account!</font></h2>
<p>SimPal is the fast, easy and <b>secure</b> way to pay and get paid on the SIM95 network.
No checks, no stamps, no waiting for the bank to open.</p>
<ul>
<li><b>Send money</b> to any member in seconds</li>
<li><b>Request money</b> from friends who owe you</li>
<li><b>Shop online</b> wherever you see the <b>Pay with SimPal</b> button</li>
<li><b>Accept payments</b> on your own web site: <a href="merchant.asp">find out how</a></li>
</ul>
<p>Sign up today and we'll put <b><%= Bucks(BONUS) %></b> in your account. <b>FREE!</b></p>
<%= Padlock() %>
<p><font size="2" color="#808080">All money is in SimBucks (&sect;), kept on <%= H(SERVER.Name) %>'s
disk in C:\PALDATA. Every penny is written in the ledger before it moves.</font></p>
</td>
<td width="45%" valign="top">
<%= Notice(problem) %>
<%= BoxTop("Member Log In") %>
<form action="login.asp" method="post">
<input type="hidden" name="next" value="<%= H(nextPage) %>">
<table cellpadding="3">
<tr><td><font size="2">User name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Log In"></td></tr>
</table>
</form>
<%= BoxTop("Sign Up - It's Free!") %>
<form action="join.asp" method="post">
<input type="hidden" name="next" value="<%= H(nextPage) %>">
<table cellpadding="3">
<tr><td><font size="2">Full name:</font></td><td><input name="name" size="20"></td></tr>
<tr><td><font size="2">User name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Sign Up"></td></tr>
</table>
<p><font size="1" color="#808080">User names are 3 to 8 letters or digits. Shops sign up the same way.</font></p>
</form>
</td>
</tr></table>
<%= Bottom() %>
