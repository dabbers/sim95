<%@ import file="BOOK.SPK" %>
<%
' EDIT.ASP - change your profile. GET shows the form; POST saves it.
' The picture has its own page, PICTURE.ASP.
VAR rec AS Array OF String
VAR problem AS String
VAR key AS String
VAR keys AS Array OF String
RequireLogin()
rec = LoadUser(viewer)

IF REQUEST.Method = "POST" THEN
    RequireToken()
    IF REQUEST.Form("name").Trim() = "" THEN
        problem = "Your name cannot be empty."
    ELSE
        ' Short fields and long ones; Clip keeps every page under the 64K a message can carry.
        keys = ["sex", "birthday", "hometown", "status"]
        FOR EACH key IN keys
            SetField(rec, key, Clip(REQUEST.Form(key), SHORTFIELD))
        NEXT
        keys = ["interests", "music", "about"]
        FOR EACH key IN keys
            SetField(rec, key, Clip(REQUEST.Form(key), LONGFIELD))
        NEXT
        IF Clip(REQUEST.Form("name"), MAXNAME) <> Field(rec, "name") THEN
            SetField(rec, "name", Clip(REQUEST.Form("name"), MAXNAME))
            RenamePerson(viewer, Clip(REQUEST.Form("name"), MAXNAME))
        END IF
        SaveUser(viewer, rec)
        RESPONSE.Redirect("profile.asp?u=" + viewer)
    END IF
END IF
%>
<%= Top("Edit My Profile") %>
<table width="100%" cellpadding="8" cellspacing="0"><tr><td valign="top">
<% IF REQUEST.Query("new") = "1" THEN %>
<%= Notice("Welcome to SimBook! Tell people a little about yourself, then go find your friends.") %>
<% END IF %>
<%= Notice(problem) %>
<%= BoxTop("Edit My Profile") %>
<form action="edit.asp" method="post"><%= TokenField() %>
<table cellpadding="4">
<tr><td><font size="2">Name:</font></td><td><input name="name" size="30" maxlength="<%= MAXNAME %>" value="<%= H(Field(rec, "name")) %>"></td></tr>
<tr><td><font size="2">Sex:</font></td><td><select name="sex"><%= Opt("", Field(rec, "sex")) %><%= Opt("Female", Field(rec, "sex")) %><%= Opt("Male", Field(rec, "sex")) %></select></td></tr>
<tr><td><font size="2">Birthday:</font></td><td><input name="birthday" size="20" maxlength="<%= SHORTFIELD %>" value="<%= H(Field(rec, "birthday")) %>"></td></tr>
<tr><td><font size="2">Hometown:</font></td><td><input name="hometown" size="30" maxlength="<%= SHORTFIELD %>" value="<%= H(Field(rec, "hometown")) %>"></td></tr>
<tr><td><font size="2">Relationship:</font></td><td><select name="status"><%= Opt("", Field(rec, "status")) %><%= Opt("Single", Field(rec, "status")) %><%= Opt("In a Relationship", Field(rec, "status")) %><%= Opt("Married", Field(rec, "status")) %><%= Opt("It's Complicated", Field(rec, "status")) %></select></td></tr>
<tr><td valign="top"><font size="2">Interests:</font></td><td><%= LimitedBox("interests", Field(rec, "interests"), 3, 40, LONGFIELD) %></td></tr>
<tr><td valign="top"><font size="2">Favorite Music:</font></td><td><%= LimitedBox("music", Field(rec, "music"), 3, 40, LONGFIELD) %></td></tr>
<tr><td valign="top"><font size="2">About Me:</font></td><td><%= LimitedBox("about", Field(rec, "about"), 5, 40, LONGFIELD) %></td></tr>
<tr><td valign="top"><font size="2">Picture:</font></td><td><font size="2"><a href="picture.asp">Change my picture</a></font></td></tr>
<tr><td></td><td><input type="submit" id="go" value="Save Changes"></td></tr>
</table>
</form>
<%= LimitScript("interests,music,about", Str(LONGFIELD) + "," + Str(LONGFIELD) + "," + Str(LONGFIELD)) %>
</td></tr></table>
<%= Bottom() %>
