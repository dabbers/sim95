<%@ import file="BOOK.SPK" %>
<%
' PASSWORD.ASP - change your password: the old one, then the new one twice.
' Your other sign-ins end; this one carries on.
VAR problem AS String
VAR done AS Bool
RequireLogin()
IF REQUEST.Method = "POST" THEN
    RequireToken()
    IF NOT CheckPassword(viewer, REQUEST.Form("old")) THEN
        problem = "That is not your password now."
    ELSEIF REQUEST.Form("pw") <> REQUEST.Form("pw2") THEN
        problem = "The two new passwords are different."
    ELSE
        problem = SetPassword(viewer, REQUEST.Form("pw"), SessionPath())
        IF problem = "" THEN done = TRUE
    END IF
END IF
%>
<%= Top("Change My Password") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<% IF done THEN %>
<%= Notice("Your password is changed. Anywhere else you were signed in, you have been signed out.") %>
<% END IF %>
<%= Notice(problem) %>
<%= BoxTop("Change My Password") %>
<form action="password.asp" method="post"><%= TokenField() %>
<table cellpadding="4">
<tr><td><font size="2">Password now:</font></td><td><input type="password" name="old" size="16"></td></tr>
<tr><td><font size="2">New password:</font></td><td><input type="password" name="pw" size="16"></td></tr>
<tr><td><font size="2">Again:</font></td><td><input type="password" name="pw2" size="16"></td></tr>
<tr><td></td><td><input type="submit" value="Change Password"></td></tr>
</table>
</form>
<p><font size="2"><a href="edit.asp">Back to my profile</a></font></p>
</td></tr></table>
<%= Bottom() %>
