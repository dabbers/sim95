<%@ import file="BOOK.SPK" %>
<%
' RESET.ASP - forgotten passwords, two ways.
'   By e-mail: a member who put an address on their profile gets a link,
'   reset.asp?k=..., that works once, for an hour. It needs ColdMail on this
'   machine to send it.
'   By the machine's owner: with the user name and password from
'   C:\SYSTEM\USERS.INI (the ones the Files service takes), they give any
'   member a new password.
' Either way, every sign-in that member had ends.
VAR problem AS String
VAR said AS String
VAR u AS String
VAR k AS String
VAR who AS String
viewer = CurrentUser()
k = REQUEST.Query("k")
IF k = "" THEN k = REQUEST.Form("k")
IF k <> "" THEN
    who = ResetUser(k.Trim().Upper())
    IF who = "" THEN
        problem = "That reset link has been used, is more than an hour old, or isn't one. Ask for a new one below."
        k = ""
    ELSEIF REQUEST.Method = "POST" THEN
        IF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
            problem = "The two new passwords are different."
        ELSE
            problem = SetPassword(who, REQUEST.Form("pw"), "")
            IF problem = "" THEN
                said = "Your password is changed. Log in with it now."
                k = ""
            END IF
        END IF
    END IF
ELSEIF REQUEST.Method = "POST" AND REQUEST.Form("do") = "mail" THEN
    u = CleanName(REQUEST.Form("u"))
    IF u <> "" THEN MailReset(u)
    ' the same answer either way, so this page can't be used to find out who has an address
    said = "If " + REQUEST.Form("u").Trim() + " has an e-mail address on their profile, a link to reset the password is on its way there. It works for an hour."
ELSEIF REQUEST.Method = "POST" THEN
    u = CleanName(REQUEST.Form("u"))
    IF NOT IsOwner(REQUEST.Form("owner"), REQUEST.Form("opw")) THEN
        problem = "That is not this machine's user name and password."
    ELSEIF u = "" OR NOT UserExists(u) THEN
        problem = "There is no member called " + REQUEST.Form("u").Trim() + " here."
    ELSEIF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
        problem = "The two new passwords are different."
    ELSE
        problem = SetPassword(u, REQUEST.Form("pw"), "")
        IF problem = "" THEN said = u + " has a new password. They can log in with it now."
    END IF
END IF
%>
<%= Top("Forgot Your Password?") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<%= Notice(said) %>
<%= Notice(problem) %>
<% IF k <> "" THEN %>
<%= BoxTop("Pick a New Password for " + H(who)) %>
<form action="reset.asp" method="post"><input type="hidden" name="k" value="<%= H(k) %>">
<table cellpadding="4">
<tr><td><font size="2">New password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Change Password"></td></tr>
</table>
</form>
<% ELSE %>
<%= BoxTop("Reset It by E-mail") %>
<% IF CanMail() THEN %>
<p><font size="2">If you put an e-mail address on your profile, we'll send a link to it.</font></p>
<form action="reset.asp" method="post"><input type="hidden" name="do" value="mail">
<table cellpadding="4">
<tr><td><font size="2">User name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="E-mail Me a Link"></td></tr>
</table>
</form>
<% ELSE %>
<p><font size="2"><%= H(SERVER.Name) %> has no mail server (ColdMail), so SimBook can't send e-mail. Ask the machine's owner instead.</font></p>
<% END IF %>
<%= BoxTop("Ask the Machine's Owner") %>
<p><font size="2">Whoever runs <%= H(SERVER.Name) %> can give any member a new password
here, with the machine's own user name and password (the ones in C:\SYSTEM\USERS.INI).</font></p>
<form action="reset.asp" method="post">
<table cellpadding="4">
<tr><td><font size="2">Member's user name:</font></td><td><input name="u" size="16"></td></tr>
<tr><td><font size="2">New password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="16"></td></tr>
<tr><td colspan="2"><font size="2"><b>This machine's owner</b></font></td></tr>
<tr><td><font size="2">User name:</font></td><td><input name="owner" size="16"></td></tr>
<tr><td><font size="2">Password:</font></td><td><input type="password" name="opw" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Reset Password"></td></tr>
</table>
</form>
<% END IF %>
<p><font size="2"><a href="index.asp">Back to the login</a></font></p>
</td></tr></table>
<%= Bottom() %>
