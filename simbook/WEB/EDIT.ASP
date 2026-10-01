<%@ import file="BOOK.SPK" %>
<%
' EDIT.ASP - change your profile and picture. GET shows the form; POST saves it.
VAR rec AS Array OF String
VAR problem AS String
VAR pic AS String
VAR size AS Array OF String
VAR key AS String
VAR keys AS Array OF String
RequireLogin()
rec = LoadUser(viewer)

IF REQUEST.Method = "POST" THEN
    IF REQUEST.Form("name").Trim() = "" THEN
        problem = "Your name cannot be empty."
    ELSE
        keys = ["sex", "birthday", "hometown", "status", "interests", "music", "about"]
        FOR EACH key IN keys
            SetField(rec, key, REQUEST.Form(key).Replace(Chr(13), "").Trim())
        NEXT
        IF REQUEST.Form("name").Trim() <> Field(rec, "name") THEN
            SetField(rec, "name", REQUEST.Form("name").Trim())
            RenamePerson(viewer, REQUEST.Form("name").Trim())
        END IF
        SaveUser(viewer, rec)

        ' A picture is a Sketch .PIC file: "SIM95PIC width height", then rows of hex digits.
        pic = REQUEST.Form("pic")
        IF REQUEST.Form("nopic") <> "" AND HasPicture(viewer) THEN FS.Delete(PICDIR + "\" + viewer + ".PIC")
        IF pic <> "" THEN
            size = pic.Lines()[0].Trim().Split(" ")
            IF NOT pic.StartsWith("SIM95PIC ") OR size.Count < 3 THEN
                problem = "Your profile was saved, but that is not a picture. Draw one in Sketch and save it as a .PIC file."
            ELSEIF pic.Length > MAXPIC OR Val(size[1]) > 200 OR Val(size[2]) > 200 THEN
                problem = "Your profile was saved, but the picture is too big. Keep it under 200 by 200."
            ELSE
                EnsureDisk()
                FS.Write(PICDIR + "\" + viewer + ".PIC", pic)
            END IF
        END IF
        IF problem = "" THEN RESPONSE.Redirect("profile.asp?u=" + viewer)
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
<form action="edit.asp" method="post">
<table cellpadding="4">
<tr><td><font size="2">Name:</font></td><td><input name="name" size="30" value="<%= H(Field(rec, "name")) %>"></td></tr>
<tr><td><font size="2">Sex:</font></td><td><select name="sex"><%= Opt("", Field(rec, "sex")) %><%= Opt("Female", Field(rec, "sex")) %><%= Opt("Male", Field(rec, "sex")) %></select></td></tr>
<tr><td><font size="2">Birthday:</font></td><td><input name="birthday" size="20" value="<%= H(Field(rec, "birthday")) %>"></td></tr>
<tr><td><font size="2">Hometown:</font></td><td><input name="hometown" size="30" value="<%= H(Field(rec, "hometown")) %>"></td></tr>
<tr><td><font size="2">Relationship:</font></td><td><select name="status"><%= Opt("", Field(rec, "status")) %><%= Opt("Single", Field(rec, "status")) %><%= Opt("In a Relationship", Field(rec, "status")) %><%= Opt("Married", Field(rec, "status")) %><%= Opt("It's Complicated", Field(rec, "status")) %></select></td></tr>
<tr><td valign="top"><font size="2">Interests:</font></td><td><textarea name="interests" rows="3" cols="40"><%= H(Field(rec, "interests")) %></textarea></td></tr>
<tr><td valign="top"><font size="2">Favorite Music:</font></td><td><textarea name="music" rows="3" cols="40"><%= H(Field(rec, "music")) %></textarea></td></tr>
<tr><td valign="top"><font size="2">About Me:</font></td><td><textarea name="about" rows="5" cols="40"><%= H(Field(rec, "about")) %></textarea></td></tr>
<tr><td valign="top"><font size="2">Picture:</font></td><td><input type="file" name="pic" size="24"><br>
<font size="1" color="#808080">A .PIC file from Sketch, up to 200 by 200.</font>
<% IF HasPicture(viewer) THEN %><br><input type="checkbox" name="nopic"> <font size="2">Remove my picture</font><% END IF %></td></tr>
<tr><td></td><td><input type="submit" value="Save Changes"></td></tr>
</table>
</form>
</td></tr></table>
<%= Bottom() %>
