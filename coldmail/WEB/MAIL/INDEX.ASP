<%@ import file="MAIL.SPK" %>
<%
' INDEX.ASP - the front door: sign in or get a free ColdMail address.
VAR problem AS String
viewer = CurrentUser()
IF viewer <> "" THEN RESPONSE.Redirect("inbox.asp")
SELECT CASE REQUEST.Query("e")
    CASE "login"
        problem = "That name and password do not match."
    CASE "join"
        problem = REQUEST.Query("why")
    CASE "bye"
        problem = "You have signed out of ColdMail."
END SELECT
%>
<%= Top("Welcome") %>
<table width="100%" cellpadding="10" cellspacing="0"><tr>
<td width="55%" valign="top">
<h2><font color="#003399">Free e-mail for everyone on the network</font></h2>
<p>Get your own address, <b>you@<%= H(NET.HostName.Lower()) %></b>, and write to anybody on
any SIM95 machine that runs a mail server. Read your mail from any Voyager, anywhere.</p>
<ul>
<li>Send to people on other machines: <tt>bob@theirmachine</tt></li>
<li>Letters that cannot be delivered come back to you, with the reason</li>
<li>No ads. No spam filter either. It is 1996.</li>
</ul>
<table width="100%" cellpadding="8"><tr><td bgcolor="#EEF4FF"><font size="2">
<b>Want your own mail server?</b> Every SIM95 machine can run one.
<a href="host.asp"><b>Host ColdMail on your machine</b></a>: one small program copies it over
from here, starts it, and gives you <tt>http://yourmachine/mail/</tt>.<br><br>
Mail server on <%= H(NET.HostName.Lower()) %>:
<% IF ServerAlive() THEN %><font color="#008000"><b>running</b></font><% ELSE %><font color="#990000"><b>not running</b></font><% END IF %>
</font></td></tr></table>
</td>
<td width="45%" valign="top">
<%= Notice(problem) %>
<%= BoxTop("Sign In") %>
<form action="login.asp" method="post">
<table cellpadding="3">
<tr><td><font size="2">Mail name:</font></td><td><input name="u" size="12" maxlength="8"> <font size="2">@<%= H(NET.HostName.Lower()) %></font></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="12"></td></tr>
<tr><td></td><td><input type="submit" value="Sign In"></td></tr>
</table>
</form>
<%= BoxTop("Sign Up for ColdMail") %>
<form action="join.asp" method="post">
<table cellpadding="3">
<tr><td><font size="2">Your name:</font></td><td><input name="name" size="20" maxlength="<%= MAXNAME %>"></td></tr>
<tr><td><font size="2">Mail name:</font></td><td><input name="u" size="12" maxlength="8"> <font size="2">@<%= H(NET.HostName.Lower()) %></font></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="pw" size="12"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="12"></td></tr>
<tr><td></td><td><input type="submit" value="Sign Up"></td></tr>
</table>
</form>
</td>
</tr></table>
<%= Bottom() %>
